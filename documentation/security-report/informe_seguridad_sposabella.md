# Informe técnico de seguridad informática de SposaBella

## Portada

**Proyecto:** Boutique SposaBella  
**Título del Proyecto de Grado:** *Sistema web de gestión de ventas aplicando el algoritmo de Árbol de Decisión para el análisis y detección de comportamientos anómalos*  
**Tipo de documento:** Auditoría técnica documental y de código  
**Fecha de revisión:** 13 de noviembre de 2026  
**Repositorio:** `E:\boutique-system`  
**Versión auditada:** estado local del repositorio durante la revisión, incluidos cambios locales preexistentes  
**Clasificación:** uso académico; no contiene credenciales, tokens ni datos de usuarios

> Este informe evalúa evidencias visibles en archivos y pruebas ejecutadas. No constituye una prueba de penetración, certificación, evaluación legal ni garantía de seguridad del despliegue.

## Índice

1. Introducción
2. Objetivos
3. Alcance de la seguridad en SposaBella
4. Arquitectura de seguridad del sistema
5. Seguridad enfocada en inicio de sesión y contraseñas
6. Seguridad enfocada en diseño y desarrollo
7. Marcos y estándares de referencia
8. Pruebas y comprobación de seguridad
9. Evidencias de implementación
10. Resultados de la auditoría
11. Limitaciones y mejoras propuestas
12. Conclusiones
13. Referencias bibliográficas
14. Anexos

Las matrices ampliadas, el inventario de riesgos, el plan de capturas, los diagramas y las referencias están en los documentos relacionados de esta carpeta: [matriz_auditoria_seguridad.md](./matriz_auditoria_seguridad.md), [plan_capturas_evidencias.md](./plan_capturas_evidencias.md), [diagramas_seguridad.md](./diagramas_seguridad.md) y [fuentes_referencias.md](./fuentes_referencias.md).

## 1. Introducción

La seguridad de SposaBella es relevante porque el sistema procesa cuentas de usuario, roles, permisos, información comercial y eventos utilizados para construir señales de comportamiento. La confianza de las decisiones del Árbol de Decisión depende de que esos eventos conserven procedencia e integridad suficientes.

La revisión se realizó sobre la documentación y el árbol de trabajo disponibles en el repositorio. Se encontraron implementaciones comprobables de hashing de contraseñas, validación de JWT, permisos dinámicos consultados desde la base de datos, limitación de solicitudes de autenticación, contratos de eventos y pruebas automatizadas.

También se detectaron limitaciones importantes: los tokens se guardan en `localStorage`, el entorno de Docker Compose está configurado como desarrollo y usa HTTP, hay puertos de servicios y bases de datos publicados en el host, y el endpoint de ingesta de eventos no valida la identidad de quien lo invoca. No se encontró una configuración verificable de producción.

## 2. Objetivos

### 2.1. Objetivo general

Evaluar técnicamente los controles de seguridad implementados en SposaBella, con énfasis en autenticación, contraseñas, autorización, arquitectura de microservicios, datos y eventos operativos.

### 2.2. Objetivos específicos

- Trazar el flujo de credenciales, tokens y autorización a través del frontend, gateway y servicios.
- Identificar controles comprobables y distinguirlos de pruebas pendientes y recomendaciones.
- Evaluar amenazas web mediante OWASP Top 10:2021 y prácticas técnicas de NIST, OWASP e ISO.
- Documentar riesgos específicos y proponer pruebas reproducibles que no afecten datos reales.
- Proporcionar evidencias rastreables para completar el informe académico y la rúbrica.

## 3. Alcance de la seguridad en SposaBella

### 3.1. Componentes revisados

Se inspeccionaron `backend/services/users-service` (rutas, middleware, permisos, esquema Prisma y pruebas), `backend/gateway`, los mecanismos de autorización de `products-service`, `sales-service` e `inventory-service`, `notifications-service`, `logic-correlation-service`, los contratos compartidos de eventos, los puntos de entrada del `ai-service`, el frontend de autenticación y `docker-compose.yml`, Dockerfiles y configuración Nginx.

La documentación consultada incluye [README.md](../../README.md), [docs/architecture.md](../../docs/architecture.md), [docs/ML_PIPELINE.md](../../docs/ML_PIPELINE.md), la documentación de servicios, y [Informe_revision_tesis_y_diagramas_mermaid.md](../../Informe_revision_tesis_y_diagramas_mermaid.md). Se consultó además la guía de redacción entregada fuera del repositorio.

### 3.2. Documentación académica no disponible

No se localizó en el workspace el documento principal de tesis en DOC/DOCX, PDF u ODT, ni la matriz académica original. El archivo de revisión de tesis menciona documentos DOCX/XLSX revisados en otro contexto, pero esos originales no están en las rutas disponibles. Por ello, no se puede certificar cuál es la versión académica más reciente ni confirmar sus capítulos, requisitos, citas o estilo integral.

El título y el contexto de grado que aparecen en esta portada proceden de la solicitud del proyecto; no se atribuyen al documento académico original, que no estuvo disponible. La auditoría no modificó los documentos fuente.

### 3.3. Método y límites

La auditoría combinó lectura estática dirigida, búsqueda de implementaciones y ejecución local de pruebas unitarias seleccionadas. No se ejecutó el sistema integrado, no se consultaron bases activas, no se realizaron pruebas contra cuentas reales, no se generaron tokens de usuario y no se iniciaron ni reconstruyeron contenedores.

La conclusión describe el código en el estado local observado, que incluye modificaciones y archivos sin seguimiento preexistentes. No es una certificación de la rama principal ni de un despliegue remoto. Una prueba unitaria con dobles o datos sintéticos demuestra solo el comportamiento de esa prueba, no una operación comercial real.

## 4. Arquitectura de seguridad del sistema

