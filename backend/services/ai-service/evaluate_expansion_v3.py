import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd
import sklearn
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.tree import DecisionTreeClassifier

ROOT = Path("/app/data/synthetic/expansion_v3")
DATASET = ROOT / "training_v3.csv"
REPORT = ROOT / "evaluation_report_v3.json"

FEATURES = [
    "failed_login_count",
    "successful_login_count",
    "failed_login_ratio",
    "sales_count_5m",
    "sales_count",
    "sales_without_stock_link_count",
    "cancelled_sales_count",
    "cancellation_ratio",
    "stock_change_count",
    "price_change_count",
    "admin_action_count",
    "role_change_count",
    "user_change_count",
    "sales_after_stock_change",
    "sales_after_price_change",
    "unique_entities_modified",
]
PARAMS = {
    "criterion": "gini",
    "splitter": "best",
    "max_depth": 5,
    "min_samples_leaf": 5,
    "random_state": 42,
}
HOLDOUT_FAMILIES = {"alcance_administrativo", "patron_combinado"}


def metrics(y_true, y_pred):
    tn, fp, fn, tp = confusion_matrix(
        y_true, y_pred, labels=[0, 1]
    ).ravel()
    return {
        "casos": int(len(y_true)),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(
            balanced_accuracy_score(y_true, y_pred)
        ),
        "precision_anomalia": float(
            precision_score(y_true, y_pred, zero_division=0)
        ),
        "recall_anomalia": float(
            recall_score(y_true, y_pred, zero_division=0)
        ),
        "f1_anomalia": float(
            f1_score(y_true, y_pred, zero_division=0)
        ),
        "matriz_confusion": [[int(tn), int(fp)], [int(fn), int(tp)]],
    }


