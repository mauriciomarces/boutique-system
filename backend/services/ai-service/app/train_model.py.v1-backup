from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, _tree

from app.config import (
    CURRENT_METADATA_PATH,
    CURRENT_MODEL_PATH,
    DATASET_PATH,
    DEFAULT_TREE_PARAMS,
    FEATURE_COLUMNS,
    METRICS_DIR,
    MODELS_DIR,
)


class DatasetError(ValueError):
    pass


def load_dataset(path: Path | None = None) -> pd.DataFrame:
    dataset_path = path or DATASET_PATH
    if not dataset_path.exists():
        raise DatasetError(f"No existe el dataset: {dataset_path}")
    frame = pd.read_csv(dataset_path)
    missing = [column for column in FEATURE_COLUMNS + ["label"] if column not in frame.columns]
    if missing:
        raise DatasetError(f"Columnas faltantes: {missing}")
    if frame["label"].isin([0, 1]).sum() != len(frame):
        raise DatasetError("label debe ser 0 (NORMAL) o 1 (ANOMALO)")
    return frame


def train_decision_tree(
    dataset_path: Path | None = None,
    params: dict[str, Any] | None = None,
    dataset_version: str = "dataset-v1",
) -> dict[str, Any]:
    frame = load_dataset(dataset_path)
    tree_params = {**DEFAULT_TREE_PARAMS, **(params or {})}
    x = frame[FEATURE_COLUMNS]
    y = frame["label"]
    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.25,
        random_state=tree_params.get("random_state", 42),
        stratify=y,
    )
    model = DecisionTreeClassifier(**tree_params)
    model.fit(x_train, y_train)
    y_pred = model.predict(x_test)

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, average="binary", zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, average="binary", zero_division=0)),
        "f1_score": float(f1_score(y_test, y_pred, average="binary", zero_division=0)),
        "precision_por_clase": {
            "NORMAL": float(precision_score(y_test, y_pred, pos_label=0, zero_division=0)),
            "ANOMALO": float(precision_score(y_test, y_pred, pos_label=1, zero_division=0)),
        },
        "recall_por_clase": {
            "NORMAL": float(recall_score(y_test, y_pred, pos_label=0, zero_division=0)),
            "ANOMALO": float(recall_score(y_test, y_pred, pos_label=1, zero_division=0)),
        },
        "f1_por_clase": {
            "NORMAL": float(f1_score(y_test, y_pred, pos_label=0, zero_division=0)),
            "ANOMALO": float(f1_score(y_test, y_pred, pos_label=1, zero_division=0)),
        },
        "confusion_matrix": confusion_matrix(y_test, y_pred, labels=[0, 1]).tolist(),
        "classification_report": classification_report(
            y_test,
            y_pred,
            target_names=["NORMAL", "ANOMALO"],
            zero_division=0,
            output_dict=True,
        ),
        "n_train": int(len(x_train)),
        "n_test": int(len(x_test)),
    }

    importances = {
        column: float(value)
        for column, value in zip(FEATURE_COLUMNS, model.feature_importances_)
    }

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    METRICS_DIR.mkdir(parents=True, exist_ok=True)

    next_index = next_model_index()
    model_version = f"v{next_index}"
    version_dir = MODELS_DIR / model_version
    version_dir.mkdir(parents=True, exist_ok=True)
    model_path = version_dir / "decision_tree.joblib"
    joblib.dump(model, model_path)
    joblib.dump(model, CURRENT_MODEL_PATH)

    trained_at = datetime.now(timezone.utc).isoformat()
    metadata = {
        "training_id": f"train-{model_version}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
        "model_version": model_version,
        "dataset_version": dataset_version,
        "fecha_entrenamiento": trained_at,
        "algoritmo": "DecisionTreeClassifier",
        "parametros": tree_params,
        "features": FEATURE_COLUMNS,
        "cantidad_registros": int(len(frame)),
        "cantidad_features": len(FEATURE_COLUMNS),
        "metricas": metrics,
        "feature_importances": importances,
        "model_path": str(model_path),
        "dataset_path": str(dataset_path or DATASET_PATH),
        "estado": "COMPLETADO",
        "nota_academica": (
            "La clasificación es una señal de riesgo experimental. "
            "No constituye prueba de fraude ni usa etiquetas reales de SposaBella."
        ),
    }

    (version_dir / "model_metadata.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )
    CURRENT_METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (METRICS_DIR / f"{model_version}.json").write_text(
        json.dumps(metrics, indent=2),
        encoding="utf-8",
    )
    return metadata


def next_model_index() -> int:
    existing = [
        int(path.name[1:])
        for path in MODELS_DIR.glob("v*")
        if path.is_dir() and path.name[1:].isdigit()
    ]
    return (max(existing) + 1) if existing else 1


def load_current_model():
    if not CURRENT_MODEL_PATH.exists():
        return None
    return joblib.load(CURRENT_MODEL_PATH)


def load_current_metadata() -> dict[str, Any] | None:
    if not CURRENT_METADATA_PATH.exists():
        return None
    return json.loads(CURRENT_METADATA_PATH.read_text(encoding="utf-8"))


def decision_path_conditions(model: DecisionTreeClassifier, sample: np.ndarray) -> list[str]:
    tree = model.tree_
    feature_names = FEATURE_COLUMNS
    node_indicator = model.decision_path(sample)
    node_index = node_indicator.indices[node_indicator.indptr[0] : node_indicator.indptr[1]]
    conditions: list[str] = []
    for node_id in node_index:
        if tree.feature[node_id] == _tree.TREE_UNDEFINED:
            continue
        name = feature_names[tree.feature[node_id]]
        threshold = tree.threshold[node_id]
        value = sample[0, tree.feature[node_id]]
        if value <= threshold:
            conditions.append(f"{name} <= {threshold:.3f}")
        else:
            conditions.append(f"{name} > {threshold:.3f}")
    return conditions
