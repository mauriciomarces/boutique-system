
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
from sklearn.tree import plot_tree

MODEL_PATH = Path(
    r"E:\boutique-system\backend\services\ai-service\models\decision_tree.joblib"
)

OUTPUT_DIR = Path(r"E:\boutique-system\evidencia_arbol")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_NAMES = [
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

loaded = joblib.load(MODEL_PATH)

if hasattr(loaded, "tree_"):
    model = loaded
elif hasattr(loaded, "named_steps"):
    model = next(
        (
            step for step in reversed(list(loaded.named_steps.values()))
            if hasattr(step, "tree_")
        ),
        None
    )
else:
    model = None

if model is None:
    raise TypeError("No se encontró un árbol de decisión compatible.")

if model.n_features_in_ != len(FEATURE_NAMES):
    raise ValueError(
        f"El modelo requiere {model.n_features_in_} variables, "
        f"pero se proporcionaron {len(FEATURE_NAMES)}."
    )

features = (
    list(model.feature_names_in_)
    if hasattr(model, "feature_names_in_")
    else FEATURE_NAMES
)

classes = [str(c) for c in model.classes_]

depth = model.get_depth()
nodes = model.tree_.node_count

print(f"Profundidad: {depth}")
print(f"Nodos: {nodes}")
print(f"Clases: {classes}")

def generate_tree(filename, max_depth=None, fontsize=13, dpi=300):
    # Ajustar el tamaño de acuerdo con la profundidad mostrada
    visible_depth = depth if max_depth is None else min(depth, max_depth)

    width = max(22, 8 * (2 ** min(visible_depth, 5)))
    height = max(12, 5 * (visible_depth + 1))

    fig, ax = plt.subplots(figsize=(width, height))

    plot_tree(
        model,
        feature_names=features,
        class_names=classes,
        filled=True,
        rounded=True,
        impurity=True,
        proportion=False,
        precision=3,
        fontsize=fontsize,
        max_depth=max_depth,
        ax=ax
    )

    title = "Árbol de Decisión CART - Boutique SposaBella"
    if max_depth is not None:
        title += f" (hasta nivel {max_depth})"

    ax.set_title(title, fontsize=22, pad=25)
    ax.axis("off")

    fig.tight_layout()

    output = OUTPUT_DIR / filename
    fig.savefig(
        output,
        dpi=dpi,
        bbox_inches="tight",
        facecolor="white"
    )

    plt.close(fig)
    print(f"Generado: {output}")

# 1. Árbol completo
generate_tree(
    "01_arbol_completo.png",
    max_depth=None,
    fontsize=13
)

# 2. Vista ampliada de los primeros niveles
generate_tree(
    "02_arbol_niveles_iniciales.png",
    max_depth=2,
    fontsize=18
)

# 3. PDF vectorial para ampliar sin perder calidad
generate_tree(
    "03_arbol_completo.pdf",
    max_depth=None,
    fontsize=13,
    dpi=300
)

print("\nGeneración finalizada.")
