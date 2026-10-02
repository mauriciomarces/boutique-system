from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = Path(os.getenv("AI_DATA_DIR", BASE_DIR / "data"))
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
SYNTHETIC_DIR = DATA_DIR / "synthetic"
MODELS_DIR = Path(os.getenv("AI_MODELS_DIR", BASE_DIR / "models"))
METRICS_DIR = Path(os.getenv("AI_METRICS_DIR", BASE_DIR / "metrics"))

DATASET_PATH = PROCESSED_DIR / "sposabella_training.csv"
DATASET_IMBALANCED_PATH = PROCESSED_DIR / "sposabella_training_imbalanced.csv"
CURRENT_MODEL_PATH = MODELS_DIR / "decision_tree.joblib"
CURRENT_METADATA_PATH = MODELS_DIR / "model_metadata.json"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{(BASE_DIR / 'data' / 'training_history.sqlite').as_posix()}",
)

AI_PORT = int(os.getenv("PORT", "4008"))
DATASET_VERSION = os.getenv("DATASET_VERSION", "dataset-v1")
RANDOM_STATE = 42

DEFAULT_TREE_PARAMS = {
    "criterion": "gini",  # ALGORITMO CART
    "splitter": "best",
    "max_depth": 5,
    "min_samples_leaf": 5,
    "random_state": RANDOM_STATE,
}

FEATURE_COLUMNS = [
    "event_count_5m",
    "event_count_10m",
    "event_count_30m",
    "failed_login_count",
    "successful_login_count",
    "failed_login_ratio",
    "sales_count",
    "cancelled_sales_count",
    "cancellation_ratio",
    "stock_change_count",
    "price_change_count",
    "admin_action_count",
    "role_change_count",
    "user_change_count",
    "sales_after_stock_change",
    "sales_after_price_change",
    "time_since_last_login",
    "time_since_last_stock_change",
    "time_since_last_price_change",
    "events_per_minute",
    "unique_entities_modified",
    "failed_login_rule",
    "cancellation_rule",
    "stock_sale_rule",
    "price_sale_rule",
    "admin_activity_rule",
    "combined_pattern_rule",
    "risk_rule_count",
]

for directory in (RAW_DIR, PROCESSED_DIR, SYNTHETIC_DIR, MODELS_DIR, METRICS_DIR):
    directory.mkdir(parents=True, exist_ok=True)
