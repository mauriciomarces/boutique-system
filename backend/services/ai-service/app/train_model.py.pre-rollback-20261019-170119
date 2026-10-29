from __future__ import annotations

import json
import os
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


def publication_decision(metrics: dict[str, Any]) -> dict[str, Any]:
    """Controles técnicos mínimos para decidir la publicación."""
    anomaly_recall = float(
        metrics.get("recall_por_clase", {}).get("ANOMALO", 0.0)
    )
    macro_f1_delta = float(metrics.get("f1_macro_delta_vs_baseline", 0.0))

    checks = {
        "detecta_al_menos_una_anomalia": anomaly_recall > 0.0,
        "supera_f1_macro_baseline": macro_f1_delta > 0.0,
    }
    reasons = []
    if not checks["detecta_al_menos_una_anomalia"]:
        reasons.append(
            "El candidato no detecta anomalías en el conjunto de prueba."
        )
    if not checks["supera_f1_macro_baseline"]:
        reasons.append(
            "El F1 macro no supera al clasificador de referencia."
        )

    return {
        "aprobado": all(checks.values()),
        "controles": checks,
        "motivos_rechazo": reasons,
        "naturaleza": (
            "Controles técnicos mínimos. No certifican calidad para producción "
            "ni demuestran detección de fraude real."
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

    train_indices, test_indices = grouped_scenario_split(
        frame, 0.25, random_state
    )
    x_train, x_test = x.iloc[train_indices], x.iloc[test_indices]
    y_train, y_test = y.iloc[train_indices], y.iloc[test_indices]

    evaluation_model = DecisionTreeClassifier(**tree_params)
    evaluation_model.fit(x_train, y_train)
    y_pred = evaluation_model.predict(x_test)

    metrics = classification_metrics(y_test, y_pred)
    baseline = DummyClassifier(strategy="most_frequent")
    baseline.fit(x_train, y_train)
    baseline_metrics = classification_metrics(
        y_test, baseline.predict(x_test)
    )

    train_scenarios = sorted(
        frame.iloc[train_indices]["scenario"].astype(str).unique().tolist()
    )
    test_scenarios = sorted(
        frame.iloc[test_indices]["scenario"].astype(str).unique().tolist()
    )
    metrics.update({
        "n_train": int(len(x_train)),
        "n_test": int(len(x_test)),
        "split_strategy": "GroupShuffleSplit por familia de escenario",
        "scenario_groups_train": train_scenarios,
        "scenario_groups_test": test_scenarios,
        "baseline_most_frequent": baseline_metrics,
        "f1_macro_delta_vs_baseline": float(
            metrics["f1_macro"] - baseline_metrics["f1_macro"]
        ),
    })

    decision = publication_decision(metrics)
    approved = decision["aprobado"]

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    METRICS_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc)
    trained_at = timestamp.isoformat()
    timestamp_id = timestamp.strftime("%Y%m%dT%H%M%S%fZ")

    if approved:
        model_version = f"v{next_model_index()}"
        model = DecisionTreeClassifier(**tree_params)
        model.fit(x, y)
        importances_source = model.feature_importances_
        version_dir = MODELS_DIR / model_version
        version_dir.mkdir(parents=True, exist_ok=False)
        version_model_path = version_dir / "decision_tree.joblib"
        joblib.dump(model, version_model_path)
        model_path = str(version_model_path)
    else:
        # Los candidatos rechazados no crean una versión publicable.
        model_version = (
            f"candidate-{timestamp.strftime('%y%m%d%H%M%S%f')}"
        )
        importances_source = evaluation_model.feature_importances_
        model_path = ""

    importances = {
        column: float(value)
        for column, value in zip(MODEL_FEATURE_COLUMNS, importances_source)
    }

    metadata = {
        "training_id": f"train-{model_version}-{timestamp_id}",
        "model_version": model_version,
        "dataset_version": dataset_version,
        "fecha_entrenamiento": trained_at,
        "algoritmo": "DecisionTreeClassifier",
        "parametros": tree_params,
        "features": MODEL_FEATURE_COLUMNS,
        "cantidad_registros": int(len(frame)),
        "cantidad_features": len(MODEL_FEATURE_COLUMNS),
        "modelo_final_entrenado_con_dataset_completo": bool(approved),
        "metricas": metrics,
        "feature_importances": importances,
        "model_path": model_path,
        "dataset_path": str(dataset_path or DATASET_PATH),
        "estado": "PUBLICADO" if approved else "RECHAZADO",
        "publicacion": decision,
        "nota_academica": (
            "Las etiquetas son sintéticas y se asignan por familia de escenario. "
            "La evaluación agrupada no demuestra generalización a actividad real "
            "ni constituye prueba de fraude. Los controles de publicación son "
            "mínimos y no certifican calidad para producción."
        ),
    }

    if approved:
        # Guardar metadatos de la versión antes de cambiar el modelo actual.
        version_metadata_path = version_dir / "model_metadata.json"
        version_metadata_path.write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        # Preparar los nuevos archivos en temporales del mismo directorio.
        model_tmp = MODELS_DIR / f".decision_tree-{timestamp_id}.tmp"
        metadata_tmp = MODELS_DIR / f".model_metadata-{timestamp_id}.tmp"
        model_backup = MODELS_DIR / f".decision_tree-{timestamp_id}.previous"
        metadata_backup = MODELS_DIR / f".model_metadata-{timestamp_id}.previous"

        import shutil

        had_model = CURRENT_MODEL_PATH.exists()
        had_metadata = CURRENT_METADATA_PATH.exists()

        try:
            joblib.dump(model, model_tmp)
            metadata_tmp.write_text(
                json.dumps(metadata, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

            if had_model:
                shutil.copy2(CURRENT_MODEL_PATH, model_backup)
            if had_metadata:
                shutil.copy2(CURRENT_METADATA_PATH, metadata_backup)

            try:
                os.replace(model_tmp, CURRENT_MODEL_PATH)
                os.replace(metadata_tmp, CURRENT_METADATA_PATH)
            except Exception:
                if had_model and model_backup.exists():
                    os.replace(model_backup, CURRENT_MODEL_PATH)
                elif CURRENT_MODEL_PATH.exists():
                    CURRENT_MODEL_PATH.unlink()

                if had_metadata and metadata_backup.exists():
                    os.replace(metadata_backup, CURRENT_METADATA_PATH)
                elif CURRENT_METADATA_PATH.exists():
                    CURRENT_METADATA_PATH.unlink()
                raise
        finally:
            for temporary in (
                model_tmp, metadata_tmp, model_backup, metadata_backup
            ):
                if temporary.exists():
                    temporary.unlink()

    # Mantener el formato histórico de los archivos de métricas.
    metrics_path = METRICS_DIR / f"{model_version}.json"
    metrics_path.write_text(
        json.dumps(metrics, indent=2, ensure_ascii=False),
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
