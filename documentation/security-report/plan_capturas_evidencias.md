# Plan de capturas y evidencias visuales

Este plan no simula capturas ni sustituye pruebas pendientes. Las capturas deben obtenerse desde un entorno aislado y utilizar datos sintéticos. Antes de registrar una terminal, eliminar variables de entorno, comandos, cuerpos o resultados que contengan secretos, correo real, token, contraseña, hash o datos de cliente.

**Ruta base del repositorio:** `E:\boutique-system`  
**Destino sugerido de imágenes:** `documentation\security-report\evidencias\` (crear manualmente solo si se decide guardar capturas).

## Figuras solicitadas

### Figura 1. Arquitectura general de seguridad de SposaBella

**Fuente:** diagrama elaborado a partir de los componentes reales del repositorio.  
**Ubicación:** diagrama Mermaid en [diagramas_seguridad.md](./diagramas_seguridad.md).  
**Captura:** renderizar la sección “Arquitectura de seguridad” en un editor Mermaid o Markdown que soporte Mermaid.  
**Debe mostrar:** frontend, Nginx HTTP de desarrollo, gateway, `users-service`, servicios de dominio, correlador, AI service, bases y frontera de red común.  
**Debe ocultar:** secretos, URLs con credenciales, nombres de usuario/contraseña de DB y datos personales.  
**Estado:** diagrama editable incluido; captura visual manual pendiente.

### Figura 2. Flujo de autenticación mediante JWT

**Fuente:** diagrama Mermaid elaborado desde `users-service`, gateway y frontend.  
**Ubicación:** [diagramas_seguridad.md](./diagramas_seguridad.md), secuencia de login y autorización.  
**Captura:** renderizar el Mermaid.  
**Debe mostrar:** verificación de bcrypt, estado/roles/permisos, access JWT, refresh aleatorio hashado en DB y validación dinámica posterior.  
**Debe ocultar:** tokens, claims de una sesión real, correo y credenciales.  
**Estado:** diagrama editable incluido; captura visual manual pendiente.

### Figura 3. Implementación del proceso de login

**Fuente:** `backend\services\users-service\src\index.js`, ruta `POST /auth/login` (aprox. línea 2865).  
**Captura:** abrir el archivo en VS Code y usar Go to Line 2865; incluir solo fragmento acotado de localización, comparación bcrypt, validación de contexto y emisión.  
**Debe mostrar:** función y ruta, nombres de funciones y respuesta genérica de error.  
**Debe ocultar:** cualquier valor concreto de usuario, credencial, configuración o consola de entorno.  
**Estado:** código disponible; captura manual pendiente.

### Figura 4. Almacenamiento seguro de contraseñas

**Fuente:** `backend\services\users-service\src\index.js` (hash en alta/cambio, líneas cercanas a 2164/2772; comparación cerca de 2954) y `prisma\schema.prisma` (`credenciales.hash_contrasena`).  
**Captura:** presentar las llamadas `bcrypt.hash(..., 12)`, `bcrypt.compare(...)` y nombre de campo de schema, sin filas de base de datos.  
**Debe ocultar:** hashes de cuentas reales, contraseñas y datos personales.  
**Estado:** implementación disponible; captura manual pendiente.

### Figura 5. Validación del token de acceso

**Fuente:** `backend\services\users-service\src\index.js`, `authenticateToken` (aprox. línea 521).  
**Captura:** mostrar Bearer, `jwt.verify`, lista `algorithms: ['HS256']`, `sub` validado y respuesta de token inválido.  
**Debe ocultar:** secretos JWT y tokens.  
**Estado:** implementación disponible; captura manual pendiente.

### Figura 6. Autorización dinámica de usuarios

**Fuente:** `backend\services\users-service\src\index.js`, `obtenerContextoAutorizacion` y `authorizePermission` (aprox. líneas 457 y 599), además de `src\permisos.js`.  
**Captura:** mostrar lectura de estado/roles/permisos desde Prisma y rechazo del permiso requerido.  
**Debe ocultar:** información de usuarios reales y SQL/valores sensibles.  
**Estado:** implementación y tests unitarios disponibles; captura manual pendiente.

### Figura 7. Validación interna de permisos

**Fuente:** `backend\services\users-service\src\index.js`, `POST /internal/auth/validate` (aprox. línea 3359).  
**Captura:** mostrar la comprobación de clave, JWT y permiso consultado dinámicamente.  
**Debe ocultar:** valor de `INTERNAL_SERVICE_SECRET`, JWT y respuestas con identidad real.  
**Estado:** código disponible; captura manual pendiente.

### Figura 8. Configuración de rate limiting

**Fuente:** `backend\services\users-service\src\index.js` (definiciones aproximadas en líneas 46–66) y `src\rate-limit.js`.  
**Captura:** mostrar los tres perfiles de límite y el key generator; se puede complementar con los tres casos de `test\rate-limit.test.js`.  
**Debe mostrar:** límites y ventana; no necesita mostrar el valor de la clave interna.  
**Debe ocultar:** secreto compartido e IP real.  
**Estado:** tests relacionados ejecutados; captura manual pendiente.

### Figura 9. Validación de permisos en el API Gateway

**Fuente:** `backend\gateway\src\app.controller.ts`, `requireAnalysisPermission` y `requireReportPermission` (aprox. líneas 1311 y 1374).  
**Captura:** mostrar llamada al endpoint interno, permiso y roles requeridos, y manejo de 401/403.  
**Debe ocultar:** secreto interno, bearer token, dirección de producción y PII.  
**Estado:** código y tests con fetch simulado disponibles; captura manual pendiente.

### Figura 10. Prueba de autenticación correcta

**Fuente necesaria:** ejecución funcional contra entorno de integración aislado con usuario sintético.  
**Comando/procedimiento:** Postman collection o cliente HTTP dirigido al gateway de integración; ocultar el contenido de `access_token` y `refresh_token` antes de guardar la imagen.  
**Debe mostrar:** endpoint de login, respuesta 200 y confirmación de campos de usuario no sensibles, sin tokens visibles.  
**Debe ocultar:** contraseña, correo personal, tokens, cookies y variables del entorno.  
**Estado:** no ejecutada; marcador obligatorio, no presentar como aprobada.

### Figura 11. Rechazo de acceso por falta de permisos

**Fuente necesaria:** prueba aislada con usuario sintético autenticado sin permiso requerido.  
**Comando/procedimiento:** llamar ruta protegida mediante Postman o test E2E y mostrar solo status 403 y mensaje general.  
**Debe ocultar:** bearer, secreto y datos de usuario.  
**Estado:** no ejecutada como flujo funcional; marcador pendiente.

### Figura 12. Acceso autorizado a una ruta protegida

**Fuente necesaria:** prueba aislada con usuario sintético que tenga el permiso mínimo requerido.  
**Comando/procedimiento:** solicitar ruta protegida y mostrar status 200 más respuesta anonimizada.  
**Debe ocultar:** bearer y datos comerciales/personales.  
**Estado:** no ejecutada como flujo funcional; tests de gateway son mocks, no sustituyen esta figura.

### Figura 13. Pruebas automatizadas de seguridad

**Fuente:** terminal local y salidas reales de las cuatro suites registradas en el informe.  
**Comandos ejecutados:** `pnpm --dir backend/services/users-service test`; `pnpm --dir backend/services/products-service test`; `pnpm --dir backend/services/logic-correlation-service test`; `pnpm --dir backend/gateway test --runInBand`.  
**Captura:** terminal mostrando comando, suite y conteo final; puede prepararse una imagen por suite o un collage sin recortar el resultado.  
**Debe ocultar:** rutas personales del perfil del sistema operativo y variables de entorno.  
**Estado:** resultados observados 16/16, 3/3, 32/32 y 13/13; captura todavía manual. No cambiar el texto de salida ni combinar pruebas no ejecutadas.

### Figura 14. Contrato de eventos del sistema

**Fuente:** `backend\contracts\system-event.schema.json` y `backend\contracts\system-event.js`.  
**Captura:** mostrar campos requeridos, enum de servicios/eventos, `additionalProperties: false` y sanitización de metadata por clave.  
**Debe ocultar:** ningún dato operativo real; utilizar solo el esquema.  
**Estado:** código y tests disponibles; captura manual pendiente.

### Figura 15. Protección de secretos y configuración

**Fuente:** `.env.example`, `.gitignore`, referencias a variables en `docker-compose.yml`; no abrir `.env` ni archivos `.env` específicos de servicios.  
**Captura:** mostrar únicamente nombres de variables requeridas y la regla de exclusión del archivo; verificar que no aparezcan valores después del signo igual.  
**Debe ocultar:** todos los valores, nombres de cuentas, tokens, contraseñas, URLs con credenciales y rutas personales.  
**Estado:** `.env` está ignorado por Git y `.env.example` enumera variables; no se verificó ni se debe divulgar su contenido.

### Figura 16. Contenedores y arquitectura de servicios

**Fuente:** `docker-compose.yml`; opcionalmente ejecutar `docker compose ps` solo si el usuario ya tiene un entorno activo y autoriza una captura de solo lectura.  
**Comando no mutante:** `docker compose ps`. No ejecutar `up`, `down`, `build`, `restart` ni comandos de migración.  
**Debe mostrar:** nombres/estado de servicios y puertos publicados, si el stack ya está levantado. Alternativamente capturar los bloques de servicios/puertos del YAML.  
**Debe ocultar:** valores de variables, cadenas de conexión, passwords y secretos.  
**Estado:** configuración disponible; no se consultó estado de contenedores porque esta auditoría no los inició.

## Marcadores listos para insertar

Los siguientes marcadores deben conservarse hasta que se obtengan capturas reales:

> [INSERTAR FIGURA 1. ARQUITECTURA GENERAL DE SEGURIDAD DE SPOSABELLA. CAPTURA NECESARIA: diagrama Mermaid renderizado con los componentes y fronteras descritos. UBICACIÓN: diagramas_seguridad.md y documentación architecture.md. ELEMENTOS QUE DEBEN SER VISIBLES: frontend, gateway, servicios, bases, red común y llamadas autenticadas/no autenticadas. ELEMENTOS QUE DEBEN OCULTARSE: secretos, credenciales, tokens y datos personales.]

> [INSERTAR FIGURA 2. FLUJO DE AUTENTICACIÓN MEDIANTE JWT. CAPTURA NECESARIA: secuencia Mermaid renderizada desde login hasta autorización dinámica. UBICACIÓN: diagramas_seguridad.md. ELEMENTOS QUE DEBEN SER VISIBLES: bcrypt, roles/permisos actuales, access JWT, refresh hashado y validación en backend. ELEMENTOS QUE DEBEN OCULTARSE: tokens reales, secretos y credenciales.]

> [INSERTAR FIGURA 3. IMPLEMENTACIÓN DEL PROCESO DE LOGIN. CAPTURA NECESARIA: fragmento de login del users-service. UBICACIÓN: backend/services/users-service/src/index.js, alrededor de la ruta /auth/login. ELEMENTOS QUE DEBEN SER VISIBLES: validación, bcrypt.compare y emisión condicional. ELEMENTOS QUE DEBEN OCULTARSE: contraseñas, hashes de usuarios, correos reales y secretos.]

> [INSERTAR FIGURA 4. ALMACENAMIENTO SEGURO DE CONTRASEÑAS. CAPTURA NECESARIA: hash bcrypt y comparación más nombre del campo de esquema. UBICACIÓN: users-service/src/index.js y users-service/prisma/schema.prisma. ELEMENTOS QUE DEBEN SER VISIBLES: bcrypt.hash con costo 12, bcrypt.compare y hash_contrasena. ELEMENTOS QUE DEBEN OCULTARSE: hashes reales y contraseñas.]

> [INSERTAR FIGURA 5. VALIDACIÓN DEL TOKEN DE ACCESO. CAPTURA NECESARIA: middleware authenticateToken. UBICACIÓN: users-service/src/index.js. ELEMENTOS QUE DEBEN SER VISIBLES: algoritmo permitido, verificación, validación de sub y errores 401. ELEMENTOS QUE DEBEN OCULTARSE: JWT y secreto de firma.]

> [INSERTAR FIGURA 6. AUTORIZACIÓN DINÁMICA DE USUARIOS. CAPTURA NECESARIA: lectura de roles/permisos actuales y guard de permiso. UBICACIÓN: users-service/src/index.js y src/permisos.js. ELEMENTOS QUE DEBEN SER VISIBLES: estado de usuario/rol y decisión por permiso. ELEMENTOS QUE DEBEN OCULTARSE: usuarios y permisos operativos reales.]

> [INSERTAR FIGURA 7. VALIDACIÓN INTERNA DE PERMISOS. CAPTURA NECESARIA: endpoint /internal/auth/validate. UBICACIÓN: users-service/src/index.js. ELEMENTOS QUE DEBEN SER VISIBLES: validación de clave, JWT, rol y permiso. ELEMENTOS QUE DEBEN OCULTARSE: valores de clave y token.]

> [INSERTAR FIGURA 8. CONFIGURACIÓN DE RATE LIMITING. CAPTURA NECESARIA: límites por ventana y clave de IP. UBICACIÓN: users-service/src/index.js y src/rate-limit.js. ELEMENTOS QUE DEBEN SER VISIBLES: login 10/15 min, auth 20/15 min, recovery 5/15 min. ELEMENTOS QUE DEBEN OCULTARSE: secreto compartido e IP reales.]

> [INSERTAR FIGURA 9. VALIDACIÓN DE PERMISOS EN EL API GATEWAY. CAPTURA NECESARIA: requireAnalysisPermission o requireReportPermission. UBICACIÓN: backend/gateway/src/app.controller.ts. ELEMENTOS QUE DEBEN SER VISIBLES: llamada interna, permiso requerido y respuesta 401/403. ELEMENTOS QUE DEBEN OCULTARSE: secretos, JWT y PII.]

> [INSERTAR FIGURA 10. PRUEBA DE AUTENTICACIÓN CORRECTA. CAPTURA NECESARIA: resultado HTTP 200 de usuario sintético en integración. UBICACIÓN: entorno de integración aislado/Postman. ELEMENTOS QUE DEBEN SER VISIBLES: endpoint y status 200. ELEMENTOS QUE DEBEN OCULTARSE: credenciales, tokens, cookies y datos personales.]

> [INSERTAR FIGURA 11. RECHAZO DE ACCESO POR FALTA DE PERMISOS. CAPTURA NECESARIA: respuesta HTTP 403 para usuario sintético. UBICACIÓN: prueba aislada de ruta protegida. ELEMENTOS QUE DEBEN SER VISIBLES: solicitud anonimizada y status 403. ELEMENTOS QUE DEBEN OCULTARSE: bearer, clave interna y PII.]

> [INSERTAR FIGURA 12. ACCESO AUTORIZADO A UNA RUTA PROTEGIDA. CAPTURA NECESARIA: respuesta HTTP 200 para usuario sintético con permiso. UBICACIÓN: prueba aislada de ruta protegida. ELEMENTOS QUE DEBEN SER VISIBLES: endpoint y status 200 con respuesta anonimizada. ELEMENTOS QUE DEBEN OCULTARSE: token, credenciales y datos comerciales.]

> [INSERTAR FIGURA 13. PRUEBAS AUTOMATIZADAS DE SEGURIDAD. CAPTURA NECESARIA: salidas reales de las cuatro suites registradas. UBICACIÓN: terminal en la raíz del repositorio, comandos del apartado 8. ELEMENTOS QUE DEBEN SER VISIBLES: comando, nombre de suite y conteo aprobado. ELEMENTOS QUE DEBEN OCULTARSE: variables de entorno y rutas personales.]

> [INSERTAR FIGURA 14. CONTRATO DE EVENTOS DEL SISTEMA. CAPTURA NECESARIA: campos requeridos, enumeraciones y reglas de metadata. UBICACIÓN: backend/contracts/system-event.schema.json y system-event.js. ELEMENTOS QUE DEBEN SER VISIBLES: event_id, service, tipo_evento, timestamp y validación de campos. ELEMENTOS QUE DEBEN OCULTARSE: eventos reales y PII.]

> [INSERTAR FIGURA 15. PROTECCIÓN DE SECRETOS Y CONFIGURACIÓN. CAPTURA NECESARIA: nombres de variables de .env.example y regla de exclusión de .env, sin valores. UBICACIÓN: .env.example y .gitignore. ELEMENTOS QUE DEBEN SER VISIBLES: nombres de variables y exclusión. ELEMENTOS QUE DEBEN OCULTARSE: todo valor, secreto, contraseña, token o URL con credenciales.]

> [INSERTAR FIGURA 16. CONTENEDORES Y ARQUITECTURA DE SERVICIOS. CAPTURA NECESARIA: YAML de servicios/puertos o salida de docker compose ps si el stack ya está activo. UBICACIÓN: docker-compose.yml; comando no mutante: docker compose ps. ELEMENTOS QUE DEBEN SER VISIBLES: servicios y puertos de desarrollo. ELEMENTOS QUE DEBEN OCULTARSE: variables con valores, credenciales y secretos.]
