# Matriz de auditoría de seguridad de SposaBella

**Fecha de corte:** 13 de noviembre de 2026  
**Criterio de estado:** *implementado* = evidencia directa en código/configuración y, cuando se indique, prueba; *parcial* = control limitado o cobertura incompleta; *pendiente* = no se encontró evidencia suficiente; *recomendado* = acción futura, no implementada.

## 1. Inventario de controles

| Control y objetivo | Amenaza mitigada | Componente / evidencia del repositorio | Funcionamiento y prueba disponible | Estado y limitación |
|---|---|---|---|---|
| Hash de contraseña | Robo de credenciales almacenadas y cracking offline | `backend/services/users-service/src/index.js` (`bcrypt.hash`, `bcrypt.compare`); `prisma/schema.prisma` (`credenciales.hash_contrasena`) | bcryptjs con costo 12; creación, activación, recuperación y login usan hash/comparación. La suite ejecutada no verifica endpoints contra DB | Implementado; mínimo de 8 caracteres y manejo del límite de 72 bytes requieren revisión |
| Verificación de correo | Activación de cuentas no verificadas | `users-service/src/index.js`; tabla `tokens_verificacion` | Token/código guardado como SHA-256, expiración y máximo de cinco intentos para verificación por código | Implementado parcialmente; no constituye MFA |
| Rate limiting | Fuerza bruta básica desde una IP | `users-service/src/index.js`; `src/rate-limit.js`; `test/rate-limit.test.js` | 10 login, 20 rutas comunes y 5 recuperación por IP/15 min; suite ejecutada comprueba clave IP confiable y umbral con middleware de prueba | Implementado parcialmente; memoria local, sin límite por cuenta, distribuido o protección específica anti-credential-stuffing |
| JWT de acceso | Falsificación/reutilización de token fuera de vigencia | `users-service/src/index.js` (`generateAccessToken`, `authenticateToken`) | JWT HS256; vencimiento por configuración con default 15 min; `jwt.verify` limita algoritmo | Implementado; no se configuran `iss`/`aud`/`jti`; claim no cifra contenido |
| Refresh token | Persistencia insegura del token de sesión | `users-service/src/index.js` (`generateRefreshToken`, `hashToken`, rutas refresh/logout); esquema `tokens_refresh` | 64 bytes aleatorios, hash SHA-256 guardado, expiración default 7 días, campo de revocación | Implementado parcialmente; sin rotación/reutilización detectable; access JWT no revocable inmediatamente |
| Autorización dinámica | Permiso obsoleto o cuenta deshabilitada | `users-service/src/index.js` (`obtenerContextoAutorizacion`, `authorizePermission`, `/internal/auth/validate`); `src/permisos.js` | Consulta estado, roles activos y permisos efectivos actuales por solicitud; suite de permisos y gateway pasa | Implementado en rutas consumidoras; no hay pruebas funcionales de cambio de permisos en sesión para todos los servicios |
| Autorización entre servicios | Suplantación de usuario o llamada sin permiso | Gateway `app.controller.ts`; middleware de `sales`, `inventory`, `products`; `users-service` endpoint interno | Se transmite bearer y secreto compartido; endpoint verifica secreto con `timingSafeEqual`, JWT y permiso/roles actuales | Parcial; secreto común, HTTP, no mTLS, inventario total de rutas pendiente |
| Limitación de metadatos de eventos | Fuga de PII o credenciales por evento | `backend/contracts/system-event.js`, `system-event.schema.json` | Valida nombres de campos, tipos, límites, enum y elimina claves sensibles conocidas; cobertura en pruebas del correlador | Parcial; una clave inocua puede transportar valor sensible; no autentica al emisor |
| Outbox e idempotencia | Pérdida, duplicado o repetición de eventos | `contracts/event-publisher.js`; `logic-correlation-service/src/store.js` | UUID, archivo outbox, reintento y acuse cotejado; se solicita modo 0600 al crear temporal; DB SQLite con clave primaria y consultas parametrizadas; 32 tests pasan | Implementado en persistencia/idempotencia; no es firma ni garantía de inmutabilidad; permisos de directorio/archivos existentes pendientes |
| Control de actor | Manipulación del ID del usuario que ejecutó una acción | `contracts/event-actor.js`; middleware productos/ventas; tests productos | Usa identidad devuelta por users-service, no confía en el ID que llega en el cuerpo en rutas probadas | Parcial; no se verificó cobertura de todos los eventos/rutas |
| Protección HTTP | Intercepción y modificación de credenciales en tránsito | `infrastructure/nginx/default.conf`; `docker-compose.yml`; llamadas HTTP entre servicios | Configuración observada escucha HTTP/80 y compose publica HTTP; sin certificados hallados | Pendiente para producción; no afirmar TLS desplegado |
| Protección frontend | Exposición de tokens a scripts inyectados | `frontend/web/src/auth/services/session.ts` | Tokens access/refresh almacenados en `localStorage` | Parcial/riesgo: cualquier XSS con ejecución puede leerlos; no se observó cookie HttpOnly |
| Cabeceras de seguridad | Clickjacking, sniffing y otras clases de abuso del navegador | users-service y correlator aplican Helmet con CSP deshabilitada; gateway bootstrap y nginx | Algunas cabeceras provienen de Helmet; no hay CSP confirmada | Parcial; falta política CSP y revisión de cabeceras en gateway/proxy |
| Secretos de despliegue | Uso indebido de DB/JWT/servicio | `.env.example`, `.gitignore`, `docker-compose.yml`, Dockerfiles | `.env` está ignorado; nombres de variables documentados; compose exige algunos secretos pero conserva credenciales/defaults de desarrollo | Parcial; no hay gestor centralizado ni perfil de producción demostrado |
| SQL parametrizado | Inyección SQL | Prisma en servicios; consultas preparadas de correlator; consultas Prisma tagged | Búsqueda dirigida no encontró `queryRawUnsafe`/`executeRawUnsafe`; pruebas no son fuzzing de inputs | Mitigación observada; no equivale a prueba exhaustiva |
| Logging y monitoreo | Detección tardía o falta de trazabilidad | eventos LOGIN/LOGIN_FALLIDO, publisher/outbox y logs de consola | Eventos de seguridad y operación se validan y persisten en SQLite | Parcial; retención, alertas, centralización, integridad independiente y response playbook no verificados |
| Contenedores | Escape, abuso de privilegios y exposición de red | `infrastructure/docker/Dockerfile.*`, `docker-compose.yml` | Imágenes explícitas; red bridge común; varios puertos host publicados; Dockerfiles sin `USER` observado | Pendiente de hardening; no ejecutado escaneo ni `docker compose ps` |

