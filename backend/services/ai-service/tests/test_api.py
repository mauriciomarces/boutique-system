from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app
from app.dataset import write_datasets
from app.train_model import train_decision_tree
from app.db import save_training_run


client = TestClient(app)


def test_health():
    init_db()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "ai-service"


def test_predict_without_model():
    init_db()
    response = client.post("/predict", json={"event_count_10m": 1})
    assert response.status_code == 409


def test_train_predict_normal_and_anomalo():
    init_db()
    write_datasets(random_state=42)
    trained = client.post("/train", json={"dataset_version": "dataset-v1"})
    assert trained.status_code == 200
    body = trained.json()
    assert "metricas" in body
    assert client.get("/training").status_code == 200
    assert client.get("/metrics").status_code == 200
    assert client.get("/model").status_code == 200

    normal = client.post(
        "/predict",
        json={
            "event_count_10m": 4,
            "failed_login_count": 0,
            "failed_login_ratio": 0,
            "sales_count": 2,
            "cancelled_sales_count": 0,
            "cancellation_ratio": 0,
            "stock_change_count": 0,
            "price_change_count": 0,
            "admin_action_count": 0,
            "events_per_minute": 0.3,
        },
    )
    assert normal.status_code == 200
    assert normal.json()["clasificacion"] in {"NORMAL", "ANOMALO"}
    assert "fraude confirmado" not in normal.json()["interpretacion"].lower()

    anomalo = client.post(
        "/predict",
        json={
            "event_count_10m": 12,
            "failed_login_count": 6,
            "failed_login_ratio": 0.8,
            "sales_count": 5,
            "cancelled_sales_count": 3,
            "cancellation_ratio": 0.6,
            "stock_change_count": 2,
            "price_change_count": 1,
            "admin_action_count": 0,
            "events_per_minute": 6,
            "failed_login_rule": 1,
            "cancellation_rule": 1,
            "combined_pattern_rule": 1,
            "risk_rule_count": 3,
        },
    )
    assert anomalo.status_code == 200
    payload = anomalo.json()
    assert payload["clasificacion"] in {"NORMAL", "ANOMALO"}
    assert "factores" in payload
    assert "nivel_riesgo" in payload
