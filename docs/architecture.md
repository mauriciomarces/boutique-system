# Boutique System Architecture

Este repositorio fue reorganizado siguiendo una arquitectura de microservicios, con separación de frontend y backend, servicios con bases de datos independientes, infraestructura Docker y un gateway central.

## Componentes principales

- Frontend web en `frontend/web`
- Gateway en `backend/gateway`
- Servicios en `backend/services/*`
- Bases de datos en `databases/*`
- Configuración Docker e infraestructura en `infrastructure/`

## Convención

Cada microservicio debe mantener su propia base de datos, su entorno y su contrato de API, y se comunica a través del gateway o por eventos.