## 2. Evaluación OWASP Top 10:2021

| Categoría | Aplicación y superficie en SposaBella | Mitigaciones observadas | Brechas / recomendación | Prueba verificable |
|---|---|---|---|---|
| A01 Broken Access Control | Rutas de usuarios, ventas, inventario, productos, reportes y análisis | Middleware backend por permiso y consulta dinámica interna; respuestas 401/403 diferenciadas | Verificar rutas sin guard, acceso directo a servicios, IDOR y exposición de endpoints internos; no basarse en UI | Matriz de roles/permisos y tests de cada ruta 401/403/200; mutar rol después de emisión de JWT |
| A02 Cryptographic Failures | Contraseñas, JWT, refresh tokens, PII y comunicación HTTP | bcrypt costo 12; hash de refresh; algoritmos HS256 fijados al verificar | HTTP en Compose, tokens en localStorage, no evidencia cifrado DB/backups, defaults locales; evaluar límite bcrypt | Inspección TLS y prueba de certificados en ambiente aislado; prueba de tokens no legibles por almacenamiento web |
| A03 Injection | JSON HTTP, filtros y operaciones DB | Prisma, SQL parametrizado y validación de contratos/fechas | Validar límites y tipos en todas las rutas, auditar consultas raw y errores de ORM | Pruebas de límites/SQL metacharacters en entorno temporal y revisión de queries; sin datos de producción |
| A04 Insecure Design | Contraseñas, tokens, servicios internos y datos para analítica | Controles de permisos, outbox y tests del pipeline | Falta MFA; secretos de servicio compartidos; evento no autentica fuente; threat model y abuso de recuperación incompletos | Taller de abuso y pruebas de flujo de recuperación, replay y eventos falsificados con datos sintéticos |
| A05 Security Misconfiguration | Nginx, Compose, puertos, variables, CORS, contenedores | `.env` ignorado; algunos secretos requeridos; Helmet parcial | Compose usa modo desarrollo/defaults y publica puertos DB/servicios; no hay TLS; CSP deshabilitada; contenedores sin usuario declarado | Revisión de configuración estática, `docker compose config` con secretos redactados y escaneo de imagen aislado |
| A06 Vulnerable and Outdated Components | pnpm, pip, imágenes Node/Python/Nginx/MySQL | Manifests y lockfile presentes; versiones declaradas en manifests | No se ejecutó auditoría de dependencias, SBOM, escáner de imágenes o verificación CVE | Ejecutar SCA y escaneo de imágenes en CI, guardar fecha, herramienta, baseline y resultados |
| A07 Identification and Authentication Failures | Login, refresh, reset, activación y tokens | bcrypt, verificación de correo, rate limits, validación JWT y estados | Sin MFA; tokens en localStorage; límites solo por IP; estados de cuenta revelados; refresh no rota | Pruebas de login/reset, vencimiento, reutilización, MFA futura y rate-limit por cuenta/origen |
| A08 Software and Data Integrity Failures | Eventos, outbox, correlación, entrenamiento y datos del modelo | JSON Schema, idempotencia, UUID y cotejo de acuse | Receptor no autentica productor; no firma ni secuencia de evento; modelo/datasets no se verificaron con firma | Enviar evento alterado/repetido solo a instancia de prueba y verificar rechazo, atribución y cadena de procedencia |
| A09 Security Logging and Monitoring Failures | Intentos de login y cambios/operaciones comerciales | Eventos de autenticación y operación; persistencia y pruebas de outbox | Sin retención, alertas ni agregación probadas; IP puede ser proxy; no inmutabilidad | Generar casos sintéticos, corroborar actor/tiempo, alertas y retención en un entorno dedicado |
| A10 Server-Side Request Forgery | Llamadas HTTP a servicios y URL base por variables | Destinos internos configurados por variables/constantes en rutas revisadas | No se encontró fetch a URL arbitraria de usuario en las rutas revisadas; superficie total/egress no comprobados | Pruebas de validación de URL y restricciones de salida, sin acceso a destinos externos sensibles |

