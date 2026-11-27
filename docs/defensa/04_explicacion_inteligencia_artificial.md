# Inteligencia artificial: CART, datos y evaluación

## Qué hace el componente

`ai-service` expone una API FastAPI para validar un vector operativo, consultar el artefacto CART vigente y devolver clase, nivel de riesgo, score, factores globales informativos y las divisiones recorridas. El servicio de correlación calcula reglas y características; la IA no recibe texto libre ni registros personales de clientes para construir la clase.

El flujo es: eventos validados → ventanas/relaciones → vector de características → `DecisionTreeClassifier` → `NORMAL` o `ANOMALO` → presentación. El arranque del contenedor no entrena automáticamente. El código central está en [correlation.js](../../backend/services/logic-correlation-service/src/correlation.js#L194), [main.py](../../backend/services/ai-service/app/main.py#L140) y [train_model.py](../../backend/services/ai-service/app/train_model.py#L301).

## Conceptos explicados

- **Aprendizaje supervisado**: se entrena usando ejemplos que ya tienen una etiqueta. En esta versión, las etiquetas proceden de familias sintéticas predefinidas, no de un comité que haya verificado fraude real.
- **Clasificación**: asignar a una observación una clase discreta. Aquí, `0 = NORMAL` y `1 = ANOMALO`.
- **Árbol de decisión**: secuencia de preguntas sobre una característica y un umbral. Cada nodo interno evalúa una condición; cada rama es el resultado de esa condición; cada hoja contiene la clase predicha.
- **CART**: árboles de clasificación/regresión binarios. La configuración actual de scikit-learn usa divisiones binarias y el criterio Gini.
- **Impureza Gini**: para un nodo con proporciones de clase \(p_k\), \(Gini = 1 - \sum_k p_k^2\). Vale 0 cuando el nodo contiene una sola clase. El algoritmo busca umbrales que reduzcan la impureza ponderada de los hijos.
- **Profundidad máxima 5**: limita la longitud máxima de la ruta para reducir complejidad y facilitar la inspección; no garantiza ausencia de sobreajuste.
- **`min_samples_leaf=5`**: cada hoja debe contener al menos cinco muestras de entrenamiento; limita hojas extremadamente pequeñas, pero no convierte las muestras sintéticas en evidencia real.
- **`random_state=42`**: estabiliza las operaciones aleatorias controladas por scikit-learn; por sí solo no hace reproducible un entorno con versiones/datos distintos.

Los parámetros comprobables están en [config.py](../../backend/services/ai-service/app/config.py#L29); el clasificador se instancia en [train_model.py](../../backend/services/ai-service/app/train_model.py#L189).

## Variables de entrada: distinguir 30 del subconjunto CART

`FEATURE_COLUMNS` contiene **30** valores de contrato calculados por correlación. `MODEL_FEATURE_COLUMNS` excluye tiempos genéricos, conteos globales de eventos, las banderas de reglas y `risk_rule_count`; el modelo vigente recibe **16**:

1. `failed_login_count`
2. `successful_login_count`
3. `failed_login_ratio`
4. `sales_count_5m`
5. `sales_count`
6. `sales_without_stock_link_count`
7. `cancelled_sales_count`
8. `cancellation_ratio`
9. `stock_change_count`
10. `price_change_count`
11. `admin_action_count`
12. `role_change_count`
13. `user_change_count`
14. `sales_after_stock_change`
15. `sales_after_price_change`
16. `unique_entities_modified`

La lista y exclusión están en [config.py](../../backend/services/ai-service/app/config.py#L39). Se conservaron las 16 entradas actuales. No se propone cambiar el vector ni el entrenamiento como parte de esta guía.

Los valores se extraen de eventos ordenados, deduplicados por `event_id` y recortados respecto de la hora de referencia. Se calculan conteos en ventanas de 5/10/30 minutos, proporciones, relaciones de ventas/anulaciones, operaciones de administración y entidades únicas. Ejemplos:

- `failed_login_ratio = fallos / (fallos + logins correctos)`, o 0 si no hubo logins.
- `cancellation_ratio = anulaciones / (ventas creadas + anulaciones)`, o 0 si no hubo operaciones.
- `sales_without_stock_link_count` solo cuenta ventas maduras (al menos 15 minutos desde su creación) sin salida de stock enlazada y excluye ventas anuladas.
- `sales_after_stock_change` cuenta ventas enlazadas por `venta_id`, actor compatible y tiempo. Es una relación, no un supuesto de fraude.

La implementación está en [extract_features Python](../../backend/services/ai-service/app/features.py#L201), el cálculo equivalente en [correlación JavaScript](../../backend/services/logic-correlation-service/src/correlation.js#L194) y las ventanas/constantes en [constants.js](../../backend/services/logic-correlation-service/src/constants.js#L1). Hay pruebas de paridad entre ambas implementaciones; no son dos fuentes independientes de datos.

## Etiquetas, fuente de datos y fuga

El dataset `expansion_v3` declara 800 casos: 560 normales sintéticos y 240 anómalos simulados; cada una de ocho familias contiene ambas clases. Sus etiquetas describen intervenciones sintéticas predefinidas. La generación marca `label_source` como `synthetic_normal_scenario` o `synthetic_anomaly_scenario`; véase [dataset.py](../../backend/services/ai-service/app/dataset.py#L85), [manifest_v3.json](../../backend/services/ai-service/data/synthetic/expansion_v3/manifest_v3.json) y [evaluation_report_v3.json](../../backend/services/ai-service/data/synthetic/expansion_v3/evaluation_report_v3.json).

El reporte registra 348 ocurrencias duplicadas de vector de características y cero vectores contradictorios; la interpretación exacta de ese contador debe mantenerse como la denomina el reporte (`duplicate_feature_vectors`), no como “348 casos únicos”. La validación agrupada por hash de vector mantiene los duplicados idénticos en un solo pliegue. La prueba adicional reserva dos familias completas, `alcance_administrativo` y `patron_combinado`, para medir transferencia a esas familias sintéticas no vistas. Eso reduce una forma de fuga entre duplicados/familias, pero no valida datos operativos reales.

El dataset UCI Online Retail se usa únicamente como referencia opcional de intensidad transaccional; no tiene etiquetas de fraude de SposaBella. El manifiesto de dataset procesado indica `used_local_file: false`; la guía de datos detalla la procedencia en [data/README.md](../../backend/services/ai-service/data/README.md).

## Entrenamiento y estado de publicación

La función `train_decision_tree` carga y valida columnas, separa los grupos de escenario, entrena en el conjunto de entrenamiento y calcula métricas en test. Devuelve una evaluación experimental en memoria; no persiste el árbol y explícitamente informa `model_version=None`, `model_path=""` y `estado=EVALUACION_EXPERIMENTAL`. Véase [train_model.py](../../backend/services/ai-service/app/train_model.py#L169).

El artefacto actual declara versión `v2`, dataset `expansion_v3`, fecha `2026-10-29`, 800 registros y los parámetros CART arriba descritos, en [model_metadata.json](../../backend/services/ai-service/models/model_metadata.json). La metadata guarda métricas de evaluación por familias, no métricas de producción.

**Límite importante**: `POST /train` responde `409` y dice que el entrenamiento/publicación está deshabilitado; véase [main.py](../../backend/services/ai-service/app/main.py#L201) y el test [test_api.py](../../backend/services/ai-service/tests/test_api.py#L40). La documentación de [AI Service README](../../backend/services/ai-service/README.md#L30) aún indica `python train.py` y describe `/train` como activo. Además, `train.py` llama `save_training_run` con la salida de evaluación, pero esta carece de `fecha_entrenamiento` y tiene `model_version=None`, mientras `db.py` exige `fecha_entrenamiento` y una columna no nula. No se ejecutó ese script porque `init_db()` puede crear tablas en la base configurada. Debe corregirse/documentarse por separado antes de afirmar que el reentrenamiento manual funciona.

## Métricas que constan y cómo se interpretan

La metadata del modelo vigente y el reporte V3 registran una prueba por familias no vistas de 200 casos: 140 normales y 60 anómalos. La matriz, en orden `[NORMAL, ANOMALO]`, es:

```text
[[140, 0],
 [ 16, 44]]
```

Así, para esa partición sintética:

- **Exactitud (accuracy)**: \((140 + 44) / 200 = 0.92\). Fracción total de clases correctas. Puede ocultar fallos de la clase minoritaria.
- **Precisión de ANOMALO**: \(44 / (44 + 0) = 1.00\). Entre las predicciones anómalas, qué fracción era anómala según las etiquetas sintéticas.
- **Exhaustividad/recall de ANOMALO**: \(44 / (44 + 16) \approx 0.7333\). Detecta 44 de 60; deja 16 falsos negativos en el holdout.
- **F1 de ANOMALO**: \(2PR/(P+R) \approx 0.8462\). Media armónica de precisión y recall.
- **F1 macro**: media aritmética del F1 de NORMAL y el de ANOMALO, ponderando ambas clases por igual. Metadata: 0.896.
- **Matriz de confusión**: filas son etiqueta real `[NORMAL, ANOMALO]`, columnas predicción `[NORMAL, ANOMALO]`; los valores revelan 16 anómalos no detectados en el holdout.
- **Balanced accuracy**: media del recall por clase; en la evaluación de 200 casos es 0.8667.

La validación cruzada `StratifiedGroupKFold` de cinco pliegues agrupada por hash de vector registra 0.9775 de accuracy y 0.925 de recall anómalo agregado. Debe presentarse separada de la prueba de familias reservadas. No se debe escoger solo la cifra más alta: el baseline `most_frequent` tiene accuracy 0.70 y recall de anomalía 0 en esa distribución desbalanceada. Fuente: [evaluation_report_v3.json](../../backend/services/ai-service/data/synthetic/expansion_v3/evaluation_report_v3.json) y [model_metadata.json](../../backend/services/ai-service/models/model_metadata.json).

Las definiciones de cálculo en código están en [classification_metrics](../../backend/services/ai-service/app/train_model.py#L107). Estas métricas son rendimiento respecto de etiquetas sintéticas, no sensibilidad/especificidad clínica ni detección real de fraude.

## Predicción y explicación de una persona

1. `/predict` requiere las 30 columnas del contrato; valida valores finitos, conteos enteros/no negativos, proporciones `[0,1]` y banderas binarias. Después construye la tabla con las 16 columnas del metadata.
2. El modelo devuelve clase y `predict_proba`; el score de anomalía es la salida para clase 1. El código aclara que no está calibrada como probabilidad de fraude real.
3. `decision_path` del objeto entrenado identifica nodos visitados. `decision_path_details` toma la característica del nodo, el valor de esa observación, el umbral, si se cumplió `<=`, la rama izquierda/derecha y la hoja final. No genera reglas posteriores inventadas.
4. `feature_importances` produce factores generales del modelo. No equivale al recorrido individual; la UI los etiqueta por separado.
5. En el frontend se distinguen eventos relacionados, características del clasificador, reglas lógicas, pasos de CART, hoja final y estado de notificación. Véase [DetectionPage](../../frontend/web/src/analysis/pages/DetectionPage.tsx#L527).

El riesgo se calcula con umbrales en [explain.py](../../backend/services/ai-service/app/explain.py#L23): NORMAL es BAJO; ANOMALO sin score es MEDIO; con score ≥0.75 es ALTO, ≥0.55 MEDIO y menor BAJO. Estos valores son categorías definidas por la aplicación, no una certificación de riesgo financiero.

## Ejemplo reproducible del modelo vigente

Se cargó el artefacto actual en una imagen Python 3.12 ya existente, con el directorio del servicio montado de solo lectura, red deshabilitada y archivos temporales en `/tmp`; no se inició FastAPI ni se consultó/modificó una base. Los escenarios y el seed están en [scenarios.py](../../backend/services/ai-service/app/scenarios.py#L54) y la transformación en `extract_features`.

Para una venta con salida de stock enlazada, `sales_count=1`, `sales_without_stock_link_count=0`, sin fallos de login ni actividad administrativa, el artefacto produjo `NORMAL` y score de clase ANOMALO `0.01616`. El recorrido real fue:

1. `admin_action_count = 0 <= 2.5` → izquierda.
2. `sales_count = 1 <= 3.5` → izquierda.
3. `sales_after_price_change = 0 <= 0.5` → izquierda.
4. `failed_login_ratio = 0 <= 0.528` → izquierda.
5. `sales_without_stock_link_count = 0 <= 0.5` → izquierda.
6. Hoja 5: `NORMAL`, 557 muestras de entrenamiento en esa hoja.

Para cinco intentos fallidos, tres anulaciones y tres acciones administrativas, los valores relevantes fueron `failed_login_count=5`, `cancelled_sales_count=3`, `admin_action_count=3` y `sales_without_stock_link_count=0`. El artefacto produjo `ANOMALO`, score 1.0, con un paso: `admin_action_count = 3`; el split evaluó `<= 2.5`, no se cumplió y tomó la rama derecha; hoja 14, clase ANOMALO, 90 muestras.

Estos dos resultados se pueden reproducir pasando esos eventos ficticios por `app.features.extract_features` y el modelo de `app.config.CURRENT_MODEL_PATH`. Son dos ejemplos ilustrativos del artefacto local actual, no un benchmark, no evidencia clínica/operativa y no una predicción sobre una persona real. La semántica del score está definida en [main.py](../../backend/services/ai-service/app/main.py#L140).

## Preguntas difíciles y respuesta honesta

- **¿Por qué el árbol no usa `failed_login_rule` directamente?** La bandera pertenece a las 30 características de correlación, pero no a las 16 entradas actuales CART. El árbol puede usar el conteo/proporción subyacente; no se deben confundir ambos sistemas.
- **¿Un F1 macro 0.896 demuestra buen desempeño productivo?** No. Solo resume esa partición sintética por dos familias. Hace falta validación humana y datos reales con etiquetas de referencia para hablar de transferencia.
- **¿Por qué aparecen muchos vectores duplicados?** El reporte V3 registra 348 filas marcadas como vector repetido. Se agruparon por hash para que iguales no crucen folds, pero la repetición indica diversidad limitada y dependencia de patrones de generación.
- **¿El score 1.0 significa 100 % de probabilidad de fraude?** No. Es `predict_proba` sobre clases de escenarios sintéticos y no está calibrada para fraude real.
- **¿El sistema aprende automáticamente con las ventas?** No. El arranque no entrena; `/train` está deshabilitado. La IA clasifica con el artefacto disponible.

