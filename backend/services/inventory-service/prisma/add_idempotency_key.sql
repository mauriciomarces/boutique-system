-- Preparación de migración.
-- Revisar el esquema real y respaldar la base de datos antes de ejecutar.
ALTER TABLE movimientos_inventario
  ADD COLUMN idempotency_key VARCHAR(191) NULL,
  ADD UNIQUE KEY uq_movimientos_idempotency_key (idempotency_key);