No se considera que ninguna categoría haya sido eliminada por completo.

## 3. Hardening de infraestructura

| Control | Estado observado | Evidencia | Recomendación |
|---|---|---|---|
| TLS de entrada | Pendiente en configuración inspeccionada | Nginx listen 80, proxy HTTP; Compose publica host HTTP | Terminar TLS con certificados y redirección; validar TLS interno según riesgo |
| Variables y secretos | Parcial | `.env` ignorado y `.env.example`; variables obligatorias para JWT/servicios; defaults de desarrollo en Compose | Secret manager/orquestador; borrar defaults y revisar historial/artefactos sin revelar valores |
| Exposición de puertos | Riesgo alto en Compose de desarrollo | Puertos de gateway, servicios, DB y phpMyAdmin publicados | Publicar solo proxy público; eliminar mapeos de DB y servicios internos en perfiles no locales |
| Segmentación | Parcial | Una red bridge común `boutique-network` | Separar red frontend/gateway, servicios y DB; mínimo flujo entre servicios |
| Usuario no privilegiado | Pendiente | Dockerfiles no declaran `USER` | Crear UID no root, permisos mínimos y filesystem de solo lectura cuando sea viable |
| Imagen base | Parcial | Node 22 Alpine, Nginx 1.27 Alpine, Python 3.12 slim; MySQL 8 | Fijar digest/versiones, automatizar actualización y CVE/SBOM |
| Dependencias | Pendiente de evaluación | pnpm-lock y requirements presentes | SCA reproducible y revisar lockfile; no se afirma vulnerabilidad |
| Despliegue de desarrollo | Configuración actual | Compose marca `NODE_ENV` desarrollo; gateway arranca `start:dev`; volúmenes de código | Separar Compose de desarrollo y producción; no publicar configuración dev |
| Seguridad HTTP | Parcial | Helmet en dos servicios, CSP deshabilitada; CORS amplio en correlador | Cabeceras explícitas, CSP, CORS allowlist y pruebas de configuración |
| Logs y eventos | Parcial | Outbox con modo archivo 0600 y SQLite persistente | Definir permisos de directorio, retención, backup protegido, alertas e integridad |
| Servicios de IA/correlación | Pendiente de control por endpoint | Rutas sin middleware de autenticación; red compartida | Autenticación servicio-a-servicio, autorización específica y límites de petición |
| phpMyAdmin | Riesgo local | Compose publica servicio de administración y credenciales por defecto | Deshabilitar fuera de desarrollo, red de administración restringida, acceso fuerte y temporal |

