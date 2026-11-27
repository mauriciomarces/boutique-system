-- CreateTable
CREATE TABLE `clientes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `apellido` VARCHAR(100) NOT NULL,
    `telefono` VARCHAR(30) NULL,
    `correo` VARCHAR(150) NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    `creado_en` DATETIME(0) NOT NULL,
    `actualizado_en` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detalle_ventas` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `venta_id` BIGINT NOT NULL,
    `variante_producto_id` BIGINT NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `precio_unitario` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,

    INDEX `venta_id`(`venta_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eventos_anulacion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `operacion_id` BIGINT NOT NULL,
    `tarea_id` BIGINT NULL,
    `tipo_evento` VARCHAR(50) NOT NULL,
    `estado_anterior` VARCHAR(24) NULL,
    `estado_nuevo` VARCHAR(24) NULL,
    `actor_id` BIGINT NULL,
    `mensaje` TEXT NULL,
    `metadata` JSON NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_eventos_anulacion_operacion_fecha`(`operacion_id` ASC, `creado_en` ASC),
    INDEX `idx_eventos_anulacion_tarea_fecha`(`tarea_id` ASC, `creado_en` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operaciones_anulacion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `venta_id` BIGINT NOT NULL,
    `estado` VARCHAR(24) NOT NULL DEFAULT 'PENDIENTE',
    `solicitada_por_id` BIGINT NULL,
    `motivo` VARCHAR(500) NULL,
    `intentos` INTEGER NOT NULL DEFAULT 0,
    `ultimo_error` TEXT NULL,
    `lease_token` VARCHAR(64) NULL,
    `lease_hasta` DATETIME(0) NULL,
    `creada_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `iniciada_en` DATETIME(0) NULL,
    `completada_en` DATETIME(0) NULL,
    `actualizada_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_operaciones_anulacion_recuperacion`(`estado` ASC, `lease_hasta` ASC),
    UNIQUE INDEX `uq_operaciones_anulacion_venta`(`venta_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagos` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `venta_id` BIGINT NOT NULL,
    `metodo_pago` VARCHAR(50) NOT NULL,
    `monto` DECIMAL(12, 2) NOT NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    `fecha_pago` DATETIME(0) NULL,
    `creado_en` DATETIME(0) NOT NULL,
    `actualizado_en` DATETIME(0) NOT NULL,

    INDEX `venta_id`(`venta_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tareas_anulacion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `operacion_id` BIGINT NOT NULL,
    `detalle_venta_id` BIGINT NOT NULL,
    `variante_producto_id` BIGINT NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `estado` VARCHAR(24) NOT NULL DEFAULT 'PENDIENTE',
    `idempotency_key` VARCHAR(191) NOT NULL,
    `movimiento_inventario_id` BIGINT NULL,
    `intentos` INTEGER NOT NULL DEFAULT 0,
    `ultimo_error` TEXT NULL,
    `iniciada_en` DATETIME(0) NULL,
    `completada_en` DATETIME(0) NULL,
    `creada_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizada_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_tarea_anulacion_detalle`(`detalle_venta_id` ASC),
    INDEX `idx_tareas_anulacion_estado`(`operacion_id` ASC, `estado` ASC),
    UNIQUE INDEX `uq_tarea_anulacion_detalle`(`operacion_id` ASC, `detalle_venta_id` ASC),
    UNIQUE INDEX `uq_tarea_anulacion_idempotencia`(`idempotency_key` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ventas` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `cliente_id` BIGINT NULL,
    `fecha_venta` DATETIME(0) NOT NULL,
    `estado` VARCHAR(30) NOT NULL DEFAULT 'CONFIRMADA',
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `creado_en` DATETIME(0) NOT NULL,
    `actualizado_en` DATETIME(0) NOT NULL,

    INDEX `cliente_id`(`cliente_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `detalle_ventas` ADD CONSTRAINT `detalle_ventas_ibfk_1` FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `eventos_anulacion` ADD CONSTRAINT `fk_eventos_anulacion_operacion` FOREIGN KEY (`operacion_id`) REFERENCES `operaciones_anulacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `eventos_anulacion` ADD CONSTRAINT `fk_eventos_anulacion_tarea` FOREIGN KEY (`tarea_id`) REFERENCES `tareas_anulacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `operaciones_anulacion` ADD CONSTRAINT `fk_operaciones_anulacion_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_ibfk_1` FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `tareas_anulacion` ADD CONSTRAINT `fk_tarea_anulacion_detalle` FOREIGN KEY (`detalle_venta_id`) REFERENCES `detalle_ventas`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tareas_anulacion` ADD CONSTRAINT `fk_tarea_anulacion_operacion` FOREIGN KEY (`operacion_id`) REFERENCES `operaciones_anulacion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ventas` ADD CONSTRAINT `ventas_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
