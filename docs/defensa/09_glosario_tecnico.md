# Glosario técnico

**Actor** — Usuario que ejecutó o se asocia a un evento. Puede ser nulo cuando la identidad no se conoce, por ejemplo, un login de una cuenta inexistente.

**API Gateway** — Servicio frontal que ofrece rutas `/api`, reenvía solicitudes a microservicios y realiza comprobaciones de permiso en rutas que lo requieren.

**Apellido compuesto** — Apellido anterior que puede contener espacios y no debe dividirse heurísticamente. En el backfill se conserva entero en `apellido_paterno`.

**Anomalía (`ANOMALO`)** — Clase de salida que indica parecido con los escenarios anómalos sintéticos usados para el entrenamiento; es una señal experimental para revisar, no fraude confirmado.

**Árbol de decisión** — Modelo de clasificación formado por nodos de condición, ramas y hojas que predicen clase.

**Baseline / línea base** — Clasificador sencillo de referencia, en este caso `DummyClassifier(strategy="most_frequent")`. Sirve para evaluar si el árbol supera una política trivial en las métricas escogidas.

**CART** — Árbol de clasificación y regresión binario. En este servicio se implementa con `DecisionTreeClassifier` de scikit-learn, criterio Gini y profundidad limitada.

**Característica / feature** — Valor numérico derivado de una ventana o relación de eventos, por ejemplo, `cancelled_sales_count`.

**Clasificación** — Asignación de una etiqueta discreta (`NORMAL` o `ANOMALO`) a un vector.

**Condición del árbol** — Comparación de la característica del nodo contra su umbral, por ejemplo `sales_count <= 3.5`.

**Correlación lógica** — Relación determinista entre eventos que comparten actor, entidad, secuencia o ventana. La aplica `logic-correlation-service`; no es el modelo CART.

**Dataset sintético** — Casos/eventos generados por escenarios y etiquetas definidas por reglas de generación. No son registros de clientes reales ni fraude verificado.

**Exactitud / accuracy** — Proporción total de predicciones correctas: `(VP + VN) / total`. Puede ocultar mal desempeño en una clase minoritaria.

**Exhaustividad / recall** — Para una clase, fracción de sus elementos reales que el modelo detecta: `VP / (VP + FN)`.

**F1-score** — Media armónica de precisión y recall: `2 × precision × recall / (precision + recall)`.

**F1 macro** — Media aritmética de F1 por clase; trata cada clase con igual peso, sin importar su frecuencia.

**Fuga de datos** — Uso indirecto de información de evaluación durante entrenamiento, por ejemplo repartir filas casi idénticas entre train/test. Agrupar vectores reduce una fuga específica, pero no garantiza validez externa.

**Gini** — Medida de impureza de un nodo: `1 − Σ p_k²`. Disminuye cuando un nodo concentra ejemplos de una clase.

**Hoja** — Nodo terminal del árbol; contiene la clase predicha y muestras de entrenamiento asociadas.

**Importancia global** — Estadística de cuánto contribuye una característica a las divisiones del modelo completo. No explica por sí sola una predicción individual.

**Matriz de confusión** — Conteo de clases verdaderas frente a predichas. En este proyecto la salida se guarda con etiquetas `[0,1]`, es decir, `[NORMAL, ANOMALO]`.

**Microservicio** — Servicio con responsabilidad de dominio y despliegue propio. En esta arquitectura, algunos comparten lenguaje o infraestructura, no base transaccional.

**Nivel de riesgo** — Categoría (`BAJO`, `MEDIO`, `ALTO`) producida por reglas en `explain.py` a partir de clase y score. No es una categoría académica calibrada.

**Nodo** — Punto del árbol que evalúa una condición; las ramas conducen a nodos hijos.

**Outbox** — Archivo JSON local donde el publicador conserva eventos hasta recibir confirmación. Es reintentable, pero no una tabla transaccional acoplada al commit de MySQL.

**Precisión / precision** — Entre predicciones positivas, fracción correcta: `VP / (VP + FP)`.

**Probabilidad `predict_proba`** — Score estimado de pertenencia a clase según el modelo entrenado. Aquí no se calibró como probabilidad de fraude real.

**Rama** — Salida izquierda/derecha de una condición del nodo. Un valor que no satisface `<= umbral` recorre derecha (`>`).

**Regla de correlación** — Condición programada (R1, R2, R3, R4, R5, R6) con descripción y valor. No es una condición aprendida por CART.

**Riesgo de fuga cross-service** — No es un término del código; se usa aquí para recordar que IDs entre bases no tienen FK global y requieren coherencia por APIs/procesos.

**Score** — Valor numérico de `predict_proba` para `ANOMALO`; no sustituye la clase ni es certeza.

**Semilla aleatoria** — Valor inicial que estabiliza la generación de fixtures o particiones pseudoaleatorias. No convierte datos sintéticos en representativos.

**Umbral** — Valor contra el que se compara una característica en un nodo del árbol.

**Ventana temporal** — Intervalo de eventos usado para conteos y reglas, por ejemplo 10 minutos para R1/R5.

**Vector de características** — Fila ordenada de valores numéricos que alimenta al modelo. El contrato expone 30; el artefacto CART usa 16.

**`analysis_id` / `input_id`** — IDs de trazabilidad. Correlador crea `analysis_id` y lo usa como `input_id` al llamar a IA; la respuesta se persiste enlazando eventos, correlación y clasificación.