## 4. Matriz de riesgos específica

Escalas: probabilidad (P) e impacto (I) cualitativos: 1 bajo, 2 medio, 3 alto. Riesgo inherente = `P × I`: 1–2 bajo, 3–4 moderado, 6 alto, 9 crítico. El residual es una estimación cualitativa después de controles de código observados; no es una medición de incidentes ni de probabilidad estadística.

| Activo | Amenaza / condición | P | I | Inherente | Controles existentes | Residual estimado | Acción recomendada | Prioridad |
|---|---|---:|---:|---|---|---|---|---|
| Cuentas de usuario | Toma de cuenta por contraseña reutilizada o filtrada | 3 | 3 | 9 crítico | bcrypt, rate limit por IP, correo verificado | 6 alto | MFA para administradores, lista de contraseñas bloqueadas y monitoreo de credential stuffing | Alta |
| Sesiones y operaciones comerciales | Robo de access/refresh token por XSS o dispositivo | 3 | 3 | 9 crítico | Access JWT 15 min; refresh hashado y revocable | 6 alto | Evitar localStorage; CSP; rotar refresh con detección de reuse; sesión de revocación | Alta |
| Login | Fuerza bruta distribuida | 3 | 3 | 9 crítico | 10 intentos/IP/15 min | 6 alto | Límite por cuenta y global; almacenamiento distribuido, detección y mitigación adaptativa | Alta |
| Roles y permisos | Manipulación o asignación indebida | 2 | 3 | 6 alto | Guards por permiso y validación dinámica | 3 moderado | Revisar mínimos privilegios, cambios de rol auditables y tests de cada mutación | Alta |
| Bases comerciales | Inyección SQL | 2 | 3 | 6 alto | Prisma y queries parametrizadas en puntos revisados | 2 bajo | Completar revisión/fuzz de inputs y controles de autorización por objeto | Media |
| PII/clientes | Exposición por puertos, logs o acceso excesivo | 2 | 3 | 6 alto | Selección de campos en algunos endpoints; hash de contraseñas | 4 moderado | Minimizar campos, restringir puertos, redactar logs y definir retención | Alta |
| Secretos de aplicación | Exposición de claves y passwords por configuración/imagen | 3 | 3 | 9 crítico | `.env` ignorado; algunos secretos requeridos | 6 alto | Retirar defaults, gestionar secretos externamente, rotar valores comprometidos y escanear repositorio/imagen | Alta |
| Eventos de correlación | Evento falsificado/replay o actor no auténtico | 3 | 3 | 9 crítico | Esquema, UUID, idempotencia y validación de formato | 9 crítico | Autenticar emisor, firmar eventos, proteger transporte y validar identidad/permisos | Crítica |
| Ventas e inventario | Alteración de operación o atribución falsa | 2 | 3 | 6 alto | Autorización a través de users-service y actor devuelto | 4 moderado | Revisión de todas las rutas, trazas inmutables y pruebas de autorización de integración | Alta |
| Componentes | CVE en paquetes o imagen base | 2 | 2 | 4 moderado | Lockfile y manifests | 4 moderado | Ejecutar SCA/SBOM/escaneo de imagen de forma periódica | Media |
| Disponibilidad | Agotamiento de CPU/DB o caída de servicio | 3 | 3 | 9 crítico | Rate limits solo en autenticación, health checks en DB | 6 alto | Límites por servicio, timeouts, cuotas, alertas, backups y ensayo de recuperación | Alta |
| Microservicios | Movimiento lateral y uso de secreto compartido | 3 | 3 | 9 crítico | Clave interna y permisos consultados en un servicio central | 6 alto | mTLS/identidades por workload, claves rotables y segmentación de red | Alta |
| Historial de auditoría | Pérdida, alteración o retención inadecuada de eventos | 2 | 3 | 6 alto | Outbox, SQLite persistente e idempotencia | 4 moderado | Copias protegidas, acceso restringido, retención definida y controles de integridad externos | Alta |
| Servicio de notificaciones | JWT aceptado con configuración fallback o claims insuficientes | 2 | 3 | 6 alto | Verificación de firma HMAC; Compose suministra secreto | 4 moderado | Quitar fallback, exigir `exp`/`sub`/algoritmo, permisos actuales y clave de servicio segura | Alta |

