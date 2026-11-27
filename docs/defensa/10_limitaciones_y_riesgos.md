# Limitaciones y riesgos

## Riesgos principales

| Prioridad | Limitación comprobada | Impacto | Respuesta defendible / siguiente paso |
|---|---|---|---|
| Alta | El dataset CART y las etiquetas son sintéticos; no hay historial operacional de SposaBella etiquetado por expertos. | El modelo puede aprender la lógica del generador y no generalizar a datos reales. | Presentarlo como prototipo experimental; antes de despliegue, recolectar eventos con gobernanza, revisión humana y evaluación aprobada. |
| Alta | El `POST /train` está deshabilitado; el CLI `train.py` llama a una evaluación que ya no devuelve los campos que su persistencia exige. | El reentrenamiento documentado no está disponible de forma demostrada. | No ejecutarlo contra una base activa. Actualizar contrato/código y reactivar solo con pruebas y autorización. |
| Alta | Las migraciones de apellidos se aplicaron y verificaron en las bases locales de Compose; no se verificó un entorno de producción o staging. | La evidencia local no certifica una restauración ni el estado de otros entornos. | Antes de desplegar fuera de local, preparar una copia restaurable y repetir verificación de conteos y valores; mantener las columnas antiguas durante la transición. |
| Alta | El generador se ejecutó en las bases locales de Compose autorizadas y se repitió con el mismo seed; la limpieza operativa está deshabilitada. | Los fixtures aparecen en la interfaz local y no se deben confundir con datos operativos ni validación académica. | Mantener identificadores `demo`, etiquetar evidencias como sintéticas y no ejecutar contra despliegues compartidos. |
| Alta | Ventas e inventario viven en bases distintas y no forman una transacción distribuida. | Fallos parciales pueden dejar una venta pendiente o stock actualizado sin finalizar la otra parte. | Asegurar conciliación/reintento idempotente y exponer estados pendientes; ensayar cortes de red en integración. |
| Media-alta | Outbox JSON local no es atómico con la transacción MySQL del negocio. | Una caída entre commit y persistencia del archivo puede perder el evento. | Evaluar outbox transaccional por servicio o reconciliación; no afirmar entrega exactly-once. |
| Media-alta | V3 reporta 348 ocurrencias de vector duplicado; etiquetas definidas por escenarios. | Diversidad efectiva limitada y posible dependencia de patrones de generación. | Publicar definición precisa del contador, ampliar escenarios, evaluar grupos/tiempo/actores y mantener test externo. |
| Media-alta | El holdout de dos familias sintéticas tiene 16 falsos negativos de anomalía en 60 casos. | La alerta puede no detectar parte de los patrones anómalos definidos. | Reportar recall 0.7333 y analizar fallos; no destacar únicamente precision 1.0 o CV 0.9775. |
| Media | `predict_proba` no está calibrada para fraude real. | Un valor alto puede inducir falsa certeza. | Mostrar semantics text, score como señal experimental y categoría de riesgo como regla de UI, no como probabilidad operacional. |
| Media | R3 requiere movimiento de stock posterior a venta; un README dice diferencia absoluta. | Presentación o fixture puede explicar una relación que el código rechaza. | Corregir documentación y probar secuencias con el orden exacto. |
| Media | Reporte de venta compone el nombre del cliente actual; no existe snapshot en venta. | Cambios del cliente pueden cambiar el nombre mostrado para ventas históricas. | Decirlo con precisión; si el requisito es conservar nombre histórico, diseñar snapshot y migración aparte. |
| Media | Notificación deduplica consultando mensaje por `analysis_id` antes de insertar, sin una restricción única visible en el schema. | Dos solicitudes concurrentes podrían superar la búsqueda al mismo tiempo y crear duplicados. | No prometer idempotencia concurrente fuerte; evaluar clave única dedicada/transactional y test de concurrencia. |
| Media | El correlador expone endpoints internos sin autenticación propia visible; el Gateway valida permiso para las rutas de usuario. | La topología depende de aislamiento de red y Gateway como frontera. | Mantener el servicio en red interna; revisar exposición/configuración antes de despliegue. |
| Baja-media | El README raíz presenta IA/correlación como futura implementación. | La documentación puede restar credibilidad por divergencia con rutas y pruebas. | Actualizar estado e indicar validaciones pendientes. |

## Particularidades de datos y ventas

- En las migraciones, apellido anterior se conserva entero en `apellido_paterno`; `apellido_materno` queda nulo; la columna `apellido` sigue hasta una transición futura. Esta transición se aplicó en las bases locales aprobadas; no se retiró la columna antigua.
- Los IDs de variante/usuario que cruzan bases no tienen FKs globales. Las cargas deben mantener coherencia de IDs y validación entre servicios.
- La cancelación de compra revierte stock solo si existe cantidad suficiente. La venta y el descuento de inventario son coordinación entre servicios.
- El nombre de cliente que el reporte muestra proviene del registro relacionado actualmente. No se debe afirmar que es inmutable en la historia.

## Particularidades del análisis

