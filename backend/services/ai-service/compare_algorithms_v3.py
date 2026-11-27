import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    accuracy_score, confusion_matrix
)

BASE = Path(__file__).resolve().parent
ROOT = BASE / "data" / "synthetic" / "expansion_v3"
DATASET = ROOT / "training_v3.csv"
OUTPUT = ROOT / "algorithm_comparison_v3.json"

FEATURES = [
    "failed_login_count", "successful_login_count",
    "failed_login_ratio", "sales_count_5m", "sales_count",
    "sales_without_stock_link_count", "cancelled_sales_count",
    "cancellation_ratio", "stock_change_count", "price_change_count",
    "admin_action_count", "role_change_count", "user_change_count",
    "sales_after_stock_change", "sales_after_price_change",
    "unique_entities_modified"
]

HOLDOUT = {"alcance_administrativo", "patron_combinado"}
EXPECTED_SHA256 = "e8ac69f554eb39740aaac21857d79cbfecaaee1f8e909743cae62af8efa67e77"


def entropy(counts):
    total = counts.sum()
    if total == 0:
        return 0.0
    p = counts[counts > 0] / total
    return float(-np.sum(p * np.log2(p)))


class ExperimentalTree:
    def __init__(self, criterion, max_depth=5, min_leaf=5):
        self.criterion = criterion
        self.max_depth = max_depth
        self.min_leaf = min_leaf
        self.root = None

    def fit(self, X, y):
        self.X = np.asarray(X, dtype=float)
        self.y = np.asarray(y, dtype=int)
        self.root = self._build(np.arange(len(self.y)), 0)
        return self

    def _build(self, indices, depth):
        labels = self.y[indices]
        counts = np.bincount(labels, minlength=2)
        prediction = int(np.argmax(counts))

        node = {"prediction": prediction, "feature": None}

        if (depth >= self.max_depth or len(indices) < 2 * self.min_leaf
                or np.count_nonzero(counts) < 2):
            return node

        parent_entropy = entropy(counts)
        best = None
        candidates = []

        for feature in range(self.X.shape[1]):
            values = self.X[indices, feature]
            order = np.argsort(values, kind="mergesort")
            sorted_values = values[order]
            sorted_labels = labels[order]

            boundaries = np.flatnonzero(
                sorted_values[:-1] < sorted_values[1:]
            )
            boundaries = boundaries[
                (boundaries + 1 >= self.min_leaf) &
                (len(indices) - boundaries - 1 >= self.min_leaf)
            ]

            if len(boundaries) == 0:
                continue

            cumulative_ones = np.cumsum(sorted_labels)
            left_n = boundaries + 1
            left_ones = cumulative_ones[boundaries]
            right_n = len(indices) - left_n
            right_ones = counts[1] - left_ones

            left_entropy = np.array([
                entropy(np.array([n - ones, ones]))
                for n, ones in zip(left_n, left_ones)
            ])
            right_entropy = np.array([
                entropy(np.array([n - ones, ones]))
                for n, ones in zip(right_n, right_ones)
            ])

            weighted = (
                left_n * left_entropy + right_n * right_entropy
            ) / len(indices)

            gains = parent_entropy - weighted

            proportions = left_n / len(indices)
            split_info = -(
                proportions * np.log2(proportions) +
                (1 - proportions) * np.log2(1 - proportions)
            )

            ratios = np.divide(
                gains, split_info,
                out=np.zeros_like(gains),
                where=split_info > 0
            )

            for j, boundary in enumerate(boundaries):
                threshold = (
                    sorted_values[boundary] +
                    sorted_values[boundary + 1]
                ) / 2

                candidates.append({
                    "feature": feature,
                    "threshold": float(threshold),
                    "gain": float(gains[j]),
                    "ratio": float(ratios[j])
                })

        if not candidates:
            return node

        if self.criterion == "gain_ratio":
            best_by_feature = {}

            for candidate in candidates:
                feature = candidate["feature"]
                current = best_by_feature.get(feature)

                if current is None or (
                    candidate["gain"], candidate["ratio"]
                ) > (
                    current["gain"], current["ratio"]
                ):
                    best_by_feature[feature] = candidate

            average_gain = np.mean([
                candidate["gain"]
                for candidate in best_by_feature.values()
            ])

            eligible = [
                candidate
                for candidate in best_by_feature.values()
                if candidate["gain"] >= average_gain
                and candidate["gain"] > 0
            ]

            pool = eligible if eligible else list(best_by_feature.values())
            best = max(pool, key=lambda c: (c["ratio"], c["gain"]))
        else:
            best = max(candidates, key=lambda c: c["gain"])

        if best is None or best["gain"] <= 1e-12:
            return node

        feature = best["feature"]
        threshold = best["threshold"]
        left_mask = self.X[indices, feature] <= threshold

        left_indices = indices[left_mask]
        right_indices = indices[~left_mask]

        if len(left_indices) < self.min_leaf or len(right_indices) < self.min_leaf:
            return node

        node.update({
            "feature": feature,
            "threshold": threshold,
            "left": self._build(left_indices, depth + 1),
            "right": self._build(right_indices, depth + 1)
        })
        return node

    def predict(self, X):
        X = np.asarray(X, dtype=float)
        predictions = []

        for row in X:
            node = self.root
            while node["feature"] is not None:
                if row[node["feature"]] <= node["threshold"]:
                    node = node["left"]
                else:
                    node = node["right"]
            predictions.append(node["prediction"])

        return np.asarray(predictions, dtype=int)


