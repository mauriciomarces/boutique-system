# Boutique System

Sistema web orientado a la gestión de una boutique mediante una arquitectura de microservicios.

## Arquitectura

El sistema utiliza una arquitectura basada en microservicios, donde cada servicio mantiene una responsabilidad funcional específica y, cuando corresponde, su propia base de datos.

La comunicación entre el frontend y los servicios backend se realiza mediante un API Gateway.

## Estructura del proyecto

```text
boutique-system/
├── frontend/
│   └── web/
├── backend/
│   ├── gateway/
│   └── services/
│       ├── users-service/
│       ├── products-service/
│       ├── inventory-service/
│       ├── sales-service/
│       ├── notifications-service/
│       ├── ai-service/
│       └── logic-correlation-service/
├── infrastructure/
│   ├── database/
│   ├── docker/
│   └── nginx/
├── docs/
├── scripts/
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## Servicios

### Frontend

Aplicación web utilizada por los usuarios del sistema para acceder a las funcionalidades de la boutique.

### API Gateway

Punto de entrada para las solicitudes provenientes del frontend. Se encarga de dirigir las solicitudes hacia el microservicio correspondiente.

### Users Service

Gestiona la información de los usuarios, empleados, cargos, roles y permisos.

También gestiona los procesos relacionados con la autenticación y autorización, incluyendo credenciales, tokens de acceso, tokens de actualización y recuperación de cuentas.

La información se almacena en la base de datos `boutique_users`.

### Products Service

Gestiona la información correspondiente a los productos de la boutique.

Utiliza la base de datos `boutique_products`.

### Inventory Service

Gestiona las operaciones relacionadas con el inventario y existencias de productos.

Utiliza la base de datos `boutique_inventory`.

### Sales Service

Gestiona las operaciones relacionadas con las ventas.

Utiliza la base de datos `boutique_sales`.

### Notifications Service

Gestiona las notificaciones generadas por el sistema, incluyendo aquellas relacionadas con eventos relevantes para los usuarios.

Utiliza la base de datos `boutique_notifications`.

### Logic Correlation Service

Servicio destinado al procesamiento y correlación lógica de eventos generados por las operaciones del sistema.

Su función será identificar relaciones entre diferentes eventos para generar información que pueda ser utilizada posteriormente por el componente de análisis.

Actualmente se encuentra en etapa de implementación.

### AI Service

Servicio destinado al procesamiento del modelo de aprendizaje automático utilizado para el análisis y clasificación de eventos.

Será responsable de integrar el modelo basado en el algoritmo de Árbol de Decisión dentro de la arquitectura del sistema.

Actualmente se encuentra en etapa de implementación.

## Bases de datos

Los microservicios funcionales utilizan bases de datos independientes:

```text
users-service          → boutique_users
products-service       → boutique_products
inventory-service      → boutique_inventory
sales-service           → boutique_sales
notifications-service  → boutique_notifications
```

La separación permite que cada servicio gestione únicamente los datos correspondientes a su responsabilidad.

Los servicios `ai-service` y `logic-correlation-service` se encuentran todavía en desarrollo, por lo que su persistencia y configuración definitiva se establecerán durante su implementación.

## Infraestructura

La infraestructura se administra mediante Docker Compose.

Los principales componentes son:

* Nginx
* Frontend web
* API Gateway
* Microservicios backend
* Instancias independientes de MySQL
* phpMyAdmin para administración de bases de datos

Todos los componentes se comunican mediante la red Docker `boutique-network`.

## Requisitos

* Docker
* Docker Compose
* Node.js 22+
* pnpm

## Instalación

Clonar el repositorio y acceder al directorio del proyecto:

```bash
git clone <URL_DEL_REPOSITORIO>
cd boutique-system
```

Instalar las dependencias:

```bash
pnpm install
```

Crear el archivo de variables de entorno a partir de `.env.example`:

```bash
cp .env.example .env
```

En Windows, si `cp` no está disponible, puede utilizarse:

```powershell
Copy-Item .env.example .env
```

## Ejecución con Docker

Para construir y ejecutar los servicios:

```bash
docker compose up -d --build
```

Para consultar el estado de los contenedores:

```bash
docker compose ps
```

Para detener los servicios:

```bash
docker compose down
```

## Puertos principales

| Componente            | Puerto |
| --------------------- | -----: |
| Nginx                 |   8080 |
| API Gateway           |   3000 |
| Users Service         |   4002 |
| Products Service      |   4003 |
| Inventory Service     |   4004 |
| Sales Service         |   4005 |
| Notifications Service |   4006 |
| MySQL Users           |   3308 |
| MySQL Products        |   3309 |
| MySQL Inventory       |   3310 |
| MySQL Sales           |   3311 |
| MySQL Notifications   |   3312 |
| MySQL AI              |   3313 |
| phpMyAdmin            |   8081 |

La aplicación web puede accederse mediante:

```text
http://localhost:8080
```

El API Gateway se encuentra disponible en:

```text
http://localhost:3000
```

phpMyAdmin se encuentra disponible en:

```text
http://localhost:8081
```

## Convenciones

Cada microservicio backend mantiene una responsabilidad funcional independiente.

Los servicios no deben acceder directamente a las bases de datos pertenecientes a otros microservicios. La comunicación entre componentes se realiza mediante las interfaces expuestas por los servicios correspondientes.

La autenticación se encuentra integrada en `users-service` y no constituye un microservicio independiente.

La infraestructura de desarrollo y ejecución se administra mediante Docker Compose.
