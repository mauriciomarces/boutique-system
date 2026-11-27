-- CreateTable
CREATE TABLE `cargos` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',

    UNIQUE INDEX `nombre`(`nombre` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credenciales` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `usuario_id` BIGINT NOT NULL,
    `hash_contrasena` VARCHAR(255) NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    `creado_en` DATETIME(0) NOT NULL,
    `actualizado_en` DATETIME(0) NOT NULL,

    UNIQUE INDEX `usuario_id`(`usuario_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empleados` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `usuario_id` BIGINT NOT NULL,
    `cargo_id` BIGINT NOT NULL,
    `creado_en` DATETIME(0) NOT NULL,
    `actualizado_en` DATETIME(0) NOT NULL,

    INDEX `cargo_id`(`cargo_id` ASC),
    UNIQUE INDEX `usuario_id`(`usuario_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permisos` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `descripcion` VARCHAR(255) NULL,

    UNIQUE INDEX `nombre`(`nombre` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rol_permiso` (
    `rol_id` BIGINT NOT NULL,
    `permiso_id` BIGINT NOT NULL,

    INDEX `permiso_id`(`permiso_id` ASC),
    PRIMARY KEY (`rol_id` ASC, `permiso_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',

    UNIQUE INDEX `nombre`(`nombre` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tokens_recuperacion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `usuario_id` BIGINT NOT NULL,
    `hash_token` VARCHAR(255) NOT NULL,
    `expira_en` DATETIME(0) NOT NULL,
    `utilizado_en` DATETIME(0) NULL,
    `creado_en` DATETIME(0) NOT NULL,

    UNIQUE INDEX `hash_token`(`hash_token` ASC),
    INDEX `usuario_id`(`usuario_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tokens_refresh` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `usuario_id` BIGINT NOT NULL,
    `hash_token` VARCHAR(255) NOT NULL,
    `expira_en` DATETIME(0) NOT NULL,
    `revocado_en` DATETIME(0) NULL,
    `creado_en` DATETIME(0) NOT NULL,

    UNIQUE INDEX `hash_token`(`hash_token` ASC),
    INDEX `usuario_id`(`usuario_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tokens_verificacion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `usuario_id` BIGINT NOT NULL,
    `hash_codigo` VARCHAR(255) NOT NULL,
    `expira_en` DATETIME(0) NOT NULL,
    `utilizado_en` DATETIME(0) NULL,
    `intentos` INTEGER NOT NULL DEFAULT 0,
    `creado_en` DATETIME(0) NOT NULL,

    UNIQUE INDEX `hash_codigo`(`hash_codigo` ASC),
    INDEX `usuario_id`(`usuario_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario_rol` (
    `usuario_id` BIGINT NOT NULL,
    `rol_id` BIGINT NOT NULL,

    INDEX `rol_id`(`rol_id` ASC),
    PRIMARY KEY (`usuario_id` ASC, `rol_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `apellido` VARCHAR(100) NOT NULL,
    `correo` VARCHAR(150) NOT NULL,
    `telefono` VARCHAR(30) NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    `creado_en` DATETIME(0) NOT NULL,
    `actualizado_en` DATETIME(0) NOT NULL,
    `correo_verificado` BOOLEAN NOT NULL DEFAULT false,
    `verificado_en` DATETIME(0) NULL,

    UNIQUE INDEX `correo`(`correo` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `credenciales` ADD CONSTRAINT `credenciales_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `empleados` ADD CONSTRAINT `empleados_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `empleados` ADD CONSTRAINT `empleados_ibfk_2` FOREIGN KEY (`cargo_id`) REFERENCES `cargos`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `rol_permiso` ADD CONSTRAINT `rol_permiso_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `rol_permiso` ADD CONSTRAINT `rol_permiso_ibfk_2` FOREIGN KEY (`permiso_id`) REFERENCES `permisos`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `tokens_recuperacion` ADD CONSTRAINT `tokens_recuperacion_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `tokens_refresh` ADD CONSTRAINT `tokens_refresh_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `tokens_verificacion` ADD CONSTRAINT `tokens_verificacion_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `usuario_rol` ADD CONSTRAINT `usuario_rol_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `usuario_rol` ADD CONSTRAINT `usuario_rol_ibfk_2` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
