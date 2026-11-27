-- Migración aditiva: conserva apellido y copia su contenido completo sin dividirlo.
ALTER TABLE usuarios
  ADD COLUMN apellido_paterno VARCHAR(100) NULL,
  ADD COLUMN apellido_materno VARCHAR(100) NULL;

UPDATE usuarios
SET apellido_paterno = apellido
WHERE apellido_paterno IS NULL;

ALTER TABLE usuarios
  MODIFY COLUMN apellido_paterno VARCHAR(100) NOT NULL;
