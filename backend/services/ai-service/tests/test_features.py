from app.features import extract_features
from app.scenarios import (
    scenario_cancellations,
    scenario_failed_logins,
    scenario_normal_a,
    scenario_price_then_sale,
    scenario_stock_then_sale,
)
import numpy as np


def test_normal_sequence_does_not_fire_login_rule():
    rng = np.random.default_rng(0)
    features = extract_features(scenario_normal_a(1, rng, 3))
    assert features["failed_login_rule"] == 0
    assert features["label"] if False else features["sales_count"] >= 1


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


def test_price_then_sale_rule():
    rng = np.random.default_rng(0)
    features = extract_features(scenario_price_then_sale(5, rng, 2))
    assert features["price_sale_rule"] == 1
