# Boutique System

Arquitectura orientada a microservicios para una boutique digital.

## Estructura

```text
boutique-system/
├── frontend/
│   └── web/
├── backend/
│   ├── gateway/
│   └── services/
│       ├── auth-service/
│       ├── users-service/
│       ├── products-service/
│       ├── inventory-service/
│       ├── sales-service/
│       └── notifications-service/
├── databases/
│   ├── auth/
│   ├── users/
│   ├── products/
│   ├── inventory/
│   ├── sales/
│   └── notifications/
├── infrastructure/
│   ├── docker/
│   └── nginx/
├── docs/
├── scripts/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## Servicios incluidos

- Frontend web
- API Gateway
- Auth service
- Users service
- Products service
- Inventory service
- Sales service
- Notifications service

## Requisitos

- Docker
- Docker Compose
- Node.js 22+
- pnpm

## Comandos rápidos

```bash
cp .env.example .env
pnpm install
pnpm docker:up
```

La aplicación queda disponible en:

- Frontend: http://localhost:8080
- Gateway: http://localhost:3000
- PgAdmin / phpMyAdmin no está incluido; se recomienda mantener una herramienta externa para revisar bases de datos.

## Convención

Cada microservicio tiene su propia base de datos PostgreSQL y se conecta a través del gateway. La infraestructura se administra con Docker Compose.
