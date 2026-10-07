require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { sendEmail, verifyMailer } = require('./mailer');

const app = express();
const port = Number(process.env.PORT || 3000);

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || 'mysql-notifications',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'boutique',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_NAME || 'boutique_notifications',
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  acquireTimeout: Number(process.env.DB_ACQUIRE_TIMEOUT || 10000),
  idleTimeout: Number(process.env.DB_IDLE_TIMEOUT || 300),
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

function verifyAccessToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT inválido');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  const provided = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error('Firma JWT inválida');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('JWT expirado');
  }

  return payload;
}

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  const token = authorization.substring(7);
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'boutique_dev_secret';

  try {
    const payload = verifyAccessToken(token, accessSecret);
    req.auth = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function authorizeInternalService(req, res, next) {
  const providedSecret = req.headers['x-internal-service-key'];
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;

  if (!expectedSecret) {
    console.error('[notifications-service][INTERNAL_SERVICE_SECRET] no está configurado');

    return res.status(500).json({
      error: 'Secreto interno no configurado',
    });
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({
      error: 'Servicio no autorizado',
    });
  }

  next();
}

async function createNotification({ usuarioId, tipo, titulo, mensaje }) {
  return prisma.notificaciones.create({
    data: {
      usuario_id: BigInt(usuarioId),
      tipo,
      titulo,
      mensaje,
      canal: 'EMAIL',
      estado: 'ENVIADO',
      enviado_en: new Date(),
      creado_en: new Date(),
    },
  });
}

app.get('/health', (req, res) => {
  res.json({
    service: 'notifications-service',
    status: 'ok',
    port,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'notifications-service',
    message: 'Microservice ready',
  });
});

app.post('/email/verification', authorizeInternalService, async (req, res) => {
  try {
    const { usuario_id, correo, codigo } = req.body;

    if (!usuario_id || !correo || !codigo) {
      return res.status(400).json({
        error: 'usuario_id, correo y codigo son obligatorios',
      });
    }

    const codigoNormalizado = String(codigo).trim();

    if (!/^\d{6}$/.test(codigoNormalizado)) {
      return res.status(400).json({
        error: 'El código debe tener 6 dígitos',
      });
    }

    const titulo = 'Verifica tu correo electrónico - SposaBella';
    const mensaje = `Hola.\n\nGracias por registrarte en SposaBella.\n\nTu código de verificación es:\n\n${codigoNormalizado}\n\nEste código es válido durante un tiempo limitado.\n\nSi no realizaste este registro, puedes ignorar este mensaje.\n\nSaludos,\nSposaBella`.trim();

    try {
      await sendEmail({
        to: correo,
        subject: titulo,
        text: mensaje,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Verificación de correo electrónico</h2>
            <p>Gracias por registrarte en <strong>SposaBella</strong>.</p>
            <p>Tu código de verificación es:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">${codigoNormalizado}</div>
            <p>Este código es válido durante un tiempo limitado.</p>
            <p>Si no realizaste este registro, puedes ignorar este mensaje.</p>
            <p>Saludos,<br><strong>SposaBella</strong></p>
          </div>
        `,
      });
      console.log('[notifications-service] Correo de verificación enviado correctamente');
    } catch (smtpError) {
      console.error('[notifications-service][SMTP_ERROR] Falló el envío del correo de verificación:', smtpError.message || smtpError);
      return res.status(502).json({
        error: 'No se pudo enviar el correo de verificación',
      });
    }

    try {
      await createNotification({
        usuarioId: usuario_id,
        tipo: 'VERIFICACION_EMAIL',
        titulo,
        mensaje,
      });
      console.log('[notifications-service] Notificación de verificación registrada en BD');
    } catch (dbError) {
      console.error('[notifications-service][DATABASE_ERROR] Falló el registro de notificación de verificación:', dbError.message || dbError);
      return res.status(500).json({
        error: 'Correo enviado correctamente, pero falló el registro de la notificación',
      });
    }

    return res.status(201).json({
      message: 'Correo de verificación enviado correctamente',
    });
  } catch (error) {
    console.error('[notifications-service][INTERNAL_ERROR] Error al procesar verificación:', error.message || error);
    return res.status(500).json({
      error: 'No se pudo procesar la solicitud de verificación',
    });
  }
});

app.post('/email/account-activation', authorizeInternalService, async (req, res) => {
  try {
    const { usuario_id, correo, token, frontend_url } = req.body;

    if (!usuario_id || !correo || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: 'Datos de activación inválidos' });
    }

    const activationUrl = `${String(frontend_url || 'http://localhost:8080').replace(/\/$/, '')}/activacion-cuenta?token=${encodeURIComponent(token)}`;
    const titulo = 'Activa tu cuenta de SposaBella';
    const mensaje = `Hola.\n\nTu cuenta de SposaBella fue creada. Abre el siguiente enlace para activarla y definir tu contraseña:\n\n${activationUrl}\n\nEl enlace vence en 24 horas y solo puede utilizarse una vez.`;
    const mensajeRegistro = 'Tu cuenta fue creada. Se envió un enlace de activación al correo del usuario.';

    try {
      await sendEmail({
        to: correo,
        subject: titulo,
        text: mensaje,
        html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;"><h2>Activa tu cuenta</h2><p>Tu cuenta de <strong>SposaBella</strong> fue creada.</p><p><a href="${activationUrl}" style="display:inline-block;padding:12px 18px;background:#263238;color:#fff;text-decoration:none;border-radius:8px;">Activar cuenta</a></p><p>El enlace vence en 24 horas y solo puede utilizarse una vez.</p></div>`,
      });
      console.log('[notifications-service] Correo de activación enviado correctamente');
    } catch (smtpError) {
      console.error('[notifications-service][SMTP_ERROR] Falló el envío de activación:', smtpError.message || smtpError);
      return res.status(502).json({ error: 'No se pudo enviar el correo de activación' });
    }

    try {
      await createNotification({ usuarioId: usuario_id, tipo: 'ACTIVACION_CUENTA', titulo, mensaje: mensajeRegistro });
      console.log('[notifications-service] Notificación de activación registrada en BD');
    } catch (dbError) {
      console.error('[notifications-service][DATABASE_ERROR] Falló el registro de activación:', dbError.message || dbError);
      return res.status(500).json({ error: 'Correo enviado correctamente, pero falló el registro de la notificación' });
    }

    return res.status(201).json({ message: 'Correo de activación enviado correctamente' });
  } catch (error) {
    console.error('[notifications-service][INTERNAL_ERROR] Error al procesar activación:', error.message || error);
    return res.status(500).json({ error: 'No se pudo procesar la activación' });
  }
});

app.post(
  '/email/password-recovery',
  authorizeInternalService,
  async (req, res) => {
    try {
      const { usuario_id, correo, codigo } = req.body;

      if (!usuario_id || !correo || !codigo) {
        return res.status(400).json({
          error: 'usuario_id, correo y codigo son obligatorios',
        });
      }

      const codigoNormalizado = String(codigo).trim();

      if (!/^\d{6}$/.test(codigoNormalizado)) {
        return res.status(400).json({
          error: 'El código debe tener 6 dígitos',
        });
      }

      const titulo = 'Código para restablecer tu contraseña - SposaBella';
      const mensaje = `Hola.\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta de SposaBella.\n\nTu código de recuperación es:\n\n${codigoNormalizado}\n\nEste código es válido durante 30 minutos.\n\nSi no solicitaste este cambio, puedes ignorar este correo.\n\nSaludos,\nSposaBella`.trim();

      try {
        await sendEmail({
          to: correo,
          subject: titulo,
          text: mensaje,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Restablecimiento de contraseña</h2>
              <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de <strong>SposaBella</strong>.</p>
              <p>Tu código de recuperación es:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">${codigoNormalizado}</div>
              <p>Este código es válido durante 30 minutos.</p>
              <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
              <p>Saludos,<br><strong>SposaBella</strong></p>
            </div>
          `,
        });
        console.log('[notifications-service] Correo de recuperación enviado correctamente');
      } catch (smtpError) {
        console.error('[notifications-service][SMTP_ERROR] Falló el envío del correo de recuperación:', smtpError.message || smtpError);
        return res.status(502).json({
          error: 'No se pudo enviar el correo de recuperación',
        });
      }

      try {
        await createNotification({
          usuarioId: usuario_id,
          tipo: 'RECUPERACION_CONTRASENA',
          titulo,
          mensaje,
        });
        console.log('[notifications-service] Notificación de recuperación registrada en BD');
      } catch (dbError) {
        console.error('[notifications-service][DATABASE_ERROR] Falló el registro de notificación de recuperación:', dbError.message || dbError);
        return res.status(500).json({
          error: 'Correo enviado correctamente, pero falló el registro de la notificación',
        });
      }

      return res.status(201).json({
        message: 'Correo de recuperación enviado correctamente',
      });
    } catch (error) {
      console.error('[notifications-service][INTERNAL_ERROR] Error al enviar correo de recuperación:', error.message || error);
      return res.status(500).json({
        error: 'No se pudo procesar la solicitud de recuperación',
      });
    }
  },
);

app.post(
  '/email/password-changed',
  authorizeInternalService,
  async (req, res) => {
    try {
      const { usuario_id, correo } = req.body;

      if (!usuario_id || !correo) {
        return res.status(400).json({
          error: 'usuario_id y correo son obligatorios',
        });
      }

      const titulo = 'Tu contraseña fue modificada - SposaBella';
      const mensaje = `Hola.\n\nLa contraseña de tu cuenta de SposaBella fue modificada correctamente.\n\nSi no realizaste este cambio, comunícate con soporte lo antes posible.\n\nSaludos,\nSposaBella`.trim();

      try {
        await sendEmail({
          to: correo,
          subject: titulo,
          text: mensaje,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Contraseña modificada</h2>
              <p>La contraseña de tu cuenta de <strong>SposaBella</strong> fue modificada correctamente.</p>
              <p>Si no realizaste este cambio, comunícate con soporte lo antes posible.</p>
              <p>Saludos,<br><strong>SposaBella</strong></p>
            </div>
          `,
        });
        console.log('[notifications-service] Correo de confirmación de contraseña enviado correctamente');
      } catch (smtpError) {
        console.error('[notifications-service][SMTP_ERROR] Falló el envío del correo de confirmación de contraseña:', smtpError.message || smtpError);
        return res.status(502).json({
          error: 'No se pudo enviar la confirmación de cambio de contraseña',
        });
      }

      try {
        await createNotification({
          usuarioId: usuario_id,
          tipo: 'CONTRASENA_MODIFICADA',
          titulo,
          mensaje,
        });
        console.log('[notifications-service] Notificación de contraseña modificada registrada en BD');
      } catch (dbError) {
        console.error('[notifications-service][DATABASE_ERROR] Falló el registro de notificación de contraseña cambiada:', dbError.message || dbError);
        return res.status(500).json({
          error: 'Correo enviado correctamente, pero falló el registro de la notificación',
        });
      }

      return res.status(201).json({
        message: 'Confirmación de cambio de contraseña enviada correctamente',
      });
    } catch (error) {
      console.error('[notifications-service][INTERNAL_ERROR] Error al procesar confirmación de contraseña:', error.message || error);
      return res.status(500).json({
        error: 'No se pudo procesar la confirmación de cambio de contraseña',
      });
    }
  },
);

app.get('/notificaciones', authenticateToken, async (req, res) => {
  try {
    const usuarioId = BigInt(req.auth.sub);
    const notificaciones = await prisma.notificaciones.findMany({
      where: { usuario_id: usuarioId },
      orderBy: { creado_en: 'desc' },
    });

    res.json(notificaciones);
  } catch (error) {
    console.error('[notifications-service][DATABASE_ERROR] Error al consultar notificaciones:', error.message || error);

    res.status(500).json({
      error: 'No se pudieron consultar las notificaciones',
    });
  }
});

verifyMailer()
  .then(() => {
    console.log('SMTP listo para enviar correos');
  })
  .catch((error) => {
    console.error('Error al configurar SMTP:', error.message);
  });

app.listen(port, () => {
  console.log(`notifications-service running on port ${port}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
