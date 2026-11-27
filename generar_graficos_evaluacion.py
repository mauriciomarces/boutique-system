
from pathlib import Path
import joblib
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# --------------------------------------------------
# CONFIGURACIÓN
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = (
    BASE_DIR
    / "backend"
    / "services"
    / "ai-service"
    / "models"
    / "decision_tree.joblib"
)

OUTPUT_DIR = BASE_DIR / "evidencia_graficos"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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

sns.set_theme(style="whitegrid", font_scale=1.0)


# --------------------------------------------------
# OBTENER EL CLASIFICADOR
# --------------------------------------------------

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"No se encontró el modelo: {MODEL_PATH}"
    )

loaded_model = joblib.load(MODEL_PATH)

# Si el modelo es un Pipeline, obtener su último estimador.
if hasattr(loaded_model, "named_steps"):
    model = list(loaded_model.named_steps.values())[-1]
else:
    model = loaded_model

if not hasattr(model, "feature_importances_"):
    raise TypeError(
        "El modelo cargado no expone feature_importances_. "
        "Verifica que sea un DecisionTreeClassifier entrenado."
    )

importances = np.asarray(model.feature_importances_)

if len(importances) != len(FEATURES):
    raise ValueError(
        f"El modelo tiene {len(importances)} importancias, "
        f"pero se definieron {len(FEATURES)} variables. "
        "Verifica las variables de entrada del modelo."
    )


# --------------------------------------------------
# GRÁFICO 1: MATRIZ DE CONFUSIÓN
# --------------------------------------------------

# Filas: clase real.
# Columnas: clase predicha.
# Orden: Normal, Anómalo.

confusion_matrix = np.array([
    [140, 0],
    [16, 44]
])

fig, ax = plt.subplots(figsize=(8, 6))

sns.heatmap(
    confusion_matrix,
    annot=True,
    fmt="d",
    cmap="Blues",
    cbar=True,
    square=True,
    linewidths=1,
    linecolor="white",
    xticklabels=["Normal", "Anómalo"],
    yticklabels=["Normal", "Anómalo"],
    annot_kws={"size": 18, "weight": "bold"},
    ax=ax
)

ax.set_title(
    "Matriz de confusión del modelo CART",
    fontsize=15,
    fontweight="bold",
    pad=18
)

ax.set_xlabel("Clase predicha", fontsize=12)
ax.set_ylabel("Clase real", fontsize=12)

plt.tight_layout()

plt.savefig(
    OUTPUT_DIR / "01_matriz_confusion.png",
    dpi=300,
    bbox_inches="tight"
)

plt.close()


# --------------------------------------------------
# GRÁFICO 2: IMPORTANCIA DE VARIABLES
# --------------------------------------------------

# Obtener nombres del modelo cuando estén disponibles.
model_features = getattr(
    model,
    "feature_names_in_",
    FEATURES
)

if len(model_features) != len(importances):
    model_features = FEATURES

# Ordenar de mayor a menor importancia.
order = np.argsort(importances)

sorted_names = np.asarray(model_features)[order]
sorted_values = importances[order]

fig, ax = plt.subplots(figsize=(12, 9))

bars = ax.barh(
    sorted_names,
    sorted_values,
    color=sns.color_palette("Blues_r", len(sorted_values))
)

ax.set_title(
    "Importancia de las variables del modelo CART",
    fontsize=15,
    fontweight="bold",
    pad=18
)

ax.set_xlabel("Importancia relativa", fontsize=12)
ax.set_ylabel("Variables de entrada", fontsize=12)

ax.grid(axis="x", linestyle="--", alpha=0.4)
ax.grid(axis="y", visible=False)

# Mostrar el valor de importancia al final de cada barra.
for bar, value in zip(bars, sorted_values):
    ax.text(
        value,
        bar.get_y() + bar.get_height() / 2,
        f" {value:.4f}",
        va="center",
        fontsize=9
    )

plt.tight_layout()

plt.savefig(
    OUTPUT_DIR / "02_importancia_variables.png",
    dpi=300,
    bbox_inches="tight"
)

plt.close()


# --------------------------------------------------
# RESULTADO
# --------------------------------------------------

print("\nGráficos generados correctamente:")
print(OUTPUT_DIR / "01_matriz_confusion.png")
print(OUTPUT_DIR / "02_importancia_variables.png")

print("\nImportancia de variables:")
for name, value in sorted(
    zip(model_features, importances),
    key=lambda item: item[1],
    reverse=True
):
    print(f"{name}: {value:.6f}")