## 5. Correspondencia de marcos

| Marco o referencia | Principio aplicado | Aplicación en SposaBella | Evidencia | Estado |
|---|---|---|---|---|
| OWASP Top 10:2021 | Identificar las diez familias principales de riesgo web | Evaluación por A01–A10 incluida en esta matriz | Código, Compose y pruebas revisadas | Evaluado; no equivale a conformidad |
| OWASP ASVS 5.0.0 | Requisitos verificables para diseño y prueba de aplicaciones | Base para priorizar autenticación, acceso, validación y despliegue | Controles en `users-service`, gateway y eventos | Parcial; no se ejecutó assessment completo por requisito |
| OWASP Password Storage Cheat Sheet | Hash adaptativo, salt individual y factores de costo | bcryptjs con costo 12 | `users-service/src/index.js`, schema Prisma | Implementado con limitaciones de longitud y actualización |
| OWASP Authentication Cheat Sheet | Controles de autenticación, errores y protección de contraseña | Rate limit y mensaje genérico de credencial inválida | rutas de login y rate limit | Parcial |
| OWASP Session Management Cheat Sheet | Protección de credenciales de sesión | Access/refresh token con expiración y revocación de refresh | session.ts, schema, endpoints refresh/logout | Parcial por localStorage, falta de rotación y revocación del access |
| RFC 7519/RFC 8725 y OWASP REST Security | Uso seguro de firma, algoritmos y claims | HS256 limitado en verificación; refresh opaco separado | `users-service` y `notifications-service` | Parcial; falta issuer/audience y uniformidad |
| OWASP Input Validation / SQL Injection Prevention | Allowlist, límites y parametrización | Validaciones de correo, eventos, fechas, campos y ORM | validador de evento, Prisma, SQLite prepared statements | Parcial; cobertura de rutas no exhaustiva |
| OWASP Logging / REST / TLS Cheat Sheets | Eventos útiles, autorización por endpoint y transporte seguro | LOGIN/LOGOUT, guards, llamadas internas | event publisher, middleware, Compose | Parcial; sin HTTPS confirmado, retención o alertas |
| ISO/IEC 27001:2022 | Gestión de riesgos e ISMS | Riesgos, activos y acciones identificados a nivel de proyecto | Matriz de riesgos de este informe | Referencia académica; sin certificación ni ISMS auditado |
| ISO/IEC 27002:2022 | Guía de controles organizativos/técnicos | Acceso, criptografía, logging, cambios y proveedores | Hallazgos y recomendaciones | Recomendado como guía; no se declara implementación integral |
| ISO 22301:2019 | Continuidad del negocio y recuperación | Disponibilidad, respaldos y recuperación | Compose y persistencia documentada; no hay evidencia de ensayo | Pendiente; pertinente solo para continuidad |
| NIST SP 800-63B-4 (2025) | Identidad, autenticación, contraseñas y autenticadores | Login de un factor y política de contraseña | `validatePassword`, login y ausencia de MFA | Parcial; NIST usado como comparación, no como certificación |
| NIST SP 800-218 SSDF 1.1 | Integrar prácticas seguras al SDLC | Suites de test y documentación; falta evidencia de SCA/CI seguro | manifests, pruebas y scripts disponibles | Parcial |