def calculate_metrics(y_true, pred):
    tn, fp, fn, tp = confusion_matrix(
        y_true, pred, labels=[0, 1]
    ).ravel()

    return {
        "precision": round(float(precision_score(
            y_true, pred, zero_division=0
        )) * 100, 2),
        "recall": round(float(recall_score(
            y_true, pred, zero_division=0
        )) * 100, 2),
        "f1_score": round(float(f1_score(
            y_true, pred, zero_division=0
        )) * 100, 2),
        "accuracy": round(float(accuracy_score(y_true, pred)) * 100, 2),
        "matriz_confusion": [[int(tn), int(fp)], [int(fn), int(tp)]]
    }


def main():
    if not DATASET.exists():
        raise FileNotFoundError(DATASET)
    if OUTPUT.exists():
        raise FileExistsError(
            f"Se protege el informe existente: {OUTPUT}"
        )

    raw = DATASET.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()

    if sha != EXPECTED_SHA256:
        raise ValueError(
            f"El SHA256 del dataset no coincide con el experimento V3: {sha}"
        )

    df = pd.read_csv(DATASET)
    required = FEATURES + ["label", "scenario"]
    if df[required].isna().any().any():
        raise ValueError("Hay valores nulos en columnas requeridas.")

    X = df[FEATURES].apply(pd.to_numeric, errors="raise")
    y = df["label"].astype(int)
    scenarios = df["scenario"].astype(str)

    test_mask = scenarios.isin(HOLDOUT)
    train_mask = ~test_mask

    if int(train_mask.sum()) != 600 or int(test_mask.sum()) != 200:
        raise ValueError("La partición no coincide con los 600/200 casos.")

    X_train, X_test = X.loc[train_mask], X.loc[test_mask]
    y_train, y_test = y.loc[train_mask], y.loc[test_mask]

    results = {}

    id3 = ExperimentalTree("information_gain").fit(X_train, y_train)
    results["ID3"] = calculate_metrics(y_test, id3.predict(X_test))

    c45 = ExperimentalTree("gain_ratio").fit(X_train, y_train)
    results["C4.5"] = calculate_metrics(y_test, c45.predict(X_test))

    cart = DecisionTreeClassifier(
        criterion="gini",
        splitter="best",
        max_depth=5,
        min_samples_leaf=5,
        random_state=42
    )
    cart.fit(X_train, y_train)
    cart_metrics = calculate_metrics(y_test, cart.predict(X_test))
    results["CART"] = cart_metrics

    expected = {
        "precision": 100.00,
        "recall": 73.33,
        "f1_score": 84.62
    }

    cart_verified = all(
        abs(cart_metrics[k] - v) <= 0.02
        for k, v in expected.items()
    )

    report = {
        "dataset": "expansion_v3",
        "dataset_kind": "synthetic_experimental",
        "dataset_sha256": sha,
        "records": len(df),
        "features": len(FEATURES),
        "train_cases": len(X_train),
        "test_cases": len(X_test),
        "test_families": sorted(HOLDOUT),
        "positive_class": 1,
        "software": {"scikit_learn": sklearn.__version__},
        "methodology": {
            "ID3": "Ganancia de informacion; divisiones binarias para variables numericas.",
            "C4.5": "Razon de ganancia; umbrales numericos y filtro de ganancia media.",
            "CART": "DecisionTreeClassifier original con parametros V3."
        },
        "cart_reference_verified": cart_verified,
        "results": results
    }

    OUTPUT.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    print("\n========== COMPARACION DE ALGORITMOS ==========")
    print(f"{'Algoritmo':<12} {'Precision':>12} {'Recall':>12} {'F1-score':>12}")
    for name, values in results.items():
        print(
            f"{name:<12} {values['precision']:>11.2f}% "
            f"{values['recall']:>11.2f}% {values['f1_score']:>11.2f}%"
        )

    print("\nCART coincide con el informe original:", cart_verified)
    print("Informe generado:", OUTPUT)

    if not cart_verified:
        raise RuntimeError(
            "CART no reprodujo las métricas originales. "
            "No considerar válida la comparación."
        )


if __name__ == "__main__":
    main()
