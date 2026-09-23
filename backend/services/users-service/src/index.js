require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const app = express();
app.disable('x-powered-by');

app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ||
  'http://localhost:8080,http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origen no permitido ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const recoveryRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const port = Number(process.env.PORT || 4002);
const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || 'mysql-users',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'boutique',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_NAME || 'boutique_users',
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  acquireTimeout: Number(process.env.DB_ACQUIRE_TIMEOUT || 30000),
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 30000),
  idleTimeout: Number(process.env.DB_IDLE_TIMEOUT || 300),
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET;

if (!ACCESS_SECRET) {
  throw new Error(
    'JWT_ACCESS_SECRET no está definido en las variables de entorno'
  );
}

const ACCESS_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN || '15m';

const REFRESH_EXPIRES_IN_DAYS =
  Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || 7);

const ROLES_ADMINISTRABLES = [
  'SUPERVISOR',
  'VENDEDOR',
  'INVENTARIO',
  'CONSULTA',
];

/**
 * Convierte BigInt a string para evitar errores
 * al serializar respuestas JSON.
 */
function serializeBigInt(value) {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) =>
      typeof currentValue === 'bigint'
        ? currentValue.toString()
        : currentValue
    )
  );
}

function buildUserPayload(usuario) {
  const roles = (usuario.usuario_rol || [])
    .filter(({ roles }) => roles?.estado === 'ACTIVO')
    .map(({ roles }) => ({
      id: roles.id,
      nombre: roles.nombre,
      descripcion: roles.descripcion,
      estado: roles.estado,
    }));

  return serializeBigInt({
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    telefono: usuario.telefono,
    estado: usuario.estado,
    correo_verificado: usuario.correo_verificado ?? false,
    verificado_en: usuario.verificado_en ?? null,
    roles,
    usuario_rol: roles,
  });
}

async function ensureRoleSeed() {
  const permisosBase = [
    'USUARIOS_LEER',
    'USUARIOS_CREAR',
    'USUARIOS_EDITAR',
    'USUARIOS_CAMBIAR_ESTADO',
    'ROLES_LEER',
    'ROLES_CREAR',
    'ROLES_EDITAR',
    'ROLES_ASIGNAR_PERMISOS',
    'PERMISOS_LEER',
    'PRODUCTOS_LEER',
    'PRODUCTOS_CREAR',
    'PRODUCTOS_EDITAR',
    'PRODUCTOS_ELIMINAR',
    'INVENTARIO_LEER',
    'INVENTARIO_EDITAR',
    'VENTAS_LEER',
    'VENTAS_CREAR',
    'VENTAS_EDITAR',
    'NOTIFICACIONES_LEER',
  ];

  const permisos = await Promise.all(
    permisosBase.map(async (nombre) => {
      return prisma.permisos.upsert({
        where: { nombre },
        update: {},
        create: {
          nombre,
          descripcion: `Permiso ${nombre}`,
        },
      });
    }),
  );

  const adminRole = await prisma.roles.upsert({
    where: { nombre: 'ADMIN' },
    update: {
      descripcion: 'Administrador del sistema',
      estado: 'ACTIVO',
    },
    create: {
      nombre: 'ADMIN',
      descripcion: 'Administrador del sistema',
      estado: 'ACTIVO',
    },
  });

  const permisosIds = new Set(permisos.map((permiso) => permiso.id.toString()));

  for (const permiso of permisos) {
    const existente = await prisma.rol_permiso.findUnique({
      where: {
        rol_id_permiso_id: {
          rol_id: adminRole.id,
          permiso_id: permiso.id,
        },
      },
    });

    if (!existente) {
      await prisma.rol_permiso.create({
        data: {
          rol_id: adminRole.id,
          permiso_id: permiso.id,
        },
      });
    }
  }

  return { adminRole, permisosIds };
}

async function ensureAdminUser(adminRole) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn(
      'ADMIN_EMAIL/ADMIN_PASSWORD no definidos; se omite el usuario administrador inicial'
    );
    return;
  }

  if (adminPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres');
  }

  const now = new Date();
  const hashContrasena = await bcrypt.hash(adminPassword, 12);
  const usuario = await prisma.usuarios.upsert({
    where: { correo: adminEmail },
    update: {
      nombre: process.env.ADMIN_NAME || 'Administrador',
      apellido: process.env.ADMIN_LAST_NAME || 'SposaBella',
      estado: 'ACTIVO',
      correo_verificado: true,
      verificado_en: now,
      credenciales: {
        upsert: {
          update: {
            hash_contrasena: hashContrasena,
            estado: 'ACTIVO',
            actualizado_en: now,
          },
          create: {
            hash_contrasena: hashContrasena,
            estado: 'ACTIVO',
            creado_en: now,
            actualizado_en: now,
          },
        },
      },
    },
    create: {
      nombre: process.env.ADMIN_NAME || 'Administrador',
      apellido: process.env.ADMIN_LAST_NAME || 'SposaBella',
      correo: adminEmail,
      estado: 'ACTIVO',
      correo_verificado: true,
      verificado_en: now,
      creado_en: now,
      actualizado_en: now,
      credenciales: {
        create: {
          hash_contrasena: hashContrasena,
          estado: 'ACTIVO',
          creado_en: now,
          actualizado_en: now,
        },
      },
    },
  });

  await prisma.usuario_rol.upsert({
    where: {
      usuario_id_rol_id: {
        usuario_id: usuario.id,
        rol_id: adminRole.id,
      },
    },
    update: {},
    create: {
      usuario_id: usuario.id,
      rol_id: adminRole.id,
    },
  });

  console.log(`Usuario administrador listo: ${adminEmail}`);
}

/**
 * Genera un hash SHA-256 para almacenar refresh tokens.
 * El token original nunca se guarda en la BD.
 */
function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Genera un refresh token aleatorio.
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Normaliza y valida un correo electrónico.
 */
function normalizeEmail(correo) {
  if (typeof correo !== 'string') {
    return null;
  }

  const email = correo.trim().toLowerCase();

  const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return null;
  }

  return email;
}

/**
 * Limpia campos de texto básicos.
 */
function normalizeText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();

  return text.length > 0 ? text : null;
}

function normalizePersonName(value, fieldName) {
  const text = normalizeText(value);

  if (!text || !/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:[ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/.test(text)) {
    throw new Error(`${fieldName} solo puede contener letras y espacios válidos`);
  }

  return text;
}

function normalizeAdminPhone(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const phone = String(value).trim();

  if (!/^\d{8,9}$/.test(phone)) {
    throw new Error('El teléfono debe contener entre 8 y 9 dígitos');
  }

  return phone;
}

/**
 * Genera un código numérico de 6 dígitos.
 */
function generateVerificationCode() {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
}

function generateActivationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Genera un hash SHA-256 para códigos y tokens temporales.
 */
function hashVerificationValue(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

/**
 * Valida una contraseña.
 */
function validatePassword(password) {
  if (typeof password !== 'string') {
    return 'La contraseña es obligatoria';
  }

  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }

  if (password.length > 128) {
    return 'La contraseña no puede superar los 128 caracteres';
  }

  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra mayúscula';
  }

  if (!/[a-z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra minúscula';
  }

  if (!/\d/.test(password)) {
    return 'La contraseña debe incluir al menos un número';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un carácter especial';
  }

  return null;
}

/**
 * Genera el JWT de acceso.
 */
function generateAccessToken(usuario, roles) {
  return jwt.sign(
    {
      sub: usuario.id.toString(),
      correo: usuario.correo,
      roles,
    },
    ACCESS_SECRET,
    {
      expiresIn: ACCESS_EXPIRES_IN,
    }
  );
}

/**
 * Middleware para autenticar JWT.
 */
async function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Token de acceso requerido',
    });
  }

  const token = authorization.substring(7);

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);

    const usuario = await prisma.usuarios.findUnique({
      where: { id: BigInt(payload.sub) },
      select: { id: true, estado: true, correo: true },
    });

    if (!usuario) {
      return res.status(401).json({
        error: 'Usuario no encontrado',
      });
    }

    if (usuario.estado !== 'ACTIVO') {
      return res.status(403).json({
        error: 'El usuario se encuentra inactivo',
      });
    }

    req.auth = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Token inválido o expirado',
    });
  }
}

