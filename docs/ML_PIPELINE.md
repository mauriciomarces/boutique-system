# Pipeline experimental de detección (SposaBella)

Este documento describe la **primera versión funcional** del análisis de eventos de Boutique SposaBella. No es un sistema productivo de fraude.

## Flujo

```
Eventos de usuarios / ventas / inventario / administración
        │
        ▼
logic-correlation-service :4007
        ├── normalización
        ├── ventanas 5 / 10 / 30 / 60 min
        ├── correlación de secuencias
        ├── reglas lógicas R1–R6 (indicadores)
        └── características
        │
        ▼
ai-service :4008
        ├── dataset sintético + referencia UCI
        ├── DecisionTreeClassifier
        ├── métricas e historial de entrenamientos
        └── predicción + explicación
        │
        ▼
NORMAL | ANOMALO  (señal de riesgo, no prueba de fraude)
```

## Qué hace cada pieza

| Pieza | Responsabilidad |
|--------|-----------------|
| Correlación lógica | Relaciones temporales y reglas explícitas entre eventos |
| Árbol de decisión | Clasificación supervisada a partir de características etiquetadas por escenario |
| Detección | Aplicar el modelo a un vector nuevo |

## Datos

1. **Públicos (UCI Online Retail):** comportamiento transaccional de referencia. Sin etiqueta de fraude SposaBella.
2. **Sintéticos:** sesiones de boutique con etiqueta conocida por diseño del escenario.
3. **Reales SposaBella:** pendientes de un historial de eventos suficiente.

## Contrato de evento futuro

`backend/contracts/system-event.schema.json`

Los microservicios de dominio no están obligados a emitir eventos en esta iteración.

## Cómo demostrar el pipeline

1. `python generate_dataset.py`
2. `python train.py`
3. Levantar `logic-correlation-service` y `ai-service`
4. `POST /events` y `POST /features/generate`
5. `POST /predict` o `POST /analyze-and-classify`
6. Ver iteraciones en `/analisis/entrenamiento`

## Dashboard

- Entrenamiento: `/analisis/entrenamiento` (experimental)
- Detección: `/analisis/deteccion` (módulo separado; no mezcla métricas de entrenamiento con alertas)
