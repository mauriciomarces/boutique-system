from fastapi.testclient import TestClient
import numpy as np

from app.db import init_db
from app import main as main_module
from app.main import app
from app.config import FEATURE_COLUMNS
from app.features import extract_features
from app.scenarios import ANOMALY_SCENARIOS, NORMAL_SCENARIOS

client = TestClient(app)

def feature_payload(**overrides):
    return {**{name: 0 for name in FEATURE_COLUMNS}, **overrides}

class ControlledTestModel:
    """Modelo determinista para probar el contrato de la API."""

    classes_ = np.array([0, 1])
    n_features_in_ = len(FEATURE_COLUMNS)

    def predict(self, values):
        return np.array([
            int(
                values.iloc[0].get("failed_login_rule", 0) == 1
                or values.iloc[0].get("cancellation_rule", 0) == 1
            )
        ])

    def predict_proba(self, values):
        label = int(self.predict(values)[0])
        return np.array([
            [0.9, 0.1] if label == 0 else [0.1, 0.9]
        ])



def test_health():
    init_db()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "ai-service"


def test_predict_rejects_missing_required_features():
    init_db()
    response = client.post("/predict", json={"event_count_10m": 1})
    assert response.status_code == 400
    assert "Faltan características obligatorias" in response.json()["detail"]

def test_train_predict_normal_and_anomalo(monkeypatch):
    init_db()

    trained = client.post("/train", json={"dataset_version": "dataset-v1"})
    assert trained.status_code == 409
    assert trained.json()["detail"] == (
        "Entrenamiento y publicacion temporalmente deshabilitados "
        "durante la validacion experimental. El modelo vigente no se modifica."
    )
    monkeypatch.setattr(
        main_module,
        "load_current_model",
        lambda: ControlledTestModel(),
    )
    monkeypatch.setattr(
        main_module,
        "load_current_metadata",
        lambda: {
            "model_version": "test-controlled-v1",
            "features": FEATURE_COLUMNS,
            "feature_importances": {},
        },
    )

    monkeypatch.setattr(
        main_module,
        "decision_path_conditions",
        lambda model, sample: [],
    )

    normal_features = extract_features(
        NORMAL_SCENARIOS["normal_busy"](42, np.random.default_rng(42), 4)
    )
    normal = client.post(
        "/predict",
        json={**normal_features, "input_id": "analysis-normal-high-volume"},
    )
    assert normal.status_code == 200
    assert normal.json()["clasificacion"] == "NORMAL"
    assert normal.json()["input_id"] == "analysis-normal-high-volume"
    assert "fraude confirmado" not in normal.json()["interpretacion"].lower()

    cancellation_features = extract_features(
        ANOMALY_SCENARIOS["cancellations"](43, np.random.default_rng(43), 4)
    )
    cancellation = client.post(
        "/predict",
        json={**cancellation_features, "input_id": "analysis-moderate-cancellations"},
    )
    assert cancellation.status_code == 200
    assert cancellation.json()["clasificacion"] == "ANOMALO"
    assert cancellation.json()["input_id"] == "analysis-moderate-cancellations"

    anomalo = client.post(
        "/predict",
        json={
            **extract_features(
                ANOMALY_SCENARIOS["failed_logins"](44, np.random.default_rng(44), 4)
            ),
            "input_id": "analysis-failed-logins",
        },
    )
    assert anomalo.status_code == 200
    payload = anomalo.json()
    assert payload["clasificacion"] == "ANOMALO"
    assert "factores" in payload
    assert "nivel_riesgo" in payload
    assert payload["model_version"]
    assert "sintéticos" in payload["probability_semantics"]
    assert payload["input_id"] == "analysis-failed-logins"

    negative_count = client.post(
        "/predict",
        json=feature_payload(event_count_10m=-1),
    )
    assert negative_count.status_code == 400

    invalid_rule = client.post(
        "/predict",
        json=feature_payload(failed_login_rule=2),
    )
    assert invalid_rule.status_code == 400


def test_predict_rejects_missing_required_features():
    init_db()
    response = client.post("/predict", json={"event_count_10m": 1})
    assert response.status_code == 400
    assert "Faltan características obligatorias" in response.json()["detail"]


def test_predict_rejects_unknown_model_class(monkeypatch):
    class UnknownClassModel:
        def predict(self, _values):
            return np.array([2])

    monkeypatch.setattr(main_module, "load_current_model", lambda: UnknownClassModel())
    response = client.post("/predict", json=feature_payload())
    assert response.status_code == 503
    assert response.json()["detail"] == "El modelo devolvió una clase desconocida."