- `NORMAL` no significa riesgo cero en sentido estadístico; solo es la clase predicha por el artefacto en ese vector.
- `ANOMALO` no significa delito, fraude ni intención; significa que el árbol asignó la clase sintética anómala.
- Reglas activadas no son causa de la clasificación. El recorrido del árbol sí muestra qué nodos evaluó ese modelo para esa muestra.
- `feature_importances` no son explicación individual; se muestran como factores generales del modelo.
- Los ejemplos ejecutados con el artefacto son sintéticos y reproducibles, no deben presentarse como resultados de un cliente o de una venta real.

## Criterios de “no afirmar”

No decir:

- “El sistema detecta fraude con 92 % de exactitud”.
- “La probabilidad 1.0 demuestra fraude”.
- “El outbox garantiza exactamente una entrega”.
- “La venta y el inventario se guardan en una única transacción”.
- “Las migraciones preservaron los registros de producción” antes de ejecutarlas en una copia y comprobarla.
- “El seed se probó en MySQL” sin una ejecución aislada documentada.
- “El sistema reentrena automáticamente” o “`POST /train` está disponible”.
- “Una cancelación individual es anómala por sí sola”.

Formulación recomendada: **“El prototipo correlaciona eventos operativos y clasifica vectores sintéticos mediante un árbol de decisión; una salida ANOMALO es una señal explicable que requiere revisión humana.”**

## Decisiones que requieren aprobación antes de corregir

1. Aplicar migraciones de users/sales, preparar una copia restaurable y decidir cuándo retirar la columna histórica.
2. Cambiar el contrato de entrenamiento o hacer que el CLI publique un modelo; puede afectar artefactos, métricas e historial.
3. Cambiar variables/etiquetas, umbrales o entrenamiento CART; requiere autorización académica/técnica y evaluación experimental nueva.
4. Introducir snapshot de nombre para ventas históricas; implica alterar modelo, API y migración de datos.
5. Cambiar persistencia/notificación para deduplicación concurrente; requiere diseño y prueba de concurrencia.

No se ejecutaron estas acciones como parte de la preparación documental.

## Verificación técnica y estado local

- Frontend: `npm run build --prefix frontend\web` pasó tras los cambios de filtros y etiquetas; Vite conserva una advertencia de chunk principal superior a 500 kB. La interfaz local respondió HTTP 200 en una verificación anterior.
- Users-service: 18 pruebas aprobadas.
- Sales-service: 20 pruebas aprobadas, incluidas combinaciones, validaciones de filtros y límites de día calendario de Bolivia.
- Logic-correlation-service: 32 pruebas aprobadas.
- AI-service: 22 pruebas aprobadas con SQLite temporal dentro de un contenedor aislado; no se usó la base MySQL operativa para esta ejecución.
- Gateway: compilación aprobada y 13 pruebas aprobadas.
- Generador demo: 19 pruebas aprobadas, incluidas vista previa, límites de destino, confirmación operativa, separación de actores, reproducibilidad e ingreso de eventos.
- Prisma Client de users y sales se generó correctamente durante la generación de imágenes. Las migraciones aditivas de apellidos se desplegaron mediante `prisma migrate deploy`; no se ejecutó `db push`.
- Inventario: 2 pruebas de validación del límite de movimientos aprobadas; `node --check` también pasó.
- Notifications-service: 2 pruebas de mensaje comprensible de alerta aprobadas.
- Carga local con seed `20261125`: 10 usuarios ficticios inactivos y sin credenciales, 1 rol sin permisos, 10 productos/variantes, 1 proveedor, 10 compras, 10 existencias, 10 clientes, 10 ventas confirmadas y 10 pagos. Las verificaciones agregadas no encontraron stock negativo ni relaciones internas faltantes; repetir el seed no aumentó los conteos.
- Correlación: 13 eventos sintéticos (2 normales y 11 anómalos) ingresados por `POST /events`; la repetición devolvió 13 duplicados. Se ingresó además un segundo lote reciente de 13 eventos con IDs nuevos, sin duplicar registros de negocio. No se borraron eventos ni filas previas.
- Las imágenes actualizadas de los servicios se generaron secuencialmente después de que una compilación paralela fallara por timeouts de `registry.npmjs.org`. Los servicios quedaron iniciados; las comprobaciones HTTP de frontend, users, sales, inventory, notifications, correlation y AI devolvieron 200 dentro de la red Compose. El Gateway respondió 200 al consultar correlación desde su contenedor.
- `git diff --check` pasó, con avisos de conversión de fin de línea en Windows.
- Tras ingresar 26 eventos sintéticos, se completaron mediante análisis CART autenticados por la ruta autorizada un resultado `ANOMALO` de riesgo `ALTO` para el actor 22 (análisis `a831b91f-5ad5-4a3a-9be7-b981415718d6`, 11 eventos) y un resultado `NORMAL` de riesgo `BAJO` para el actor 21 (análisis `4617dd5b-9385-45a8-bb2b-bd5db31958e0`, 2 eventos). La notificación del análisis anómalo quedó persistida y visible en la lista de notificaciones; no existe notificación asociada al análisis normal. No se eludieron permisos ni se insertaron resultados directamente.

El estado anterior solo describe las bases y servicios locales usados en esta sesión; no acredita el despliegue en un servidor externo ni convierte los datos sintéticos en resultados de producción o de evaluación académica.
