# Anulación persistente de ventas

## Arquitectura y consistencia

`sales-service` registra una operación de anulación, una tarea por detalle de venta y eventos de auditoría en `boutique_sales`. No abre conexiones a la base de datos de inventario. Para cada tarea llama al endpoint interno de `inventory-service`, que actualiza la existencia y crea el movimiento dentro de una única transacción MySQL.

Cada reversión utiliza el movimiento `ENTRADA`, referencia `VENTA` y una clave estable:

```text
VENTA:<venta_id>:DETALLE:<detalle_venta_id>:ANULACION
```

Los reintentos conservan esta clave. Inventario compara el contenido de la solicitud con el movimiento existente; un payload distinto con la misma clave obtiene HTTP 409. La restricción única del inventario es la última defensa frente a solicitudes concurrentes; si la creación del movimiento falla, la transacción revierte también el cambio de existencias.

La operación usa los estados `PENDIENTE`, `EN_PROCESO`, `REINTENTABLE` y `COMPLETADA`. Cada tarea usa los mismos estados. El procesador reclama la operación mediante una actualización condicional y un token propietario. Renueva el lease de 120 segundos antes de cada tarea y fase de finalización; las solicitudes al inventario tienen un timeout de 15 segundos. Las actualizaciones de tareas, eventos y finalización vuelven a verificar estado, token y vigencia del lease en transacciones breves. Si el propietario cambia tras una llamada de inventario, el trabajador antiguo no persiste resultados; el propietario siguiente reintenta con la misma clave.

Solo se marcan la venta y los pagos como `ANULADO` después de comprobar dentro de una transacción que todas las tareas están completadas. Una venta ya anulada puede completar una operación recuperada y reconciliar sus pagos; una venta en cualquier otro estado inesperado no se declara completada.

## Contratos HTTP y autorización

Las rutas del servicio son accesibles a través del gateway:

| Gateway | Permiso |
| --- | --- |
| `PATCH /api/ventas/:id/estado` con `{ "estado": "ANULADA", "motivo": "..." }` | `VENTAS_EDITAR` |
| `GET /api/ventas/:id/anulacion` | `VENTAS_LEER` |
| `POST /api/ventas/:id/anulacion/reintentar` | `VENTAS_EDITAR` |

La anulación y el reintento responden 200 cuando la operación está `COMPLETADA`, 202 mientras siga pendiente/en proceso o requiera reintento, y 409 para conflictos de estado. La consulta devuelve 404 si la venta todavía no tiene una operación. El gateway conserva el significado de 200/202 y no revela credenciales internas.

El endpoint de inventario `POST /internal/ventas/movimientos` no se expone en el gateway. Requiere `x-sales-inventory-secret`, compara el secreto en tiempo constante, valida cantidades e IDs y devuelve el movimiento guardado. Solo los servicios de ventas e inventario deben compartir `SALES_INVENTORY_INTERNAL_SECRET`.

## Recuperación y configuración

La recuperación disponible es **manual**; no hay worker ni tarea programada que vuelva a reclamar operaciones automáticamente. El lease vencido permite que una solicitud posterior reclame y reanude una operación. Una operación `REINTENTABLE` se retoma con:

```http
POST /api/ventas/:id/anulacion/reintentar
```

También puede repetirse el `PATCH` de anulación: si existe una operación persistida, se recupera esa operación y no se generan claves nuevas. El usuario puede consultar su estado con `GET /api/ventas/:id/anulacion`. No se debe informar que una operación pendiente se completará sola.

Variables relacionadas (no incluir sus valores en logs ni documentación):

- `SALES_INVENTORY_INTERNAL_SECRET`: obligatorio y compartido por ambos servicios. Se declara como requisito en `docker-compose.yml`; el `.env` local debe configurarlo antes de iniciar Compose.
- `INVENTORY_SERVICE_URL`: URL interna que usa ventas para llamar a inventario.
- `USERS_SERVICE_URL` e `INTERNAL_SERVICE_SECRET`: validación de permisos de ventas mediante `users-service`.
- `SALES_SERVICE_DATABASE_URL` e `INVENTORY_SERVICE_DATABASE_URL`: conexiones independientes de Prisma para cada servicio.