El repositorio contiene una aplicación React/Vite, un gateway NestJS, servicios Node.js/Express y un servicio de IA Python/FastAPI. El servicio de usuarios usa Prisma con adaptador MariaDB y la infraestructura de Compose declara imágenes MySQL 8. El servicio de correlación persiste eventos y análisis en SQLite; el repositorio no muestra una base de datos cifrada ni un mecanismo de cifrado en reposo.

El gateway enruta solicitudes de autenticación al `users-service`. Las decisiones de permiso se delegan al endpoint interno de validación de usuarios, que comprueba el JWT, consulta de nuevo el estado del usuario y calcula roles/permisos actuales. Varios servicios de dominio siguen el mismo patrón para operaciones protegidas. La autorización del endpoint no debe confundirse con la restricción visual de botones o pantallas del frontend (OWASP Foundation, 2025; OWASP Foundation, s. f.-e).

La red declarada en Compose es una red bridge común. Los servicios y bases no están distribuidos en subredes de confianza diferenciadas. El archivo publica en el host el gateway, varios servicios de dominio, instancias MySQL y phpMyAdmin; el servicio de correlación y el servicio de IA no aparecen publicados directamente en el fragmento Compose inspeccionado, pero participan en la misma red Docker. Esa topología corresponde al entorno de desarrollo y no prueba la exposición efectiva de una instalación externa.

La ingesta correlador–servicios usa HTTP y el código de publicación de eventos no incorpora una credencial propia. `logic-correlation-service` y `ai-service` no implementan autenticación en sus rutas de API revisadas. Su contención depende, por tanto, del perímetro y la red del entorno, y no de controles de identidad en esos endpoints.

El flujo editable de arquitectura y autenticación está en [diagramas_seguridad.md](./diagramas_seguridad.md). Allí se distingue la autenticación del usuario, la validación interna de permisos y la publicación de eventos.

## 5. Seguridad enfocada en inicio de sesión y contraseñas

### 5.1. Arquitectura de autenticación

El frontend envía correo y contraseña mediante `POST /api/users/auth/login`; el gateway reenvía el cuerpo a `users-service` y agrega encabezados internos usados para derivar la IP de cliente del limitador. El servicio normaliza el correo, busca usuario y credencial mediante Prisma, verifica la cuenta y el estado de la credencial, y compara la contraseña con `bcryptjs.compare`.

Si las credenciales son correctas, se consulta `obtenerContextoAutorizacion`, que carga de la base el estado del usuario, las relaciones con roles, el estado de cada rol y sus permisos. La aplicación rechaza la autenticación si la cuenta está inactiva, no tiene roles activos o no posee permisos efectivos. Después emite el JWT de acceso y un refresh token aleatorio, persiste el hash del refresh token y devuelve los tokens y el perfil filtrado.

Para una ruta protegida, `authenticateToken` comprueba la firma y expiración del JWT, exige un `sub` con formato numérico y vuelve a consultar el contexto de autorización actual. El guard `authorizePermission` exige el permiso actual requerido por la ruta. En otros servicios, gateway o middleware de servicio invocan `/internal/auth/validate` con el JWT de usuario y una clave compartida, y `users-service` realiza nuevamente la comprobación de cuenta, roles y permisos.

El frontend conserva credenciales de sesión en almacenamiento del navegador. La presencia de un componente de protección de ruta mejora la experiencia de interfaz, pero no concede autorización por sí misma. La validación efectiva debe producirse en backend.

### 5.2. Gestión de sesiones y tokens

El mecanismo de acceso es JWT firmado con HS256. El código de emisión añade los claims `sub`, `correo` y `roles`, y `jsonwebtoken` agrega expiración con la duración configurada. El valor predeterminado del access token en el código es 15 minutos. El secreto de firma debe estar definido como `JWT_ACCESS_SECRET`; `users-service` falla durante el arranque si falta (Jones et al., 2015; Sheffer et al., 2020).

El refresh token no es un JWT: se genera con 64 bytes aleatorios criptográficos y se devuelve en representación hexadecimal. La base guarda únicamente SHA-256 del token, su usuario, vencimiento y fecha de revocación. El vencimiento predeterminado es de siete días. La tabla y los endpoints permiten revocar refresh tokens en logout y cuando se restablece una contraseña.

El endpoint de renovación valida que el refresh token exista, no esté revocado y no haya expirado. También comprueba estado de cuenta y permisos actuales antes de emitir un nuevo access token. El código de renovación devuelve solo el nuevo access token; no reemplaza ni rota el refresh token persistente.

El logout revoca el refresh token proporcionado, pero no mantiene una lista de revocación de access JWT. Por ello, un JWT de acceso ya emitido puede seguir siendo criptográficamente válido hasta expirar. Sin embargo, las rutas protegidas atendidas por `users-service` y los validadores internos vuelven a consultar la autorización actual y pueden bloquear al usuario antes de que expire ese JWT.

Cambiar roles, desactivar un rol o retirar un permiso cambia el contexto consultado para la siguiente autorización; no se confía solo en el claim `roles`. Deshabilitar un usuario hace que las comprobaciones actuales de autorización y renovación rechacen la cuenta. El comportamiento de todos los endpoints y microservicios no queda demostrado por pruebas de integración dedicadas.

El frontend guarda tanto access como refresh token en `localStorage`. Esto permite a JavaScript leerlos; una vulnerabilidad XSS podría robarlos. No se observaron cookies `HttpOnly`, `Secure`, `SameSite` para estos tokens, ni una estrategia de almacenamiento solo en memoria. Limpiar el almacenamiento en logout es útil, pero no revoca por sí mismo el access JWT robado (OWASP Foundation, s. f.-f).

### 5.3. Funcionamiento del JWT

Un JWT es una representación compacta de claims. En este proyecto la firma permite verificar integridad y posesión del secreto compartido, pero no identifica de forma única a un servicio emisor; el formato firmado tampoco cifra el contenido. Un lector que obtenga el token puede decodificar el encabezado y el payload, por lo que no deben incluirse contraseñas, hashes, secretos ni datos que requieran confidencialidad. El claim de correo es legible y debe considerarse información personal (Jones et al., 2015; Sheffer et al., 2020).

