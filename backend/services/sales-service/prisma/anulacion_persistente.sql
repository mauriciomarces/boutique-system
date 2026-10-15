
-- Boutique SposaBella
-- Operacion persistente de anulacion de ventas
-- Ejecutar solo en una base de prueba cuya identidad se haya verificado.
-- No ejecutar en boutique_sales ni en ninguna base del entorno principal.
-- actualizada_en se mantiene bajo gestion de Prisma (@updatedAt), sin ON UPDATE.

CREATE TABLE operaciones_anulacion (
    id BIGINT NOT NULL AUTO_INCREMENT,
    venta_id BIGINT NOT NULL,
    estado VARCHAR(24) NOT NULL DEFAULT 'PENDIENTE',
    solicitada_por_id BIGINT NULL,
    motivo VARCHAR(500) NULL,
    intentos INT NOT NULL DEFAULT 0,
    ultimo_error TEXT NULL,
    lease_token VARCHAR(64) NULL,
    lease_hasta DATETIME(0) NULL,
    creada_en DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    iniciada_en DATETIME(0) NULL,
    completada_en DATETIME(0) NULL,
    actualizada_en DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_operaciones_anulacion
        PRIMARY KEY (id),

    CONSTRAINT uq_operaciones_anulacion_venta
        UNIQUE (venta_id),

    CONSTRAINT fk_operaciones_anulacion_venta
        FOREIGN KEY (venta_id)
        REFERENCES ventas (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_operaciones_anulacion_recuperacion
        (estado, lease_hasta)
) ENGINE=InnoDB;


CREATE TABLE tareas_anulacion (
    id BIGINT NOT NULL AUTO_INCREMENT,
    operacion_id BIGINT NOT NULL,
    detalle_venta_id BIGINT NOT NULL,
    variante_producto_id BIGINT NOT NULL,
    cantidad INT NOT NULL,
    estado VARCHAR(24) NOT NULL DEFAULT 'PENDIENTE',
    idempotency_key VARCHAR(191) NOT NULL,
    movimiento_inventario_id BIGINT NULL,
    intentos INT NOT NULL DEFAULT 0,
    ultimo_error TEXT NULL,
    iniciada_en DATETIME(0) NULL,
    completada_en DATETIME(0) NULL,
    creada_en DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizada_en DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_tareas_anulacion
        PRIMARY KEY (id),

    CONSTRAINT uq_tarea_anulacion_idempotencia
        UNIQUE (idempotency_key),

    CONSTRAINT uq_tarea_anulacion_detalle
        UNIQUE (operacion_id, detalle_venta_id),

    CONSTRAINT fk_tarea_anulacion_operacion
        FOREIGN KEY (operacion_id)
        REFERENCES operaciones_anulacion (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_tarea_anulacion_detalle
        FOREIGN KEY (detalle_venta_id)
        REFERENCES detalle_ventas (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_tareas_anulacion_estado
        (operacion_id, estado)
) ENGINE=InnoDB;


CREATE TABLE eventos_anulacion (
    id BIGINT NOT NULL AUTO_INCREMENT,
    operacion_id BIGINT NOT NULL,
    tarea_id BIGINT NULL,
    tipo_evento VARCHAR(50) NOT NULL,
    estado_anterior VARCHAR(24) NULL,
    estado_nuevo VARCHAR(24) NULL,
    actor_id BIGINT NULL,
    mensaje TEXT NULL,
    metadata JSON NULL,
    creado_en DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_eventos_anulacion
        PRIMARY KEY (id),

    CONSTRAINT fk_eventos_anulacion_operacion
        FOREIGN KEY (operacion_id)
        REFERENCES operaciones_anulacion (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_eventos_anulacion_tarea
        FOREIGN KEY (tarea_id)
        REFERENCES tareas_anulacion (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    INDEX idx_eventos_anulacion_operacion_fecha
        (operacion_id, creado_en),

    INDEX idx_eventos_anulacion_tarea_fecha
        (tarea_id, creado_en)
) ENGINE=InnoDB;
