# Users service

## Preparar cuentas demostrativas por rol

El comando `pnpm --filter users-service seed:role-test-users` verifica los roles
existentes y activos y las cuentas asociadas. Las cuentas faltantes se crean en
una única transacción; las cuentas existentes nunca cambian de contraseña ni de
asignaciones. Una cuenta existente que no coincide exactamente con su rol
esperado detiene el proceso sin modificarla.

Identificadores predeterminados (con datos personales ficticios y correos no enrutables):

- `cuenta.admin@sposabella.invalid` — ADMIN
- `cuenta.supervisor@sposabella.invalid` — SUPERVISOR
- `cuenta.vendedor@sposabella.invalid` — VENDEDOR
- `cuenta.inventario@sposabella.invalid` — INVENTARIO
- `cuenta.consulta@sposabella.invalid` — CONSULTA

Los correos personalizados deben conservar el dominio no enrutable
`@sposabella.invalid`. El script no se ejecuta en producción. Solo para cuentas
que no existan todavía, define `ROLE_TEST_<ROL>_PASSWORD` como variable de
entorno con una contraseña aleatoria de al menos 20 caracteres, mayúsculas,
minúsculas, dígitos, símbolos y al menos 12 caracteres distintos. No guardes estas
variables en archivos versionados ni compartas su valor; el comando no imprime
contraseñas ni tokens. La conexión requiere `DB_HOST`, `DB_USER`, `DB_PASSWORD`
y `DB_NAME`.