La validación de `users-service` restringe el algoritmo aceptado a HS256, y el esquema compartido de firma/clave simétrica implica que cada componente que valida JWT y conoce el secreto también puede crear firmas válidas. Las opciones de `issuer`, `audience`, `jti` y `notBefore` no aparecen configuradas en el emisor revisado. Se recomienda definir explícitamente audiencia y emisor, limitar la distribución del secreto y valorar claves asimétricas si el número de verificadores crece.

Un access token robado puede usarse como bearer hasta su expiración, salvo que las consultas dinámicas de cuenta o permisos lo bloqueen. Un refresh token robado puede renovar sesiones mientras siga vigente y no revocado. La mitigación actual incluye expiración del access token, almacenamiento del hash de refresh, revocación de refresh, rate limiting y consulta dinámica de autorización. No hay evidencia de autenticación multifactor ni de detección de reutilización del refresh token (OWASP Foundation, s. f.-f).

### 5.4. Autorización dinámica

`obtenerContextoAutorizacion` carga datos actuales desde MySQL por cada verificación de autorización. Los permisos efectivos se calculan con las relaciones rol–permiso; un rol `ADMIN` activo recibe el catálogo actual. El middleware comprueba estado `ACTIVO`, al menos un rol activo y al menos un permiso efectivo. Después `authorizePermission` valida el nombre del permiso requerido.

El endpoint interno `/internal/auth/validate` exige la cabecera de secreto interno, verifica el bearer token con HS256 y valida `sub` y `exp`. Luego consulta la base y puede exigir tanto un permiso como una lista de roles autorizados. El gateway usa el permiso `USUARIOS_LEER` para análisis y el permiso `VENTAS_LEER` junto con roles `ADMIN` o `SUPERVISOR` para reportes.

La comprobación actual reduce el tiempo durante el cual un cambio de rol o permiso sigue teniendo efecto en las rutas que usan estos guards. No equivale a revocación criptográfica inmediata del JWT; otros servicios, especialmente `notifications-service`, implementan validaciones propias y no consultan siempre el estado actual de roles y permisos.

### 5.5. Gestión y almacenamiento de contraseñas

El campo `credenciales.hash_contrasena` almacena el resultado de `bcryptjs.hash` con costo 12 en creación, activación y restablecimiento. El login usa `bcryptjs.compare`; no se observó cifrado reversible AES de contraseñas. bcrypt es un hash adaptativo con salt individual incorporado en el formato de hash; no es necesario almacenar un salt separado. El costo 12 determina trabajo computacional y debe medirse y revisarse conforme evolucione el hardware (OWASP Foundation, s. f.-d).

El código impone longitud de 8 a 128 caracteres y exige mayúscula, minúscula, dígito y símbolo. No se encontró comprobación contra una lista de contraseñas comunes o comprometidas. OWASP/NIST actuales recomiendan priorizar longitud y listas de bloqueo, y NIST indica una longitud mínima de 15 caracteres para autenticación de un solo factor bajo su guía actual. La política implementada funciona como control parcial, pero la longitud mínima de ocho y las reglas de composición son candidatas a revisión (National Institute of Standards and Technology, 2025; OWASP Foundation, s. f.-a).

bcrypt tiene un límite práctico de entrada de 72 bytes documentado por OWASP, mientras la validación de esta aplicación permite hasta 128 caracteres y no limita explícitamente bytes UTF-8. Debe añadirse una prueba de límite multibyte y decidir una política coherente antes de ampliar o cambiar el algoritmo. No se afirma que la aplicación ya gestione correctamente el truncamiento.

El restablecimiento de contraseña genera un código de seis dígitos, almacena su SHA-256, le da una validez de 30 minutos, invalida códigos previos y limita solicitudes por IP. No se encontró contador de intentos por código en `tokens_recuperacion`; el limitador de recuperación es por IP y puede distribuirse entre múltiples orígenes. La tabla de verificación de correo sí contiene contador y el endpoint bloquea el código tras cinco fallos. El restablecimiento invalida refresh tokens existentes, pero los access JWT ya emitidos pueden seguir válidos hasta expirar.

Hash, codificación y cifrado son distintos: codificar solo cambia representación, cifrar es reversible con una clave, y un hash criptográfico es unidireccional. Un hash de contraseña agrega un salt individual y un factor de trabajo para encarecer la búsqueda offline. Por eso el secreto de contraseña se verifica comparando con bcrypt, no descifrando el valor guardado.

### 5.6. Protección de credenciales en tránsito

La configuración Nginx inspeccionada escucha en HTTP/80 y Compose publica el servicio en el host mediante el puerto 8080; no se hallaron certificados, escucha HTTPS ni configuración TLS. El gateway y los servicios se comunican mediante URLs HTTP en la red Docker. Por tanto, solo puede afirmarse que el entorno declarado es HTTP; no se puede afirmar HTTPS en producción, ni que exista un entorno productivo separado.

Las credenciales de login y los bearer tokens viajan en cuerpos JSON o cabeceras Authorization. En HTTP son susceptibles a lectura o modificación por quien tenga posición de red. Para producción se requiere HTTPS/TLS en el borde y protección de comunicaciones internas según el modelo de amenazas. CORS controla qué páginas pueden leer respuestas en navegadores, pero no cifra tráfico ni sustituye autenticación (OWASP Foundation, s. f.-e, s. f.-h).

### 5.7. Protección frente a ataques de autenticación

El login limita a 10 solicitudes por IP cada 15 minutos. Los endpoints comunes de autenticación limitan a 20 por IP cada 15 minutos. La recuperación de contraseña limita a 5 por IP cada 15 minutos. La clave de limitación puede usar `x-client-ip` cuando coincide el secreto interno y la prueba unitaria verifica que un encabezado no confiable no pueda cambiar la clave.

