from app.config import FEATURE_COLUMNS, MODEL_FEATURE_COLUMNS
from app.dataset import generate_training_frame, write_datasets
from app.train_model import DatasetError, grouped_scenario_split, load_dataset, train_decision_tree


def test_balanced_dataset_has_both_classes():
    frame, summary, _events = generate_training_frame(random_state=42, normal_per_family=4, anomaly_per_family=3)
    assert summary["n_normal"] > 0
    assert summary["n_anomalo"] > 0
    assert "label" in frame.columns
    assert "label_source" in frame.columns
    train_indices, test_indices = grouped_scenario_split(frame, 0.25, 42)
    train_scenarios = set(frame.iloc[train_indices]["scenario"])
    test_scenarios = set(frame.iloc[test_indices]["scenario"])
    assert train_scenarios.isdisjoint(test_scenarios)
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
    assert "confusion_matrix" in metadata["metricas"]
    assert "f1_por_clase" in metadata["metricas"]
    assert "f1_macro" in metadata["metricas"]
    assert "baseline_most_frequent" in metadata["metricas"]
    assert metadata["metricas"]["scenario_groups_test"]
    assert metadata["parametros"]["max_depth"] == 5
    assert metadata["features"] == MODEL_FEATURE_COLUMNS
    assert not {
        "event_count_5m",
        "event_count_10m",
        "event_count_30m",
        "events_per_minute",
        "time_since_last_login",
        "time_since_last_stock_change",
        "time_since_last_price_change",
        "failed_login_rule",
        "cancellation_rule",
        "stock_sale_rule",
        "price_sale_rule",
        "admin_activity_rule",
        "combined_pattern_rule",
        "risk_rule_count",
    }.intersection(metadata["features"])
    if metadata["estado"] == "PUBLICADO":
        assert metadata["modelo_final_entrenado_con_dataset_completo"] is True
        assert metadata["publicacion"]["aprobado"] is True
        assert config.CURRENT_MODEL_PATH.exists()
        assert config.CURRENT_METADATA_PATH.exists()
        assert metadata["model_path"]
    else:
        assert metadata["estado"] == "RECHAZADO"
        assert metadata["modelo_final_entrenado_con_dataset_completo"] is False
        assert metadata["publicacion"]["aprobado"] is False
        assert not config.CURRENT_MODEL_PATH.exists()
        assert not config.CURRENT_METADATA_PATH.exists()
        assert metadata["model_path"] == ""
