import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np

base = Path(__file__).resolve().parent
report_path = base / "data/synthetic/expansion_v3/algorithm_comparison_v3_corrected.json"
output_path = base / "data/synthetic/expansion_v3/matriz_confusion_cart_actualizada.png"

with report_path.open("r", encoding="utf-8") as f:
    report = json.load(f)

cart = report["results"]["CART"]
matrix = np.array(cart["confusion_matrix"])

fig, ax = plt.subplots(figsize=(8, 6))
im = ax.imshow(matrix, cmap="Blues")

ax.set_title("Matriz de confusión - Algoritmo CART", fontsize=15, pad=16)
ax.set_xlabel("Clase predicha")
ax.set_ylabel("Clase real")
ax.set_xticks([0, 1])
ax.set_yticks([0, 1])
ax.set_xticklabels(["Normal", "Anómalo"])
ax.set_yticklabels(["Normal", "Anómalo"])

for i in range(2):
    for j in range(2):
        ax.text(
            j, i, str(matrix[i, j]),
            ha="center", va="center",
            fontsize=18, fontweight="bold",
            color="white" if matrix[i, j] > matrix.max() / 2 else "black"
        )

fig.colorbar(im, ax=ax, label="Cantidad de registros")
fig.tight_layout()
fig.savefig(output_path, dpi=300, bbox_inches="tight")
plt.close(fig)

print("Matriz:", matrix.tolist())
print(f"Precisión: {cart['precision']}%")
print(f"Recall: {cart['recall']}%")
print(f"F1-score: {cart['f1_score']}%")
print(f"Accuracy: {cart['accuracy']}%")
print(f"Gráfico generado: {output_path}")