## 6. Pruebas requeridas de autenticación

**Estado global:** las pruebas de casos reales de login de esta tabla no se ejecutaron. Los cuatro comandos unitarios ejecutados están documentados en el informe. “Pendiente” significa que no existe resultado observado en esta auditoría; no significa fallo ni aprobación.

| ID | Objetivo | Precondiciones y procedimiento seguro | Resultado esperado | Resultado observado / estado | Evidencia |
|---|---|---|---|---|---|
| T01 | Inicio de sesión válido | Base desechable; usuario sintético activo, correo verificado, credencial bcrypt y rol/permisos activos; POST login | 200, access/refresh token y usuario sin hash | No ejecutado; pendiente | No hay test de endpoint login en suite users-service revisada |
| T02 | Contraseña incorrecta | Usuario sintético válido y contraseña distinta | 401 genérico, evento FALLIDO | No ejecutado; pendiente | La rama está en `users-service/src/index.js`; sin resultado HTTP capturado |
| T03 | Usuario inexistente | Correo sintético inexistente | 401 genérico equivalente a credencial incorrecta | No ejecutado; pendiente | No existe caso de endpoint comprobado |
| T04 | Usuario inactivo | Usuario sintético desactivado | 403; sin tokens | No ejecutado; pendiente | Comportamiento codificado, no probado por integración |
| T05 | Sin roles activos | Usuario activo sin asignación o solo rol inactivo | 403; sin tokens | No ejecutado; pendiente | Helper de permiso tiene tests, endpoint no |
| T06 | Sin permisos efectivos | Usuario sintético con rol activo sin permisos efectivos | 403; sin tokens | No ejecutado; pendiente | Helper de permisos cubre casos próximos; login no |
| T07 | Token inválido | GET protegida con firma alterada en entorno aislado | 401 | No ejecutado como prueba funcional | Middleware verifica token; sin suite de auth |
| T08 | Token expirado | JWT de prueba vencido | 401 | No ejecutado; pendiente | Sin fixture de expiración |
| T09 | Token malformado | Bearer con forma no JWT | 401 sin excepción no controlada | No ejecutado; pendiente | Sin test directo del middleware |
| T10 | Ruta sin permiso | Token de usuario sin permiso para recurso | 403 | No ejecutado con servicio real | Tests de gateway usan mocks, no demuestran estado real |
| T11 | Ruta con permiso | Usuario sintético autorizado | 200 o respuesta funcional | No ejecutado con servicio real | Tests de gateway mockean respuesta válida |
| T12 | Permiso retirado luego de emitir JWT | Emitir token, retirar permiso en DB desechable y repetir request | Próxima autorización rechazada | No ejecutado; lógica consulta contexto actual | Sin prueba de integración |
| T13 | Rol desactivado luego de emitir JWT | Emitir token, desactivar rol y repetir request | Rechazo 403 | No ejecutado; pendiente | Sin prueba de integración |
| T14 | Usuario deshabilitado luego de emitir JWT | Emitir token, desactivar usuario y repetir request | Rechazo en rutas dinámicas y renovación | No ejecutado; pendiente | Sin prueba de integración |
| T15 | Renovación tras perder autorización | Revocar permiso/rol o desactivar usuario y llamar refresh | 403; no nuevo access token | No ejecutado; lógica se ve en código | Sin resultado HTTP observado |
| T16 | Intentos repetidos de login | IP sintética repetida en entorno de prueba, sin cuenta real | Rechazo 429 según límite y evento apropiado | El helper/limitador fue probado con 1 request/minuto y obtuvo 429; flujo real de login no probado | `users-service/test/rate-limit.test.js`, 3 casos aprobados |

