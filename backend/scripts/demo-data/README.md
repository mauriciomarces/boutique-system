# Datos ficticios de demostración

`seed-demo-data.js` crea datos ficticios e idempotentes con nombres y descripciones verosímiles. No representan personas ni comercios reales; los correos usan dominios reservados `.invalid` para evitar contactar direcciones reales. Por defecto solo permite bases aisladas `_demo`, `_test` o `_integration`; la vista previa es el comportamiento predeterminado y no se conecta a ninguna base. El modo operativo está deshabilitado salvo que se solicite explícitamente con `--allow-operational`, una confirmación aparte y las bases locales exactas incluidas en la lista permitida. No use este modo contra producción ni despliegues compartidos.

## Requisitos

- Node.js 22 (el servicio de correlación usa `node:sqlite`).
- Dependencias instaladas con pnpm, incluido `mariadb` del `products-service`.
- Bases MySQL separadas ya inicializadas con el esquema actual y migraciones aditivas aplicadas en users y sales. Este script no ejecuta migraciones ni `db push`.
- Para eventos: una carpeta SQLite dedicada/aislada, vacía en su primer uso y separada del directorio persistente del servicio de correlación.
- Para cargar los eventos operativos: el contenedor `boutique-logic-correlation-service` debe estar iniciado y actualizado con `post-events-to-correlation.js`.

No se crean credenciales ni usuarios que puedan iniciar sesión: los usuarios ficticios quedan `INACTIVO`, con rol sin permisos y sin fila de credenciales. Los correos usan el dominio reservado `example.invalid`.

## Vista previa y ejecución por servicio

En PowerShell, desde la raíz del repositorio:

```powershell
node backend\scripts\demo-data\seed-demo-data.js --service all
node backend\scripts\demo-data\seed-demo-data.js --service products --count 4 --seed 23
```

La primera línea muestra el plan sin conectarse. Para aplicar cambios, configure en la sesión las variables de entorno para bases exclusivas de prueba:

```powershell
$env:DEMO_USERS_DATABASE_URL = "mysql://<usuario>:<contraseña>@127.0.0.1:3306/boutique_users_demo"
$env:DEMO_PRODUCTS_DATABASE_URL = "mysql://<usuario>:<contraseña>@127.0.0.1:3306/boutique_products_demo"
$env:DEMO_INVENTORY_DATABASE_URL = "mysql://<usuario>:<contraseña>@127.0.0.1:3306/boutique_inventory_demo"
$env:DEMO_SALES_DATABASE_URL = "mysql://<usuario>:<contraseña>@127.0.0.1:3306/boutique_sales_demo"
$env:DEMO_CORRELATION_DATA_DIR = "$env:TEMP\sposabella-correlation-demo"
$env:DEMO_SEED_CONFIRM = "I_UNDERSTAND_TEST_DATABASE_ONLY"
node backend\scripts\demo-data\seed-demo-data.js --service all --count 3 --seed 42 --apply
```

No coloque valores reales de conexión en archivos versionados ni comparta la salida de configuración. También puede ejecutar `users`, `products`, `inventory`, `sales` o `events` individualmente. El orden recomendado es: usuarios, productos, inventario, ventas y eventos. Inventario y ventas requieren las variantes creadas en `products` para el mismo seed; las ventas además requieren el inventario de ese seed, porque el script crea una salida de stock idempotente antes de confirmar la venta. `events` requiere usuarios, productos y ventas preexistentes con ese seed.

## Carga de demostración en las bases locales de Compose

Este modo solo se debe usar tras verificar que Compose apunta a las bases locales de desarrollo autorizadas. Permite exactamente `boutique_users:3308`, `boutique_products:3309`, `boutique_inventory:3310` y `boutique_sales:3311`, en `localhost` o `127.0.0.1`; también reconoce los alias de Compose `mysql-users`, `mysql-products`, `mysql-inventory` y `mysql-sales` en el puerto interno 3306 y los traduce a los puertos locales publicados al ejecutarse desde el host. Solo usa las variables ya configuradas `*_SERVICE_DATABASE_URL`; el script no imprime sus valores. Se niega a ejecutar limpieza en modo operativo. La tabla auxiliar `_demo_seed_registry` se crea aditivamente para mantener las claves de idempotencia; no modifica tablas de negocio.