function authorizePermission(permissionName) {
  return async (req, res, next) => {
    try {
      if (!req.auth?.sub) {
        return res.status(401).json({
          error: 'Autenticación requerida',
        });
      }

      const usuarioId = BigInt(req.auth.sub);

      const usuario = await prisma.usuarios.findUnique({
        where: {
          id: usuarioId,
        },
        select: {
          id: true,
          estado: true,
          usuario_rol: {
            select: {
              roles: {
                select: {
                  id: true,
                  nombre: true,
                  estado: true,
                  rol_permiso: {
                    select: {
                      permisos: {
                        select: {
                          id: true,
                          nombre: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!usuario) {
        return res.status(401).json({
          error: 'Usuario no encontrado',
        });
      }

      if (usuario.estado !== 'ACTIVO') {
        return res.status(403).json({
          error: 'El usuario se encuentra inactivo',
        });
      }

      const tienePermiso = usuario.usuario_rol.some(
        ({ roles }) => {
          if (roles.estado !== 'ACTIVO') {
            return false;
          }

          return roles.rol_permiso.some(
            ({ permisos }) =>
              permisos.nombre === permissionName
          );
        }
      );

      if (!tienePermiso) {
        return res.status(403).json({
          error: 'No tiene permisos para realizar esta operación',
          permiso_requerido: permissionName,
        });
      }

      req.authorization = {
        permission: permissionName,
      };

      next();
    } catch (error) {
      console.error(
        'Error al verificar permisos:',
        error
      );

      return res.status(500).json({
        error: 'No se pudo verificar la autorización',
      });
    }
  };
}

function isAdminRole(role) {
  return role?.nombre === 'ADMIN';
}

async function countActiveAdministrators() {
  return prisma.usuarios.count({
    where: {
      estado: 'ACTIVO',
      usuario_rol: {
        some: {
          roles: {
            nombre: 'ADMIN',
            estado: 'ACTIVO',
          },
        },
      },
    },
  });
}

async function userHasActiveAdminRole(usuarioId) {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: {
      estado: true,
      usuario_rol: {
        select: {
          roles: {
            select: {
              nombre: true,
              estado: true,
            },
          },
        },
      },
    },
  });

  return (
    usuario?.estado === 'ACTIVO' &&
    usuario.usuario_rol.some(
      ({ roles }) =>
        roles?.nombre === 'ADMIN' &&
        roles.estado === 'ACTIVO',
    )
  );
}

async function sendVerificationEmail({ usuarioId, correo, codigo }) {
  const notificationsServiceUrl =
    process.env.NOTIFICATIONS_SERVICE_URL ||
    'http://notifications-service:4006';

  const notificationsServiceSecret =
    process.env.NOTIFICATIONS_SERVICE_SECRET;

  if (!notificationsServiceSecret) {
    throw new Error(
      'NOTIFICATIONS_SERVICE_SECRET no está configurado',
    );
  }

  const response = await fetch(
    `${notificationsServiceUrl}/email/verification`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service-key': notificationsServiceSecret,
      },
      body: JSON.stringify({
        usuario_id: usuarioId,
        correo,
        codigo,
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
        `notifications-service respondió con HTTP ${response.status}`,
    );
  }

  return data;
}

async function sendActivationEmail({ usuarioId, correo, token }) {
  const notificationsServiceUrl =
    process.env.NOTIFICATIONS_SERVICE_URL ||
    'http://notifications-service:4006';
  const notificationsServiceSecret = process.env.NOTIFICATIONS_SERVICE_SECRET;

  if (!notificationsServiceSecret) {
    throw new Error('NOTIFICATIONS_SERVICE_SECRET no está configurado');
  }

  const response = await fetch(`${notificationsServiceUrl}/email/account-activation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-service-key': notificationsServiceSecret,
    },
    body: JSON.stringify({
      usuario_id: usuarioId,
      correo,
      token,
      frontend_url: process.env.FRONTEND_URL || 'http://localhost:8080',
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `notifications-service respondió con HTTP ${response.status}`);
  }

  return data;
}

async function sendPasswordRecoveryEmail({
  usuarioId,
  correo,
  codigo,
}) {
  const notificationsServiceUrl =
    process.env.NOTIFICATIONS_SERVICE_URL ||
    'http://notifications-service:4006';

  const notificationsServiceSecret =
    process.env.NOTIFICATIONS_SERVICE_SECRET;

  if (!notificationsServiceSecret) {
    throw new Error(
      'NOTIFICATIONS_SERVICE_SECRET no está configurado',
    );
  }

  const response = await fetch(
    `${notificationsServiceUrl}/email/password-recovery`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service-key': notificationsServiceSecret,
      },
      body: JSON.stringify({
        usuario_id: usuarioId,
        correo,
        codigo,
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
        `notifications-service respondió con HTTP ${response.status}`,
    );
  }

  return data;
}

async function sendPasswordChangedEmail({ usuarioId, correo }) {
  const notificationsServiceUrl =
    process.env.NOTIFICATIONS_SERVICE_URL ||
    'http://notifications-service:4006';

  const notificationsServiceSecret =
    process.env.NOTIFICATIONS_SERVICE_SECRET;

  if (!notificationsServiceSecret) {
    throw new Error(
      'NOTIFICATIONS_SERVICE_SECRET no está configurado',
    );
  }

  const response = await fetch(
    `${notificationsServiceUrl}/email/password-changed`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service-key': notificationsServiceSecret,
      },
      body: JSON.stringify({
        usuario_id: usuarioId,
        correo,
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
        `notifications-service respondió con HTTP ${response.status}`,
    );
  }

  return data;
}

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    service: 'users-service',
    status: 'ok',
    port,
  });
});

/**
 * Root
 */
app.get('/', (req, res) => {
  res.json({
    service: 'users-service',
    message: 'Microservice ready',
  });
});

/**
 * GET /usuarios
 *
 * Lista usuarios sin exponer credenciales.
 */
app.get(
  '/usuarios', 
  authenticateToken,
  authorizePermission('USUARIOS_LEER'),
  async (req, res) => {
  try {
    const usuarios = await prisma.usuarios.findMany({
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        telefono: true,
        estado: true,
        creado_en: true,
        actualizado_en: true,

        usuario_rol: {
          select: {
            roles: {
              select: {
                id: true,
                nombre: true,
                descripcion: true,
                estado: true,
              },
            },
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    res.json(serializeBigInt(usuarios));
  } catch (error) {
    console.error('Error al consultar usuarios:', error);

    res.status(500).json({
      error: 'No se pudieron consultar los usuarios',
    });
  }
});

/**
 * GET /usuarios/:id
 */
app.get(
  '/usuarios/:id', 
  authenticateToken,
  authorizePermission('USUARIOS_LEER'),
  async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const usuario = await prisma.usuarios.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        telefono: true,
        estado: true,
        creado_en: true,
        actualizado_en: true,

        usuario_rol: {
          select: {
            roles: {
              select: {
                id: true,
                nombre: true,
                descripcion: true,
                estado: true,
              },
            },
          },
        },

        empleados: {
          select: {
            id: true,
            cargo_id: true,
            cargos: {
              select: {
                id: true,
                nombre: true,
                descripcion: true,
                estado: true,
              },
            },
          },
        },
      },
    });

    if (!usuario) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
      });
    }

    res.json(serializeBigInt(usuario));
  } catch (error) {
    console.error('Error al consultar usuario:', error);

    res.status(400).json({
      error: 'ID de usuario inválido',
    });
  }
});

app.get('/permisos', authenticateToken, authorizePermission('PERMISOS_LEER'), async (req, res) => {
  try {
    const permisos = await prisma.permisos.findMany({
      orderBy: { id: 'asc' },
    });

    res.json(serializeBigInt(permisos));
  } catch (error) {
    console.error('Error al consultar permisos:', error);
    res.status(500).json({ error: 'No se pudieron consultar los permisos' });
  }
});

app.get('/roles', authenticateToken, authorizePermission('ROLES_LEER'), async (req, res) => {
  try {
    const roles = await prisma.roles.findMany({
      include: {
        rol_permiso: {
          include: {
            permisos: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    res.json(serializeBigInt(roles));
  } catch (error) {
    console.error('Error al consultar roles:', error);
    res.status(500).json({ error: 'No se pudieron consultar los roles' });
  }
});

app.get('/roles/:id', authenticateToken, authorizePermission('ROLES_LEER'), async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const rol = await prisma.roles.findUnique({
      where: { id },
      include: { rol_permiso: { include: { permisos: true } } },
    });

    if (!rol) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    res.json(serializeBigInt(rol));
  } catch (error) {
    console.error('Error al consultar rol:', error);
    res.status(400).json({ error: 'ID de rol inválido' });
  }
});

app.post(
  '/roles',
  authenticateToken,
  authorizePermission('ROLES_CREAR'),
  async (req, res) => {
    try {
      const { nombre, descripcion, estado } = req.body;

      if (
        !nombre ||
        typeof nombre !== 'string'
      ) {
        return res.status(400).json({
          error: 'Selecciona un rol válido de la lista permitida',
          roles_permitidos: ROLES_ADMINISTRABLES,
        });
      }

      const nombreNormalizado = nombre.trim().toUpperCase();

      if (!ROLES_ADMINISTRABLES.includes(nombreNormalizado)) {
        return res.status(400).json({
          error: 'No se puede crear ese rol',
          roles_permitidos: ROLES_ADMINISTRABLES,
        });
      }

      const rolExistente = await prisma.roles.findUnique({
        where: {
          nombre: nombreNormalizado,
        },
      });

      if (rolExistente) {
        return res.status(409).json({
          error: 'El rol ya existe',
        });
      }

      const rol = await prisma.roles.create({
        data: {
          nombre: nombreNormalizado,
          descripcion:
            typeof descripcion === 'string'
              ? descripcion.trim() || null
              : null,
          estado:
            ['ACTIVO', 'INACTIVO'].includes(estado)
              ? estado
              : 'ACTIVO',
        },
      });

      return res.status(201).json(
        serializeBigInt(rol),
      );
    } catch (error) {
      console.error('Error al crear rol:', error);

      return res.status(500).json({
        error: 'No se pudo crear el rol',
      });
    }
  },
);

app.put(
  '/roles/:id',
  authenticateToken,
  authorizePermission('ROLES_EDITAR'),
  async (req, res) => {
    try {
      const id = BigInt(req.params.id);
      const { nombre, descripcion, estado } = req.body;

      const rolActual = await prisma.roles.findUnique({
        where: { id },
      });

      if (!rolActual) {
        return res.status(404).json({
          error: 'Rol no encontrado',
        });
      }

      if (isAdminRole(rolActual)) {
        return res.status(403).json({
          error: 'El rol ADMIN está protegido y no puede modificarse',
        });
      }

      if (nombre !== undefined) {
        if (typeof nombre !== 'string') {
          return res.status(400).json({
            error: 'El nombre del rol no es válido',
          });
        }

        const nombreNormalizado = nombre.trim().toUpperCase();

        if (!ROLES_ADMINISTRABLES.includes(nombreNormalizado)) {
          return res.status(400).json({
            error: 'El nombre del rol no está permitido',
            roles_permitidos: ROLES_ADMINISTRABLES,
          });
        }

        const rolExistente = await prisma.roles.findFirst({
          where: {
            nombre: nombreNormalizado,
            NOT: {
              id,
            },
          },
        });

        if (rolExistente) {
          return res.status(409).json({
            error: 'Ya existe otro rol con ese nombre',
          });
        }
      }

      if (
        estado !== undefined &&
        !['ACTIVO', 'INACTIVO'].includes(estado)
      ) {
        return res.status(400).json({
          error: 'Estado inválido',
        });
      }

      const rol = await prisma.roles.update({
        where: { id },
        data: {
          ...(nombre !== undefined && {
            nombre: nombre.trim().toUpperCase(),
          }),
          ...(descripcion !== undefined && {
            descripcion:
              descripcion === null
                ? null
                : String(descripcion).trim() || null,
          }),
          ...(estado !== undefined && {
            estado,
          }),
        },
      });

      return res.json(
        serializeBigInt(rol),
      );
    } catch (error) {
      console.error('Error al actualizar rol:', error);

      return res.status(500).json({
        error: 'No se pudo actualizar el rol',
      });
    }
  },
);

app.patch(
  '/roles/:id/estado',
  authenticateToken,
  authorizePermission('ROLES_EDITAR'),
  async (req, res) => {
    try {
      const { estado } = req.body;

      if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
        return res.status(400).json({
          error: 'Estado inválido',
        });
      }

      const id = BigInt(req.params.id);

      const rolActual = await prisma.roles.findUnique({
        where: { id },
      });

      if (!rolActual) {
        return res.status(404).json({
          error: 'Rol no encontrado',
        });
      }

      if (isAdminRole(rolActual)) {
        return res.status(403).json({
          error: 'El rol ADMIN está protegido y no puede desactivarse',
        });
      }

      const rol = await prisma.roles.update({
        where: { id },
        data: {
          estado,
        },
      });

      return res.json(
        serializeBigInt(rol),
      );
    } catch (error) {
      console.error(
        'Error al cambiar estado del rol:',
        error,
      );

      return res.status(500).json({
        error: 'No se pudo cambiar el estado del rol',
      });
    }
  },
);

app.get('/roles/:id/permisos', authenticateToken, authorizePermission('ROLES_LEER'), async (req, res) => {
  try {
    const rol = await prisma.roles.findUnique({
      where: { id: BigInt(req.params.id) },
      include: { rol_permiso: { include: { permisos: true } } },
    });

    if (!rol) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    res.json(serializeBigInt(rol.rol_permiso.map(({ permisos }) => permisos)));
  } catch (error) {
    console.error('Error al consultar permisos del rol:', error);
    res.status(500).json({ error: 'No se pudieron consultar los permisos del rol' });
  }
});

app.post('/roles/:id/permisos', authenticateToken, authorizePermission('ROLES_ASIGNAR_PERMISOS'), async (req, res) => {
  try {
    const { permiso_id } = req.body;
    if (!permiso_id) {
      return res.status(400).json({ error: 'permiso_id es obligatorio' });
    }

    const rolId = BigInt(req.params.id);
    const permisoId = BigInt(permiso_id);

    const rol = await prisma.roles.findUnique({ where: { id: rolId } });
    const permiso = await prisma.permisos.findUnique({ where: { id: permisoId } });
    if (!rol || !permiso) {
      return res.status(404).json({ error: 'Rol o permiso no encontrado' });
    }

    const existente = await prisma.rol_permiso.findUnique({
      where: { rol_id_permiso_id: { rol_id: rolId, permiso_id: permisoId } },
    });
    if (existente) {
      return res.status(409).json({ error: 'La relación rol-permiso ya existe' });
    }

    const relacion = await prisma.rol_permiso.create({
      data: { rol_id: rolId, permiso_id: permisoId },
    });

    res.status(201).json(serializeBigInt(relacion));
  } catch (error) {
    console.error('Error al asignar permiso al rol:', error);
    res.status(500).json({ error: 'No se pudo asignar el permiso al rol' });
  }
});

app.delete('/roles/:id/permisos/:permisoId', authenticateToken, authorizePermission('ROLES_ASIGNAR_PERMISOS'), async (req, res) => {
  try {
    const rolId = BigInt(req.params.id);
    const permisoId = BigInt(req.params.permisoId);

    const relacion = await prisma.rol_permiso.findUnique({
      where: {
        rol_id_permiso_id: {
          rol_id: rolId,
          permiso_id: permisoId,
        },
      },
    });

    if (!relacion) {
      return res.status(404).json({
        error: 'El permiso no está asignado a ese rol',
      });
    }

    await prisma.rol_permiso.delete({
      where: {
        rol_id_permiso_id: {
          rol_id: rolId,
          permiso_id: permisoId,
        },
      },
    });

    res.json({
      message: 'Permiso removido del rol correctamente',
    });
  } catch (error) {
    console.error('Error al quitar permiso del rol:', error);
    res.status(500).json({ error: 'No se pudo quitar el permiso del rol' });
  }
});

app.get('/usuarios/:id/roles', authenticateToken, authorizePermission('USUARIOS_LEER'), async (req, res) => {
  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: BigInt(req.params.id) },
      include: { usuario_rol: { include: { roles: true } } },
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(serializeBigInt(usuario.usuario_rol.map(({ roles }) => roles)));
  } catch (error) {
    console.error('Error al consultar roles del usuario:', error);
    res.status(500).json({ error: 'No se pudieron consultar los roles del usuario' });
  }
});

app.post(
  '/usuarios/:id/roles',
  authenticateToken,
  authorizePermission('USUARIOS_EDITAR'),
  async (req, res) => {
    try {
      const { rol_id } = req.body;

      if (!rol_id) {
        return res.status(400).json({
          error: 'rol_id es obligatorio',
        });
      }

      const usuarioId = BigInt(req.params.id);
      const rolId = BigInt(rol_id);

      const usuario = await prisma.usuarios.findUnique({
        where: {
          id: usuarioId,
        },
      });

      const rol = await prisma.roles.findUnique({
        where: {
          id: rolId,
        },
      });

      if (!usuario || !rol) {
        return res.status(404).json({
          error: 'Usuario o rol no encontrado',
        });
      }

      if (isAdminRole(rol)) {
        return res.status(403).json({
          error: 'El rol ADMIN no puede asignarse desde esta operación',
        });
      }

      if (rol.estado !== 'ACTIVO') {
        return res.status(400).json({
          error: 'No se puede asignar un rol inactivo',
        });
      }

      const existente = await prisma.usuario_rol.findUnique({
        where: {
          usuario_id_rol_id: {
            usuario_id: usuarioId,
            rol_id: rolId,
          },
        },
      });

      if (existente) {
        return res.status(409).json({
          error: 'El usuario ya tiene asignado ese rol',
        });
      }

      const relacion = await prisma.usuario_rol.create({
        data: {
          usuario_id: usuarioId,
          rol_id: rolId,
        },
      });

      return res.status(201).json(
        serializeBigInt(relacion),
      );
    } catch (error) {
      console.error(
        'Error al asignar rol al usuario:',
        error,
      );

      return res.status(500).json({
        error: 'No se pudo asignar el rol al usuario',
      });
    }
  },
);

app.delete(
  '/usuarios/:id/roles/:rolId',
  authenticateToken,
  authorizePermission('USUARIOS_EDITAR'),
  async (req, res) => {
    try {
      const usuarioId = BigInt(req.params.id);
      const rolId = BigInt(req.params.rolId);

      const relacion = await prisma.usuario_rol.findUnique({
        where: {
          usuario_id_rol_id: {
            usuario_id: usuarioId,
            rol_id: rolId,
          },
        },
        include: {
          roles: true,
        },
      });

      if (!relacion) {
        return res.status(404).json({
          error: 'El usuario no tiene asignado ese rol',
        });
      }

      if (isAdminRole(relacion.roles)) {
        const esAdministradorActivo =
          await userHasActiveAdminRole(usuarioId);

        if (esAdministradorActivo) {
          const administradoresActivos =
            await countActiveAdministrators();

          if (administradoresActivos <= 1) {
            return res.status(409).json({
              error:
                'No puedes quitar el rol ADMIN al último administrador activo',
            });
          }
        }
      }

      await prisma.usuario_rol.delete({
        where: {
          usuario_id_rol_id: {
            usuario_id: usuarioId,
            rol_id: rolId,
          },
        },
      });

      return res.json({
        message:
          'Rol removido del usuario correctamente',
      });
    } catch (error) {
      console.error(
        'Error al quitar rol al usuario:',
        error,
      );

      return res.status(500).json({
        error: 'No se pudo quitar el rol al usuario',
      });
    }
  },
);

/**
 * POST /usuarios
 *
 * Crea usuario y envía un enlace de activación.
 */
app.post(
  '/usuarios', 
  authenticateToken,
  authorizePermission('USUARIOS_CREAR'),
  async (req, res) => {
  try {
    const { nombre, apellido, correo, telefono, rol_id } = req.body;
    const nombreNormalizado = normalizePersonName(nombre, 'El nombre');
    const apellidoNormalizado = normalizePersonName(apellido, 'El apellido');
    const correoNormalizado = normalizeEmail(correo);
    const telefonoNormalizado = normalizeAdminPhone(telefono);

    if (!correoNormalizado) {
      return res.status(400).json({ error: 'El correo electrónico no es válido' });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'contrasena')) {
      return res.status(400).json({ error: 'La contraseña se define mediante el enlace de activación' });
    }

    const usuarioExistente = await prisma.usuarios.findUnique({ where: { correo: correoNormalizado } });
    if (usuarioExistente) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    let rol = null;
    if (rol_id !== undefined && rol_id !== null && rol_id !== '') {
      rol = await prisma.roles.findUnique({ where: { id: BigInt(rol_id) } });
      if (!rol || rol.estado !== 'ACTIVO') {
        return res.status(400).json({
          error: 'El rol seleccionado no existe o está inactivo',
        });
      }

      if (isAdminRole(rol)) {
        return res.status(403).json({
          error: 'El rol ADMIN no puede asignarse mediante la creación normal de usuarios',
        });
      }
    }

    const ahora = new Date();
    const token = generateActivationToken();
    const usuario = await prisma.$transaction(async (tx) => {
      const creado = await tx.usuarios.create({
        data: {
          nombre: nombreNormalizado,
          apellido: apellidoNormalizado,
          correo: correoNormalizado,
          telefono: telefonoNormalizado,
          estado: 'INACTIVO',
          correo_verificado: false,
          creado_en: ahora,
          actualizado_en: ahora,
          ...(rol ? { usuario_rol: { create: { rol_id: rol.id } } } : {}),
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          correo: true,
          telefono: true,
          estado: true,
          correo_verificado: true,
          creado_en: true,
          actualizado_en: true,
          usuario_rol: { include: { roles: true } },
        },
      });

      await tx.tokens_verificacion.create({
        data: {
          usuario_id: creado.id,
          hash_codigo: hashVerificationValue(token),
          expira_en: new Date(ahora.getTime() + 24 * 60 * 60 * 1000),
          intentos: 0,
          creado_en: ahora,
        },
      });

      return creado;
    });

    try {
      await sendActivationEmail({ usuarioId: usuario.id.toString(), correo: usuario.correo, token });
    } catch (error) {
      console.error('[users-service][ACTIVATION_EMAIL_ERROR] No se pudo enviar la activación:', error.message || error);
      return res.status(502).json({ error: 'Usuario creado, pero no se pudo enviar el enlace de activación' });
    }

    return res.status(201).json({
      message: 'Usuario creado. Se envió un enlace de activación al correo indicado.',
      usuario: serializeBigInt(usuario),
    });
  } catch (error) {
    if (error.message?.startsWith('El nombre') || error.message?.startsWith('El apellido') || error.message?.startsWith('El teléfono')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al crear usuario:', error.message || error);
    return res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
});

/**
 * PUT /usuarios/:id
 */
app.put(
  '/usuarios/:id', 
  authenticateToken,
  authorizePermission('USUARIOS_EDITAR'),
  async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const {
      nombre,
      apellido,
      correo,
      telefono,
    } = req.body;

    const nombreNormalizado = normalizePersonName(nombre, 'El nombre');
    const apellidoNormalizado = normalizePersonName(apellido, 'El apellido');
    const correoNormalizado = normalizeEmail(correo);
    const telefonoNormalizado = normalizeAdminPhone(telefono);

    if (!correoNormalizado) {
      return res.status(400).json({ error: 'El correo electrónico no es válido' });
    }

    const usuario = await prisma.usuarios.update({
      where: {
        id,
      },
      data: {
        nombre: nombreNormalizado,
        apellido: apellidoNormalizado,
        correo: correoNormalizado,
        telefono: telefonoNormalizado,
        actualizado_en: new Date(),
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        telefono: true,
        estado: true,
        creado_en: true,
        actualizado_en: true,
      },
    });

    res.json(
      serializeBigInt(usuario)
    );
  } catch (error) {
    if (error.message?.startsWith('El nombre') || error.message?.startsWith('El apellido') || error.message?.startsWith('El teléfono')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al actualizar usuario:', error.message || error);
    return res.status(500).json({ error: 'No se pudo actualizar el usuario' });
  }
});

/**
 * PATCH /usuarios/:id/estado
 */
app.patch(
  '/usuarios/:id/estado', 
  authenticateToken,
  authorizePermission('USUARIOS_CAMBIAR_ESTADO'),
  async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const { estado } = req.body;

    const estadosPermitidos = [
      'ACTIVO',
      'INACTIVO',
    ];

    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        error: 'Estado inválido',
        estados_permitidos: estadosPermitidos,
      });
    }

    if (estado === 'INACTIVO' && id.toString() === req.auth.sub) {
      return res.status(409).json({
        error: 'Un administrador no puede desactivarse a sí mismo',
      });
    }

    if (estado === 'INACTIVO') {
      const usuarioObjetivo = await prisma.usuarios.findUnique({
        where: { id },
        select: {
          estado: true,
          usuario_rol: {
            select: {
              roles: {
                select: { nombre: true, estado: true },
              },
            },
          },
        },
      });

      if (!usuarioObjetivo) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
        });
      }

      const esAdministradorActivo =
        usuarioObjetivo?.estado === 'ACTIVO' &&
        usuarioObjetivo.usuario_rol.some(
          ({ roles }) =>
            roles?.nombre === 'ADMIN' && roles.estado === 'ACTIVO'
        );

      if (esAdministradorActivo) {
        const administradoresActivos = await prisma.usuarios.count({
          where: {
            estado: 'ACTIVO',
            usuario_rol: {
              some: {
                roles: {
                  nombre: 'ADMIN',
                  estado: 'ACTIVO',
                },
              },
            },
          },
        });

        if (administradoresActivos <= 1) {
          return res.status(409).json({
            error: 'No puedes desactivar al último administrador activo',
          });
        }
      }
    }

    const usuario = await prisma.usuarios.update({
      where: {
        id,
      },
      data: {
        estado,
        actualizado_en: new Date(),
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        telefono: true,
        estado: true,
        actualizado_en: true,
      },
    });

    res.json(
      serializeBigInt(usuario)
    );
  } catch (error) {
    console.error(
      'Error al cambiar estado del usuario:',
      error
    );

    res.status(500).json({
      error: 'No se pudo cambiar el estado del usuario',
    });
  }
});

app.post('/usuarios/:id/reenviar-activacion', authenticateToken, authorizePermission('USUARIOS_EDITAR'), async (req, res) => {
  try {
    const usuarioId = BigInt(req.params.id);
    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
      select: { id: true, correo: true, estado: true, correo_verificado: true },
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (usuario.correo_verificado) {
      return res.status(400).json({ error: 'La cuenta ya fue activada' });
    }

    const token = generateActivationToken();
    const ahora = new Date();
    await prisma.tokens_verificacion.updateMany({
      where: { usuario_id: usuario.id, utilizado_en: null },
      data: { utilizado_en: ahora },
    });
    await prisma.tokens_verificacion.create({
      data: {
        usuario_id: usuario.id,
        hash_codigo: hashVerificationValue(token),
        expira_en: new Date(ahora.getTime() + 24 * 60 * 60 * 1000),
        intentos: 0,
        creado_en: ahora,
      },
    });

    try {
      await sendActivationEmail({ usuarioId: usuario.id.toString(), correo: usuario.correo, token });
    } catch (error) {
      console.error('[users-service][ACTIVATION_EMAIL_ERROR] No se pudo reenviar la activación:', error.message || error);
      return res.status(502).json({ error: 'No se pudo enviar el nuevo enlace de activación' });
    }

    return res.json({ message: 'Se envió un nuevo enlace de activación' });
  } catch (error) {
    console.error('[users-service] Error al reenviar activación:', error.message || error);
    return res.status(500).json({ error: 'No se pudo reenviar la activación' });
  }
});

app.post('/auth/activate-account', authRateLimit, async (req, res) => {
  try {
    const { token, nueva_contrasena } = req.body;

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: 'El enlace de activación no es válido' });
    }

    const passwordError = validatePassword(nueva_contrasena);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const registro = await prisma.tokens_verificacion.findFirst({
      where: {
        hash_codigo: hashVerificationValue(token),
        utilizado_en: null,
        expira_en: { gt: new Date() },
      },
      orderBy: { creado_en: 'desc' },
    });

    if (!registro) {
      return res.status(400).json({ error: 'El enlace de activación no existe o ha expirado' });
    }

    const ahora = new Date();
    const hashContrasena = await bcrypt.hash(nueva_contrasena, 12);

    await prisma.$transaction([
      prisma.tokens_verificacion.update({ where: { id: registro.id }, data: { utilizado_en: ahora } }),
      prisma.usuarios.update({
        where: { id: registro.usuario_id },
        data: { estado: 'ACTIVO', correo_verificado: true, verificado_en: ahora, actualizado_en: ahora },
      }),
      prisma.credenciales.upsert({
        where: { usuario_id: registro.usuario_id },
        update: { hash_contrasena: hashContrasena, estado: 'ACTIVO', actualizado_en: ahora },
        create: { usuario_id: registro.usuario_id, hash_contrasena: hashContrasena, estado: 'ACTIVO', creado_en: ahora, actualizado_en: ahora },
      }),
    ]);

    return res.json({ message: 'Cuenta activada correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('[users-service] Error al activar cuenta:', error.message || error);
    return res.status(500).json({ error: 'No se pudo activar la cuenta' });
  }
});

/**
 * POST /auth/register
 *
 * Registro público de usuarios.
 *
 * El usuario queda activo, pero su correo
 * debe ser verificado mediante un código temporal.
 */
app.post('/auth/register', authRateLimit, async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      correo,
      telefono,
      contrasena,
    } = req.body;

    let nombreNormalizado;
    let apellidoNormalizado;
    try {
      nombreNormalizado = normalizePersonName(nombre, 'El nombre');
      apellidoNormalizado = normalizePersonName(apellido, 'El apellido');
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const correoNormalizado = normalizeEmail(correo);
    let telefonoNormalizado;
    try {
      telefonoNormalizado = normalizeAdminPhone(telefono);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!nombreNormalizado) {
      return res.status(400).json({
        error: 'El nombre es obligatorio',
      });
    }

    if (!apellidoNormalizado) {
      return res.status(400).json({
        error: 'El apellido es obligatorio',
      });
    }

    if (!correoNormalizado) {
      return res.status(400).json({
        error: 'El correo electrónico no es válido',
      });
    }

    const passwordError = validatePassword(contrasena);

    if (passwordError) {
      return res.status(400).json({
        error: passwordError,
      });
    }


    const usuarioExistente =
      await prisma.usuarios.findUnique({
        where: {
          correo: correoNormalizado,
        },
      });

    if (usuarioExistente) {
      return res.status(409).json({
        error: 'El correo ya está registrado',
      });
    }

    const hashContrasena =
      await bcrypt.hash(contrasena, 12);

    const codigo =
      generateVerificationCode();

    const hashCodigo =
      hashVerificationValue(codigo);

    const ahora = new Date();

    const expiraEn = new Date(
      ahora.getTime() + 10 * 60 * 1000
    );

    /*
     * Primero persistimos el usuario y el código.
     * El correo se envía después de confirmar el commit
     * de la transacción.
     */
    const resultado =
      await prisma.$transaction(async (tx) => {
        const usuario =
          await tx.usuarios.create({
            data: {
              nombre: nombreNormalizado,
              apellido: apellidoNormalizado,
              correo: correoNormalizado,
              telefono: telefonoNormalizado,
              estado: 'ACTIVO',
              creado_en: ahora,
              actualizado_en: ahora,
              correo_verificado: false,
              verificado_en: null,

              credenciales: {
                create: {
                  hash_contrasena: hashContrasena,
                  estado: 'ACTIVO',
                  creado_en: ahora,
                  actualizado_en: ahora,
                },
              },
            },

            select: {
              id: true,
              nombre: true,
              apellido: true,
              correo: true,
              telefono: true,
              estado: true,
              correo_verificado: true,
            },
          });

        await tx.tokens_verificacion.create({
          data: {
            usuario_id: usuario.id,
            hash_codigo: hashCodigo,
            expira_en: expiraEn,
            utilizado_en: null,
            intentos: 0,
            creado_en: ahora,
          },
        });

        return usuario;
      });

    /*
     * La transacción ya terminó correctamente.
     * Ahora enviamos el código mediante notifications-service.
     */
    let verificationEmailSent = false;

    try {
      await sendVerificationEmail({
        usuarioId: resultado.id.toString(),
        correo: resultado.correo,
        codigo,
      });

      verificationEmailSent = true;
    } catch (error) {
      console.error(
        'No se pudo enviar el correo de verificación:',
        error
      );
    }

    /*
     * Nunca devolvemos el código al frontend.
     */
    if (verificationEmailSent) {
      return res.status(201).json({
        message:
          'Usuario registrado correctamente. Se envió un código de verificación a su correo electrónico.',
        usuario: serializeBigInt(resultado),
      });
    }

    /*
     * El usuario ya fue creado, pero el correo falló.
     * Puede utilizar posteriormente resend-verification.
     */
    return res.status(201).json({
      message:
        'Usuario registrado correctamente, pero no se pudo enviar el correo de verificación. Puede solicitar un nuevo código.',
      usuario: serializeBigInt(resultado),
    });
  } catch (error) {
    console.error(
      'Error en registro de usuario:',
      error
    );

    return res.status(500).json({
      error: 'No se pudo registrar el usuario',
    });
  }
});

/**
 * POST /auth/verify-email
 *
 * Verifica un código temporal enviado al correo.
 */
app.post('/auth/verify-email', authRateLimit, async (req, res) => {
  try {
    const {
      correo,
      codigo,
    } = req.body;

    const correoNormalizado =
      normalizeEmail(correo);

    if (!correoNormalizado) {
      return res.status(400).json({
        error: 'El correo electrónico no es válido',
      });
    }

    if (
      typeof codigo !== 'string' ||
      !/^\d{6}$/.test(codigo)
    ) {
      return res.status(400).json({
        error: 'El código debe contener 6 dígitos',
      });
    }

    const usuario =
      await prisma.usuarios.findUnique({
        where: {
          correo: correoNormalizado,
        },
        select: {
          id: true,
          correo: true,
          correo_verificado: true,
        },
      });

    if (!usuario) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
      });
    }

    if (usuario.correo_verificado) {
      return res.status(400).json({
        error: 'El correo electrónico ya fue verificado',
      });
    }

    const registro =
      await prisma.tokens_verificacion.findFirst({
        where: {
          usuario_id: usuario.id,
          utilizado_en: null,
          expira_en: {
            gt: new Date(),
          },
        },
        orderBy: {
          creado_en: 'desc',
        },
      });

    if (!registro) {
      return res.status(400).json({
        error:
          'El código no existe o ha expirado. Solicite uno nuevo.',
      });
    }

    if (registro.intentos >= 5) {
      return res.status(429).json({
        error:
          'Se superó el número máximo de intentos para este código',
      });
    }

    const codigoHash =
      hashVerificationValue(codigo);

    if (codigoHash !== registro.hash_codigo) {
      await prisma.tokens_verificacion.update({
        where: {
          id: registro.id,
        },
        data: {
          intentos: {
            increment: 1,
          },
        },
      });

      return res.status(400).json({
        error: 'Código de verificación incorrecto',
      });
    }

    const ahora = new Date();

    await prisma.$transaction([
      prisma.tokens_verificacion.update({
        where: {
          id: registro.id,
        },
        data: {
          utilizado_en: ahora,
        },
      }),

      prisma.usuarios.update({
        where: {
          id: usuario.id,
        },
        data: {
          correo_verificado: true,
          verificado_en: ahora,
          actualizado_en: ahora,
        },
      }),
    ]);

    return res.json({
      message:
        'Correo electrónico verificado correctamente',
    });
  } catch (error) {
    console.error(
      'Error al verificar correo:',
      error
    );

    return res.status(500).json({
      error:
        'No se pudo verificar el correo electrónico',
    });
  }
});

/**
 * POST /auth/resend-verification
 *
 * Genera un nuevo código de verificación.
 */
app.post(
  '/auth/resend-verification',
  authRateLimit,
  async (req, res) => {
    try {
      const correoNormalizado =
        normalizeEmail(req.body.correo);

      if (!correoNormalizado) {
        return res.status(400).json({
          error: 'El correo electrónico no es válido',
        });
      }

      const usuario =
        await prisma.usuarios.findUnique({
          where: {
            correo: correoNormalizado,
          },
          select: {
            id: true,
            correo: true,
            correo_verificado: true,
          },
        });

      /*
       * No revelamos si el correo existe.
       */
      if (
        !usuario ||
        usuario.correo_verificado
      ) {
        return res.json({
          message:
            'Si el correo corresponde a una cuenta pendiente de verificación, se generará un nuevo código.',
        });
      }

      const codigo =
        generateVerificationCode();

      const hashCodigo =
        hashVerificationValue(codigo);

      const ahora = new Date();

      const expiraEn = new Date(
        ahora.getTime() + 10 * 60 * 1000
      );

      /*
       * Invalidamos códigos anteriores y generamos
       * uno nuevo.
       */
      await prisma.$transaction([
        prisma.tokens_verificacion.updateMany({
          where: {
            usuario_id: usuario.id,
            utilizado_en: null,
          },
          data: {
            utilizado_en: ahora,
          },
        }),

        prisma.tokens_verificacion.create({
          data: {
            usuario_id: usuario.id,
            hash_codigo: hashCodigo,
            expira_en: expiraEn,
            utilizado_en: null,
            intentos: 0,
            creado_en: ahora,
          },
        }),
      ]);

      /*
       * La BD ya tiene el nuevo código.
       * Ahora enviamos el código mediante
       * notifications-service.
       */
      try {
        await sendVerificationEmail({
          usuarioId: usuario.id.toString(),
          correo: usuario.correo,
          codigo,
        });
      } catch (error) {
        console.error(
          'No se pudo enviar el correo de verificación:',
          error
        );

        return res.status(500).json({
          error:
            'Se generó un nuevo código, pero no se pudo enviar el correo de verificación. Intente nuevamente.',
        });
      }

      return res.json({
        message:
          'Se envió un nuevo código de verificación a su correo electrónico.',
      });
    } catch (error) {
      console.error(
        'Error al reenviar código:',
        error
      );

      return res.status(500).json({
        error:
          'No se pudo generar un nuevo código',
      });
    }
  }
);

/**
 * POST /auth/forgot-password
 *
 * Solicita la recuperación de contraseña.
 *
 * Por seguridad, la respuesta no revela si el correo
 * está registrado o no.
 */
app.post('/auth/forgot-password', recoveryRateLimit, async (req, res) => {
  try {
    const correoNormalizado = normalizeEmail(req.body.correo);

    if (!correoNormalizado) {
      return res.status(400).json({
        error: 'El correo electrónico no es válido',
      });
    }

    const respuestaGenerica = {
      message:
        'Si el correo corresponde a una cuenta válida, se enviará un código de recuperación.',
    };

    const usuario = await prisma.usuarios.findUnique({
      where: {
        correo: correoNormalizado,
      },
      select: {
        id: true,
        correo: true,
        estado: true,
        correo_verificado: true,
      },
    });

    /*
     * No revelamos si la cuenta existe.
     *
     * Tampoco generamos recuperación para cuentas
     * inactivas o con correo no verificado.
     */
    if (
      !usuario ||
      usuario.estado !== 'ACTIVO' ||
      !usuario.correo_verificado
    ) {
      return res.json(respuestaGenerica);
    }

    const codigo = generateVerificationCode();
    const hashToken = hashVerificationValue(codigo);

    const ahora = new Date();

    /*
     * El código de recuperación tendrá una validez
     * de 30 minutos.
     */
    const expiraEn = new Date(
      ahora.getTime() + 30 * 60 * 1000
    );

    /*
     * Invalidamos códigos de recuperación anteriores
     * que todavía estén activos.
     */
    await prisma.$transaction([
      prisma.tokens_recuperacion.updateMany({
        where: {
          usuario_id: usuario.id,
          utilizado_en: null,
        },
        data: {
          utilizado_en: ahora,
        },
      }),

      prisma.tokens_recuperacion.create({
        data: {
          usuario_id: usuario.id,
          hash_token: hashToken,
          expira_en: expiraEn,
          utilizado_en: null,
          creado_en: ahora,
        },
      }),
    ]);

    try {
      await sendPasswordRecoveryEmail({
        usuarioId: usuario.id.toString(),
        correo: usuario.correo,
        codigo,
      });
    } catch (error) {
      console.error(
        'No se pudo enviar el correo de recuperación:',
        error,
      );
    }

    return res.json(respuestaGenerica);
  } catch (error) {
    console.error(
      'Error al solicitar recuperación de contraseña:',
      error
    );

    return res.status(500).json({
      error: 'No se pudo procesar la solicitud de recuperación',
    });
  }
});

/**
 * POST /auth/reset-password
 *
 * Cambia la contraseña utilizando un código
 * de recuperación válido.
 */
app.post('/auth/reset-password', recoveryRateLimit, async (req, res) => {
  try {
    const {
      correo,
      codigo,
      nueva_contrasena,
    } = req.body;

    const correoNormalizado = normalizeEmail(correo);

    if (!correoNormalizado) {
      return res.status(400).json({
        error: 'El correo electrónico no es válido',
      });
    }

    if (
      typeof codigo !== 'string' ||
      !/^\d{6}$/.test(codigo)
    ) {
      return res.status(400).json({
        error: 'El código de recuperación debe contener 6 dígitos',
      });
    }

    const passwordError =
      validatePassword(nueva_contrasena);

    if (passwordError) {
      return res.status(400).json({
        error: passwordError,
      });
    }

    const hashToken =
      hashVerificationValue(codigo);

    const registro =
      await prisma.tokens_recuperacion.findUnique({
        where: {
          hash_token: hashToken,
        },
        include: {
          usuarios: {
            include: {
              credenciales: true,
            },
          },
        },
      });

    if (!registro) {
      return res.status(400).json({
        error: 'El código de recuperación no es válido',
      });
    }

    if (registro.utilizado_en) {
      return res.status(400).json({
        error: 'El código de recuperación ya fue utilizado',
      });
    }

    if (registro.expira_en <= new Date()) {
      return res.status(400).json({
        error: 'El código de recuperación ha expirado',
      });
    }

    const usuario = registro.usuarios;

    if (!usuario) {
      return res.status(400).json({
        error: 'El código de recuperación no es válido',
      });
    }

    if (usuario.correo !== correoNormalizado) {
      return res.status(400).json({
        error: 'El código de recuperación no es válido',
      });
    }

    if (usuario.estado !== 'ACTIVO') {
      return res.status(403).json({
        error: 'El usuario se encuentra inactivo',
      });
    }

    if (
      !usuario.credenciales ||
      usuario.credenciales.estado !== 'ACTIVO'
    ) {
      return res.status(403).json({
        error: 'Las credenciales se encuentran inactivas',
      });
    }

    const hashContrasena =
      await bcrypt.hash(nueva_contrasena, 12);

    const ahora = new Date();

    /*
     * Todo el cambio se realiza dentro de una transacción:
     *
     * 1. Actualizar contraseña.
     * 2. Consumir código de recuperación.
     * 3. Revocar todas las sesiones persistentes.
     * 4. Invalidar otros tokens de recuperación.
     */
    await prisma.$transaction([
      prisma.credenciales.update({
        where: {
          usuario_id: usuario.id,
        },
        data: {
          hash_contrasena: hashContrasena,
          actualizado_en: ahora,
        },
      }),

      prisma.tokens_recuperacion.update({
        where: {
          id: registro.id,
        },
        data: {
          utilizado_en: ahora,
        },
      }),

      prisma.tokens_recuperacion.updateMany({
        where: {
          usuario_id: usuario.id,
          utilizado_en: null,
        },
        data: {
          utilizado_en: ahora,
        },
      }),

      prisma.tokens_refresh.updateMany({
        where: {
          usuario_id: usuario.id,
          revocado_en: null,
        },
        data: {
          revocado_en: ahora,
        },
      }),

      prisma.usuarios.update({
        where: {
          id: usuario.id,
        },
        data: {
          actualizado_en: ahora,
        },
      }),
    ]);

    try {
      await sendPasswordChangedEmail({
        usuarioId: usuario.id.toString(),
        correo: usuario.correo,
      });
    } catch (error) {
      console.error(
        'No se pudo enviar la confirmación de cambio de contraseña:',
        error,
      );
    }

    return res.json({
      message:
        'La contraseña se restableció correctamente. Inicie sesión nuevamente.',
    });
  } catch (error) {
    console.error(
      'Error al restablecer contraseña:',
      error
    );

    return res.status(500).json({
      error: 'No se pudo restablecer la contraseña',
    });
  }
});

/**
 * POST /auth/login
 */
app.post('/auth/login', loginRateLimit, async (req, res) => {
  try {
    const {
      correo,
      contrasena,
    } = req.body;

    if (!correo || !contrasena) {
      return res.status(400).json({
        error: 'correo y contrasena son obligatorios',
      });
    }

    const correoNormalizado = normalizeEmail(correo);

    if (!correoNormalizado) {
      return res.status(400).json({
        error: 'El correo electrónico no es válido',
      });
    }

    const usuario = await prisma.usuarios.findUnique({
      where: {
        correo: correoNormalizado,
      },
      include: {
        credenciales: true,

        usuario_rol: {
          include: {
            roles: true,
          },
        },
      },
    });

    if (!usuario || !usuario.credenciales) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
      });
    }

    if (!usuario.correo_verificado) {
      return res.status(403).json({
        error:
          'Debe verificar su correo electrónico antes de iniciar sesión',
      });
    }

    if (usuario.estado !== 'ACTIVO') {
      return res.status(403).json({
        error: 'El usuario se encuentra inactivo',
      });
    }

    if (usuario.credenciales.estado !== 'ACTIVO') {
      return res.status(403).json({
        error: 'Las credenciales se encuentran inactivas',
      });
    }

    const contrasenaValida = await bcrypt.compare(
      contrasena,
      usuario.credenciales.hash_contrasena
    );

    if (!contrasenaValida) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
      });
    }

    const roles = usuario.usuario_rol
      .filter(
        ({ roles }) => roles.estado === 'ACTIVO'
      )
      .map(({ roles }) => roles.nombre);

    const accessToken = generateAccessToken(
      usuario,
      roles
    );

    const refreshToken = generateRefreshToken();

    const refreshTokenHash =
      hashToken(refreshToken);

    const ahora = new Date();

    const expiraEn = new Date(ahora);

    expiraEn.setDate(
      expiraEn.getDate() +
        REFRESH_EXPIRES_IN_DAYS
    );

    await prisma.tokens_refresh.create({
      data: {
        usuario_id: usuario.id,
        hash_token: refreshTokenHash,
        expira_en: expiraEn,
        revocado_en: null,
        creado_en: ahora,
      },
    });

    const user = buildUserPayload({
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      telefono: usuario.telefono,
      estado: usuario.estado,
      correo_verificado: usuario.correo_verificado,
      verificado_en: usuario.verificado_en,
      usuario_rol: usuario.usuario_rol,
    });

    res.json({
      message: 'Autenticación exitosa',
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: ACCESS_EXPIRES_IN,
      user,
      usuario: user,
    });
  } catch (error) {
    console.error('Error en login:', error);

    res.status(500).json({
      error: 'No se pudo realizar la autenticación',
    });
  }
});

/**
 * POST /auth/refresh
 */
app.post('/auth/refresh', authRateLimit, async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'refresh_token es obligatorio',
      });
    }

    const tokenHash =
      hashToken(refresh_token);

    const registro =
      await prisma.tokens_refresh.findUnique({
        where: {
          hash_token: tokenHash,
        },
        include: {
          usuarios: {
            include: {
              usuario_rol: {
                include: {
                  roles: true,
                },
              },
            },
          },
        },
      });

    if (!registro) {
      return res.status(401).json({
        error: 'Refresh token inválido',
      });
    }

    if (registro.revocado_en) {
      return res.status(401).json({
        error: 'Refresh token revocado',
      });
    }

    if (registro.expira_en <= new Date()) {
      return res.status(401).json({
        error: 'Refresh token expirado',
      });
    }

    if (registro.usuarios.estado !== 'ACTIVO') {
      return res.status(403).json({
        error: 'El usuario se encuentra inactivo',
      });
    }

    const roles =
      registro.usuarios.usuario_rol
        .filter(
          ({ roles }) =>
            roles.estado === 'ACTIVO'
        )
        .map(({ roles }) => roles.nombre);

    const accessToken =
      generateAccessToken(
        registro.usuarios,
        roles
      );

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_EXPIRES_IN,
    });
  } catch (error) {
    console.error(
      'Error al renovar token:',
      error
    );

    res.status(500).json({
      error: 'No se pudo renovar el token',
    });
  }
});

/**
 * POST /auth/logout
 */
app.post('/auth/logout', authRateLimit, async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'refresh_token es obligatorio',
      });
    }

    const tokenHash =
      hashToken(refresh_token);

    const resultado =
      await prisma.tokens_refresh.updateMany({
        where: {
          hash_token: tokenHash,
          revocado_en: null,
        },
        data: {
          revocado_en: new Date(),
        },
      });

    res.json({
      message: 'Sesión cerrada correctamente',
      tokens_revocados: resultado.count,
    });
  } catch (error) {
    console.error('Error en logout:', error);

    res.status(500).json({
      error: 'No se pudo cerrar la sesión',
    });
  }
});

/**
 * GET /auth/me
 */
app.get(
  '/auth/me',
  authenticateToken,
  async (req, res) => {
    try {
      const id = BigInt(req.auth.sub);

      const usuario =
        await prisma.usuarios.findUnique({
          where: {
            id,
          },
          select: {
            id: true,
            nombre: true,
            apellido: true,
            correo: true,
            telefono: true,
            estado: true,
            correo_verificado: true,
            verificado_en: true,
            usuario_rol: {
              select: {
                roles: {
                  select: {
                    id: true,
                    nombre: true,
                    descripcion: true,
                    estado: true,
                  },
                },
              },
            },
          },
        });

      if (!usuario) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
        });
      }

      if (usuario.estado !== 'ACTIVO') {
        return res.status(403).json({
          error: 'El usuario se encuentra inactivo',
        });
      }

      res.json(buildUserPayload(usuario));
    } catch (error) {
      console.error(
        'Error al consultar usuario autenticado:',
        error
      );

      res.status(500).json({
        error:
          'No se pudo consultar el usuario autenticado',
      });
    }
  }
);

async function bootstrap() {
  const { adminRole } = await ensureRoleSeed();
  await ensureAdminUser(adminRole);

  app.listen(port, () => {
    console.log(
      `users-service running on port ${port}`
    );
  });
}

bootstrap().catch((error) => {
  console.error('No se pudo iniciar users-service:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
