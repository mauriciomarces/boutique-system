# Logic Correlation Service

Microservicio de **correlación lógica y temporal de eventos** de Boutique SposaBella.

No clasifica comportamiento. Extrae relaciones, aplica reglas explícitas y genera características para `ai-service`.

- Tecnología: Node.js + Express
- Puerto: `4007`
- Persistencia v1: memoria (preparada para un almacén propio en el siguiente incremento; **no** usa `users-service` ni `sales-service`)

## Separación conceptual

```
EVENTOS → correlación lógica → características → (ai-service) Árbol de Decisión → clasificación
```

Las reglas (R1–R6) producen indicadores (`failed_login_rule`, etc.). **No** son la etiqueta del modelo ni una prueba de fraude.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio |
| POST | `/events` | Ingesta de un evento validado |
| GET | `/events` | Lista en memoria (`usuario_id`, `limit`) |
| POST | `/correlations/analyze` | Ventanas, secuencias y reglas |
| POST | `/features/generate` | Vector de características v1 |
| POST | `/analyze-and-classify` | Correlación + llamada a `ai-service` `/predict` |

### POST `/events`

```json
{
  "event_id": "evt-001",
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

## Tipos de evento

LOGIN, LOGOUT, LOGIN_FALLIDO, VENTA_CREADA, VENTA_ANULADA, VENTA_MODIFICADA, PRODUCTO_CREADO, PRODUCTO_MODIFICADO, STOCK_MODIFICADO, PRECIO_MODIFICADO, USUARIO_CREADO, USUARIO_MODIFICADO, USUARIO_DESACTIVADO, CAMBIO_ROL

## Ventanas

5, 10, 30 y 60 minutos respecto al último evento (o `reference_timestamp`).

## Reglas lógicas (indicadores, no veredicto)

- **R1**: ≥ 5 `LOGIN_FALLIDO` en 10 minutos
- **R2**: ≥ 3 `VENTA_ANULADA` en 30 minutos
- **R3**: `STOCK_MODIFICADO` → `VENTA_CREADA` en < 15 minutos
- **R4**: `PRECIO_MODIFICADO` → `VENTA_CREADA` en < 15 minutos
- **R5**: ≥ 3 acciones administrativas en 10 minutos
- **R6**: dos o más de las reglas anteriores

## Contrato futuro de emisión

Ver `backend/contracts/system-event.schema.json`. Los servicios de dominio podrán emitir este contrato más adelante; no es obligatorio modificarlos en esta iteración.

## Pruebas

```bash
pnpm --filter logic-correlation-service test
```

## Limitaciones

- Almacén en memoria (se pierde al reiniciar).
- Sin eventos reales de producción de SposaBella todavía.
- La clasificación vive exclusivamente en `ai-service`.
