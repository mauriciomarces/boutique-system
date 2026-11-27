# Inventario de evidencias para la defensa

Preparar evidencia real desde una instancia aislada. Este inventario no contiene capturas ni resultados visuales ficticios.

| Evidencia | Qué demuestra | Dónde obtenerla y qué debe verse | Precaución |
|---|---|---|---|
| Diagrama de arquitectura | Flujo navegador→Nginx/Gateway→servicios y datos separados. | Diagrama Mermaid de [arquitectura](./01_arquitectura_y_componentes.md), contrastado con `docker-compose.yml`. | No dibujar un broker de eventos ni FK entre bases si no existen. |
| Pantalla de login | Autenticación de cuenta y apertura de sesión. | `/login`; captura sin correo completo, tokens ni datos de red. | Usar cuenta de prueba; ocultar datos sensibles. |
| Permisos | Control por roles y permiso efectivo. | Administración de roles/usuarios y rutas protegidas. Mostrar rol y permisos ficticios, no tokens. | No afirmar que ocultar una ruta en React es autorización. |
| Apellidos de usuario y cliente | Contrato web/API separado y representación de apellido materno opcional. | Formularios de usuarios y clientes; mostrar dos campos. | No usar información personal real. Las bases deben ser de demostración. |
| Producto y variante | Categoría, producto, SKU, talla, color y precio. | `/administracion/productos`; seleccionar una variante visible. | No reutilizar IDs de un entorno operativo. |
| Compra y proveedor | Relación local compra/detalle/proveedor y entrada de inventario. | `/administracion/compras`; compra ficticia con detalle y total. | No presentar una transacción de prueba como compra real. |
| Inventario y movimiento | Cantidad actual e historial de movimiento por variante. | `/administracion/inventario`; incluir referencia/tipo/cantidad. | Explicar que el ID de variante cruza servicios sin FK global. |
| Venta con cliente | Cliente, línea de detalle, total y operación comercial. | `/administracion/ventas`; desplegar venta y cliente completo. | El nombre mostrado viene de la relación actual, no de snapshot histórico. |
| Evento de operación | Contrato válido y atributos mínimos del evento. | Tabla de eventos o respuesta de correlación: `event_id`, servicio, tipo, actor, entidad, fecha y resultado. | Anonimizar actor; no mostrar IP ni metadata innecesaria. |
| Outbox y persistencia | Reintento/acuse y almacenamiento de eventos. | Inspección controlada del código y consulta del almacén de prueba; mostrar estado y IDs, no el archivo completo si contiene eventos ajenos. | No exponer outbox de producción. |
| Reglas lógicas | Umbrales R1/R2/R5, relaciones R3/R4 y valor observado. | `/analisis/deteccion`, sección “Correlación lógica”. | Aclarar que R3 es relación válida y R4 contexto. |
| Predicción y recorrido CART | Clase y los nodos reales que recorrió el modelo. | Misma pantalla, sección “Explicación de la decisión CART”: variable, valor, umbral, cumplimiento, rama y hoja. | El recorrido debe corresponder al `model_version` que se muestra. |
| Eventos de soporte | Contexto temporal del resultado. | Secuencia cronológica con `event_id`, tipo, servicio y timestamp. | Son evidencias de eventos, no prueba de fraude. |
| Notificación | Creación condicional y estado de lectura. | `/administracion/notificaciones`; mensaje y badge de “Nueva/Leída”. | Confirmar que corresponde al `analysis_id`; no crear filas manuales. |
| Artefacto y metadata | Parámetros, versión, 16 características y métricas asociadas. | `models/model_metadata.json`, inspección de modelo y `GET /model` si el stack aislado responde. | No mostrar joblib o metadata como si fueran un entrenamiento de producción. |
| Matriz de confusión | Errores por clase en prueba sintética. | `evaluation_report_v3.json` o metadata vigente; filas reales, columnas predichas. | Indicar holdout/familias, distribución y naturaleza sintética. |
| Pruebas | Comportamientos cubiertos por pruebas automatizadas. | Salida del comando ejecutado en este entorno, guardada como evidencia si la institución lo permite. | Diferenciar unitarias, integración MySQL y E2E real. |
| Despliegue | Contenedores declarados y salud. | Compose aislado y `docker compose ps`/health checks si se ejecuta en ensayo. | No mostrar valores de entorno, credenciales ni IDs internos sensibles. |
| Migración de apellidos | SQL aditivo de backfill y comparación de conteos antes/después en copia de prueba. | Ejecutar solo en una DB aislada aprobada; capturar esquema y agregados, sin filas personales. | Las migraciones no se han aplicado en este trabajo. No usar la DB existente para producir la captura. |
| Seed de demostración | Preview, seed, idempotencia y escenarios controlados. | Salida del preview; luego ejecución en DB aislada y segunda ejecución con mismo seed. | En esta tarea no se ejecutó la carga persistente ni se produjeron capturas. |

## Resultados de validación ya ejecutados

Estos resultados corresponden al estado de la rama al preparar esta guía. Son pruebas automatizadas/builds; no son evidencia de producción ni de una demostración visual:

- `pnpm --dir backend\services\users-service test`: 18/18.
- `pnpm --dir backend\services\sales-service test`: 16/16.
- `pnpm --dir backend\services\products-service test`: 3/3.
- `pnpm --dir backend\services\logic-correlation-service test`: 32/32.
- `pnpm --dir backend\gateway test`: 13/13; `pnpm --dir backend\gateway build`: correcto.
- Frontend `pnpm --dir frontend\web build`: TypeScript y Vite correctos. Vite muestra una advertencia no bloqueante de chunk JavaScript mayor de 500 kB.
- IA: 22/22 con pytest en contenedor Python 3.12, red deshabilitada, código montado de solo lectura y persistencia temporal. Hubo advertencias deprecadas de FastAPI/Starlette y advertencias de caché pytest por el montaje de solo lectura.
- Generador: `node --check` y `node --test backend\scripts\demo-data\seed-demo-data.test.js`: 11/11. El preview `--service all --count 3 --seed 42 --scenario both` confirmó que no conectó a bases ni escribió archivos.
- Prisma `validate` y generación de los clientes de users/sales pasaron en la fase previa de implementación. No hubo cambios de esquema después de esa validación.

No se ejecutaron migraciones, `prisma db push`, carga `--apply`, conexión a MySQL persistente, ni una prueba de red Gateway→users-service→sales/inventory/AI/notifications en este estado.

## Capturas sugeridas, en orden

1. Inicio de sesión y panel.
2. Usuario ficticio con los dos apellidos y rol visible.
3. Producto con variante/SKU.
4. Compra y movimiento de entrada.
5. Existencia antes y después de una venta.
6. Venta con el cliente.
7. Timeline de eventos de caso normal.
8. Reglas y características del caso normal.
9. Recorrido CART NORMAL.
10. Timeline y reglas del escenario anómalo sintético.
11. Recorrido CART ANOMALO y explicación explícita de “señal para revisión”.
12. Notificación de análisis y estado leído.
13. Consola de pruebas con versión/fecha del comando y código de salida.

