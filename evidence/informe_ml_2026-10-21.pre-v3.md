# Evaluación experimental del árbol de decisión SposaBella

**Fecha:** 2026-10-21

## 1. Preparación y calidad de datos

- Registros candidatos: 800
- Variables predictoras: 16
- Valores faltantes en variables y etiqueta: 0
- Valores numéricos no finitos: 0
- Vectores de características distintos: 47 (5.88%)
- Distribución de etiquetas: {"0":400,"1":400}
- Procedencia de etiquetas: {"synthetic_anomaly_scenario":400,"synthetic_normal_scenario":400}

## 2. Análisis exploratorio

### Variables con cardinalidad baja (tres valores distintos o menos)

{
    "successful_login_count":  2,
    "sales_count_5m":  3,
    "cancellation_ratio":  2,
    "stock_change_count":  2,
    "price_change_count":  2,
    "role_change_count":  3,
    "user_change_count":  3,
    "sales_after_stock_change":  2,
    "sales_after_price_change":  3
}

### Correlaciones absolutas iguales o superiores a 0,90

[
    {
        "feature_a":  "failed_login_count",
        "feature_b":  "failed_login_ratio",
        "absolute_correlation":  0.9466
    },
    {
        "feature_a":  "cancelled_sales_count",
        "feature_b":  "cancellation_ratio",
        "absolute_correlation":  0.975
    },
    {
        "feature_a":  "stock_change_count",
        "feature_b":  "sales_after_stock_change",
        "absolute_correlation":  1.0
    },
    {
        "feature_a":  "admin_action_count",
        "feature_b":  "role_change_count",
        "absolute_correlation":  0.9863
    },
    {
        "feature_a":  "admin_action_count",
        "feature_b":  "user_change_count",
        "absolute_correlation":  0.9965
    },
    {
        "feature_a":  "role_change_count",
        "feature_b":  "user_change_count",
        "absolute_correlation":  0.969
    }
]

### Ranking de información mutua

| Variable | Información mutua |
|---|---:|
| unique_entities_modified | 0.4728 |
| sales_count | 0.4201 |
| cancelled_sales_count | 0.2223 |
| cancellation_ratio | 0.2082 |
| failed_login_ratio | 0.196 |
| failed_login_count | 0.1954 |
| successful_login_count | 0.1655 |
| sales_count_5m | 0.1636 |
| sales_without_stock_link_count | 0.162 |
| role_change_count | 0.096 |
| user_change_count | 0.0845 |
| admin_action_count | 0.0749 |
| price_change_count | 0.0643 |
| sales_after_price_change | 0.0596 |
| stock_change_count | 0.0499 |
| sales_after_stock_change | 0.0468 |

## 3. Árbol de decisión: partición agrupada

- Estrategia: GroupShuffleSplit por familia de escenario
- Entrenamiento: 540 registros
- Prueba: 260 registros
- Familias de entrenamiento: admin_burst, combined, failed_logins, normal_a, normal_busy, normal_sale_inventory_link
- Familias de prueba: cancellations, normal_b, normal_c
- Solapamiento de familias: 

### Métricas del árbol

{
    "accuracy":  0.6154,
    "balanced_accuracy":  0.5,
    "precision_anomaly":  0.0,
    "recall_anomaly":  0.0,
    "f1_anomaly":  0.0,
    "f1_macro":  0.381,
    "confusion_matrix_TN_FP_FN_TP":  [
                                         [
                                             160,
                                             0
                                         ],
                                         [
                                             100,
                                             0
                                         ]
                                     ]
}

### Línea base

{
    "accuracy":  0.3846,
    "balanced_accuracy":  0.5,
    "precision_anomaly":  0.3846,
    "recall_anomaly":  1.0,
    "f1_anomaly":  0.5556,
    "f1_macro":  0.2778,
    "confusion_matrix_TN_FP_FN_TP":  [
                                         [
                                             0,
                                             160
                                         ],
                                         [
                                             0,
                                             100
                                         ]
                                     ]
}

### Reglas aprendidas por el árbol

```text
|--- successful_login_count <= 0.50
|   |--- class: 0
|--- successful_login_count >  0.50
|   |--- stock_change_count <= 0.50
|   |   |--- class: 1
|   |--- stock_change_count >  0.50
|   |   |--- class: 0

```

### Importancia de variables

