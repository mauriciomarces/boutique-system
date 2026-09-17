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

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ||
  'http://localhost:8080,http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      /*
       * Permite herramientas como curl/Postman que no
       * envian Origin.
       */
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `CORS: origen no permitido ${origin}`
        )
      );
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error:
      'Demasiadas solicitudes. Intente nuevamente más tarde.',
  },
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error:
      'Demasiados intentos de inicio de sesión. Intente nuevamente más tarde.',
  },
});

const recoveryRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error:
      'Demasiadas solicitudes de recuperación. Intente nuevamente más tarde.',
  },
});

const port = Number(process.env.PORT || 4002);

const adapter = new PrismaMariaDb({
  host: 'mysql-users',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_users',
  connectionLimit: 5,
  acquireTimeout: 30000,
  connectTimeout: 30000,
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

/**
 * Genera un código numérico de 6 dígitos.
 */
function generateVerificationCode() {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
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
function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Token de acceso requerido',
    });
  }

  const token = authorization.substring(7);

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);

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

/**
 * POST /usuarios
 *
 * Crea usuario + credenciales.
 */
app.post(
  '/usuarios', 
  authenticateToken,
  authorizePermission('USUARIOS_CREAR'),
  async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      correo,
      telefono,
      contrasena,
    } = req.body;

    if (
      !nombre ||
      !apellido ||
      !correo ||
      !contrasena
    ) {
      return res.status(400).json({
        error:
          'nombre, apellido, correo y contrasena son obligatorios',
      });
    }

    if (contrasena.length < 8) {
      return res.status(400).json({
        error:
          'La contraseña debe tener al menos 8 caracteres',
      });
    }

    const usuarioExistente = await prisma.usuarios.findUnique({
      where: {
        correo,
      },
    });

    if (usuarioExistente) {
      return res.status(409).json({
        error: 'El correo ya está registrado',
      });
    }

    const hashContrasena = await bcrypt.hash(contrasena, 12);

    const ahora = new Date();

    const usuario = await prisma.usuarios.create({
      data: {
        nombre,
        apellido,
        correo,
        telefono: telefono || null,
        estado: 'ACTIVO',
        creado_en: ahora,
        actualizado_en: ahora,

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
        creado_en: true,
        actualizado_en: true,
      },
    });

    res.status(201).json(
      serializeBigInt(usuario)
    );
  } catch (error) {
    console.error('Error al crear usuario:', error);

    res.status(500).json({
      error: 'No se pudo crear el usuario',
    });
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

    const usuario = await prisma.usuarios.update({
      where: {
        id,
      },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(apellido !== undefined && { apellido }),
        ...(correo !== undefined && { correo }),
        ...(telefono !== undefined && {
          telefono,
        }),
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
    console.error('Error al actualizar usuario:', error);

    res.status(500).json({
      error: 'No se pudo actualizar el usuario',
    });
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

    const nombreNormalizado = normalizeText(nombre);
    const apellidoNormalizado = normalizeText(apellido);
    const correoNormalizado = normalizeEmail(correo);
    const telefonoNormalizado = normalizeText(telefono);

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

    if (
      telefonoNormalizado &&
      telefonoNormalizado.length > 30
    ) {
      return res.status(400).json({
        error: 'El teléfono no puede superar los 30 caracteres',
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

    const usuario = await prisma.usuarios.findUnique({
      where: {
        correo,
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

    res.json({
      message: 'Autenticación exitosa',

      access_token: accessToken,

      refresh_token: refreshToken,

      token_type: 'Bearer',

      expires_in: ACCESS_EXPIRES_IN,

      usuario: serializeBigInt({
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        telefono: usuario.telefono,
        estado: usuario.estado,
        roles,
      }),
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

      res.json(
        serializeBigInt(usuario)
      );
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

app.listen(port, () => {
  console.log(
    `users-service running on port ${port}`
  );
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
