# Integración: anulación persistente de ventas

## Estado y alcance

El entorno de integración aislado se levantó y verificó. Las pruebas usan dos
MySQL 8.4.11 independientes, una red interna sin salida, aliases DNS privados
para los nombres usados por los adaptadores runtime y volúmenes exclusivos.
No hay puertos publicados. El Compose principal no se inició ni modificó como
parte de estas pruebas.

Se ejecutaron 16 comprobaciones de integración con servicios reales y MySQL:
16 aprobadas, 0 fallidas. Además, se verificó por separado la persistencia de
una operación incompleta y su reanudación después de reiniciar únicamente
`sales-service`. Se ejecutaron también las pruebas unitarias de ventas y
gateway (5/5 cada una), y builds correctos de gateway y frontend. Los datos
sintéticos se conservan en los volúmenes para mantener evidencia.

Gateway no se desplegó end-to-end con `users-service`; la autorización de las
rutas reales de ventas se probó con un stub aislado, y el gateway con sus
pruebas unitarias. No hay un worker en segundo plano que recupere operaciones:
la recuperación comprobada es mediante reintento manual.

El build de frontend pasó. ESLint frontend no pasó por el diagnóstico
`react-hooks/set-state-in-effect` en `SalesPage.tsx` al invocar `loadData()`
desde el efecto de montaje. El diagnóstico ya existía antes de estos cambios y
no se modificó como parte del flujo de anulación.

## Topología aislada

`docker-compose.integration.yml` define el perfil opt-in `integration`:

- MySQL 8.4.11 para ventas e inventario, ambos saludables.
- Servicios de ventas e inventario en red privada `internal: true`.
- Stub de autorización y proxy de inventario con fallos reproducibles.
- Alias `mysql-sales` y `mysql-inventory`, que resuelven dentro de la red de
  integración a las bases sintéticas.
- Volúmenes exclusivos `boutique-annulment-it-sales-test-data` y
  `boutique-annulment-it-inventory-test-data`; no eliminarlos para conservar
  la evidencia.
- Ningún puerto publicado al host.

`integration.env.example` contiene solo marcadores. La configuración privada
de ejecución está en `.env.integration.local`, ignorada por Git y con ACL
restringida. No mostrar ni copiar sus valores. Los adaptadores runtime
mantienen sus credenciales y nombres de host existentes; la red aislada evita
que esos alias alcancen las bases del entorno principal. `DATABASE_URL` y
`INTEGRATION_INVENTORY_DATABASE_URL` se usan para CLI y harnesses, no para
redirigir por sí solos los adaptadores runtime.

La inicialización de ventas está automatizada por
`backend/services/sales-service/test/bootstrap-integration-schema.js`. El
script exige el host alias, la base `boutique_sales`, MySQL 8.4, `read_only=0`
y un hostname con formato de ID de contenedor antes de escribir. Solo crea
las tablas base si faltan todas; aplica el SQL de anulación únicamente si las
tres tablas faltan y las tablas padre existen; aborta ante estado parcial. Si
el esquema base está vacío, genera un schema temporal sin modelos de anulación
y dirige el cliente temporal a `/tmp`, para no reemplazar el Prisma Client
completo usado por el servicio.

Inventario se inicializó con su schema Prisma en la base aislada. El campo
`idempotency_key` tiene índice único. En ventas, el índice de soporte de la FK
`detalle_venta_id` está declarado explícitamente como
`fk_tarea_anulacion_detalle`, coincidiendo con MySQL. Los diffs de Prisma de
ambos servicios no reportaron diferencias.

`actualizada_en` conserva `DEFAULT CURRENT_TIMESTAMP` en SQL. Prisma la
actualiza con `@updatedAt`; el DDL no contiene `ON UPDATE CURRENT_TIMESTAMP`,
evitando dos mecanismos de actualización simultáneos.

## Reproducción

Ejecutar desde la raíz del repositorio en PowerShell. El archivo local de
entorno debe estar preparado de forma segura; nunca imprimirlo ni incluirlo en
logs o comandos con valores literales.

```powershell
$compose = @('-p', 'boutique-annulment-it', '--env-file', '.env.integration.local',
  '-f', 'docker-compose.integration.yml', '--profile', 'integration')

docker compose @compose config --quiet
docker compose @compose ps
docker compose @compose exec -T -w /app/backend/services/sales-service sales-service node test/bootstrap-integration-schema.js
docker compose @compose exec -T -w /app/backend/services/sales-service sales-service node test/integration-annulacion.integration.js core
docker compose @compose exec -T -w /app/backend/services/sales-service sales-service pnpm test
```

La secuencia separada de recuperación tras reinicio es:

```powershell
docker compose @compose exec -T -w /app/backend/services/sales-service sales-service node test/integration-annulacion.integration.js prepare-restart
docker compose @compose restart sales-service
docker compose @compose exec -T -w /app/backend/services/sales-service sales-service node test/integration-annulacion.integration.js finish-restart
```

