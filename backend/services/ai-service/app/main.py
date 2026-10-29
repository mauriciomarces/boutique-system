from __future__ import annotations

from uuid import uuid4
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.config import (
    AI_PORT,
    DATASET_PATH,
    DATASET_VERSION,
    DEFAULT_TREE_PARAMS,
    FEATURE_COLUMNS,
)
from app.db import SessionLocal, init_db, serialize_run, TrainingRun
from app.explain import build_response
from app.train_model import (
    DatasetError,
    decision_path_conditions,
    load_current_metadata,
    load_current_model,
    train_decision_tree,
)

app = FastAPI(
    title="SposaBella AI Service",
    description=(
        "Entrenamiento y predicción experimental con Árbol de Decisión. "
        "No demuestra fraude; clasifica comportamiento como NORMAL o ANÓMALO."
    ),
    version="1.0.0",
)


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    input_id: str | None = Field(default=None, min_length=1, max_length=120)


class TrainRequest(BaseModel):
    dataset_version: str = DATASET_VERSION
    max_depth: int = Field(default=DEFAULT_TREE_PARAMS["max_depth"], ge=2, le=20)
    min_samples_leaf: int = Field(default=DEFAULT_TREE_PARAMS["min_samples_leaf"], ge=1, le=50)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "ai-service",
        "port": AI_PORT,
        "model_loaded": load_current_model() is not None,
    }


def _features_from_payload(payload: dict[str, Any]) -> dict[str, float]:
    missing = [name for name in FEATURE_COLUMNS if name not in payload]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan características obligatorias del modelo v1: {', '.join(missing)}",
        )
    values: dict[str, float] = {}
    try:
        for name in FEATURE_COLUMNS:
            value = float(payload[name])
            if not np.isfinite(value):
                raise ValueError(name)
            values[name] = value
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Todas las características obligatorias deben ser números finitos.",
        ) from exc

    non_negative = {
        name
        for name in FEATURE_COLUMNS
        if name.endswith("_count")
        or name in {
            "event_count_5m",
            "event_count_10m",
            "event_count_30m",
            "sales_count",
            "cancelled_sales_count",
            "sales_after_stock_change",
            "sales_after_price_change",
            "events_per_minute",
            "unique_entities_modified",
            "time_since_last_login",
            "time_since_last_stock_change",
            "time_since_last_price_change",
        }
    }
    if any(values[name] < 0 for name in non_negative):
        raise HTTPException(status_code=400, detail="Las características de conteo y tiempo no pueden ser negativas.")
    count_features = {
        name
        for name in FEATURE_COLUMNS
        if name.endswith("_count")
        or name in {
            "event_count_5m",
            "event_count_10m",
            "event_count_30m",
            "sales_count",
            "cancelled_sales_count",
            "sales_after_stock_change",
            "sales_after_price_change",
            "unique_entities_modified",
        }
    }
    if any(not values[name].is_integer() for name in count_features):
        raise HTTPException(status_code=400, detail="Las características de conteo deben ser enteros.")
    if any(not 0 <= values[name] <= 1 for name in ("failed_login_ratio", "cancellation_ratio")):
        raise HTTPException(status_code=400, detail="Las proporciones deben estar entre 0 y 1.")
    rule_features = {
        "failed_login_rule",
        "cancellation_rule",
        "stock_sale_rule",
        "price_sale_rule",
        "admin_activity_rule",
        "combined_pattern_rule",
    }
    if any(values[name] not in (0, 1) for name in rule_features):
        raise HTTPException(status_code=400, detail="Las características de regla deben ser 0 o 1.")
    return values


@app.post("/predict")
def predict(body: PredictRequest) -> dict[str, Any]:
    features = _features_from_payload(body.model_dump())

    model = load_current_model()
    if model is None:
        raise HTTPException(
            status_code=409,
            detail="No hay modelo entrenado. Ejecute POST /train.",
        )

    metadata = load_current_metadata() or {}
    model_features = metadata.get(
        "features",
        list(getattr(model, "feature_names_in_", FEATURE_COLUMNS)),
    )
    if (
        not isinstance(model_features, list)
        or not model_features
        or any(not isinstance(name, str) or name not in features for name in model_features)
        or (
            hasattr(model, "n_features_in_")
            and len(model_features) != int(model.n_features_in_)
        )
    ):
        raise HTTPException(status_code=503, detail="Los metadatos del modelo no contienen características válidas.")
    model_input = pd.DataFrame(
        [[features[name] for name in model_features]],
        columns=model_features,
        dtype=float,
    )
    vector = model_input.to_numpy()
    label = int(model.predict(model_input)[0])
    if label not in (0, 1):
        raise HTTPException(status_code=503, detail="El modelo devolvió una clase desconocida.")
    probability = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(model_input)[0]
        classes = list(model.classes_)
        if 1 in classes:
            probability = float(proba[classes.index(1)])
    conditions = decision_path_conditions(model, model_input)
    response = build_response(
        label=label,
        probability=probability,
        features=features,
        importances=metadata.get("feature_importances"),
        conditions=conditions,
    )
    response["camino_arbol"] = conditions
    response["model_version"] = metadata.get("model_version", "desconocida")
    response["input_id"] = body.input_id or str(uuid4())
    response["probability_semantics"] = (
        "probabilidad estimada por predict_proba para la clase ANOMALO; "
        "el modelo fue entrenado con escenarios sintéticos y no está calibrada "
        "como probabilidad de fraude real"
    )
    return response


@app.post("/train")
def train(body: TrainRequest | None = None) -> dict[str, Any]:
    raise HTTPException(
        status_code=409,
        detail=(
            "Entrenamiento y publicacion temporalmente deshabilitados "
            "durante la validacion experimental. El modelo vigente no se modifica."
        ),
    )
@app.get("/training")
def list_training() -> list[dict[str, Any]]:
    session = SessionLocal()
    try:
        rows = session.query(TrainingRun).order_by(TrainingRun.fecha.desc()).all()
        return [serialize_run(row) for row in rows]
    finally:
        session.close()


@app.get("/training/{training_id}")
def get_training(training_id: str) -> dict[str, Any]:
    session = SessionLocal()
    try:
        row = session.get(TrainingRun, training_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Entrenamiento no encontrado")
        return serialize_run(row)
    finally:
        session.close()


@app.get("/metrics")
def metrics() -> dict[str, Any]:
    items = list_training()
    if not items:
        return {"entrenamientos": [], "mensaje": "No existen entrenamientos registrados."}
    current = load_current_metadata()
    return {
        "actual": current["metricas"] if current else None,
        "historial": [
            {
                "training_id": item["training_id"],
                "model_version": item["model_version"],
                "accuracy": item["accuracy"],
                "precision": item["precision"],
                "recall": item["recall"],
                "f1_score": item["f1_score"],
            }
            for item in items
        ],
    }


@app.get("/model")
def current_model() -> dict[str, Any]:
    metadata = load_current_metadata()
    if metadata is None:
        raise HTTPException(status_code=404, detail="No existe un modelo actual.")
    return metadata
