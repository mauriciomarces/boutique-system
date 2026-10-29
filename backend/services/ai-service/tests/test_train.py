import pandas as pd
import pytest

from app.config import MODEL_FEATURE_COLUMNS
from app.train_model import (
    DatasetError,
    grouped_scenario_split,
    load_dataset,
    train_decision_tree,
)


def experimental_frame():
    rows = []
    for family_index in range(8):
        family = f"familia_{family_index}"
        for index in range(20):
            label = index % 2
            row = {column: 0 for column in MODEL_FEATURE_COLUMNS}
            row["failed_login_count"] = (
                (index % 5) + 5 if label else index % 3
            )
            row["sales_count_5m"] = (
                (index % 6) + 6 if label else index % 4
            )
            row["unique_entities_modified"] = family_index * 20 + index + 1
            row.update({
                "label": label,
                "scenario": family,
                "case_id": f"{family}-{index}",
            })
            rows.append(row)
    return pd.DataFrame(rows)


def test_grouped_split_keeps_families_separate_and_both_classes():
    frame = experimental_frame()
    train_indices, test_indices = grouped_scenario_split(frame, 0.25, 42)
    train, test = frame.iloc[train_indices], frame.iloc[test_indices]

    assert set(train["scenario"]).isdisjoint(set(test["scenario"]))
    assert set(train["label"]) == {0, 1}
    assert set(test["label"]) == {0, 1}


def test_invalid_dataset_missing_label(tmp_path):
    path = tmp_path / "bad.csv"
    path.write_text("event_count_5m\n1\n", encoding="utf-8")
    with pytest.raises(DatasetError):
        load_dataset(path)


def test_evaluation_does_not_publish_or_persist(tmp_path, monkeypatch):
    from app import train_model

    dataset_path = tmp_path / "experimental.csv"
    experimental_frame().to_csv(dataset_path, index=False)

    models_dir = tmp_path / "models"
    metrics_dir = tmp_path / "metrics"
    models_dir.mkdir()
    metrics_dir.mkdir()

    current_model = models_dir / "decision_tree.joblib"
    current_metadata = models_dir / "model_metadata.json"
    current_model.write_bytes(b"model-sentinel")
    current_metadata.write_bytes(b"metadata-sentinel")

    monkeypatch.setattr(train_model, "MODELS_DIR", models_dir)
    monkeypatch.setattr(train_model, "METRICS_DIR", metrics_dir)
    monkeypatch.setattr(train_model, "CURRENT_MODEL_PATH", current_model)
    monkeypatch.setattr(train_model, "CURRENT_METADATA_PATH", current_metadata)

    result = train_decision_tree(dataset_path=dataset_path)

    assert result["estado"] == "EVALUACION_EXPERIMENTAL"
    assert result["model_path"] == ""
    assert result["modelo_final_entrenado_con_dataset_completo"] is False
    assert "confusion_matrix" in result["metricas"]
    assert "f1_macro" in result["metricas"]
    assert "baseline_most_frequent" in result["metricas"]
    assert result["metricas"]["scenario_groups_test"]
    assert result["features"] == list(MODEL_FEATURE_COLUMNS)

    assert current_model.read_bytes() == b"model-sentinel"
    assert current_metadata.read_bytes() == b"metadata-sentinel"
    assert {p.name for p in models_dir.iterdir()} == {
        "decision_tree.joblib",
        "model_metadata.json",
    }
    assert list(metrics_dir.iterdir()) == []


def test_grouped_split_rejects_too_few_families():
    frame = experimental_frame()
    frame = frame[frame["scenario"].isin(["familia_0", "familia_1"])]
    with pytest.raises(DatasetError):
        grouped_scenario_split(frame, 0.25, 42)