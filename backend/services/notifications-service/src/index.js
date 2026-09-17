require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { sendEmail, verifyMailer } = require('./mailer');

const app = express();
const port = Number(process.env.PORT || 3000);

const adapter = new PrismaMariaDb({
  host: 'mysql-notifications',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_notifications',
  connectionLimit: 5,
  connectTimeout: 5000,
  acquireTimeout: 5000,
  ssl: false,
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

function authorizeInternalService(req, res, next) {
  const providedSecret = req.headers['x-internal-service-key'];
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;

  if (!expectedSecret) {
    console.error('INTERNAL_SERVICE_SECRET no está configurado');

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

    const mensaje = `
Hola.

Gracias por registrarte en SposaBella.

Tu código de verificación es:

${codigoNormalizado}

Este código es válido durante un tiempo limitado.

Si no realizaste este registro, puedes ignorar este mensaje.

Saludos,
SposaBella
`.trim();

    await sendEmail({
      to: correo,
      subject: titulo,
      text: mensaje,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Verificación de correo electrónico</h2>

          <p>Gracias por registrarte en <strong>SposaBella</strong>.</p>

          <p>Tu código de verificación es:</p>

          <div style="
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            margin: 20px 0;
          ">
            ${codigoNormalizado}
          </div>

          <p>
            Este código es válido durante un tiempo limitado.
          </p>

          <p>
            Si no realizaste este registro, puedes ignorar este mensaje.
          </p>

          <p>
            Saludos,<br>
            <strong>SposaBella</strong>
          </p>
        </div>
      `,
    });

    await prisma.notificaciones.create({
      data: {
        usuario_id: BigInt(usuario_id),
        tipo: 'VERIFICACION_EMAIL',
        titulo,
        mensaje,
        canal: 'EMAIL',
        estado: 'ENVIADO',
        enviado_en: new Date(),
        creado_en: new Date(),
      },
    });

    return res.status(201).json({
      message: 'Correo de verificación enviado correctamente',
    });
  } catch (error) {
    console.error('Error al enviar correo de verificación:', error);

    return res.status(500).json({
      error: 'No se pudo enviar el correo de verificación',
    });
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
      const mensaje = `
Hola.

Recibimos una solicitud para restablecer la contraseña de tu cuenta de SposaBella.

Tu código de recuperación es:

${codigoNormalizado}

Este código es válido durante 30 minutos.

Si no solicitaste este cambio, puedes ignorar este correo.

Saludos,
SposaBella
`.trim();

      await sendEmail({
        to: correo,
        subject: titulo,
        text: mensaje,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Restablecimiento de contraseña</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de <strong>SposaBella</strong>.</p>
            <p>Tu código de recuperación es:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
              ${codigoNormalizado}
            </div>
            <p>Este código es válido durante 30 minutos.</p>
            <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
            <p>Saludos,<br><strong>SposaBella</strong></p>
          </div>
        `,
      });

      await prisma.notificaciones.create({
        data: {
          usuario_id: BigInt(usuario_id),
          tipo: 'RECUPERACION_CONTRASENA',
          titulo,
          mensaje,
          canal: 'EMAIL',
          estado: 'ENVIADO',
          enviado_en: new Date(),
          creado_en: new Date(),
        },
      });

      return res.status(201).json({
        message: 'Correo de recuperación enviado correctamente',
      });
    } catch (error) {
      console.error('Error al enviar correo de recuperación:', error);

      return res.status(500).json({
        error: 'No se pudo enviar el correo de recuperación',
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
      const mensaje = `
Hola.

La contraseña de tu cuenta de SposaBella fue modificada correctamente.

Si no realizaste este cambio, comunícate con soporte lo antes posible.

Saludos,
SposaBella
`.trim();

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

      await prisma.notificaciones.create({
        data: {
          usuario_id: BigInt(usuario_id),
          tipo: 'CONTRASENA_MODIFICADA',
          titulo,
          mensaje,
          canal: 'EMAIL',
          estado: 'ENVIADO',
          enviado_en: new Date(),
          creado_en: new Date(),
        },
      });

      return res.status(201).json({
        message: 'Confirmación de cambio de contraseña enviada correctamente',
      });
    } catch (error) {
      console.error(
        'Error al enviar confirmación de cambio de contraseña:',
        error,
      );

      return res.status(500).json({
        error: 'No se pudo enviar la confirmación de cambio de contraseña',
      });
    }
  },
);

app.get('/notificaciones', async (req, res) => {
  try {
    const notificaciones = await prisma.notificaciones.findMany();

    res.json(notificaciones);
  } catch (error) {
    console.error('Error al consultar notificaciones:', error);

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
