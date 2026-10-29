import json
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "backend/services/ai-service/data/synthetic/expansion_v3/evaluation_report_v3.json"
OUT = ROOT / "evidence/graficos_cap4"
OUT.mkdir(parents=True, exist_ok=True)

with SOURCE.open("r", encoding="utf-8-sig") as f:
    report = json.load(f)

cv = report["grouped_cross_validation"]
tree = cv["tree"]
baseline = cv["baseline"]
audit = report["audit"]

def esc(value):
    return html.escape(str(value))

def svg_start(title, width=1000, height=560):
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white"/>',
        f'<text x="{width/2}" y="35" text-anchor="middle" font-family="Arial" font-size="21" font-weight="bold">{esc(title)}</text>'
    ]

def text(x, y, value, size=14, anchor="middle", weight="normal"):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" '
            f'font-family="Arial" font-size="{size}" font-weight="{weight}">{esc(value)}</text>')

def save(name, parts):
    parts.append("</svg>")
    path = OUT / name
    path.write_text("\n".join(parts), encoding="utf-8")
    print(f"Creado: {path}")

def bar_chart(name, title, labels, values, suffix="%", max_value=100):
    width, height = 1000, 560
    p = svg_start(title, width, height)
    left, top, plot_w, plot_h = 90, 90, 850, 350

    for tick in range(0, 101, 20):
        y = top + plot_h - plot_h * tick / 100
        p.append(f'<line x1="{left}" y1="{y}" x2="{left+plot_w}" y2="{y}" stroke="#dddddd"/>')
        p.append(text(left-15, y+5, f"{tick}{suffix}", 12, "end"))

    slot = plot_w / len(values)
    bw = slot * 0.55
    for i, (label, value) in enumerate(zip(labels, values)):
        h = plot_h * value / max_value
        x = left + i * slot + (slot-bw)/2
        y = top + plot_h - h
        p.append(f'<rect x="{x}" y="{y}" width="{bw}" height="{h}" fill="#557fa3"/>')
        p.append(text(x+bw/2, y-9, f"{value:.2f}{suffix}", 12))
        p.append(text(x+bw/2, top+plot_h+25, label, 12))
    p.append(text(width/2, height-30, "Indicadores", 14))
    save(name, p)

# Gráfico 4.1: métricas del árbol
keys = ["accuracy", "balanced_accuracy", "precision_anomalia",
        "recall_anomalia", "f1_anomalia"]
labels = ["Exactitud", "Balanceada", "Precisión", "Sensibilidad", "F1"]
bar_chart(
    "grafico_4_1_metricas_cart.svg",
    "Gráfico 4.1. Métricas del árbol de decisión, evaluación V3",
    labels, [tree[k]*100 for k in keys]
)

# Gráfico 4.2: matriz de confusión
matrix = tree["matriz_confusion"]
p = svg_start("Gráfico 4.2. Matriz de confusión, evaluación V3", 720, 520)
p.append(text(370, 90, "Clase predicha", 16, weight="bold"))
p.append(text(215, 130, "Normal", 15))
p.append(text(425, 130, "Anómalo", 15))
p.append(text(80, 225, "Real:", 15, anchor="start", weight="bold"))
p.append(text(145, 205, "Normal", 14, anchor="start"))
p.append(text(145, 325, "Anómalo", 14, anchor="start"))
colors = [["#d9e8f5", "#f3d9d9"], ["#f3d9d9", "#d9e8f5"]]
for i in range(2):
    for j in range(2):
        x, y = 240+j*210, 150+i*120
        p.append(f'<rect x="{x}" y="{y}" width="180" height="95" fill="{colors[i][j]}" stroke="#555"/>')
        p.append(text(x+90, y+55, matrix[i][j], 24, weight="bold"))
p.append(text(360, 440, "Filas: clase real | Columnas: clase predicha", 13))
save("grafico_4_2_matriz_confusion.svg", p)

# Gráfico 4.3: comparación del árbol con el clasificador base
p = svg_start("Gráfico 4.3. Árbol de decisión frente al clasificador base", 1100, 600)
metric_names = ["Exactitud", "Balanceada", "Precisión", "Sensibilidad", "F1"]
left, top, plot_w, plot_h = 90, 100, 930, 350
for tick in range(0, 101, 20):
    y = top+plot_h-plot_h*tick/100
    p.append(f'<line x1="{left}" y1="{y}" x2="{left+plot_w}" y2="{y}" stroke="#ddd"/>')
    p.append(text(left-12, y+5, f"{tick}%", 12, "end"))
slot = plot_w/5
for i, key in enumerate(keys):
    vals = [tree[key]*100, baseline[key]*100]
    for j, value in enumerate(vals):
        bw = 28
        x = left+i*slot+slot*0.25+j*38
        h = plot_h*value/100
        y = top+plot_h-h
        color = "#557fa3" if j == 0 else "#999999"
        p.append(f'<rect x="{x}" y="{y}" width="{bw}" height="{h}" fill="{color}"/>')
        p.append(text(x+bw/2, y-7, f"{value:.1f}", 10))
    p.append(text(left+i*slot+slot/2, top+plot_h+25, metric_names[i], 12))
p.append('<rect x="370" y="510" width="16" height="16" fill="#557fa3"/>')
p.append(text(393, 523, "Árbol de decisión", 13, "start"))
p.append('<rect x="560" y="510" width="16" height="16" fill="#999999"/>')
p.append(text(583, 523, "Clasificador base", 13, "start"))
save("grafico_4_3_comparacion_base.svg", p)

# Gráfico 4.4: clases y repetición de vectores
normal = int(audit["class_counts"]["0"])
anomaly = int(audit["class_counts"]["1"])
duplicates = int(audit["duplicate_feature_vectors"])
cases = int(audit["cases"])
unique_rows = cases - duplicates

p = svg_start("Gráfico 4.4. Distribución y duplicación del conjunto V3", 1000, 560)
groups = [
    ("Clases", [("Normales", normal), ("Anómalos", anomaly)]),
    ("Repetición de vectores", [("No duplicados", unique_rows), ("Duplicados", duplicates)])
]
for gi, (heading, items) in enumerate(groups):
    x0 = 100 + gi*480
    p.append(text(x0+180, 100, heading, 17, weight="bold"))
    maxv = max(v for _, v in items)
    for i, (label, value) in enumerate(items):
        y = 170+i*115
        bw = 300*value/maxv
        p.append(f'<rect x="{x0}" y="{y}" width="{bw}" height="45" fill="#557fa3"/>')
        p.append(text(x0+bw+28, y+28, value, 14, "start"))
        p.append(text(x0, y-10, label, 13, "start"))
p.append(text(500, 500, f"Total de casos: {cases} | Características: {audit['feature_count']}", 14))
save("grafico_4_4_calidad_datos.svg", p)

print("\nResumen:")
print(f"Casos: {cases}; normales: {normal}; anómalos: {anomaly}")
print(f"Vectores duplicados: {duplicates}")
print(f"Validación: {cv['method']}, {cv['folds']} particiones")
print("Limitación: las etiquetas son de escenarios sintéticos experimentales.")