[
    {
        "feature":  "successful_login_count",
        "importance":  0.52632
    },
    {
        "feature":  "stock_change_count",
        "importance":  0.47368
    },
    {
        "feature":  "failed_login_count",
        "importance":  0.0
    },
    {
        "feature":  "failed_login_ratio",
        "importance":  0.0
    },
    {
        "feature":  "sales_count_5m",
        "importance":  0.0
    },
    {
        "feature":  "sales_count",
        "importance":  0.0
    },
    {
        "feature":  "sales_without_stock_link_count",
        "importance":  0.0
    },
    {
        "feature":  "cancelled_sales_count",
        "importance":  0.0
    },
    {
        "feature":  "cancellation_ratio",
        "importance":  0.0
    },
    {
        "feature":  "price_change_count",
        "importance":  0.0
    },
    {
        "feature":  "admin_action_count",
        "importance":  0.0
    },
    {
        "feature":  "role_change_count",
        "importance":  0.0
    },
    {
        "feature":  "user_change_count",
        "importance":  0.0
    },
    {
        "feature":  "sales_after_stock_change",
        "importance":  0.0
    },
    {
        "feature":  "sales_after_price_change",
        "importance":  0.0
    },
    {
        "feature":  "unique_entities_modified",
        "importance":  0.0
    }
]

### Ablación: sin successful_login_count

{
    "accuracy":  0.8692,
    "balanced_accuracy":  0.8938,
    "precision_anomaly":  0.7463,
    "recall_anomaly":  1.0,
    "f1_anomaly":  0.8547,
    "f1_macro":  0.8679,
    "confusion_matrix_TN_FP_FN_TP":  [
                                         [
                                             126,
                                             34
                                         ],
                                         [
                                             0,
                                             100
                                         ]
                                     ]
}

```text
|--- sales_count <= 0.50
|   |--- class: 1
|--- sales_count >  0.50
|   |--- cancelled_sales_count <= 1.50
|   |   |--- class: 0
|   |--- cancelled_sales_count >  1.50
|   |   |--- class: 1

```

## 4. Validación dejando fuera una familia completa

### Métricas agregadas

{
    "accuracy":  0.525,
    "balanced_accuracy":  0.525,
    "precision_anomaly":  0.5556,
    "recall_anomaly":  0.25,
    "f1_anomaly":  0.3448,
    "f1_macro":  0.4861,
    "confusion_matrix_TN_FP_FN_TP":  [
                                         [
                                             320,
                                             80
                                         ],
                                         [
                                             300,
                                             100
                                         ]
                                     ]
}

### Línea base

{
    "accuracy":  0.0,
    "balanced_accuracy":  0.0,
    "precision_anomaly":  0.0,
    "recall_anomaly":  0.0,
    "f1_anomaly":  0.0,
    "f1_macro":  0.0,
    "confusion_matrix_TN_FP_FN_TP":  [
                                         [
                                             0,
                                             400
                                         ],
                                         [
                                             400,
                                             0
                                         ]
                                     ]
}

| Familia excluida del entrenamiento | Clase | Registros | Predichos como anomalía | Exactitud |
|---|---:|---:|---:|---:|
| admin_burst | 1 | 100 | 0 | 0.0 |
| cancellations | 1 | 100 | 0 | 0.0 |
| combined | 1 | 100 | 100 | 1.0 |
| failed_logins | 1 | 100 | 0 | 0.0 |
| normal_a | 0 | 80 | 0 | 1.0 |
| normal_b | 0 | 80 | 0 | 1.0 |
| normal_busy | 0 | 80 | 0 | 1.0 |
| normal_c | 0 | 80 | 0 | 1.0 |
| normal_sale_inventory_link | 0 | 80 | 80 | 0.0 |

## 5. Limitaciones e interpretación

- Las etiquetas se asignan por escenario sint?tico, no por fraude real verificado.
- Los resultados miden desempe?o en escenarios generados y no acreditan generalizaci?n a datos reales.
- La informaci?n mutua y las correlaciones son an?lisis exploratorios; no justifican por s? solas eliminar variables.
- El dataset candidato se gener? en memoria y no reemplaza el CSV publicado.
- El modelo evaluado no se ha publicado ni persistido.

## 6. Integridad de la ejecución

- Dataset generado en memoria: sí.
- CSV publicado modificado: no.
- Modelo publicado modificado: no.
- Metadatos modificados: no.
- Base de datos de entrenamiento modificada: no.

## 7. Reproducción

La ejecución se realizó dentro del contenedor ai-service usando la semilla 20261020 y los parámetros configurados en app.train_model. El JSON adjunto contiene el detalle estructurado de los resultados.