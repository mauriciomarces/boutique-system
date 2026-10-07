from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from app.config import (
    DATASET_IMBALANCED_PATH,
    DATASET_PATH,
    FEATURE_COLUMNS,
    PROCESSED_DIR,
    RANDOM_STATE,
    RAW_DIR,
    SYNTHETIC_DIR,
)
from app.features import extract_features
from app.scenarios import ANOMALY_SCENARIOS, NORMAL_SCENARIOS


UCI_REFERENCE = {
    "name": "Online Retail",
    "source": "UCI Machine Learning Repository",
    "url": "https://archive.ics.uci.edu/dataset/352/online+retail",
    "doi": "10.24432/C5BW33",
    "license": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    "records_declared": 541909,
    "note": (
        "El archivo UCI no contiene etiqueta de fraude ni de anomalía operativa de SposaBella. "
        "Se usa solo como referencia de intensidad transaccional minorista."
    ),
}


def load_uci_quantity_reference(rng: np.random.Generator) -> dict:
    """Use local UCI extract if present; never download during import or Docker build."""
    candidates = [
        RAW_DIR / "online_retail.csv",
        RAW_DIR / "OnlineRetail.csv",
        RAW_DIR / "Online Retail.csv",
        RAW_DIR / "Online Retail.xlsx",
    ]
    path = next((item for item in candidates if item.exists()), None)
    stats = {
        "used_local_file": False,
        "path": None,
        "n_rows_sampled": 0,
        "median_quantity": 3.0,
        "p75_quantity": 12.0,
        "source": UCI_REFERENCE,
    }
    if path is None:
        return stats
    try:
        if path.suffix.lower() == ".xlsx":
            frame = pd.read_excel(path, nrows=20000)
        else:
            frame = pd.read_csv(path, nrows=20000)
        if "Quantity" not in frame.columns:
            return stats
        quantities = pd.to_numeric(frame["Quantity"], errors="coerce").dropna()
        quantities = quantities[(quantities > 0) & (quantities < 100)]
        stats.update(
            {
                "used_local_file": True,
                "path": str(path),
                "n_rows_sampled": int(len(quantities)),
                "median_quantity": float(quantities.median()),
                "p75_quantity": float(quantities.quantile(0.75)),
            }
        )
    except Exception as exc:  # pragma: no cover - optional local file
        stats["error"] = str(exc)
    return stats


def sample_quantity(rng: np.random.Generator, retail_stats: dict) -> int:
    median = max(1.0, float(retail_stats["median_quantity"]))
    high = max(median + 1, float(retail_stats["p75_quantity"]))
    value = int(round(rng.uniform(1, high)))
    return max(1, min(value, 24))


def generate_training_frame(
    random_state: int = RANDOM_STATE,
    normal_per_family: int = 134,
    anomaly_per_family: int = 58,
) -> tuple[pd.DataFrame, dict, list[dict]]:
    rng = np.random.default_rng(random_state)
    retail_stats = load_uci_quantity_reference(rng)
    rows: list[dict] = []
    events_dump: list[dict] = []
    usuario = 1000

    for name, builder in NORMAL_SCENARIOS.items():
        for _ in range(normal_per_family):
            usuario += 1
            quantity = sample_quantity(rng, retail_stats)
            events = builder(usuario, rng, quantity)
            features = extract_features(events)
            rows.append(
                {
                    **features,
                    "label": 0,
                    "scenario": name,
                    "label_source": "synthetic_normal_scenario",
                }
            )
            events_dump.extend(events)

    for name, builder in ANOMALY_SCENARIOS.items():
        for _ in range(anomaly_per_family):
            usuario += 1
            quantity = sample_quantity(rng, retail_stats)
            events = builder(usuario, rng, quantity)
            features = extract_features(events)
            rows.append(
                {
                    **features,
                    "label": 1,
                    "scenario": name,
                    "label_source": "synthetic_anomaly_scenario",
                }
            )
            events_dump.extend(events)

    frame = pd.DataFrame(rows)
    frame = frame.sample(frac=1.0, random_state=random_state).reset_index(drop=True)
    summary = {
        "random_state": random_state,
        "n_rows": int(len(frame)),
        "n_normal": int((frame["label"] == 0).sum()),
        "n_anomalo": int((frame["label"] == 1).sum()),
        "uci_reference": retail_stats,
        "label_policy": (
            "label=0 si el vector proviene de un escenario NORMAL documentado; "
            "label=1 si proviene de un escenario ANÓMALO controlado. "
            "Las reglas lógicas no asignan la etiqueta."
        ),
    }
    return frame, summary, events_dump


def write_datasets(random_state: int = RANDOM_STATE) -> dict:
    frame, summary, events_dump = generate_training_frame(random_state=random_state)
    DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
    SYNTHETIC_DIR.mkdir(parents=True, exist_ok=True)
    export_columns = FEATURE_COLUMNS + ["label", "scenario", "label_source"]
    frame[export_columns].to_csv(DATASET_PATH, index=False)

    # Evaluación posterior más realista: mayoría NORMAL, sin reetiquetar.
    normal = frame[frame["label"] == 0]
    anomaly = frame[frame["label"] == 1].sample(n=max(1, len(normal) // 9), random_state=random_state)
    imbalanced = pd.concat([normal, anomaly], ignore_index=True).sample(frac=1.0, random_state=random_state)
    imbalanced[export_columns].to_csv(DATASET_IMBALANCED_PATH, index=False)

    events_path = SYNTHETIC_DIR / "sposabella_synthetic_events.jsonl"
    with events_path.open("w", encoding="utf-8") as handle:
        for event in events_dump:
            handle.write(json.dumps(event) + "\n")

    manifest = {
        **summary,
        "balanced_path": str(DATASET_PATH),
        "imbalanced_path": str(DATASET_IMBALANCED_PATH),
        "imbalanced_n_rows": int(len(imbalanced)),
        "imbalanced_n_normal": int((imbalanced["label"] == 0).sum()),
        "imbalanced_n_anomalo": int((imbalanced["label"] == 1).sum()),
        "events_path": str(events_path),
        "features": FEATURE_COLUMNS,
    }
    (PROCESSED_DIR / "dataset_manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    return manifest