La limitación se aplica por IP y usa el almacenamiento en memoria predeterminado de `express-rate-limit`; no es un contador distribuido ni un bloqueo por cuenta. No se encontró bloqueo progresivo por usuario, retraso adaptativo, CAPTCHA ni protección específica contra credential stuffing. La limitación reduce intentos desde una misma IP, pero no elimina ataques distribuidos.

Cuando la cuenta no existe o la contraseña no coincide, el endpoint retorna un mensaje genérico de credenciales inválidas. En cambio, cuenta no verificada, inactiva o credencial inactiva genera respuestas diferenciadas, lo que puede revelar estados de cuenta. Se publican eventos de login exitoso y fallido, pero no se verificó un sistema central de alertas ni retención.

### 5.8. Autenticación multifactor y limitaciones

No se encontró TOTP, aplicación autenticadora, SMS ni un segundo factor de autenticación. La verificación de correo durante activación acredita control del correo en el alta, pero no equivale a solicitar un segundo factor en cada inicio de sesión.

La autenticación multifactor está pendiente y se recomienda para cuentas administrativas, con opciones resistentes a phishing cuando la plataforma y el proyecto lo permitan (National Institute of Standards and Technology, 2025). El informe no presenta MFA como una característica existente.

## 6. Seguridad enfocada en diseño y desarrollo

### 6.1. Prácticas de codificación segura

El servicio de usuarios y varios servicios de dominio usan Prisma ORM para operaciones CRUD. En los archivos revisados aparecen consultas parametrizadas del ORM y algunas consultas Prisma SQL etiquetadas; no se encontraron usos de `queryRawUnsafe` o `executeRawUnsafe` en la búsqueda dirigida. Esto reduce la exposición a inyección SQL, pero no sustituye pruebas de consultas dinámicas, revisión de autorización ni validación de datos. No se declara que todo el código del repositorio esté libre de inyección (OWASP Foundation, s. f.-b, s. f.-g).

Hay validaciones de correo, tipos de token, longitudes, enums, fechas, límites y consistencia en el contrato de eventos y en el servicio de IA. La validación no es uniforme en todos los DTO del gateway y servicios. El JSON Schema de eventos usa lista permitida y `additionalProperties: false`; la configuración de `metadata` impide campos sensibles conocidos por nombre, aunque eso no demuestra que los valores de cualquier clave sean inocuos (OWASP Foundation, s. f.-b).

El backend es la autoridad para las rutas protegidas: middleware y consultas internas comprueban permisos. La interfaz incluye guards visuales, que no deben considerarse un control de seguridad. Las respuestas HTTP suelen devolver errores genéricos, aunque se observan logs de errores internos a consola; no hay evidencia de agregación central ni redacción exhaustiva.

Helmet se aplica en `users-service` y `logic-correlation-service`, con `contentSecurityPolicy: false`; el gateway no muestra configuración explícita de Helmet en su bootstrap. `cors()` de correlación usa su configuración amplia predeterminada. Se recomienda definir política CORS explícita, CSP compatible con la aplicación y límites de cuerpo coherentes en cada servicio.

Los secretos se obtienen principalmente de variables de entorno y `.env` está ignorado por Git, mientras `.env.example` permite identificar nombres sin revelar valores. Sin embargo, el Compose incluye credenciales por defecto de bases y una contraseña de bootstrap administrativa para desarrollo, y los Dockerfiles no declaran usuario no privilegiado. No debe promoverse ese Compose como despliegue productivo.

### 6.2. Protección de datos

El sistema procesa los siguientes grupos: identificadores y correo de usuarios; teléfono y datos de clientes; ventas, pagos, productos, inventario, compras y proveedores; roles y permisos; hashes de contraseña, tokens temporales y refresh; IP y eventos de auditoría; características, etiquetas y resultados experimentales del análisis.

Para el alcance académico se clasifican como **restringidos** los secretos de autenticación, tokens, datos personales y credenciales de base; **confidenciales** los registros de ventas, pagos, compras, inventario y acciones administrativas; **internos** los eventos y resultados analíticos identificables; y **públicos** solo los elementos aprobados expresamente para presentación. Esta clasificación es una propuesta de manejo y no una clasificación institucional aprobada.

El hash de contraseñas y del refresh token protege esos valores en almacenamiento de aplicación, pero no se encontró evidencia de cifrado de bases de datos, SQLite, volúmenes o backups. Los eventos pueden contener IDs, tipo de operación, IP y metadatos; el contrato elimina claves con nombres sensibles conocidos, pero la persistencia no demuestra inmutabilidad, firma de eventos ni política de retención. La limitación de valores sensibles debe complementarse con minimización por esquema y revisión de emisores.

La tabla de usuario y el perfil retornado seleccionan campos concretos en varios endpoints. Sin embargo, la presencia de datos comerciales y personales en volúmenes y puertos de desarrollo aumenta el impacto potencial de exposición. No se encontró una política documentada de retención, borrado, backup cifrado ni recuperación probada.

### 6.3. Seguridad en microservicios

La integración entre gateway/servicios y `users-service` usa HTTP POST a `/internal/auth/validate`, una cabecera `x-internal-service-key` y el bearer token del usuario. `users-service` comprueba la clave mediante comparación de tiempo constante y valida permiso/rol actual desde la base. Este control está implementado para los callers inspeccionados y falla si la clave interna no está configurada.

La clave compartida proporciona autenticación básica de servicios, no una identidad única por servicio: varios contenedores comparten el mismo secreto, no hay mTLS ni firma por servicio, y una filtración permite suplantar a cualquier componente que use esa clave. La comunicación ocurre en HTTP sobre una red bridge común.

La ingesta de eventos en `logic-correlation-service` no exige un token ni clave interna. Las rutas de correlación y la API de `ai-service` tampoco muestran autenticación propia. En Compose no se publican directamente los puertos de esos dos servicios en el fragmento revisado, pero están conectados a la misma red interna que otros contenedores. La red es una frontera de despliegue, no un control de autorización por endpoint.

