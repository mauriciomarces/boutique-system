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
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.tree import DecisionTreeClassifier, _tree

from app.db import init_db, save_training_run
from app.config import (
    CURRENT_METADATA_PATH,
    CURRENT_MODEL_PATH,
    DATASET_PATH,
    DEFAULT_TREE_PARAMS,
    MODEL_FEATURE_COLUMNS,
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
    missing = [column for column in MODEL_FEATURE_COLUMNS + ["label"] if column not in frame.columns]
    if missing:
        raise DatasetError(f"Columnas faltantes: {missing}")
    if frame["label"].isin([0, 1]).sum() != len(frame):
        raise DatasetError("label debe ser 0 (NORMAL) o 1 (ANOMALO)")
    if "scenario" not in frame.columns:
        raise DatasetError("scenario es obligatorio para separar familias de escenarios.")
    if frame["scenario"].isna().any():
        raise DatasetError("scenario no puede estar vacío.")
    features = frame[MODEL_FEATURE_COLUMNS].apply(pd.to_numeric, errors="coerce")
    if not np.isfinite(features.to_numpy(dtype=float)).all():
        raise DatasetError("Las características deben contener números finitos.")
    frame[MODEL_FEATURE_COLUMNS] = features
    return frame


def grouped_scenario_split(
    frame: pd.DataFrame,
    test_size: float,
    random_state: int,
) -> tuple[np.ndarray, np.ndarray]:
    groups = frame["scenario"].astype(str)
    labels_by_group = frame.assign(_group=groups).groupby("_group")["label"].nunique()
    if (labels_by_group != 1).any():
        raise DatasetError("Cada familia de escenario debe tener una única etiqueta.")

    for seed in range(random_state, random_state + 100):
        splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
        train_indices, test_indices = next(splitter.split(frame, frame["label"], groups))
        if (
            set(frame.iloc[train_indices]["label"]) == {0, 1}
            and set(frame.iloc[test_indices]["label"]) == {0, 1}
        ):
            return train_indices, test_indices
    raise DatasetError(
        "No se pudo construir una evaluación agrupada con ambas clases en entrenamiento y prueba."
    )


def classification_metrics(y_true: pd.Series, y_pred: np.ndarray) -> dict[str, Any]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, average="binary", zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, average="binary", zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, average="binary", zero_division=0)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "precision_por_clase": {
            "NORMAL": float(precision_score(y_true, y_pred, pos_label=0, zero_division=0)),
            "ANOMALO": float(precision_score(y_true, y_pred, pos_label=1, zero_division=0)),
        },
        "recall_por_clase": {
            "NORMAL": float(recall_score(y_true, y_pred, pos_label=0, zero_division=0)),
            "ANOMALO": float(recall_score(y_true, y_pred, pos_label=1, zero_division=0)),
        },
        "f1_por_clase": {
            "NORMAL": float(f1_score(y_true, y_pred, pos_label=0, zero_division=0)),
            "ANOMALO": float(f1_score(y_true, y_pred, pos_label=1, zero_division=0)),
        },
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist(),
        "classification_report": classification_report(
            y_true,
            y_pred,
            target_names=["NORMAL", "ANOMALO"],
            zero_division=0,
            output_dict=True,
        ),
    }


def train_decision_tree(
    dataset_path: Path | None = None,
    params: dict[str, Any] | None = None,
    dataset_version: str = "dataset-v1",
) -> dict[str, Any]:
    frame = load_dataset(dataset_path)
    tree_params = {**DEFAULT_TREE_PARAMS, **(params or {})}
    x = frame[MODEL_FEATURE_COLUMNS]
    y = frame["label"]
    random_state = int(tree_params.get("random_state", 42))
    train_indices, test_indices = grouped_scenario_split(frame, 0.25, random_state)
    x_train, x_test = x.iloc[train_indices], x.iloc[test_indices]
    y_train, y_test = y.iloc[train_indices], y.iloc[test_indices]
    evaluation_model = DecisionTreeClassifier(**tree_params)
    evaluation_model.fit(x_train, y_train)
    y_pred = evaluation_model.predict(x_test)

    metrics = classification_metrics(y_test, y_pred)
    baseline = DummyClassifier(strategy="most_frequent")
    baseline.fit(x_train, y_train)
    baseline_metrics = classification_metrics(y_test, baseline.predict(x_test))
    train_scenarios = sorted(frame.iloc[train_indices]["scenario"].astype(str).unique().tolist())
    test_scenarios = sorted(frame.iloc[test_indices]["scenario"].astype(str).unique().tolist())
    metrics.update(
        {
            "n_train": int(len(x_train)),
            "n_test": int(len(x_test)),
            "split_strategy": "GroupShuffleSplit por familia de escenario",
            "scenario_groups_train": train_scenarios,
            "scenario_groups_test": test_scenarios,
            "baseline_most_frequent": baseline_metrics,
            "f1_macro_delta_vs_baseline": float(
                metrics["f1_macro"] - baseline_metrics["f1_macro"]
            ),
        }
    )

    model = DecisionTreeClassifier(**tree_params)
    model.fit(x, y)
    importances = {
        column: float(value)
        for column, value in zip(MODEL_FEATURE_COLUMNS, model.feature_importances_)
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

    training_timestamp = datetime.now(timezone.utc)
    trained_at = training_timestamp.isoformat()
    metadata = {
        "training_id": f"train-{model_version}-{training_timestamp.strftime('%Y%m%dT%H%M%S%fZ')}",
        "model_version": model_version,
        "dataset_version": dataset_version,
        "fecha_entrenamiento": trained_at,
        "algoritmo": "DecisionTreeClassifier",
        "parametros": tree_params,
        "features": MODEL_FEATURE_COLUMNS,
        "cantidad_registros": int(len(frame)),
        "cantidad_features": len(MODEL_FEATURE_COLUMNS),
        "modelo_final_entrenado_con_dataset_completo": True,
        "metricas": metrics,
        "feature_importances": importances,
        "model_path": str(model_path),
        "dataset_path": str(dataset_path or DATASET_PATH),
        "estado": "COMPLETADO",
        "nota_academica": (
            "Etiquetas sintéticas asignadas por familia de escenario, no por registros "
            "reales ni por reglas automáticas. El conjunto de prueba mantiene familias "
            "completas fuera del entrenamiento; al ser datos sintéticos, no demuestra "
            "generalización a actividad real ni constituye prueba de fraude."
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

    init_db()
    save_training_run(metadata)

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


def decision_path_conditions(
    model: DecisionTreeClassifier,
    sample: pd.DataFrame | np.ndarray,
) -> list[str]:
    tree = model.tree_
    feature_names = getattr(model, "feature_names_in_", MODEL_FEATURE_COLUMNS)
    node_indicator = model.decision_path(sample)
    sample_values = sample.to_numpy() if isinstance(sample, pd.DataFrame) else sample
    node_index = node_indicator.indices[node_indicator.indptr[0] : node_indicator.indptr[1]]
    conditions: list[str] = []
    for node_id in node_index:
        if tree.feature[node_id] == _tree.TREE_UNDEFINED:
            continue
        name = feature_names[tree.feature[node_id]]
        threshold = tree.threshold[node_id]
        value = sample_values[0, tree.feature[node_id]]
        if value <= threshold:
            conditions.append(f"{name} <= {threshold:.3f}")
        else:
            conditions.append(f"{name} > {threshold:.3f}")
    return conditions
