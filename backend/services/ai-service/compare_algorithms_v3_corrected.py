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
OUTPUT = ROOT / "algorithm_comparison_v3_corrected.json"

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
EXPECTED_SHA = "e8ac69f554eb39740aaac21857d79cbfecaaee1f8e909743cae62af8efa67e77"


def entropy(labels):
    counts = np.bincount(labels.astype(int), minlength=2)
    probabilities = counts[counts > 0] / len(labels)
    return float(-np.sum(probabilities * np.log2(probabilities)))


class C45Numeric:
    """Arbol experimental C4.5 con umbrales para variables numericas."""

    def __init__(self, max_depth=5, min_leaf=5):
        self.max_depth = max_depth
        self.min_leaf = min_leaf

    def fit(self, X, y):
        self.X = np.asarray(X, dtype=float)
        self.y = np.asarray(y, dtype=int)
        self.root = self._build(np.arange(len(self.y)), 0)
        return self

    def _build(self, indices, depth):
        labels = self.y[indices]
        prediction = int(np.bincount(labels, minlength=2).argmax())
        node = {"prediction": prediction, "feature": None}

        if depth >= self.max_depth or len(indices) < 2 * self.min_leaf:
            return node
        if len(np.unique(labels)) < 2:
            return node

        parent_entropy = entropy(labels)
        feature_candidates = []

        for feature in range(self.X.shape[1]):
            values = self.X[indices, feature]
            order = np.argsort(values, kind="mergesort")
            values_sorted = values[order]
            labels_sorted = labels[order]

            boundaries = np.flatnonzero(
                values_sorted[:-1] < values_sorted[1:]
            )
            boundaries = [
                int(b) for b in boundaries
                if b + 1 >= self.min_leaf
                and len(indices) - b - 1 >= self.min_leaf
                and labels_sorted[:b+1].size > 0
            ]

            best_for_feature = None

            for boundary in boundaries:
                left = labels_sorted[:boundary + 1]
                right = labels_sorted[boundary + 1:]

                gain = parent_entropy - (
                    len(left) / len(labels) * entropy(left)
                    + len(right) / len(labels) * entropy(right)
                )

                p_left = len(left) / len(labels)
                p_right = len(right) / len(labels)
                split_info = -(
                    p_left * np.log2(p_left)
                    + p_right * np.log2(p_right)
                )

                if split_info <= 0 or gain <= 1e-12:
                    continue

                ratio = gain / split_info
                threshold = float(
                    (values_sorted[boundary] + values_sorted[boundary + 1]) / 2
                )

                candidate = {
                    "feature": feature,
                    "threshold": threshold,
                    "gain": float(gain),
                    "ratio": float(ratio)
                }

                if (
                    best_for_feature is None
                    or candidate["gain"] > best_for_feature["gain"]
                ):
                    best_for_feature = candidate

            if best_for_feature is not None:
                feature_candidates.append(best_for_feature)

        if not feature_candidates:
            return node

        average_gain = np.mean([
            candidate["gain"] for candidate in feature_candidates
        ])

        eligible = [
            candidate for candidate in feature_candidates
            if candidate["gain"] >= average_gain
        ]

        if not eligible:
            eligible = feature_candidates

        best = max(eligible, key=lambda candidate: candidate["ratio"])

        feature = best["feature"]
        threshold = best["threshold"]
        left_mask = self.X[indices, feature] <= threshold

        left_indices = indices[left_mask]
        right_indices = indices[~left_mask]

        if (
            len(left_indices) < self.min_leaf
            or len(right_indices) < self.min_leaf
        ):
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


def metrics(y_true, predictions):
    tn, fp, fn, tp = confusion_matrix(
        y_true, predictions, labels=[0, 1]
    ).ravel()

    return {
        "precision": round(
            float(precision_score(y_true, predictions, zero_division=0)) * 100, 2
        ),
        "recall": round(
            float(recall_score(y_true, predictions, zero_division=0)) * 100, 2
        ),
        "f1_score": round(
            float(f1_score(y_true, predictions, zero_division=0)) * 100, 2
        ),
        "accuracy": round(
            float(accuracy_score(y_true, predictions)) * 100, 2
        ),
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]]
    }


