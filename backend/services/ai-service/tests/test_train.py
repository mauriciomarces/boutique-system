from app.config import FEATURE_COLUMNS
from app.dataset import generate_training_frame, write_datasets
from app.train_model import DatasetError, load_dataset, train_decision_tree


def test_balanced_dataset_has_both_classes():
    frame, summary, _events = generate_training_frame(random_state=42, normal_per_family=4, anomaly_per_family=3)
    assert summary["n_normal"] > 0
    assert summary["n_anomalo"] > 0
    assert "label" in frame.columns
    for column in FEATURE_COLUMNS:
        assert column in frame.columns
    assert "anomaly_detected" not in frame.columns


def test_invalid_dataset_missing_label(tmp_path):
    path = tmp_path / "bad.csv"
    path.write_text("event_count_5m\n1\n", encoding="utf-8")
    try:
        load_dataset(path)
        assert False, "expected DatasetError"
    except DatasetError:
        pass


def test_write_and_train(tmp_path, monkeypatch):
    from app import config
    from app import train_model

    monkeypatch.setattr(config, "DATASET_PATH", tmp_path / "sposabella_training.csv")
    monkeypatch.setattr(config, "DATASET_IMBALANCED_PATH", tmp_path / "imbalanced.csv")
    monkeypatch.setattr(config, "PROCESSED_DIR", tmp_path)
    monkeypatch.setattr(config, "SYNTHETIC_DIR", tmp_path / "synthetic")
    monkeypatch.setattr(config, "MODELS_DIR", tmp_path / "models")
    monkeypatch.setattr(config, "METRICS_DIR", tmp_path / "metrics")
    monkeypatch.setattr(config, "CURRENT_MODEL_PATH", tmp_path / "models" / "decision_tree.joblib")
    monkeypatch.setattr(config, "CURRENT_METADATA_PATH", tmp_path / "models" / "model_metadata.json")
    monkeypatch.setattr(train_model, "DATASET_PATH", config.DATASET_PATH)
    monkeypatch.setattr(train_model, "MODELS_DIR", config.MODELS_DIR)
    monkeypatch.setattr(train_model, "METRICS_DIR", config.METRICS_DIR)
    monkeypatch.setattr(train_model, "CURRENT_MODEL_PATH", config.CURRENT_MODEL_PATH)
    monkeypatch.setattr(train_model, "CURRENT_METADATA_PATH", config.CURRENT_METADATA_PATH)

    from app import dataset as dataset_mod

    monkeypatch.setattr(dataset_mod, "DATASET_PATH", config.DATASET_PATH)
    monkeypatch.setattr(dataset_mod, "DATASET_IMBALANCED_PATH", config.DATASET_IMBALANCED_PATH)
    monkeypatch.setattr(dataset_mod, "PROCESSED_DIR", tmp_path)
    monkeypatch.setattr(dataset_mod, "SYNTHETIC_DIR", tmp_path / "synthetic")

    manifest = write_datasets(random_state=42)
    assert manifest["n_rows"] > 10
    metadata = train_decision_tree(dataset_path=config.DATASET_PATH)
    assert metadata["algoritmo"] == "DecisionTreeClassifier"
    assert "accuracy" in metadata["metricas"]
    assert config.CURRENT_MODEL_PATH.exists()