Las acciones de escritura de productos y las operaciones de ventas/inventario consultan al servicio de usuarios y obtienen de él el actor autenticado, lo que evita confiar en un ID de actor suministrado en el cuerpo en esos puntos. Las pruebas existentes cubren parcialmente ese patrón. La revisión de autorización de todas las rutas de cada servicio no se considera exhaustiva.

### 6.4. Protección de eventos y trazabilidad

El contrato `system-event.schema.json` define identificador, servicio, actor opcional, tipo de evento, entidad, timestamp, resultado e IP opcional. `event-publisher.js` genera UUID por defecto, valida el evento, filtra claves de metadatos sensibles, solicita modo 0600 al crear el archivo temporal del outbox, reintenta entregas y solo retira un evento si recibe confirmación coincidente de `event_id` y estado. No se verificaron los permisos del directorio ni de archivos preexistentes. `logic-correlation-service` persiste el evento con una clave primaria y usa consultas SQL parametrizadas; los IDs duplicados idénticos son idempotentes y las colisiones de contenido se rechazan.

Estas propiedades favorecen trazabilidad e idempotencia, pero no hacen inmutable ni auténtico al emisor. El servicio de correlación acepta solicitudes sin autenticación; puede aceptar un evento sintácticamente válido cuya identidad de actor, nombre de servicio o timestamp fueron fabricados. No se encontró firma HMAC del evento, canal de transporte TLS, control de origen, secuencia monotónica ni almacenamiento WORM.

La correlación por eventos distintos del mismo actor, la relación venta–movimiento de stock y las pruebas de señales sintéticas se documentan en `docs/ML_PIPELINE.md` y en pruebas. La detección de patrones anómalos es una función analítica experimental; no garantiza que el sistema resista intrusiones, ni confirma fraude. El propio pipeline advierte que las etiquetas sintéticas no son operaciones reales ni evidencia de fraude de SposaBella.

Los intentos de login registran eventos LOGIN/LOGIN_FALLIDO, con IP y motivo; sin embargo, el código usa `req.ip`, cuya correspondencia con el cliente real depende de la configuración de proxy. No se observó configuración explícita de `trust proxy` en los puntos revisados. La atribución de IP y los tiempos de conservación deben validarse antes de utilizar esos registros para una investigación (OWASP Foundation, s. f.-c).

### 6.5. Amenazas comunes y mitigaciones

La matriz OWASP Top 10:2021 completa se incluye en [matriz_auditoria_seguridad.md](./matriz_auditoria_seguridad.md). Las categorías se utilizan como marco de sensibilización y priorización, no como certificación (OWASP Foundation, 2021). Los hallazgos principales son los siguientes:

- **A01 Broken Access Control:** permisos actuales en middleware y validación interna mitigan parte del riesgo; endpoints internos del correlador/IA y cobertura de rutas deben revisarse.
- **A02 Cryptographic Failures:** bcrypt y hash de refresh son controles presentes; HTTP, tokens en `localStorage`, ausencia de cifrado en reposo comprobable y secretos de desarrollo requieren corrección.
- **A03 Injection:** Prisma y consultas parametrizadas observadas son mitigaciones; faltan pruebas sistemáticas de entradas de todas las rutas y de consultas raw.
- **A04 Insecure Design:** el análisis de anomalías separa eventos, correlación y modelo; no aporta autenticación/autoridad de origen a la ingesta.
- **A05 Security Misconfiguration:** Compose de desarrollo, puertos publicados, servicios HTTP, defaults de credenciales, ausencia de `USER` en Dockerfiles y CSP desactivada son exposiciones importantes.
- **A06 Vulnerable and Outdated Components:** hay manifests y lockfile, pero no se ejecutó SCA ni escaneo de imágenes/CVE; la ausencia de escaneo no implica vulnerabilidad confirmada.
- **A07 Identification and Authentication Failures:** bcrypt, rate limit y verificación de cuenta ayudan; no hay MFA, almacenamiento web expone tokens y recuperación por código depende de límites por IP.
- **A08 Software and Data Integrity Failures:** contrato, outbox e idempotencia ayudan a detectar errores; sin autenticación/firma de eventos no se garantiza quién originó el dato.
- **A09 Security Logging and Monitoring Failures:** hay eventos de login y outbox; no se verificó centralización, alertas, retención o control de integridad del histórico.
- **A10 SSRF:** en los caminos revisados, URLs de llamadas entre servicios proceden de configuración fija y no se observó un fetch a URL arbitraria suministrada por usuario; faltan pruebas de superficie total, restricciones de salida y validación de configuración.

### 6.6. Hardening

La tabla de hardening detallada y el estado por control se encuentran en la matriz anexa. Las prioridades son separar una configuración de producción, retirar secretos/credenciales por defecto, no publicar bases de datos ni puertos internos, habilitar TLS, ejecutar contenedores con usuario no privilegiado y reducir privilegios, restringir red y CORS, proteger y autenticar endpoints internos, y escanear imágenes y dependencias.

Las imágenes base declaradas incluyen Node 22 Alpine, Nginx 1.27 Alpine y Python 3.12 slim. Son versiones declaradas en Dockerfiles; no se ejecutó un análisis de CVE ni se confirmó el digest efectivo de las imágenes. Los Dockerfiles inspeccionados no definen directiva `USER`; por ello, el usuario efectivo de ejecución debe verificarse y endurecerse antes de producción.

### 6.7. Gestión de riesgos

Se usa una estimación cualitativa de probabilidad e impacto de 1 a 3. El nivel inherente se calcula como `P × I`: 1–2 bajo, 3–4 moderado, 6 alto y 9 crítico. El riesgo residual es una estimación posterior a los controles observados, no un valor medido ni una probabilidad estadística. La matriz registra al menos doce escenarios con activo, amenaza, condición, controles, riesgo residual, acción y prioridad.