def main():
    if OUTPUT.exists():
        raise FileExistsError(f"El informe ya existe: {OUTPUT}")

    raw = DATASET.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()

    if sha != EXPECTED_SHA:
        raise ValueError("El SHA256 no coincide con el dataset V3 original.")

    df = pd.read_csv(DATASET)
    if df[FEATURES + ["label", "scenario"]].isna().any().any():
        raise ValueError("Existen valores nulos.")

    X = df[FEATURES].apply(pd.to_numeric, errors="raise")
    y = df["label"].astype(int)
    scenarios = df["scenario"].astype(str)

    test_mask = scenarios.isin(HOLDOUT)
    train_mask = ~test_mask

    if train_mask.sum() != 600 or test_mask.sum() != 200:
        raise ValueError("La particion esperada debe ser 600/200.")

    X_train, X_test = X.loc[train_mask], X.loc[test_mask]
    y_train, y_test = y.loc[train_mask], y.loc[test_mask]

    results = {}

    # ID3 adaptado a variables numericas: ganancia de informacion.
    id3 = DecisionTreeClassifier(
        criterion="entropy",
        splitter="best",
        max_depth=5,
        min_samples_leaf=5,
        random_state=42
    )
    id3.fit(X_train, y_train)
    results["ID3"] = metrics(y_test, id3.predict(X_test))

    # C4.5 experimental: razon de ganancia.
    c45 = C45Numeric(max_depth=5, min_leaf=5)
    c45.fit(X_train, y_train)
    results["C4.5"] = metrics(y_test, c45.predict(X_test))

    # CART original: no modificar parametros.
    cart = DecisionTreeClassifier(
        criterion="gini",
        splitter="best",
        max_depth=5,
        min_samples_leaf=5,
        random_state=42
    )
    cart.fit(X_train, y_train)
    results["CART"] = metrics(y_test, cart.predict(X_test))

    expected = {"precision": 100.00, "recall": 73.33, "f1_score": 84.62}
    cart_verified = all(
        abs(results["CART"][key] - value) <= 0.02
        for key, value in expected.items()
    )

    per_family = {}
    for family in sorted(HOLDOUT):
        mask = scenarios.loc[test_mask].eq(family)
        family_y = y_test.loc[mask]
        family_X = X_test.loc[mask]

        per_family[family] = {}
        for name, model in [
            ("ID3", id3), ("C4.5", c45), ("CART", cart)
        ]:
            per_family[family][name] = metrics(
                family_y, model.predict(family_X)
            )

    report = {
        "dataset_sha256": sha,
        "dataset_kind": "synthetic_experimental",
        "records": len(df),
        "features": len(FEATURES),
        "train_cases": int(train_mask.sum()),
        "test_cases": int(test_mask.sum()),
        "test_families": sorted(HOLDOUT),
        "software": {"scikit_learn": sklearn.__version__},
        "methodology": {
            "ID3": "Arbol de entropia/ganancia de informacion adaptado a variables numericas.",
            "C4.5": "Arbol experimental de razon de ganancia con umbrales numericos.",
            "CART": "DecisionTreeClassifier con Gini y parametros originales V3."
        },
        "cart_reference_verified": cart_verified,
        "results": results,
        "results_by_family": per_family
    }

    OUTPUT.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    print("\n========== COMPARACION CORREGIDA ==========")
    print(f"{'Algoritmo':<12} {'Precision':>12} {'Recall':>12} {'F1-score':>12}")

    for name, result in results.items():
        print(
            f"{name:<12} {result['precision']:>11.2f}% "
            f"{result['recall']:>11.2f}% {result['f1_score']:>11.2f}%"
        )

    print("\n========== CART CONTRA REFERENCIA ==========")
    print("Coincide:", cart_verified)

    print("\n========== RESULTADOS POR FAMILIA ==========")
    print(json.dumps(per_family, indent=2, ensure_ascii=False))

    print("\nInforme:", OUTPUT)

    if not cart_verified:
        raise RuntimeError(
            "CART no reproduce el informe V3 original."
        )


if __name__ == "__main__":
    main()