La configuración `.env` existente al revisar este cambio no incluye `SALES_INVENTORY_INTERNAL_SECRET`. No se ha editado ese archivo ni se ha generado un secreto local.

## Pruebas

Ejecutar pruebas unitarias del procesador:

```powershell
pnpm --filter sales-service test
```

Las pruebas usan un Prisma simulado y un endpoint de inventario simulado para verificar el flujo del procesador, la clave estable ante timeout y la pérdida del lease. **No** verifican transacciones MySQL, el índice único real ni comunicación entre contenedores.

Validar los esquemas sin conectarse ni cambiar datos:

```powershell
$env:DATABASE_URL = 'mysql://validation:validation@127.0.0.1:3306/validation_only'
pnpm --filter sales-service exec prisma validate
pnpm --filter inventory-service exec prisma validate
```

## SQL preparado, aún no aplicado

No ejecutar hasta contar con autorización explícita, respaldo y ventana de mantenimiento. Ambos archivos son DDL no idempotente: el SQL de ventas crea tres tablas; el de inventario añade una columna y un índice único. Si una tabla, columna o índice ya existe, no ejecutar a ciegas ni repetir el archivo.

1. Confirmar la identidad de cada base con `SELECT DATABASE()` y revisar, solo con consultas de lectura, que no existan las tablas `operaciones_anulacion`, `tareas_anulacion` o `eventos_anulacion` en `boutique_sales`, ni la columna `idempotency_key` o el índice `uq_movimientos_idempotency_key` en `boutique_inventory`. Antes de una futura aplicación, estas son las comprobaciones de lectura recomendadas en cada sesión MySQL:

   ```sql
   USE boutique_inventory;
   SELECT DATABASE();
   SHOW COLUMNS FROM movimientos_inventario LIKE 'idempotency_key';
   SHOW INDEX FROM movimientos_inventario
     WHERE Key_name = 'uq_movimientos_idempotency_key';

   USE boutique_sales;
   SELECT DATABASE();
   SHOW TABLES LIKE 'operaciones_anulacion';
   SHOW TABLES LIKE 'tareas_anulacion';
   SHOW TABLES LIKE 'eventos_anulacion';
   ```
2. Respaldar ambas bases y detener ventas e inventario para evitar incompatibilidades entre código y esquema.
3. Aplicar primero el cambio de inventario y después el de ventas. Los servicios tienen bases independientes; el primero habilita la deduplicación necesaria para que el procesador pueda recuperar una respuesta perdida.
4. Reiniciar los servicios, comprobar conexión, permisos y una prueba controlada en entorno aislado antes de habilitar el flujo.

Comandos previstos para una futura ejecución autorizada desde la raíz del repositorio Windows (no ejecutados en esta tarea; `-p` solicita la contraseña en la terminal):

```cmd
docker compose stop sales-service inventory-service
cmd.exe /d /c "mysql --protocol=TCP --host=127.0.0.1 --port=3310 --user=boutique -p boutique_inventory < backend\services\inventory-service\prisma\add_idempotency_key.sql"
cmd.exe /d /c "mysql --protocol=TCP --host=127.0.0.1 --port=3311 --user=boutique -p boutique_sales < backend\services\sales-service\prisma\anulacion_persistente.sql"
docker compose start inventory-service sales-service
```

Antes de esos comandos se debe configurar `SALES_INVENTORY_INTERNAL_SECRET` en `.env`; actualmente está ausente en la copia local revisada. Si las comprobaciones encuentran un esquema parcialmente aplicado, detenerse y preparar un script de reconciliación revisado en lugar de ejecutar los archivos tal cual.

## Limitaciones

- No existe recuperación automática; operaciones incompletas requieren consulta y reintento explícito.
- No se ejecutaron SQL, migraciones, `prisma db push` ni pruebas de integración con MySQL o Docker.
- No se demostró la existencia de dos instancias MySQL de prueba aisladas con `boutique_sales` y `boutique_inventory`, ni se verificó que los `DATABASE_URL` efectivos apunten a ellas. Ese aislamiento, datos sintéticos, secreto interno de prueba y servicios dirigidos únicamente a esas instancias son requisitos previos para probar carreras de claves únicas, rollback de transacciones y recuperación entre servicios.
- Los archivos SQL y las restricciones reales solo podrán verificarse en las bases cuando se autorice una fase posterior.