El runner comprueba identidades de ambas bases y verifica directamente sus
datos. `prepare-restart` crea una operación reintentable y escribe solo la
fixture sintética necesaria; `finish-restart` verifica estados persistidos,
stock y cardinalidad del movimiento después del reinicio.

## Cobertura y resultados

El modo `core` aprobó 16 comprobaciones, que cubren:

1. Anulación de una venta con un detalle y estado final persistido.
2. Anulación de varios detalles y stock exacto por variante.
3. Repetición de la solicitud sin operación ni movimiento duplicado.
4. Repetición de una clave interna con mismo payload y conflicto `409` ante
   payload diferente; un solo movimiento.
5. Timeout después del commit y reconocimiento idempotente al reintentar.
6. Pérdida del lease en vuelo; el propietario nuevo completa sin duplicar.
7. Recuperación de una operación con lease vencido.
8. Dos solicitudes concurrentes, una sola operación y reversiones únicas.
9. Error transitorio antes del commit y recuperación manual.
10. Reintento de operación completada rechazado sin nuevos movimientos.
11. Secreto interno ausente o incorrecto rechazado con `401` y sin cambios.
12. Fallo parcial: venta y pagos siguen activos hasta que terminen todas las
    tareas; el reintento completa las restantes.
13. Progreso parcial no declara completada la anulación prematuramente.
14. Exactitud de stocks, claves y cantidad de movimientos.
15. Persistencia de eventos, tareas, estado y lectura de la ruta GET.
16. Autorización comercial, validación de IDs/estados/importes y venta
    inexistente.

El caso de timeout deja la respuesta inicial en `202 Accepted` y conserva
venta/pagos en su estado previo. El frontend comunica el estado pendiente en
vez de afirmar éxito. La respuesta terminal solo se considera completada tras
la persistencia de todas las reversiones exigidas.

La secuencia de reinicio también pasó: operación y tarea permanecieron
`REINTENTABLES`; después del reinicio la ruta manual de reintento completó la
venta, anuló los pagos e incrementó el stock exactamente una vez.

## Errores y recuperación

- Las rutas verificadas son `PATCH /ventas/:id/estado`,
  `GET /ventas/:id/anulacion` y `POST /ventas/:id/anulacion/reintentar`.
  A través del gateway, la consulta/reintento se expone bajo
  `/api/ventas/:id/anulacion` y `/api/ventas/:id/anulacion/reintentar`.
- Un fallo transitorio o timeout deja la tarea/operación reintentable. El
  endpoint de reintento manual recupera el resultado mediante la misma clave
  idempotente.
- Un lease vencido permite adquirir un nuevo propietario; el propietario
  anterior no puede finalizar con un token obsoleto.
- Una clave idempotente con payload igual recupera el movimiento existente;
  un payload distinto responde `409`.
- No se reintentan automáticamente operaciones pendientes: no hay worker
  periódico implementado. La operación requiere el endpoint manual.
- Una solicitud de reintento sobre operación terminal responde conflicto y
  no produce nuevos movimientos.

## Esquema, validación y límites

Validaciones ejecutadas:

- Compose de integración renderizado y validado.
- Identidad de contenedores y bases de test comprobada; MySQL sin puertos
  publicados, volúmenes exclusivos y red interna.
- `prisma validate` y comparación de schemas contra las DB de integración:
  ambos servicios sin diferencias.
- Pruebas unitarias: ventas 5/5 y gateway 5/5.
- Integración MySQL: 16/16; recuperación tras reinicio: aprobada.
- Builds de gateway y frontend: aprobados.
- `node --check` en JavaScript del módulo: aprobado.
- ESLint frontend: un diagnóstico previo `react-hooks/set-state-in-effect`
  en la carga inicial de `SalesPage.tsx`; no se oculta ni se atribuye al
  módulo de anulación.
- `git diff --check` global encuentra líneas en blanco al final en archivos
  preexistentes ajenos a esta tarea. Los archivos de esta tarea se revisan
  separadamente para no modificar trabajo no relacionado.

No se ejecutó gateway end-to-end con `users-service` real. Tampoco se generó
ni restauró un backup. No se implementó un worker automático.

## Datos, backups y limpieza

Los fixtures son sintéticos, con IDs autogenerados y stocks comprobados antes
y después. No se copiaron datos de las bases actuales. Para preservar la
evidencia, no se borraron fixtures ni se detuvieron/eliminaron contenedores,
redes o volúmenes.

No se generó ni restauró respaldo. Para un procedimiento futuro, documentar y
aprobar un backup consistente con `mysqldump --single-transaction`, ejecutar
solo tras verificar contenedor y base, proteger el archivo con ACL y checksum,
y probar restauración en un sandbox descartable. No se deben respaldar las
bases actuales como parte de esta prueba.

## Protección de las bases actuales

Todas las inicializaciones y escrituras se dirigieron al perfil aislado y sus
volúmenes exclusivos. `anulacion_persistente.sql` no se ejecutó en la base
actual de ventas; no se ejecutó DDL ni DML en las bases actuales de ventas o
inventario. No se modificó `.env`, no se hizo commit/push y no se ejecutó
limpieza destructiva de Docker.
