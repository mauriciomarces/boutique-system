# Pipeline experimental de análisis de eventos

El análisis mantiene separadas tres funciones: el correlador relaciona operaciones y evalúa reglas deterministas, `ai-service` extrae el mismo vector de características en Python y el árbol clasifica ese vector. Una clasificación `ANOMALO` es una señal experimental, no una confirmación de fraude.

## Procedencia y límites de los datos

- Los eventos emitidos por los servicios de dominio usan el contrato de [system-event.schema.json](../backend/contracts/system-event.schema.json); quedan primero en un outbox local y solo se retiran cuando el correlador confirma `event_id` y estado de ingesta.
- El correlador persiste los eventos aceptados y los análisis en su SQLite/volumen. La respuesta HTTP por sí sola no demuestra persistencia duradera.
- El dataset de entrenamiento lleva `scenario` y `label_source`. Sus etiquetas son asignadas por familias de escenarios sintéticos; no son historiales ni etiquetas verificadas de SposaBella.
- El dataset UCI Online Retail se usa únicamente como referencia de cantidades minoristas y no contiene etiquetas de anomalía.
- Los indicadores deterministas (`*_rule` y `risk_rule_count`) y las variables temporales genéricas (`event_count_*`, `events_per_minute` y tiempos desde eventos) siguen disponibles para análisis, pero no forman parte de las entradas del árbol. La evaluación aislada había mostrado dependencia exclusiva de `events_per_minute` y fallos al clasificar cancelaciones moderadas; excluir esos atajos obliga a evaluar señales de comportamiento, como intentos fallidos, anulaciones y actividad administrativa.
- La evaluación mantiene familias de escenarios completas fuera de entrenamiento y compara el árbol con `DummyClassifier(most_frequent)`. Registra matriz de confusión, precisión, exhaustividad, F1 por clase, F1 macro y diferencia frente a la referencia.
- Tras registrar esa evaluación agrupada, el modelo de inferencia se ajusta con todas las filas del dataset sintético para incluir las familias reservadas; las métricas siguen describiendo únicamente la evaluación agrupada, no el ajuste final ni datos reales.
- Una evaluación agrupada entre escenarios sintéticos no demuestra calidad en datos reales. No hay evidencia de detección de fraude real ni probabilidad calibrada.

## Relaciones y señales

`VENTA_CREADA` conserva la fecha de creación de negocio y el ID de venta. La salida del inventario conserva `venta_id`, tipo de movimiento y variante. R3 enlaza los dos eventos por `venta_id`, actor compatible y ventana temporal menor de 15 minutos; un cambio de stock no relacionado no se empareja. Un cambio de precio cercano queda como contexto, no como señal de riesgo.

Las señales deterministas actuales son cinco o más inicios de sesión fallidos en 10 minutos (R1), tres o más anulaciones en 30 minutos (R2), y tres o más acciones administrativas en 10 minutos (R5). R6 indica al menos dos de R1, R2 y R5. Estos indicadores no equivalen a una etiqueta del árbol.

## Demostración aislada reproducible

Los siguientes comandos crean salidas de IA en directorios temporales dentro de un contenedor descartable. Las pruebas usan SQLite temporal y no consultan ni modifican las bases activas, los datasets ni los modelos existentes. No publican puertos ni ejecutan `/train` sobre el servicio desplegado.

En PowerShell desde la raíz del repositorio:

```powershell
pnpm --filter logic-correlation-service test
pnpm --filter products-service test
pnpm --filter sales-service test

$aiImage = "sposabella-ai-validation-" + [guid]::NewGuid().ToString("N") + ":local"
docker build --file infrastructure\docker\Dockerfile.ai --tag $aiImage .
if ($LASTEXITCODE -ne 0) { throw "No se pudo construir la imagen de pruebas de IA." }
docker run --rm --entrypoint python `
  -e AI_DATA_DIR=/tmp/sposabella-demo-data `
  -e AI_MODELS_DIR=/tmp/sposabella-demo-models `
  -e AI_METRICS_DIR=/tmp/sposabella-demo-metrics `
  -e DATABASE_URL=sqlite:////tmp/sposabella-demo-history.sqlite `
  $aiImage -m pytest tests/test_features.py tests/test_train.py tests/test_api.py -q
$aiTestExit = $LASTEXITCODE
docker image rm $aiImage | Out-Null
if ($aiTestExit -ne 0) { throw "Fallaron las pruebas aisladas de IA." }
```

Estas pruebas ejercitan los casos siguientes:

1. **Operación normal**: venta y salida de stock correlacionadas mediante `venta_id`; la salida posterior por 270 ms se asocia con la venta sin elevar por sí sola una regla de riesgo.
2. **Señal sintética**: intentos de login fallidos repetidos y anulaciones repetidas activan reglas deterministas ya definidas; no se presenta un cambio de precio ni el volumen alto como evidencia suficiente.
3. **Eventos y persistencia del correlador**: las pruebas de API validan una ingesta, su rechazo/idempotencia, la recuperación desde el almacén y la persistencia del análisis en el directorio temporal.
4. **Paridad**: un mismo conjunto de eventos se compara entre el vector de JavaScript y `app.features` de Python.
5. **Predicción y explicación**: la suite de IA entrena con sus rutas temporales, consulta `/predict`, comprueba `input_id`, `model_version`, camino del árbol y respuesta a características inválidas. El manifiesto/metadatos guardan las métricas y comparación con la referencia sencilla.
6. **Trazabilidad de clasificación**: la prueba del correlador simula la respuesta del modelo; comprueba la relación entre `analysis_id`, `input_id`, eventos y recuperación posterior. No reemplaza una prueba de red con ambos servicios desplegados.

Para revisar métricas de un entrenamiento temporal en detalle, se pueden inspeccionar los metadatos producidos por `test_train.py` durante una ejecución aislada; no se deben copiar/promover a `models/` del repositorio.

## Endpoints

- `logic-correlation-service`: `/health`, `/events`, `/correlations/analyze`, `/features/generate`, `/analyze-and-classify`, `/analyses`.
- `ai-service`: `/health`, `/predict`, `/train`, `/training`, `/metrics`, `/model`.

`/analyze-and-classify` persiste únicamente cuando la clasificación se completa y vincula respuesta, eventos, características, relaciones y reglas mediante `analysis_id`. El servicio de IA devuelve `input_id` y `model_version`. Una ejecución aislada con predictor simulado verifica la persistencia lógica, no una garantía de almacenamiento en producción.

## Pendiente para una validación operativa

No se debe probar la persistencia sobre volúmenes o bases activos. Una demostración desplegada requiere un stack de integración con credenciales y bases exclusivas de prueba, health checks de ambos servicios y verificación posterior de lecturas; no se declara aprobada hasta ejecutar ese stack aislado. Las etiquetas continúan siendo sintéticas hasta disponer de revisión humana y datos de referencia de SposaBella.
