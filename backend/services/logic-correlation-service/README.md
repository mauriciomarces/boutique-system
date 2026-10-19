# Logic Correlation Service

Microservicio de **correlación lógica y temporal de eventos** de Boutique SposaBella.

No clasifica comportamiento. Extrae relaciones, aplica reglas explícitas y genera características para `ai-service`.

- Tecnología: Node.js + Express
- Puerto: `4007`
- Persistencia: SQLite propio en `CORRELATION_DATA_DIR` (volumen `logic-correlation-data` en Compose); no usa las bases de usuarios, ventas ni IA. Los índices cubren usuario/fecha, servicio/fecha, tipo/fecha e historial de análisis.

## Separación conceptual

```
EVENTOS → correlación lógica → características → (ai-service) Árbol de Decisión → clasificación
```

R1, R2 y R5 son señales deterministas de actividad; R6 indica que se activaron dos o más de esas tres. No son la etiqueta del modelo ni una prueba de fraude. R3 describe una relación de negocio válida y R4 conserva contexto temporal, sin tratarlos como señales de riesgo.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio |
| POST | `/events` | Ingesta de un evento validado |
| GET | `/events` | Lista persistida (`usuario_id`, `service`, `tipo_evento`, `from`, `to`, `limit`) |
| GET | `/analyses` | Historial persistido de resultados clasificados |
| POST | `/correlations/analyze` | Ventanas, secuencias y reglas |
| POST | `/features/generate` | Vector de características v1 |
| POST | `/analyze-and-classify` | Correlación + llamada a `ai-service` `/predict` |

### POST `/events`

```json
{
  "event_id": "evt-001",
  "service": "sales-service",
  "usuario_id": 10,
  "tipo_evento": "VENTA_CREADA",
  "entidad": "venta",
  "entidad_id": 150,
  "timestamp": "2026-09-19T18:00:00Z",
  "resultado": "EXITOSO",
  "ip": "192.168.1.20",
  "metadata": {}
}
```

No se persisten campos personales innecesarios (`password`, `correo`, `telefono`, etc.).
`usuario_id` puede ser `null` para eventos sin actor identificable (por ejemplo, un intento de acceso para una cuenta inexistente). La ingesta devuelve `201` para un evento nuevo, `200` para un reintento idéntico y `409` si se reutiliza un ID con otro contenido.

## Tipos de evento

LOGIN, LOGOUT, LOGIN_FALLIDO, VENTA_CREADA, VENTA_ANULACION_SOLICITADA, VENTA_ANULACION_EN_PROCESO, VENTA_ANULADA, VENTA_MODIFICADA, PAGO_REGISTRADO, PRODUCTO_CREADO, PRODUCTO_MODIFICADO, STOCK_MODIFICADO, PRECIO_MODIFICADO, USUARIO_CREADO, USUARIO_MODIFICADO, USUARIO_DESACTIVADO, CAMBIO_ROL

## Ventanas

5, 10, 30 y 60 minutos respecto al último evento (o `reference_timestamp`).

## Reglas y relaciones (indicadores, no veredicto)

- **R1**: ≥ 5 `LOGIN_FALLIDO` en 10 minutos
- **R2**: ≥ 3 `VENTA_ANULADA` en 30 minutos
- **R5**: ≥ 3 acciones administrativas en 10 minutos
- **R6**: dos o más señales entre R1, R2 y R5
- **R3 (relación)**: asocia una salida de stock con `VENTA_CREADA` mediante `metadata.venta_id`, actores compatibles y una diferencia temporal absoluta menor a 15 minutos. No eleva el riesgo por sí sola.
- **R4 (contexto)**: cuenta ventas temporalmente próximas a cambios de precio; no activa una regla de riesgo.

El emisor de ventas usa `creado_en` como marca temporal de la venta; inventario emite el movimiento después de confirmar la salida y añade `referencia_tipo=VENTA`, `venta_id` y `tipo_movimiento`. Un evento solo se asocia por el identificador de venta y la ventana temporal; la cercanía por sí sola no basta. Los eventos duplicados idénticos se cuentan una vez y colisiones de `event_id` con otro contenido se rechazan.

## Emisión y trazabilidad

Ver `backend/contracts/system-event.schema.json` y `backend/contracts/event-publisher.js`. Users, products, sales e inventory guardan eventos pendientes en un outbox por servicio con reintento y timeout; el volumen del outbox permite reanudar tras reinicios. Una falla de envío se registra y no altera la respuesta de la operación comercial.

La persistencia del outbox es local y durable, pero no es una outbox transaccional acoplada a cada commit de MySQL: un cierre abrupto entre el commit de negocio y la escritura local puede perder ese evento. El correlacionador almacena eventos y análisis en `correlation.sqlite`, aplica claves únicas e índices y conserva la base en el volumen. Al iniciar, importa transaccionalmente `events.jsonl` y `analyses.jsonl` si existen; no elimina esos archivos. Un JSONL malformado o una colisión de identificadores detiene el inicio y deja los datos de origen intactos.

`/analyze-and-classify` solo procesa eventos de un usuario por solicitud (o eventos anónimos explícitos), persiste el resultado exitoso con `analysis_id`, intervalo, referencias a eventos, características, relaciones, reglas y respuesta del modelo. `input_id` enlaza la solicitud de predicción con el análisis y `model_version` identifica el modelo. El score `probabilidad` corresponde a `predict_proba` para la clase sintética ANÓMALO; no es una probabilidad calibrada de fraude real.

## Pruebas

```bash
pnpm --filter logic-correlation-service test
```

## Limitaciones

- Sin eventos reales de producción de SposaBella todavía.
- La clasificación vive exclusivamente en `ai-service`.
- La emisión y la entrega son reintentables, pero no ofrecen atomicidad transaccional entre MySQL y el outbox local.