El siguiente ejemplo crea diez registros por conjunto y dos grupos de eventos reproducibles. Use una ruta temporal nueva para el JSON; el modo `wx` rechaza sobrescribir un archivo existente. El timestamp se calcula en UTC al momento de la ejecución para que los eventos queden dentro de las ventanas de correlación:

```powershell
$eventFile = Join-Path $env:TEMP ("sposabella-seed-events-" + [guid]::NewGuid().ToString("N") + ".json")
$referenceTime = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
node -r dotenv/config backend\scripts\demo-data\seed-demo-data.js --service all --count 10 --seed 20261125 --scenario both --reference-time $referenceTime --events-output $eventFile --allow-operational
```

Lea la vista previa y confirme el nombre de los servicios seleccionados antes de aplicar. Si es correcto, vuelva a ejecutar con `--apply` y la confirmación operativa temporal:

```powershell
$env:DEMO_OPERATIONAL_SEED_CONFIRM = "I_UNDERSTAND_LOCAL_OPERATIONAL_SYNTHETIC_DATA"
node -r dotenv/config backend\scripts\demo-data\seed-demo-data.js --service all --count 10 --seed 20261125 --scenario both --reference-time $referenceTime --events-output $eventFile --allow-operational --apply
Remove-Item Env:\DEMO_OPERATIONAL_SEED_CONFIRM
```

Este modo no resetea credenciales: los usuarios ficticios se crean inactivos y sin autenticación, y los clientes/productos/ventas quedan identificados por el registro del seed. Compruebe los datos después de cada ejecución, porque los registros de demostración se ven en las pantallas de la instancia local.

Si los datos de negocio ya están cargados y necesita eventos con una ventana temporal reciente, ejecute solo `events`, conserve el `--seed` de las referencias existentes y elija un `--event-seed` nuevo. Así se crean IDs de evento distintos sin volver a insertar usuarios, productos, compras ni ventas:

```powershell
$eventFile = Join-Path $env:TEMP ("sposabella-events-" + [guid]::NewGuid().ToString("N") + ".json")
$referenceTime = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$env:DEMO_OPERATIONAL_SEED_CONFIRM = "I_UNDERSTAND_LOCAL_OPERATIONAL_SYNTHETIC_DATA"
node backend\scripts\demo-data\seed-demo-data.js --service events --seed 20261125 --event-seed 20261126 --count 10 --scenario both --reference-time $referenceTime --events-output $eventFile --allow-operational --apply
Remove-Item Env:\DEMO_OPERATIONAL_SEED_CONFIRM
```

La semilla `--seed` identifica los registros fuente y `--event-seed` solamente genera IDs de eventos únicos. Registre el timestamp usado para que el análisis pueda filtrar la misma ventana temporal.

El seed escribe las filas de negocio, pero **no escribe directamente en la base de eventos**. Para pasar el JSON al servicio real mediante `POST /events`, desde PowerShell:

```powershell
docker cp backend\scripts\demo-data\post-events-to-correlation.js boutique-logic-correlation-service:/tmp/post-events-to-correlation.js
docker cp $eventFile boutique-logic-correlation-service:/tmp/sposabella-seed-events.json
docker compose exec -T logic-correlation-service node /tmp/post-events-to-correlation.js /tmp/sposabella-seed-events.json
docker compose exec -T logic-correlation-service rm -f /tmp/post-events-to-correlation.js /tmp/sposabella-seed-events.json
```

El cliente solo envía eventos cuyo `event_id` y metadatos los identifican como sintéticos; muestra conteos de `created`/`duplicate` y detiene la carga ante respuestas no exitosas. El API valida y persiste los eventos en su almacenamiento configurado. No elimine el archivo local hasta verificar la recepción; luego puede borrarlo puntualmente con `Remove-Item $eventFile`.