Los riesgos prioritarios son la inyección de eventos falsos al correlador, la exposición de credenciales y bases por el Compose de desarrollo, el robo/reutilización de tokens y la falta de autenticación específica por microservicio. La estimación debe actualizarse cuando se disponga de un despliegue de producción, un modelo de amenazas formal y resultados de pruebas de integración.

## 7. Marcos y estándares de referencia

OWASP Top 10:2021 sirve como taxonomía de riesgos web, no como certificación. ASVS 5.0.0 proporciona requisitos verificables para ordenar pruebas, sin que esta auditoría declare cumplimiento de nivel alguno (OWASP Foundation, 2021, 2025). OWASP Cheat Sheet Series aporta recomendaciones técnicas para almacenamiento de contraseñas, autenticación, sesiones, validación, consultas, TLS, logging y API REST (OWASP Foundation, s. f.-a, s. f.-b, s. f.-c, s. f.-d, s. f.-e, s. f.-f, s. f.-g, s. f.-h).

NIST SP 800-63B, versión 4 publicada en 2025, es la referencia actual de identidad digital y autenticación; sustituyó a la versión previa (National Institute of Standards and Technology, 2025). NIST SP 800-218 SSDF 1.1 orienta la integración de seguridad en ciclo de desarrollo y cadena de suministro (National Institute of Standards and Technology, 2022). ISO/IEC 27001:2022 se utiliza como referencia de gestión del riesgo; ISO/IEC 27002:2022 aporta guía de controles; ISO 22301:2019 se considera únicamente para continuidad y recuperación (International Organization for Standardization, 2019, 2022a, 2022b). No se afirma certificación ni cumplimiento integral ISO.

La matriz de correspondencia —marco, principio, aplicación, evidencia y estado— está en [matriz_auditoria_seguridad.md](./matriz_auditoria_seguridad.md). La bibliografía APA 7 y enlaces oficiales están en [fuentes_referencias.md](./fuentes_referencias.md).

## 8. Pruebas y comprobación de seguridad

Se ejecutaron cuatro suites locales, sin reiniciar servicios ni contenedores y sin acceder a bases de datos activas:

| Componente | Comando ejecutado | Resultado |
|---|---|---:|
| users-service | `pnpm --dir backend/services/users-service test` | 16/16 aprobadas |
| products-service | `pnpm --dir backend/services/products-service test` | 3/3 aprobadas |
| logic-correlation-service | `pnpm --dir backend/services/logic-correlation-service test` | 32/32 aprobadas |
| gateway | `pnpm --dir backend/gateway test --runInBand` | 13/13 aprobadas |

Las suites verifican funciones de permisos, identificación de IP confiable y límite simulado, autorización de mutaciones de productos, formato/ingesta/idempotencia de eventos y lógica del correlador, así como guards del gateway usando respuestas simuladas. El correlador usa datos sintéticos y una base temporal de prueba; estos resultados no son eventos operativos reales.

No se ejecutaron pruebas end-to-end con el `users-service` y una base de integración, pruebas contra cuenta real, verificación de respuestas HTTP 401/403/200 con usuarios reales, pruebas de expiración JWT, modificación de permisos durante una sesión, renovación tras revocación, prueba de fuerza bruta de login ni escaneo de dependencias o imágenes. El plan de 16 pruebas requeridas y su estado observado está en la matriz.

En particular, un test unitario del gateway que simula una respuesta `valid: true` no demuestra que un inicio de sesión real haya obtenido HTTP 200 ni que el despliegue esté correctamente configurado. No se presenta como captura de operación real.

## 9. Evidencias de implementación

Se proponen dieciséis figuras con fuentes de código o configuración exactas y descripciones de captura. Las figuras 1 y 2 incluyen diagramas Mermaid editables; las demás conservan marcadores cuando la captura aún debe obtenerse. No se insertaron capturas inexistentes ni se inició Docker para producir evidencia.

El plan de capturas explica qué comando o pantalla usar, qué debe permanecer visible y qué datos se deben ocultar. En las capturas del código debe ocultarse toda clave, password, token o dato personal. En salidas de prueba deben ocultarse los bearer tokens y cuerpos de credenciales.

[INSERTAR FIGURA 1. ARQUITECTURA GENERAL DE SEGURIDAD DE SPOSABELLA. CAPTURA NECESARIA: render del diagrama Mermaid editable. UBICACIÓN: `diagramas_seguridad.md`, Figura 1. ELEMENTOS QUE DEBEN SER VISIBLES: frontend, gateway, servicios, bases, red común y fronteras de confianza. ELEMENTOS QUE DEBEN OCULTARSE: secretos, credenciales, tokens y datos personales.]

[INSERTAR FIGURA 2. FLUJO DE AUTENTICACIÓN MEDIANTE JWT. CAPTURA NECESARIA: render de la secuencia Mermaid de login y autorización dinámica. UBICACIÓN: `diagramas_seguridad.md`, Figura 2. ELEMENTOS QUE DEBEN SER VISIBLES: comparación bcrypt, estado y permisos actuales, access JWT y refresh token almacenado mediante hash. ELEMENTOS QUE DEBEN OCULTARSE: tokens reales, secretos y credenciales.]

[INSERTAR FIGURA 3. IMPLEMENTACIÓN DEL PROCESO DE LOGIN. CAPTURA NECESARIA: fragmento de `POST /auth/login`. UBICACIÓN: `backend/services/users-service/src/index.js`. ELEMENTOS QUE DEBEN SER VISIBLES: búsqueda de cuenta, comparación de contraseña y emisión condicional de tokens. ELEMENTOS QUE DEBEN OCULTARSE: contraseñas, hashes reales, datos personales y secretos.]

[INSERTAR FIGURA 4. ALMACENAMIENTO SEGURO DE CONTRASEÑAS. CAPTURA NECESARIA: llamadas de hash y comparación junto al nombre del campo de esquema. UBICACIÓN: `backend/services/users-service/src/index.js` y `backend/services/users-service/prisma/schema.prisma`. ELEMENTOS QUE DEBEN SER VISIBLES: `bcrypt.hash` con costo 12, `bcrypt.compare` y `hash_contrasena`. ELEMENTOS QUE DEBEN OCULTARSE: hashes reales y contraseñas.]

