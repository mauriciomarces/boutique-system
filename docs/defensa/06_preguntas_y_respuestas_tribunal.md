# Preguntas y respuestas para el tribunal

Las respuestas están formuladas para no exagerar el alcance. Si el tribunal solicita evidencia que no está en el repositorio, es preferible decir “no se verificó” y proponer cómo validarlo.

## 1. Problema y objetivos

**¿Qué problema aborda SposaBella?**  
Gestiona operaciones de una boutique y agrega un flujo experimental que relaciona eventos y clasifica patrones operativos para apoyar la revisión. No detecta fraude probado.

**¿Qué aporta el componente de IA sobre las reglas?**  
Las reglas describen condiciones explícitas de correlación. CART toma un subconjunto de características y decide con divisiones aprendidas a partir de escenarios sintéticos. Se mantienen separados porque responden preguntas diferentes.

## 2. Alcance y delimitaciones

**¿El sistema valida fraude real?**  
No. No hay eventos históricos etiquetados por expertos en el repositorio. La experimentación usa escenarios sintéticos y una fuente minorista pública sin etiquetas de fraude aplicables.

**¿El sistema incluye análisis y notificaciones?**  
Sí, existe una ruta de correlación→predicción, persistencia de análisis y creación condicional de notificación cuando la clase es `ANOMALO`. No se deben simular resultados de producción ni poblarlos artificialmente con el seed.

## 3. Arquitectura y tecnologías

**¿Por qué microservicios?**  
El código separa dominios de identidad, catálogo, inventario, ventas, notificaciones y análisis. Esto asigna propiedad de datos y reglas por servicio; a cambio, requiere tratar consistencia y errores entre servicios.

**¿Existe un bus de eventos?**  
No se declara Kafka, RabbitMQ ni un broker. La implementación actual usa archivo outbox y `POST /events` al correlador.

## 4. Ingeniería de software

**¿Cómo evita duplicar una salida de stock al reintentar?**  
El movimiento incluye una clave idempotente y los flujos de anulación coordinan operaciones/tareas con claves únicas. Las pruebas de integración documentadas para cancelaciones cubren reintentos; esto no equivale a una transacción distribuida.

**¿Qué pruebas existen?**  
Pruebas unitarias de normalización, rutas, permisos, correlación, API, predicción y explicación; además, el repositorio documenta una suite de integración MySQL específica de anulación. Indicar cuáles se ejecutaron en el informe de trabajo y no confundir suite unitaria con E2E.

## 5. Base de datos y normalización

**¿Por qué dos campos de apellido?**  
Permiten representar paternal y maternal sin asumir que una cadena con espacios puede dividirse con seguridad. El backfill copia el apellido previo completo a paterno y deja materno nulo.

**¿Hay relaciones entre las bases de servicios?**  
No hay FKs cross-database en Prisma. Sales mantiene FKs internas entre venta/cliente/detalles/pagos; `variante_producto_id` es un identificador de otro dominio y se coordina por servicio.

**¿Por qué existe la tabla `empleados` si no aparecen empleados?**  
El esquema la modela como vínculo opcional uno-a-uno entre `usuarios` y un `cargo`; el cargo describe la posición laboral, mientras los roles/permisos controlan el acceso al sistema. La API solo incluye esa relación al consultar un usuario; no hay CRUD o módulo de empleados implementado y la inspección encontró cero filas en `empleados` y `cargos`. Por tanto, se debe explicar como entidad modelada pero actualmente no utilizada, no como una función demostrable.

**¿El nombre de cliente en una venta es una fotografía histórica?**  
No. Los reportes consultan el cliente relacionado y componen su nombre actual. Si se edita el cliente, un reporte futuro puede mostrar el nombre actualizado; el esquema no guarda un snapshot del nombre al momento de vender.

**¿Todos los registros se guardan en la hora local?**  
No. `DateTime` en MySQL no conserva zona horaria; en esta instancia el servidor MySQL usa UTC, y el backend genera timestamps con `Date`/ISO UTC. La interfaz los formatea para `es-BO`. Los filtros de reportes interpretan fechas de calendario como días de `America/La_Paz` (UTC−4), sin cambiar cómo se almacenan los instantes.

## 6. Seguridad

**¿La interfaz garantiza los permisos?**  
No. `RequireAuth` y `RequirePermission` protegen rutas de navegación; el servidor valida token/permisos. El Gateway verifica autorización para análisis y products consulta al users-service en operaciones de escritura.

**¿Cómo se almacenan contraseñas/tokens?**  
Las contraseñas se comparan contra hash bcrypt; los tokens de refresco/recuperación se almacenan como hashes en users. No revelar ni poner credenciales en las capturas o scripts.

**¿Se debe exponer directamente el puerto del correlador?**  
Las llamadas de usuario pasan por Gateway, que comprueba permiso. El despliegue debe mantener servicios internos detrás de la red/control de entrada; una exposición directa requeriría endurecimiento y validación adicional.

## 7. Ventas e inventario

**¿La venta y el descuento de inventario se confirman atómicamente?**  
No, ocurren en servicios/bases distintas. El sistema coordina llamadas e idempotencia, pero no dispone de transacción distribuida. Por eso hay estados/reintentos y se requiere demostrar manejo de fallos.

