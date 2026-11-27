# Guía de código por módulos

## Cómo usar esta guía

Las líneas identifican los puntos de entrada que conviene abrir en el IDE. Explicar el flujo y sus contratos, no leer cada línea. “Entrada” y “salida” describen el código inspeccionado. Los fragmentos esenciales aparecen primero; los complementarios sirven para preguntas de seguimiento.

## Autenticación

**Esencial**

- [Login en users-service](../../backend/services/users-service/src/index.js#L2871): recibe correo y contraseña; normaliza el correo, busca usuario y credencial, comprueba verificación/estado/rol/permisos, compara hash y emite tokens. Genera eventos de login fallido y login correcto.
- [Registro público](../../backend/services/users-service/src/index.js#L2097): recibe `nombre`, `apellido_paterno`, `apellido_materno`, correo, teléfono y contraseña; normaliza, valida, guarda usuario/credencial/código dentro de transacción y continúa verificación por correo.
- [AuthUser](../../frontend/web/src/auth/types/auth.types.ts#L1) y [RegisterPage](../../frontend/web/src/auth/pages/RegisterPage.tsx#L90): contrato web con apellidos separados.
- [Proxy de login Gateway](../../backend/gateway/src/app.controller.ts#L140): reenvía al users-service y conserva los headers de limitación pertinentes; las rutas autenticadas propagan Authorization.

**Complementario**

- [Refresh/logout](../../backend/services/users-service/src/index.js#L3115) y [tokens Prisma](../../backend/services/users-service/prisma/schema.prisma#L79).
- [Payload JSON del usuario](../../backend/services/users-service/src/index.js#L131): incluye campos nuevos, omite la columna histórica y convierte BigInt.

**Por qué**: users-service centraliza identidades y credenciales, mientras los demás servicios verifican permisos o reciben contexto a través de componentes internos.

**Pregunta probable**: “¿El JWT por sí solo decide todo permiso?”  
**Respuesta**: No. El backend verifica el token y deriva permisos efectivos desde las relaciones vigentes; las rutas críticas consultan autorización. La interfaz también oculta rutas, pero eso no sustituye al control servidor.

## Autorización y permisos

- [Cálculo de permisos efectivos](../../backend/services/users-service/src/permisos.js#L38): entrada: usuario con roles activos y permisos disponibles; salida: lista ordenada de permisos. ADMIN se trata como acceso al catálogo vigente.
- [Middleware de productos](../../backend/services/products-service/src/authorization.js#L1): intercepta escrituras de categorías, productos y variantes, y consulta el endpoint interno de validación.
- [Gateway: validación para análisis](../../backend/gateway/src/app.controller.ts#L1334): aplica permiso antes de consultar eventos, clasificar o administrar entrenamiento.
- [Rutas protegidas de React](../../frontend/web/src/App.tsx#L160): `RequireAuth` más `RequirePermission`; solo aporta protección de navegación.

**Pregunta probable**: “¿Qué impide que alguien invoque directamente un endpoint?”  
**Respuesta**: La API vuelve a comprobar token/permisos. La protección del cliente mejora UX, no es la frontera de seguridad.

## Usuarios y apellidos

- [Modelo Prisma users](../../backend/services/users-service/prisma/schema.prisma#L123): nombre, dos apellidos nuevos, y `apellido` antiguo retenido para transición.
- [Normalizador de nombres](../../backend/services/users-service/src/person-names.js#L1): valida nombre obligatorio y paterno; admite materno opcional.
- [Serialización](../../backend/services/users-service/src/index.js#L131), [registro](../../backend/services/users-service/src/index.js#L2097), [actualización administrativa](../../backend/services/users-service/src/index.js#L1687) y [perfil](../../backend/services/users-service/src/index.js#L3287): respuestas públicas usan los campos nuevos.
- [Seed de roles y admin](../../backend/services/users-service/src/index.js#L156): inserta catálogo de roles/permisos; la cuenta inicial solo se crea si hay configuración y el `upsert` no actualiza la credencial de un usuario existente.
- [Migración de usuarios](../../backend/services/users-service/prisma/migrations/20261125_split_surnames/migration.sql#L1): añade columnas, copia el apellido previo completo a paterno y conserva la columna antigua. No separa por espacios.
- [UI de administración](../../frontend/web/src/admin/pages/AdminUsersPage.tsx#L30) y [formulario de registro](../../frontend/web/src/auth/pages/RegisterPage.tsx#L159): presentan ambos apellidos.

**Pregunta probable**: “¿Cómo se conserva un apellido compuesto?”  
**Respuesta**: El backfill asigna la cadena histórica íntegra a `apellido_paterno` y deja `apellido_materno` nulo. No hay división automática.

## Clientes

- [Modelo `clientes`](../../backend/services/sales-service/prisma/schema.prisma#L10): nombre, apellidos separados y campo histórico de transición.
- [Normalización](../../backend/services/sales-service/src/client-data.js#L71): exige nombre y paterno, valida materno opcional, crea además una cadena temporal para mantener la columna histórica.
- [CRUD de clientes](../../backend/services/sales-service/src/index.js#L257): búsqueda, consulta, creación y edición devuelven únicamente el contrato nuevo.
- [Cliente al crear venta](../../backend/services/sales-service/src/ventas.routes.js#L197): valida que exista y esté activo.
- [Reportes](../../backend/services/sales-service/src/reportes.routes.js#L161): arma el nombre mostrado con campos disponibles. La venta conserva una FK al cliente, no una copia histórica del nombre.
- [Frontend](../../frontend/web/src/clients/types/clients.types.ts#L1), [validación](../../frontend/web/src/clients/utils/clientsValidation.ts#L1), [selector en ventas](../../frontend/web/src/sales/pages/SalesPage.tsx#L1197).
- [Migración de clientes](../../backend/services/sales-service/prisma/migrations/20261125_split_client_surnames/migration.sql#L1): copia completa y aditiva; no aplicada.

## Productos y variantes

- [Catálogo](../../backend/services/products-service/src/index.js#L273): consulta y operaciones de producto/categoría.
- [Escritura de productos](../../backend/services/products-service/src/index.js#L342): valida categoría y persistencia.
- [Variantes](../../backend/services/products-service/src/variantes.routes.js#L111): SKU, talla, color y precio se almacenan en una fila variante enlazada localmente a producto.
- [Autorización de escritura](../../backend/services/products-service/src/authorization.js#L23): validación de permiso contra users-service.
- [Schema](../../backend/services/products-service/prisma/schema.prisma#L10): relaciones internas categoría/producto/variante.

**Pregunta probable**: “¿Inventario tiene una FK a la variante?”  
**Respuesta**: No en la base de inventario; `variante_producto_id` es un ID de dominio compartido. Las bases son separadas y se valida la existencia mediante integración/API cuando corresponde.

## Compras

- [Crear compra](../../backend/services/inventory-service/src/index.js#L1279): valida proveedor, fecha y detalles; calcula subtotales/total; guarda compra/detalles, aumenta existencias y registra entradas dentro de transacción.
- [Anular compra](../../backend/services/inventory-service/src/index.js#L1453): comprueba stock suficiente antes de revertir cantidades y estado.
- [Schema inventory](../../backend/services/inventory-service/prisma/schema.prisma#L10): proveedor→compra→detalle; existencia única por variante; movimientos con referencia.
- [Gateway](../../backend/gateway/src/app.controller.ts#L390), [UI](../../frontend/web/src/inventory/pages/PurchasesPage.tsx#L92).

**Pregunta probable**: “¿Qué pasa si se intenta anular una compra cuyo stock ya se consumió?”  
**Respuesta**: La ruta compara existencia con cantidad a revertir y rechaza el cambio si no hay stock suficiente.

## Inventario

- [Existencias](../../backend/services/inventory-service/src/index.js#L697): consulta cantidades y filtros.
- [Movimientos](../../backend/services/inventory-service/src/index.js#L846): consulta y registra movimientos con tipo/referencia; admite un límite opcional validado de 1 a 100 para resúmenes pequeños.
- [Validación del límite](../../backend/services/inventory-service/src/pagination.js#L1) y [prueba de límites](../../backend/services/inventory-service/test/pagination.test.js#L6): permiten omitir el límite o usar 1–100 y rechazan valores malformados.
- [Validación de solicitud de salida desde venta](../../backend/services/inventory-service/src/index.js#L221): verifica secreto interno y actor.
- [Schema](../../backend/services/inventory-service/prisma/schema.prisma#L38): existencia por variante y movimiento con clave idempotente opcional.
- [Frontend](../../frontend/web/src/inventory/pages/InventoryPage.tsx#L54).

## Panel administrativo y navegación

- [Redirección tras login](../../frontend/web/src/auth/pages/LoginPage.tsx#L59): dirige al panel principal, no a la lista de usuarios.
- [Ruta del panel](../../frontend/web/src/App.tsx#L152) y [sidebar compartido](../../frontend/web/src/administration/components/AdministrationSidebar.tsx#L26): establecen una entrada común para ADMIN y estado activo accesible del menú.
- [Panel](../../frontend/web/src/panel/pages/PanelPage.tsx#L303): resume ventas válidas e ingresos del mes, anulaciones, variantes con stock bajo y movimientos recientes. Consulta endpoints existentes y muestra errores de carga explícitos; módulos/acciones visibles dependen de permisos.
- [Límite de movimientos](../../backend/services/inventory-service/src/index.js#L846): el panel pide solo los movimientos recientes; el límite se valida antes de consultar.

**Pregunta probable**: “¿El panel muestra todas las operaciones del sistema en tiempo real?”  
**Respuesta**: No. Es un resumen de endpoints existentes y métricas mensuales; no se presenta como un stream en tiempo real ni como una transacción global.

## Reportes, filtros y paginación

- [Filtros de interfaz](../../frontend/web/src/reports/pages/ReportsPage.tsx#L335): fechas desde/hasta, estado de venta, ID/nombre de cliente, ID de venta, rango de importe, estado y método de pago.
- [Validación y consulta](../../backend/services/sales-service/src/reportes.routes.js#L351): normaliza y valida los filtros; la consulta aplica condiciones sobre venta, cliente relacionado y pagos.
- [Paginación reutilizable](../../frontend/web/src/components/PaginationControls.tsx#L42): tamaño de página seleccionable y navegación común; se reutiliza en listas extensas. La paginación de pantalla no recorta la versión impresa ni la exportación completa del reporte.
- [Pruebas de filtros](../../backend/services/sales-service/test/reportes.routes.test.js#L163): comprueban combinaciones de fechas, cliente, importes, venta y pago, además de entradas inválidas.
- Los límites de fecha de los reportes se interpretan como días calendario de Bolivia (`America/La_Paz`, UTC-4), aunque las marcas de tiempo consultadas se representan como instantes UTC. El reporte mensual también agrupa cada venta según ese día local.

**Pregunta probable**: “¿El filtro por fechas mide la fecha del pago?”  
**Respuesta**: En el reporte de ventas, desde/hasta filtra la fecha local de la venta. Los filtros de estado y método restringen pagos relacionados; no debe confundirse con un reporte por fecha de liquidación del pago.

## Ventas, clientes y reportes

- [Crear venta](../../backend/services/sales-service/src/ventas.routes.js#L197): valida cliente, variantes, cantidad/precio, calcula subtotales, invoca inventario y persiste venta/detalles/pagos según el flujo.
- [Anulación](../../backend/services/sales-service/src/ventas.routes.js#L666): opera con estado, lease y clave idempotente; las acciones de recuperación son explícitas.
- [CRUD clientes](../../backend/services/sales-service/src/index.js#L257), [reporte de venta](../../backend/services/sales-service/src/reportes.routes.js#L161), [schema sales](../../backend/services/sales-service/prisma/schema.prisma#L10).
- [Frontend de ventas](../../frontend/web/src/sales/pages/SalesPage.tsx#L93): selector de cliente y variante, formularios y detalle.

**Pregunta probable**: “¿La venta y la salida de stock son una sola transacción ACID?”  
**Respuesta**: No, son servicios y bases separados. El código aplica coordinación, reintentos e idempotencia, pero no hay transacción distribuida. Existe riesgo de operación parcial y la conciliación/reintento debe explicarse.

## Eventos: contrato, productores y outbox

- [JSON Schema común](../../backend/contracts/system-event.schema.json#L1): campos obligatorios, tipos admitidos, límites de `metadata` y rechazo de campos extra.
- [Validación compartida](../../backend/contracts/system-event.js#L11): normaliza/valida antes de aceptar el evento.
- [Publicador](../../backend/contracts/event-publisher.js#L81): construye ID, fecha, actor y metadata; valida; persiste en outbox JSON de permisos restringidos; intenta entregar y conserva pendientes ante error.
- [Productores](../../backend/services/users-service/src/index.js#L2871), [ventas](../../backend/services/sales-service/src/ventas.routes.js#L547), [compras](../../backend/services/inventory-service/src/index.js#L1430), [movimientos de stock](../../backend/services/inventory-service/src/index.js#L976) y [productos](../../backend/services/products-service/src/index.js#L440).

**Pregunta probable**: “¿El outbox hace atómica la escritura del negocio y el evento?”  
**Respuesta**: No. Es persistente y reintentable, pero se escribe localmente después del procesamiento del dominio y no es una tabla outbox en la misma transacción MySQL. Una caída en la ventana entre commit y escritura puede perder ese evento.

## Correlación y características

- [Ingesta y endpoints](../../backend/services/logic-correlation-service/src/index.js#L29): valida evento y persiste; repetición igual es idempotente, colisión con contenido distinto es conflicto.
- [Resolución de eventos](../../backend/services/logic-correlation-service/src/index.js#L81): valida filtros/actor, acepta eventos explícitos o lee los persistidos y evita mezclar usuarios sin filtro.
- [Reglas](../../backend/services/logic-correlation-service/src/correlation.js#L132), [extracción](../../backend/services/logic-correlation-service/src/correlation.js#L194), [relación venta-stock](../../backend/services/logic-correlation-service/src/correlation.js#L72), [persistencia](../../backend/services/logic-correlation-service/src/store.js#L77).

## Entrenamiento, predicción y explicación CART

- [Vector y parámetros](../../backend/services/ai-service/app/config.py#L29): 30 características generales; el árbol usa un subconjunto explícito de 16.
- [Etiquetas por escenarios](../../backend/services/ai-service/app/dataset.py#L85): el `label_source` declara la procedencia sintética.
- [Split por familia](../../backend/services/ai-service/app/train_model.py#L61), [métricas](../../backend/services/ai-service/app/train_model.py#L107), [evaluación experimental](../../backend/services/ai-service/app/train_model.py#L169).
- [Validación de request y predict](../../backend/services/ai-service/app/main.py#L66), [recorrido real del árbol](../../backend/services/ai-service/app/train_model.py#L301), [respuesta interpretada](../../backend/services/ai-service/app/explain.py#L23).
- [Endpoint `/train`](../../backend/services/ai-service/app/main.py#L201): actualmente está temporalmente deshabilitado y responde `409`.

**Pregunta probable**: “¿La regla de cinco logins fallidos es la decisión del CART?”  
**Respuesta**: No necesariamente. Es R1, una regla determinista del correlador. El árbol usa sus 16 entradas numéricas y sigue sus divisiones aprendidas. En una predicción, se deben leer por separado ambos resultados.

## Notificaciones e integración web

- [Gateway: análisis y notificación condicional](../../backend/gateway/src/app.controller.ts#L784): llama a correlación; solo si la clasificación es `ANOMALO` solicita crear la notificación.
- [Notificación persistida](../../backend/services/notifications-service/src/index.js#L377): valida campos, conserva referencias/condiciones y evita repetir por el mismo análisis.
- [Web de análisis](../../frontend/web/src/analysis/pages/DetectionPage.tsx#L436): resultado, evidencias, características, reglas, camino de árbol y estado de notificación en secciones diferenciadas.
- [Web de notificaciones](../../frontend/web/src/notifications/pages/NotificationsPage.tsx#L24): consulta personal, lectura y advertencia de no fraude.

## Pruebas que respaldan los cambios

- Users: `test/person-names.test.js`, `test/permisos.test.js`, `test/rate-limit.test.js`.
- Sales: `test/client-data.test.js`, `test/reportes.routes.test.js`, `test/ventas.routes.test.js`.
- Correlación: `test/correlation.test.js`, `test/api.test.js`, `test/event-publisher.test.js`.
- IA: `tests/test_features.py`, `tests/test_train.py`, `tests/test_api.py`.
- Seed: [seed-demo-data.test.js](../../backend/scripts/demo-data/seed-demo-data.test.js).

La guía de resultados al final del trabajo indica qué comandos se ejecutaron en este entorno. Las pruebas unitarias no equivalen a una prueba end-to-end de producción.