[INSERTAR FIGURA 5. VALIDACIÓN DEL TOKEN DE ACCESO. CAPTURA NECESARIA: middleware `authenticateToken`. UBICACIÓN: `backend/services/users-service/src/index.js`. ELEMENTOS QUE DEBEN SER VISIBLES: algoritmo permitido, verificación y manejo de token inválido. ELEMENTOS QUE DEBEN OCULTARSE: JWT y secreto de firma.]

[INSERTAR FIGURA 6. AUTORIZACIÓN DINÁMICA DE USUARIOS. CAPTURA NECESARIA: lectura de roles/permisos actuales y guard de permiso. UBICACIÓN: `backend/services/users-service/src/index.js` y `backend/services/users-service/src/permisos.js`. ELEMENTOS QUE DEBEN SER VISIBLES: consulta del estado y decisión del permiso requerido. ELEMENTOS QUE DEBEN OCULTARSE: identidades y datos operativos reales.]

[INSERTAR FIGURA 7. VALIDACIÓN INTERNA DE PERMISOS. CAPTURA NECESARIA: endpoint `/internal/auth/validate`. UBICACIÓN: `backend/services/users-service/src/index.js`. ELEMENTOS QUE DEBEN SER VISIBLES: validación interna, JWT y permiso consultado dinámicamente. ELEMENTOS QUE DEBEN OCULTARSE: valor de `INTERNAL_SERVICE_SECRET`, JWT y respuestas con identidad real.]

[INSERTAR FIGURA 8. CONFIGURACIÓN DE RATE LIMITING. CAPTURA NECESARIA: límites por ventana y clave de IP. UBICACIÓN: `backend/services/users-service/src/index.js` y `backend/services/users-service/src/rate-limit.js`. ELEMENTOS QUE DEBEN SER VISIBLES: perfiles de limitación y manejo de exceso. ELEMENTOS QUE DEBEN OCULTARSE: secretos compartidos e IP reales.]

[INSERTAR FIGURA 9. VALIDACIÓN DE PERMISOS EN EL API GATEWAY. CAPTURA NECESARIA: `requireAnalysisPermission` o `requireReportPermission`. UBICACIÓN: `backend/gateway/src/app.controller.ts`. ELEMENTOS QUE DEBEN SER VISIBLES: llamada interna, permiso requerido y manejo de errores de autorización. ELEMENTOS QUE DEBEN OCULTARSE: secreto interno, bearer token y datos personales.]

[INSERTAR FIGURA 10. PRUEBA DE AUTENTICACIÓN CORRECTA. CAPTURA NECESARIA: resultado HTTP 200 obtenido en prueba funcional con usuario sintético. UBICACIÓN: entorno de integración aislado/Postman. ELEMENTOS QUE DEBEN SER VISIBLES: endpoint y estado HTTP. ELEMENTOS QUE DEBEN OCULTARSE: credenciales, tokens, cookies y datos personales. ESTADO: pendiente; no se ha ejecutado.]

[INSERTAR FIGURA 11. RECHAZO DE ACCESO POR FALTA DE PERMISOS. CAPTURA NECESARIA: resultado HTTP 403 para usuario sintético sin el permiso requerido. UBICACIÓN: prueba aislada de una ruta protegida. ELEMENTOS QUE DEBEN SER VISIBLES: solicitud anonimizada y estado HTTP 403. ELEMENTOS QUE DEBEN OCULTARSE: bearer, secreto y datos personales. ESTADO: pendiente; no se ha ejecutado como prueba funcional.]

[INSERTAR FIGURA 12. ACCESO AUTORIZADO A UNA RUTA PROTEGIDA. CAPTURA NECESARIA: resultado HTTP 200 para usuario sintético con permiso. UBICACIÓN: prueba aislada de una ruta protegida. ELEMENTOS QUE DEBEN SER VISIBLES: endpoint y respuesta anonimizada. ELEMENTOS QUE DEBEN OCULTARSE: token, credenciales y datos comerciales. ESTADO: pendiente; los tests con mocks no sustituyen esta prueba.]

[INSERTAR FIGURA 13. PRUEBAS AUTOMATIZADAS DE SEGURIDAD. CAPTURA NECESARIA: resultados de las cuatro suites realmente ejecutadas. UBICACIÓN: terminal, con los comandos descritos en la sección 8. ELEMENTOS QUE DEBEN SER VISIBLES: comando, suite y conteo final observado. ELEMENTOS QUE DEBEN OCULTARSE: variables de entorno y rutas personales.]

[INSERTAR FIGURA 14. CONTRATO DE EVENTOS DEL SISTEMA. CAPTURA NECESARIA: esquema de eventos y restricciones principales. UBICACIÓN: `backend/contracts/system-event.schema.json` y `backend/contracts/system-event.js`. ELEMENTOS QUE DEBEN SER VISIBLES: campos requeridos, enumeraciones y validación de propiedades. ELEMENTOS QUE DEBEN OCULTARSE: eventos reales y datos personales.]

[INSERTAR FIGURA 15. PROTECCIÓN DE SECRETOS Y CONFIGURACIÓN. CAPTURA NECESARIA: nombres de variables y exclusión del archivo `.env`, sin valores. UBICACIÓN: `.env.example` y `.gitignore`. ELEMENTOS QUE DEBEN SER VISIBLES: nombres de configuración y regla de exclusión. ELEMENTOS QUE DEBEN OCULTARSE: todos los valores, secretos, contraseñas, tokens y URLs con credenciales.]

