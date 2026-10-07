# AI Service

Componente experimental de **clasificación** de comportamiento operativo de Boutique SposaBella mediante un **Árbol de Decisión** interpretable.

No sustituye a `logic-correlation-service`. Recibe características ya correlacionadas.

- Tecnología: Python, FastAPI, pandas, scikit-learn, joblib
- Puerto: `4008`
- Historial de entrenamientos: base propia `boutique_ia` (MySQL `mysql-ai`) o SQLite local
- El arranque de Docker **no** entrena el modelo

## Flujo académico

```
Eventos → correlación lógica → características → dataset etiquetado por escenario
        → DecisionTreeClassifier → NORMAL | ANOMALO (señal de riesgo)
```

## Dataset

Ver `data/README.md`.

Etiqueta:

- `label = 0` → escenario NORMAL (A, B, C)
- `label = 1` → escenario ANÓMALO controlado (intentos fallidos, anulaciones, stock→venta, precio→venta, admin, ráfaga, combinado)

Las reglas lógicas pueden aparecer como indicadores (`*_rule`). **No** hay una feature `anomaly_detected` igual a la etiqueta.

## Entrenamiento manual

```bash
cd backend/services/ai-service
python generate_dataset.py
python train.py
uvicorn app.main:app --host 0.0.0.0 --port 4008
```

En Docker:

```bash
docker compose exec ai-service python generate_dataset.py
docker compose exec ai-service python train.py
```

Parámetros iniciales:

```python
DecisionTreeClassifier(max_depth=5, min_samples_leaf=5, random_state=42)
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado y si hay modelo cargado |
| POST | `/train` | Entrena una **nueva** versión (no sobrescribe el historial) |
| POST | `/predict` | Clasifica un vector de características |
| GET | `/training` | Historial de iteraciones |
| GET | `/training/{id}` | Detalle de un entrenamiento |
| GET | `/metrics` | Métricas actuales + evolución |
| GET | `/model` | Metadatos del modelo actual |

`POST /predict` usa `predict_proba` cuando el clasificador lo expone. La respuesta habla de **comportamiento clasificado como anómalo**, no de fraude confirmado.

## Estructura

```
app/           API, features, entrenamiento, explicación
generate_dataset.py
train.py
data/          raw, processed, synthetic
models/        v1, v2, … y puntero actual
metrics/
tests/
```

## Limitaciones

- Etiquetas sintéticas, no historial real de SposaBella.
- UCI Online Retail es referencia transaccional, no fuente de fraude.
- Árbol poco profundo a propósito (interpretabilidad).
- Sin MLflow, streaming ni reentrenamiento automático.
