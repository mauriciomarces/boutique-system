from app.features import extract_features
from app.scenarios import (
    scenario_cancellations,
    scenario_failed_logins,
    scenario_normal_a,
    scenario_normal_busy,
    scenario_price_then_sale,
    scenario_stock_then_sale,
)
import numpy as np


def test_normal_sequence_does_not_fire_login_rule():
    rng = np.random.default_rng(0)
    features = extract_features(scenario_normal_a(1, rng, 3))
    assert features["failed_login_rule"] == 0
    assert features["sales_count"] >= 1


def test_failed_login_scenario_sets_rule():
    rng = np.random.default_rng(0)
    features = extract_features(scenario_failed_logins(2, rng, 3))
    assert features["failed_login_count"] >= 5
    assert features["failed_login_rule"] == 1


def test_cancellation_scenario():
    rng = np.random.default_rng(0)
    features = extract_features(scenario_cancellations(3, rng, 4))
    assert features["cancelled_sales_count"] >= 3
    assert features["cancellation_rule"] == 1


def test_stock_then_sale_rule():
    rng = np.random.default_rng(0)
    features = extract_features(scenario_stock_then_sale(4, rng, 2))
    assert features["stock_sale_rule"] == 1
    assert features["sales_after_stock_change"] >= 1
    assert features["risk_rule_count"] == 0


def test_price_then_sale_rule():
    rng = np.random.default_rng(0)
    features = extract_features(scenario_price_then_sale(5, rng, 2))
    assert features["price_sale_rule"] == 0
    assert features["sales_after_price_change"] >= 1


def test_high_frequency_normal_activity_is_not_an_anomaly_rule():
    rng = np.random.default_rng(0)
    features = extract_features(scenario_normal_busy(6, rng, 2))
    assert features["events_per_minute"] > 5
    assert features["risk_rule_count"] == 0


def test_moderate_frequency_failed_logins_still_trigger_the_rule():
    rng = np.random.default_rng(0)
    features = extract_features(scenario_failed_logins(7, rng, 2))
    assert features["events_per_minute"] < 2
    assert features["failed_login_rule"] == 1

def _event(event_id, kind, minute, entity="venta", entity_id="S1",
           result="EXITOSO", metadata=None, actor=7):
    from datetime import datetime, timedelta, timezone

    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return {
        "event_id": event_id,
        "timestamp": (base + timedelta(minutes=minute)).isoformat(),
        "tipo_evento": kind,
        "resultado": result,
        "entidad": entity,
        "entidad_id": entity_id,
        "usuario_id": actor,
        "metadata": metadata or {},
    }


def test_sales_count_5m_counts_successful_sales_in_window():
    events = [
        _event("S1", "VENTA_CREADA", 1, entity_id="S1"),
        _event("S2", "VENTA_CREADA", 2, entity_id="S2"),
        _event("S3", "VENTA_CREADA", 4, entity_id="S3"),
    ]
    features = extract_features(events)
    assert features["sales_count_5m"] == 3


def test_sale_without_stock_link_requires_15_minutes():
    from datetime import datetime, timedelta
    sale = _event("S1", "VENTA_CREADA", 0, entity_id="S1")
    base = datetime.fromisoformat(sale["timestamp"])
    assert extract_features([sale], base + timedelta(minutes=14))["sales_without_stock_link_count"] == 0
    assert extract_features([sale], base + timedelta(minutes=15))["sales_without_stock_link_count"] == 1


def test_stock_movement_after_sale_is_correlated():
    from datetime import datetime, timedelta
    sale = _event("S1", "VENTA_CREADA", 0, entity_id="S1")
    movement = _event("M1", "STOCK_MODIFICADO", 1, entity="variante_producto", entity_id="V1",
        metadata={"referencia_tipo": "VENTA", "tipo_movimiento": "SALIDA", "venta_id": "S1"})
    base = datetime.fromisoformat(sale["timestamp"])
    features = extract_features([sale, movement], base + timedelta(minutes=16))
    assert features["sales_after_stock_change"] == 1
    assert features["sales_without_stock_link_count"] == 0


def test_stock_movement_before_sale_is_not_correlated():
    from datetime import datetime, timedelta
    movement = _event("M1", "STOCK_MODIFICADO", -1, entity="variante_producto", entity_id="V1",
        metadata={"referencia_tipo": "VENTA", "tipo_movimiento": "SALIDA", "venta_id": "S1"})
    sale = _event("S1", "VENTA_CREADA", 0, entity_id="S1")
    base = datetime.fromisoformat(sale["timestamp"])
    features = extract_features([movement, sale], base + timedelta(minutes=15))
    assert features["sales_after_stock_change"] == 0
    assert features["sales_without_stock_link_count"] == 1


def test_events_after_reference_do_not_affect_features():
    from datetime import datetime, timedelta
    sale = _event("S1", "VENTA_CREADA", 0, entity_id="S1")
    future_sale = _event("S2", "VENTA_CREADA", 10, entity_id="S2")
    base = datetime.fromisoformat(sale["timestamp"])
    features = extract_features([sale, future_sale], base + timedelta(minutes=2))
    assert features["sales_count"] == 1
    assert features["sales_count_5m"] == 1

def test_annulled_sale_is_not_counted_as_missing_stock_link():
    from datetime import datetime, timedelta

    sale = _event("S1", "VENTA_CREADA", 0, entity="venta", entity_id="S1")
    annulment = _event(
        "A1",
        "VENTA_ANULADA",
        5,
        entity="venta",
        entity_id="S1",
    )
    reference = datetime.fromisoformat(sale["timestamp"]) + timedelta(minutes=16)

    features = extract_features([sale, annulment], reference)

    assert features["sales_without_stock_link_count"] == 0
    assert features["cancelled_sales_count"] == 1