[INSERTAR FIGURA 16. CONTENEDORES Y ARQUITECTURA DE SERVICIOS. CAPTURA NECESARIA: bloques de servicios/puertos o salida de `docker compose ps` si el entorno ya está activo. UBICACIÓN: `docker-compose.yml`; comando no mutante opcional: `docker compose ps`. ELEMENTOS QUE DEBEN SER VISIBLES: servicios y puertos de desarrollo. ELEMENTOS QUE DEBEN OCULTARSE: valores de variables, credenciales y secretos. ESTADO: no se inició ni consultó Docker durante esta auditoría.]

## 10. Resultados de la auditoría

**Implementados con evidencia de código:** bcrypt con costo configurado; validación explícita de HS256 en `users-service`; expiración de JWT; refresh token aleatorio cuyo hash se conserva; revocación de refresh; comprobación dinámica de usuario/rol/permisos; guards backend; limitación por IP en rutas de autenticación; control de intentos de verificación de correo; validación del contrato de eventos; outbox con reintento; idempotencia en el almacén; consultas SQL con parámetros en el correlador.

**Parciales:** limitación de intentos por IP sin bloqueo por cuenta ni almacén distribuido; mensajes genéricos solo para credenciales incorrectas, con otros estados revelados; validación sensible de metadatos basada principalmente en nombre de clave; autenticación interna con secreto compartido; logging de eventos sin retención/alertas demostradas; permisos dinámicos solo donde los guards consultan `users-service`; Docker Compose como entorno de desarrollo con puertos de datos y servicios publicados.

**No encontrados o pendientes de verificar:** MFA; HTTPS/TLS de producción; cifrado de bases y backups; rotación de refresh tokens; revocación inmediata de access JWT; autenticación propia de endpoints de correlación/IA; gestión centralizada de secretos; usuario no root para contenedores; escaneo de CVE y SBOM; retención/alertas de seguridad; pruebas de integración del flujo real de autenticación; documento académico principal.

## 11. Limitaciones y mejoras propuestas

La ausencia del documento de tesis principal impide comprobar consistencia entre esta auditoría, requerimientos aprobados, objetivos y capítulos académicos. El estado local incorpora cambios no confirmados que pueden no coincidir con una versión publicada o desplegada. Tampoco se verificaron valores de secretos locales ni se consultó una base activa.

Se recomienda atender las acciones prioritarias de la matriz antes de desplegar públicamente: eliminar defaults de credenciales; retirar publicación de bases y servicios internos; poner TLS y proxy confiable explícito; proteger endpoints de eventos y administración; adoptar almacenamiento de sesión menos expuesto a XSS; revisar longitud y límite bcrypt; añadir pruebas de auth/integración y un escaneo reproducible de dependencias e imágenes.

Las capturas de la actividad académica deben proceder de un entorno aislado con cuentas sintéticas y secretos ocultos. No deben obtenerse contra datos reales ni mediante cambios en roles reales.

## 12. Conclusiones

SposaBella implementa controles relevantes en autenticación y autorización: bcrypt, limitación por IP, validación JWT con algoritmo fijado y consulta dinámica de privilegios. Estos mecanismos constituyen evidencia concreta de seguridad aplicada al proyecto, no solo recomendaciones teóricas.

La seguridad de sesión es parcial. El uso de `localStorage`, la falta de MFA, la ausencia de rotación de refresh tokens y la no revocación inmediata de access JWT limitan la resistencia frente al robo de credenciales o tokens.

El principal riesgo de integridad analítica reside en que el contrato valida forma, pero el receptor de eventos no verifica identidad criptográfica del emisor. Como el Árbol de Decisión procesa eventos como evidencia, los eventos falsificados o mal atribuidos pueden degradar el análisis aunque el modelo funcione como se programó.

La configuración inspeccionada es de desarrollo y no sustenta afirmaciones sobre producción. La publicación de puertos, credenciales por defecto, HTTP y falta de hardening deben resolverse o limitarse antes de cualquier exposición. La auditoría no certifica el cumplimiento de OWASP, NIST o ISO, ni confirma detección real de fraude.

## 13. Referencias bibliográficas

La lista APA 7 con título, autor institucional, año, URL y fecha de consulta está en [fuentes_referencias.md](./fuentes_referencias.md). Las citas parentéticas del presente informe se refieren a esa lista. No se atribuye certificación ni cumplimiento total a ningún marco.

## 14. Anexos

- **Anexo A:** [matriz de controles, OWASP, hardening, riesgos y rúbrica](./matriz_auditoria_seguridad.md).
- **Anexo B:** [plan de capturas y marcadores de evidencia](./plan_capturas_evidencias.md).
- **Anexo C:** [diagramas Mermaid editables](./diagramas_seguridad.md).
- **Anexo D:** [referencias técnicas y normativas](./fuentes_referencias.md).
- **Anexo E:** comandos de pruebas ejecutadas, consignados en la sección 8.

## Matriz final de rúbrica

| Criterio | Evidencia actual | Limitación | Autoevaluación razonada |
|---|---|---|---|
| A. Cumplimiento de directrices de seguridad (30 %) | Se describen controles implementados y pendientes, riesgos, pruebas, marcos y referencias; se evita afirmar MFA, TLS de producción o certificación | Falta tesis principal y capturas manuales; varios controles no se probaron en integración | Sustento documental amplio y verificable, pero no se asigna puntaje ni se garantiza calificación |
| B. Relevancia de medidas de seguridad (30 %) | Se conectan autenticación, permisos, secretos, eventos y datos comerciales con amenazas concretas | MFA, TLS productivo, monitoreo y autenticación de eventos están pendientes | Las medidas son pertinentes a los activos; persisten brechas significativas |
| C. Aplicación correcta en el proyecto (40 %) | Referencias a rutas, funciones, variables, pruebas ejecutadas y código de servicios reales | No se observó la tesis completa ni despliegue productivo, y no se ejecutaron los casos de login con cuentas | La aplicación está demostrada parcialmente; para una evaluación sobresaliente faltan capturas y pruebas funcionales seguras |

La autoevaluación es cualitativa y no equivale a una calificación de tribunal.