Las pruebas futuras deben emplear una base creada exclusivamente para integración, usuarios aleatorios desechables, secretos efímeros y limpieza verificada. No se deben ejecutar en cuentas ni bases reales.

## 7. Resultados observados de suites ejecutadas

| Suite | Tipo | Alcance demostrable | Resultado |
|---|---|---|---:|
| `users-service/test/*.test.js` | Unitarias | Cálculo de permisos y limitador con IP de gateway de prueba | 16/16 pasan |
| `products-service/test/*.test.js` | Unitarias de middleware | Mapeo de permisos de escritura, uso del actor validado y rechazo sin bearer | 3/3 pasan |
| `logic-correlation-service/test/*.test.js` | Unitarias e integración HTTP local con SQLite temporal | Validación de contrato, idempotencia, rechazo de colisiones, correlación y persistencia temporal | 32/32 pasan |
| `backend/gateway` Jest | Unitarias de controller con fetch simulado | Respuesta de guards ante casos 2xx válidos/inválidos y fallos de comunicación | 13/13 pasan |

La etiqueta “integración local” se limita al servidor Express y el SQLite temporal creados por la prueba. No prueba red real entre microservicios. Los datos se generan en tests y no son operaciones reales de SposaBella.

## 8. Matriz de rúbrica final

| Criterio y ponderación | Sección que aporta evidencia | Medida aplicada | Evidencia actual | Limitación | Acción pendiente |
|---|---|---|---|---|---|
| A. Cumplimiento de directrices de seguridad (30 %) | Secciones 5–8 e inventario | Contraseñas hasheadas, JWT/refresh, permisos dinámicos, rate limit, contratos y riesgos | Código, configuración, cuatro suites ejecutadas y referencias oficiales | No hay documento académico principal, MFA ni HTTPS de producción verificado | Adjuntar capturas y completar pruebas funcionales; conservar estados pendientes |
| B. Relevancia de las medidas de seguridad (30 %) | Secciones 5–7 y matriz OWASP/riesgos | Relación de controles con cuentas, ventas, PII, microservicios y eventos | Análisis de amenazas y riesgos específicos | Persisten riesgos altos/críticos en sesión, configuración y eventos | Priorizar autenticación de eventos, hardening y protección de tokens |
| C. Aplicación correcta en el proyecto (40 %) | Secciones 4–10 y matriz de evidencia | Identificación de componentes, funciones, rutas y suites reales | Rutas exactas, tests con resultados y diagramas editables | No se probó login real ni despliegue; marcadores aún requieren capturas | Obtener capturas desde entorno aislado y verificar tesis completa |

La autoevaluación es cualitativa; no asigna puntos ni garantiza calificación.