**¿Qué ocurre al anular una compra?**  
Se verifica existencia suficiente para revertir entradas. Si el stock se consumió, la operación se rechaza para no producir cantidad negativa.

## 8. Eventos y correlación

**¿Qué se correlaciona?**  
Eventos con actor, fecha, tipo y entidad. La relación venta-stock exige coincidencia por `venta_id`, actor compatible y salida posterior dentro de 15 minutos.

**¿Una regla activada obliga al modelo a clasificar anomalía?**  
No. La regla y la predicción son resultados distintos. R1/R2/R5 son indicadores deterministas; CART evalúa su vector de 16 variables actual, no las 30 salidas completas.

**¿El outbox garantiza no perder eventos?**  
No de forma absoluta: reintenta fallos de entrega después de guardar localmente, pero no comparte commit con MySQL. Una caída entre el commit de negocio y la escritura del outbox es una ventana pendiente.

## 9. Inteligencia artificial

**¿Cuál es la etiqueta positiva?**  
`ANOMALO=1` en los datasets experimentales. Significa que el ejemplo pertenece a un escenario sintético predefinido, no que un fraude haya sido verificado.

**¿Por qué se eligió CART?**  
El recorrido de condiciones se puede inspeccionar y comunicar como preguntas/ramas; la profundidad máxima limita la complejidad. Es una justificación técnica de la implementación, no una afirmación sobre una motivación histórica no documentada.

**¿El modelo se actualiza al recibir ventas?**  
No. La API de entrenamiento responde `409`; el contenedor no entrena al iniciar. La predicción carga un artefacto existente.

## 10. CART y métricas

**¿Qué significa `criterion=gini`?**  
Mide mezcla de clases en un nodo con \(1-\sum p_k^2\). El algoritmo elige una división que reduce impureza ponderada.

**¿Qué indica el holdout de 92 %?**  
En la partición sintética documentada de 200 ejemplos, 184 quedaron correctamente clasificados. Hubo 16 falsos negativos de anomalía. No es una tasa de éxito en producción.

**¿Un score 100 % es probabilidad de fraude?**  
No. Es `predict_proba` para la etiqueta sintética `ANOMALO`; el código no lo declara calibrado a fraude real.

## 11. Pruebas y validación

**¿Se probaron las migraciones sobre la base existente?**  
No. Son SQL aditivo leído y validado en esquema, pero no se ejecutó ni se conectó a las bases persistentes. Se debe aplicar primero en una copia/instancia de prueba con respaldo revisado.

**¿Se probó el generador con MySQL de prueba?**  
No en esta tarea porque no se configuró ni verificó un destino aislado. Sí se ejecutaron preview y pruebas unitarias con SQLite en memoria; no afirmarlo como validación MySQL.

## 12. Resultados y limitaciones

**¿Por qué reportar recall además de accuracy?**  
Accuracy puede ocultar la proporción de anomalías omitidas. En la matriz V3, recall anómalo es 44/60, por debajo de 1.0; esos 16 falsos negativos son relevantes.

**¿Qué limitación principal reconocen?**  
No hay datos reales de SposaBella con etiquetas verificadas; además existe repetición de vectores sintéticos, poca diversidad de escenarios, acoplamiento a reglas de generación y ausencia de calibración.

## 13. Aporte académico

**¿Cuál es el aporte demostrable con este repositorio?**  
Una integración experimental de gestión comercial, eventos, correlación determinista y un clasificador CART explicable por recorrido. El repositorio no permite sostener una afirmación estadística sobre población real.

**¿Qué población y muestra se usaron?**  
No se encontró una memoria metodológica que documente población/muestra de participantes o tiendas. El dataset de IA tiene 800 casos sintéticos; no debe llamarse muestra de clientes o transacciones reales.

## 14. Contradicciones y preguntas difíciles

**La documentación dice que correlación/IA están en implementación. ¿Es cierto?**  
Esa frase del README raíz está desactualizada: hay endpoints, SQLite, predict, persistencia de análisis y UI. El estado concreto del reentrenamiento es distinto: está deshabilitado y se debe reconocer.

**¿Cómo explica el conflicto de R3 en el README?**  
El código exige que la salida de stock ocurra después de la venta, en menos de 15 minutos. La frase “diferencia absoluta” no coincide; debe corregirse, no racionalizarse como equivalente.

**¿Por qué existe un comando `train.py` si el endpoint está bloqueado?**  
El CLI llama una función que ahora devuelve solo evaluación en memoria y después la pasa a persistencia con campos que no devuelve. No lo ejecutar sobre una base operativa; documentar la discrepancia y proponer corregir el contrato de entrenamiento en una tarea aprobada.

**¿Una anulación es evidencia de fraude?**  
No. Es un evento de negocio legítimo; R2 es solo una señal de frecuencia para revisión contextual.

**¿Qué harían antes de producción?**  
Validar con datos representativos, etiquetas revisadas, split temporal/por actor y escenarios externos; calibrar probabilidades, acordar umbrales con responsables; probar failover/reconciliación y aplicar migraciones en staging con evidencia de preservación.