def main():
    if not DATASET.is_file():
        raise FileNotFoundError(f"No existe el dataset: {DATASET}")
    if REPORT.exists():
        raise FileExistsError(f"Se protege el informe existente: {REPORT}")

    df = pd.read_csv(DATASET)
    missing = sorted(set(FEATURES + ["label", "scenario"]) - set(df.columns))
    if missing:
        raise ValueError(f"Faltan columnas requeridas: {missing}")
    if df[FEATURES + ["label", "scenario"]].isna().any().any():
        raise ValueError("Hay valores nulos en columnas requeridas.")
    if set(df["label"].unique()) != {0, 1}:
        raise ValueError("Se requieren ambas clases con etiquetas 0 y 1.")

    X = df[FEATURES].apply(pd.to_numeric, errors="raise")
    y = df["label"].astype(int)
    scenarios = df["scenario"].astype(str)
    groups = pd.util.hash_pandas_object(X, index=False).astype(str)

    # Auditoría de vectores idénticos con etiquetas contradictorias.
    audit = df[FEATURES + ["label"]].groupby(FEATURES, dropna=False)["label"].nunique()
    conflicting_vectors = int((audit > 1).sum())

    # Validación cruzada: vectores idénticos nunca pasan a folds distintos.
    cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    oof_tree = [None] * len(df)
    oof_dummy = [None] * len(df)
    fold_results = []

    for fold, (train_idx, test_idx) in enumerate(
        cv.split(X, y, groups=groups), start=1
    ):
        tree = DecisionTreeClassifier(**PARAMS)
        tree.fit(X.iloc[train_idx], y.iloc[train_idx])
        pred_tree = tree.predict(X.iloc[test_idx])

        dummy = DummyClassifier(strategy="most_frequent")
        dummy.fit(X.iloc[train_idx], y.iloc[train_idx])
        pred_dummy = dummy.predict(X.iloc[test_idx])

        for idx, pred in zip(test_idx, pred_tree):
            if oof_tree[idx] is not None:
                raise ValueError(f"Caso evaluado más de una vez: {idx}")
            oof_tree[idx] = int(pred)
        for idx, pred in zip(test_idx, pred_dummy):
            oof_dummy[idx] = int(pred)

        fold_results.append({
            "fold": fold,
            "arbol": metrics(y.iloc[test_idx], pred_tree),
            "baseline": metrics(y.iloc[test_idx], pred_dummy),
            "vectores_compartidos_train_test": int(
                len(set(groups.iloc[train_idx]) & set(groups.iloc[test_idx]))
            ),
        })

    if any(p is None for p in oof_tree) or any(p is None for p in oof_dummy):
        raise ValueError("No todos los casos recibieron exactamente una predicción.")

    cv_tree = metrics(y, oof_tree)
    cv_dummy = metrics(y, oof_dummy)

    # Prueba separada por familias no incluidas en el entrenamiento.
    test_mask = scenarios.isin(HOLDOUT_FAMILIES)
    train_mask = ~test_mask
    if not test_mask.any() or not train_mask.any():
        raise ValueError("La partición por familias no contiene train y test.")
    if y[train_mask].nunique() != 2 or y[test_mask].nunique() != 2:
        raise ValueError("La partición por familias debe contener ambas clases.")

    family_tree = DecisionTreeClassifier(**PARAMS)
    family_tree.fit(X.loc[train_mask], y.loc[train_mask])
    family_pred = family_tree.predict(X.loc[test_mask])

    family_results = {}
    for family in sorted(HOLDOUT_FAMILIES):
        mask = test_mask & scenarios.eq(family)
        family_results[family] = metrics(
            y.loc[mask], family_tree.predict(X.loc[mask])
        )

    feature_importances = {
        name: float(value)
        for name, value in sorted(
            zip(FEATURES, family_tree.feature_importances_),
            key=lambda item: item[1],
            reverse=True,
        )
    }

    report = {
        "report_version": "1.0",
        "dataset_version": "expansion_v3",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_sha256": hashlib.sha256(DATASET.read_bytes()).hexdigest(),
        "dataset_kind": "synthetic_experimental",
        "label_caveat": (
            "Las etiquetas representan reglas de escenarios sintéticos; "
            "no son confirmaciones de fraude real."
        ),
        "software": {
            "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__,
        },
        "audit": {
            "cases": int(len(df)),
            "feature_count": len(FEATURES),
            "features": FEATURES,
            "missing_required_values": int(
                df[FEATURES + ["label", "scenario"]].isna().sum().sum()
            ),
            "duplicate_feature_vectors": int(X.duplicated().sum()),
            "contradictory_feature_vectors": conflicting_vectors,
            "class_counts": {
                str(k): int(v) for k, v in y.value_counts().sort_index().items()
            },
            "scenario_counts": {
                str(k): int(v) for k, v in scenarios.value_counts().sort_index().items()
            },
        },
        "parameters": PARAMS,
        "grouped_cross_validation": {
            "method": "StratifiedGroupKFold",
            "folds": 5,
            "grouping": "hash del vector de características",
            "tree": cv_tree,
            "baseline": cv_dummy,
            "fold_results": fold_results,
            "one_oof_prediction_per_case": True,
        },
        "unseen_family_holdout": {
            "test_families": sorted(HOLDOUT_FAMILIES),
            "train_cases": int(train_mask.sum()),
            "test_cases": int(test_mask.sum()),
            "tree": metrics(y.loc[test_mask], family_pred),
            "per_family": family_results,
            "feature_importances": feature_importances,
        },
        "interpretation": (
            "Las métricas de validación cruzada miden el rendimiento en casos "
            "sintéticos de familias conocidas. La prueba por familias mide "
            "generalización a dos familias reservadas. Ninguna prueba valida "
            "la detección de fraude real."
        ),
    }

    REPORT.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("INFORME V3 GENERADO")
    print(f"Dataset: {DATASET}")
    print(f"SHA256: {report['dataset_sha256']}")
    print(f"Casos: {len(df)} | Variables: {len(FEATURES)}")
    print(f"Valores nulos requeridos: {report['audit']['missing_required_values']}")
    print(f"Vectores contradictorios: {conflicting_vectors}")
    print("\nVALIDACIÓN CRUZADA AGRUPADA")
    print(json.dumps(cv_tree, ensure_ascii=False, indent=2))
    print("\nBASELINE")
    print(json.dumps(cv_dummy, ensure_ascii=False, indent=2))
    print("\nFAMILIAS RESERVADAS")
    print(json.dumps(report["unseen_family_holdout"], ensure_ascii=False, indent=2))
    print(f"\nInforme: {REPORT}")


if __name__ == "__main__":
    main()