La repetición del mismo seed evita filas de negocio duplicadas y el endpoint de eventos responde `duplicate` si ya recibió los mismos eventos. No use `--cleanup` con `--allow-operational`; la herramienta lo rechaza. Si se necesita retirar datos operativos sintéticos, hágalo solo mediante un proceso de limpieza revisado que verifique todas las relaciones y dependencias, no borrando tablas o registros manualmente.

Para escenarios de eventos, `--scenario normal`, `--scenario anomalous` o `--scenario both` permite seleccionar el caso; `--reference-time` acepta una fecha ISO UTC y por defecto usa una referencia fija reproducible. Configure `DEMO_CORRELATION_DATA_DIR` con una carpeta dedicada cuyo nombre contenga `demo`, `test` o `integration`. Ejemplo: `C:\temp\sposabella-correlation-demo`. No apunte al directorio `backend\services\logic-correlation-service\data`. La carga `events` requiere previamente usuarios, productos y ventas del mismo seed; se puede ejecutar por separado con `--service events`.

El caso normal registra eventos sintéticos `VENTA_CREADA` y `STOCK_MODIFICADO` enlazados mediante `venta_id`. El caso anómalo registra cinco `LOGIN_FALLIDO`, tres `VENTA_ANULADA` y tres `USUARIO_MODIFICADO` del mismo actor, dentro de las ventanas utilizadas por R1, R2 y R5. Esos eventos no anulan ventas reales ni cambian usuarios; son evidencia de escenario controlado, no fraude demostrado.

La semilla controla atributos pseudoaleatorios reproducibles (tallas, colores, cantidades de compra y cantidades vendidas); `--count` determina la cantidad por conjunto. La semilla y el contador hacen estables los identificadores naturales y las claves de propiedad. Cada base MySQL tiene una tabla auxiliar `_demo_seed_registry`; se escribe en la misma transacción que los registros y permite repetir el comando sin duplicar filas ya registradas. Como cada microservicio tiene su propia base, `all` no es una transacción distribuida: si un servicio falla, los anteriores pueden haber terminado. El comando es idempotente y se puede repetir con el mismo seed; revise el error antes de continuar.

## Análisis, notificaciones y limpieza

El script no inserta filas directamente en análisis ni notificaciones. Según la arquitectura, los análisis se crean al ejecutar `/analyze-and-classify` con el servicio de IA, y las notificaciones pertenecen a su servicio; inventar esas salidas eludiría la clasificación real y podría presentarlas como resultados operativos. Para demostrar esos módulos, seleccione explícitamente los eventos en una instancia de correlación/IA configurada para pruebas y etiquete la evidencia como sintética.

La limpieza es opt-in y por seed; para no dejar referencias entre servicios, se recomienda `--service all`, que procesa las ventas, el inventario y los productos en ese orden. Una limpieza por servicio solo afecta ese almacén y puede dejar temporalmente referencias cruzadas de demostración hasta que se limpien los demás conjuntos. Solo elimina IDs guardados en `_demo_seed_registry` o `demo_seed_registry`, en orden inverso de dependencias. Se niega a borrar usuarios activados o enlazados a autenticación/empleo, roles relacionados, ventas con historial de anulación, clientes con ventas, variantes todavía referenciadas, y eventos usados por análisis persistidos. No elimina tablas, bases, volúmenes ni registros sin propiedad registrada.

```powershell
node backend\scripts\demo-data\seed-demo-data.js --service all --seed 42 --cleanup
$env:DEMO_SEED_CONFIRM = "I_UNDERSTAND_TEST_DATABASE_ONLY"
node backend\scripts\demo-data\seed-demo-data.js --service all --seed 42 --cleanup --apply
```

## Pruebas del generador

```powershell
node --test backend\scripts\demo-data\seed-demo-data.test.js
```

Las pruebas validan modos seguros, límites, confirmación operativa, destinos locales permitidos, separación de actores, escenarios de eventos y claves reproducibles; no conectan con MySQL. La prueba del cliente de eventos usa respuestas HTTP simuladas; la verificación de una carga real debe revisar el conteo agregado en el API.
