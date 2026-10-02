from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.config import AI_PORT, DATASET_PATH, DATASET_VERSION, DEFAULT_TREE_PARAMS, FEATURE_COLUMNS
from app.db import SessionLocal, init_db, save_training_run, serialize_run, TrainingRun
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
    provided = [name for name in FEATURE_COLUMNS if name in payload]
    if not provided:
        raise HTTPException(status_code=400, detail="Debe enviar al menos una característica del modelo v1")
    values: dict[str, float] = {}
    try:
        for name in FEATURE_COLUMNS:
            values[name] = float(payload[name]) if name in payload else 0.0
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Las características deben ser numéricas") from exc
    return values


@app.post("/predict")
def predict(body: PredictRequest) -> dict[str, Any]:
    model = load_current_model()
    if model is None:
        raise HTTPException(status_code=409, detail="No hay modelo entrenado. Ejecute POST /train.")
    features = _features_from_payload(body.model_dump())
    vector = np.array([[features[name] for name in FEATURE_COLUMNS]], dtype=float)
    label = int(model.predict(vector)[0])
    probability = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(vector)[0]
        classes = list(model.classes_)
        if 1 in classes:
            probability = float(proba[classes.index(1)])
        else:
            probability = float(proba[0]) if label == 0 else None
    metadata = load_current_metadata() or {}
    conditions = decision_path_conditions(model, vector)
    response = build_response(
        label=label,
        probability=probability,
        features=features,
        importances=metadata.get("feature_importances"),
        conditions=conditions,
    )
    response["camino_arbol"] = conditions
    return response


@app.post("/train")
def train(body: TrainRequest | None = None) -> dict[str, Any]:
    body = body or TrainRequest()
    if not DATASET_PATH.exists():
        raise HTTPException(
            status_code=409,
            detail="No existe data/processed/sposabella_training.csv. Ejecute generate_dataset.py",
        )
    try:
        metadata = train_decision_tree(
            dataset_path=DATASET_PATH,
            params={
                "max_depth": body.max_depth,
                "min_samples_leaf": body.min_samples_leaf,
                "random_state": 42,
            },
            dataset_version=body.dataset_version,
        )
    except DatasetError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    save_training_run(metadata)
    return metadata


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
