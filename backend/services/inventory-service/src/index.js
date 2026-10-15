
require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const app = express();
const port = Number(process.env.PORT || 4004);

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const adapter = new PrismaMariaDb({
  host: 'mysql-inventory',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_inventory',
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

function serializar(data) {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
}

function parseId(value, nombre = 'ID') {
  try {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
      throw new Error();
    }

    const id = BigInt(value);

    if (id <= 0n) {
      throw new Error(`${nombre} debe ser válido`);
    }

    return id;
  } catch {
    throw new Error(`${nombre} debe ser válido`);
  }
}

function texto(value, campo, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${campo} debe ser texto`);
  }

  const resultado = value.trim().replace(/\s+/g, ' ');

  if (!resultado) {
    return null;
  }

  if (resultado.length > maxLength) {
    throw new Error(
      `${campo} no puede superar los ${maxLength} caracteres`,
    );
  }

  return resultado;
}

function textoObligatorio(value, campo, maxLength) {
  const resultado = texto(value, campo, maxLength);

  if (!resultado) {
    throw new Error(`${campo} es obligatorio`);
  }

  return resultado;
}

function normalizarTelefono(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const telefono = String(value).trim();

  if (!/^\d{8,9}$/.test(telefono)) {
    throw new Error('El teléfono debe contener entre 8 y 9 dígitos');
  }

  return telefono;
}

function normalizarCorreo(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const correo = String(value).trim().toLowerCase();

  if (correo.length > 150) {
    throw new Error('El correo no puede superar los 150 caracteres');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error('El correo electrónico no tiene un formato válido');
  }

  return correo;
}

function enteroPositivo(value, campo) {
  const numero = Number(value);

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new Error(`${campo} debe ser un número entero mayor que 0`);
  }

  return numero;
}

function enteroNoNegativo(value, campo) {
  const numero = Number(value);

  if (!Number.isInteger(numero) || numero < 0) {
    throw new Error(`${campo} debe ser un número entero mayor o igual a 0`);
  }

  return numero;
}

function decimalPositivo(value, campo) {
  const numero = Number(value);

  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error(`${campo} debe ser mayor que 0`);
  }

  return Math.round((numero + Number.EPSILON) * 100) / 100;
}

function fechaValida(value, campo = 'La fecha') {
  if (!value) {
    return new Date();
  }

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`${campo} no es válida`);
  }

  return fecha;
}

function validarTipoMovimiento(tipo) {
  const tipos = ['ENTRADA', 'SALIDA', 'AJUSTE'];

  if (!tipos.includes(tipo)) {
    throw new Error(
      `Tipo de movimiento inválido. Valores permitidos: ${tipos.join(', ')}`,
    );
  }

  return tipo;
}

function validarEstadoProveedor(estado) {
  if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
    throw new Error('El estado debe ser ACTIVO o INACTIVO');
  }

  return estado;
}

function validarEstadoCompra(estado) {
  if (!['REGISTRADA', 'ANULADA'].includes(estado)) {
    throw new Error('El estado de compra debe ser REGISTRADA o ANULADA');
  }

  return estado;
}

/* =========================================================
   HEALTH
   ========================================================= */

app.get('/health', (req, res) => {
  res.json({
    service: 'inventory-service',
    status: 'ok',
    port,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'inventory-service',
    message: 'Microservice ready',
  });
});

/* =========================================================
   EXISTENCIAS
   ========================================================= */

/* =========================================================
   CANAL INTERNO SALES-SERVICE -> INVENTORY-SERVICE
   ========================================================= */

function validarSecretoVentas(req, res, next) {
  const expected = process.env.SALES_INVENTORY_INTERNAL_SECRET;
  const provided = req.get('x-sales-inventory-secret');

  if (!expected) {
    return res.status(503).json({
      error: 'Canal interno de ventas no configurado',
    });
  }

  if (
    typeof provided !== 'string' ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !require('node:crypto').timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(expected),
    )
  ) {
    return res.status(401).json({
      error: 'Credencial interna inválida',
    });
  }

  return next();
}

app.get(
  '/internal/ventas/movimientos',
  validarSecretoVentas,
  async (req, res) => {
    try {
      const variante_producto_id = parseId(
        req.query.variante_producto_id,
        'variante_producto_id',
      );

      const movimientos = await prisma.movimientos_inventario.findMany({
        where: { variante_producto_id },
        orderBy: { id: 'desc' },
      });

      return res.json(serializar(movimientos));
    } catch (error) {
      console.error(
        'Error al consultar movimientos internos de ventas:',
        error,
      );

      return res.status(400).json({
        error: error.message || 'No se pudieron consultar los movimientos',
      });
    }
  },
);

app.post(
  '/internal/ventas/movimientos',
  validarSecretoVentas,
  async (req, res) => {
    const body = req.body || {};
    let variante_producto_id;
    let tipo_movimiento;
    let cantidad;
    let referencia_id;
    let motivo;
    let idempotency_key;

    try {
      try {
        variante_producto_id = parseId(
          body.variante_producto_id,
          'variante_producto_id',
        );

        tipo_movimiento = body.tipo_movimiento;

        if (!['ENTRADA', 'SALIDA'].includes(tipo_movimiento)) {
          return res.status(400).json({
            error: 'El canal de ventas solo permite ENTRADA y SALIDA',
          });
        }

        cantidad = enteroPositivo(body.cantidad, 'La cantidad');
        if (cantidad > 2147483647) {
          return res.status(400).json({
            error: 'La cantidad supera el límite permitido',
          });
        }

        if (body.referencia_tipo !== 'VENTA') {
          return res.status(400).json({
            error: 'La referencia debe corresponder a una venta',
          });
        }

        referencia_id = parseId(
          body.referencia_id,
          'referencia_id',
        );

        motivo = textoObligatorio(body.motivo, 'El motivo', 255);

        idempotency_key = textoObligatorio(
          body.idempotency_key,
          'La clave de idempotencia',
          191,
        );
      } catch (error) {
        if (!error.status) error.status = 400;
        throw error;
      }

      const coincideSolicitud = (movimiento) =>
        movimiento.variante_producto_id === variante_producto_id &&
        movimiento.tipo_movimiento === tipo_movimiento &&
        movimiento.cantidad === cantidad &&
        movimiento.referencia_tipo === 'VENTA' &&
        movimiento.referencia_id === referencia_id &&
        (movimiento.motivo ?? null) === motivo;

      const responderRepeticion = async (movimiento) => {
        if (!coincideSolicitud(movimiento)) {
          return res.status(409).json({
            error: 'La clave de idempotencia ya fue utilizada con datos diferentes',
          });
        }

        const existencia = await prisma.existencias.findUnique({
          where: { variante_producto_id },
        });

        return res.status(200).json(serializar({
          existencia: existencia || null,
          movimiento,
          repetido: true,
        }));
      };

      // Vía rápida para reintentos que ya fueron completados.
      const movimientoExistente =
        await prisma.movimientos_inventario.findUnique({
          where: { idempotency_key },
        });

      if (movimientoExistente) {
        return await responderRepeticion(movimientoExistente);
      }

      let resultado;

      try {
        resultado = await prisma.$transaction(async (tx) => {
          const existencia = await tx.existencias.findUnique({
            where: { variante_producto_id },
          });

          if (!existencia) {
            const error = new Error(
              'No existe inventario para esta variante de producto',
            );
            error.status = 404;
            throw error;
          }

          // Bloquea la fila para serializar modificaciones del stock.
          const filas = await tx.$queryRaw`
            SELECT id, cantidad
            FROM existencias
            WHERE id = ${existencia.id}
            FOR UPDATE
          `;

          if (!filas.length) {
            const error = new Error('Existencia no encontrada');
            error.status = 404;
            throw error;
          }

          const cantidadActual = Number(filas[0].cantidad);
          if (!Number.isSafeInteger(cantidadActual) || cantidadActual < 0) {
            const error = new Error('La existencia tiene un valor inválido');
            error.status = 409;
            throw error;
          }

          const delta = tipo_movimiento === 'ENTRADA'
            ? cantidad
            : -cantidad;
          const nuevaCantidad = cantidadActual + delta;

          if (nuevaCantidad < 0 || nuevaCantidad > 2147483647) {
            const error = new Error(
              nuevaCantidad < 0
                ? 'Stock insuficiente para realizar la salida'
                : 'La existencia supera el límite permitido',
            );
            error.status = 409;
            throw error;
          }

          const existenciaActualizada = await tx.existencias.update({
            where: { id: existencia.id },
            data: {
              cantidad: nuevaCantidad,
              actualizado_en: new Date(),
            },
          });

          // La actualización de stock y el movimiento son atómicos.
          const movimiento = await tx.movimientos_inventario.create({
            data: {
              variante_producto_id,
              tipo_movimiento,
              cantidad,
              referencia_tipo: 'VENTA',
              referencia_id,
              motivo,
              idempotency_key,
              creado_en: new Date(),
            },
          });

          return {
            existencia: existenciaActualizada,
            movimiento,
          };
        });
      } catch (error) {
        // Si otra solicitud ganó la carrera por la clave única,
        // la transacción perdedora debe haberse revertido.
        if (error.code === 'P2002') {
          const ganador =
            await prisma.movimientos_inventario.findUnique({
              where: { idempotency_key },
            });

          if (ganador) {
            return await responderRepeticion(ganador);
          }
        }

        throw error;
      }

      return res.status(201).json(serializar(resultado));
    } catch (error) {
      console.error(
        'Error al registrar movimiento interno de ventas:',
        { code: error.code, status: error.status, name: error.name },
      );

      const status = error.status || 500;

      return res.status(status).json({
        error: status < 500
          ? error.message
          : 'No se pudo registrar el movimiento',
      });
    }
  },
);
/* =========================================================
   Validación de autorización mediante users-service
   ========================================================= */

app.use(async (req, res, next) => {
  const method = req.method.toUpperCase();
  const path = req.path;

  // Las rutas públicas /health y / ya fueron registradas arriba.
  let permission = null;

  if (
    ['GET', 'HEAD'].includes(method) &&
    (
      /^\/existencias\/?$/.test(path) ||
      /^\/existencias\/[^/]+\/?$/.test(path) ||
      /^\/movimientos\/?$/.test(path) ||
      /^\/proveedores\/?$/.test(path) ||
      /^\/proveedores\/[^/]+\/?$/.test(path) ||
      /^\/compras\/?$/.test(path) ||
      /^\/compras\/[^/]+\/?$/.test(path)
    )
  ) {
    permission = 'INVENTARIO_LEER';
  } else if (
    method === 'POST' &&
    /^\/(existencias|movimientos|proveedores|compras)\/?$/.test(path)
  ) {
    permission = 'INVENTARIO_EDITAR';
  } else if (
    method === 'PUT' &&
    (
      /^\/existencias\/[^/]+\/?$/.test(path) ||
      /^\/proveedores\/[^/]+\/?$/.test(path)
    )
  ) {
    permission = 'INVENTARIO_EDITAR';
  } else if (
    method === 'PATCH' &&
    (
      /^\/proveedores\/[^/]+\/estado\/?$/.test(path) ||
      /^\/compras\/[^/]+\/anular\/?$/.test(path)
    )
  ) {
    permission = 'INVENTARIO_EDITAR';
  }

  // Denegar por defecto métodos y rutas no reconocidos.
  if (!permission) {
    return res.status(403).json({
      error: 'Operación no autorizada',
    });
  }

  const authorization = req.get('authorization');

  if (
    typeof authorization !== 'string' ||
    !/^Bearer\s+\S+$/i.test(authorization)
  ) {
    return res.status(401).json({
      error: 'Token de acceso requerido',
    });
  }

  const usersServiceUrl = process.env.USERS_SERVICE_URL;
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET;

  if (!usersServiceUrl || !internalSecret) {
    console.error('La validación de autorización no está configurada.');

    return res.status(503).json({
      error: 'Servicio de autorización no disponible',
    });
  }

  try {
    const authResponse = await fetch(
      `${usersServiceUrl.replace(/\/+$/, '')}/internal/auth/validate`,
      {
        method: 'POST',
        headers: {
          authorization: authorization,
          'x-internal-service-key': internalSecret,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ permission }),
        signal: AbortSignal.timeout(5000),
      },
    );

    let authResult;

    try {
      authResult = await authResponse.json();
    } catch {
      console.error('users-service devolvió una respuesta no válida.');

      return res.status(503).json({
        error: 'No se pudo verificar la autorización',
      });
    }

    if (authResponse.status === 401) {
      return res.status(401).json({
        error: authResult.error || 'Token inválido o expirado',
      });
    }

    if (authResponse.status === 403) {
      return res.status(403).json({
        error: authResult.error || 'Permiso insuficiente',
      });
    }

    if (!authResponse.ok || authResult.valid !== true) {
      console.error(
        'users-service no pudo confirmar la autorización.',
        authResponse.status,
      );

      return res.status(503).json({
        error: 'No se pudo verificar la autorización',
      });
    }

    req.authenticatedUser = authResult.user;
    req.requiredPermission = permission;

    return next();
  } catch (error) {
    console.error(
      'Error al consultar users-service:',
      error.name || 'Error',
    );

    return res.status(503).json({
      error: 'Servicio de autorización no disponible',
    });
  }
});

app.get('/existencias', async (req, res) => {
  try {
    const { stock_bajo, variante_producto_id } = req.query;

    let where = {};

    if (variante_producto_id) {
      where.variante_producto_id = parseId(
        variante_producto_id,
        'variante_producto_id',
      );
    }

    let existencias = await prisma.existencias.findMany({
      where,
      orderBy: {
        id: 'desc',
      },
    });

    if (stock_bajo === 'true') {
      existencias = existencias.filter(
        (item) => item.cantidad <= item.cantidad_minima,
      );
    }

    return res.json(serializar(existencias));
  } catch (error) {
    console.error('Error al consultar existencias:', error);

    return res.status(400).json({
      error: error.message || 'No se pudieron consultar las existencias',
    });
  }
});

app.get('/existencias/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);

    const existencia = await prisma.existencias.findUnique({
      where: { id },
    });

    if (!existencia) {
      return res.status(404).json({
        error: 'Existencia no encontrada',
      });
    }

    return res.json(serializar(existencia));
  } catch (error) {
    console.error('Error al consultar existencia:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo consultar la existencia',
    });
  }
});

app.post('/existencias', async (req, res) => {
  try {
    const variante_producto_id = parseId(
      req.body.variante_producto_id,
      'variante_producto_id',
    );

    const cantidad = enteroNoNegativo(
      req.body.cantidad ?? 0,
      'La cantidad',
    );

    const cantidad_minima = enteroNoNegativo(
      req.body.cantidad_minima ?? 0,
      'La cantidad mínima',
    );

    const existente = await prisma.existencias.findUnique({
      where: {
        variante_producto_id,
      },
    });

    if (existente) {
      return res.status(409).json({
        error: 'Ya existe una existencia para esta variante de producto',
      });
    }

    const existencia = await prisma.existencias.create({
      data: {
        variante_producto_id,
        cantidad,
        cantidad_minima,
        actualizado_en: new Date(),
      },
    });

    return res.status(201).json(serializar(existencia));
  } catch (error) {
    console.error('Error al crear existencia:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo crear la existencia',
    });
  }
});

app.put('/existencias/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);

    const existente = await prisma.existencias.findUnique({
      where: { id },
    });

    if (!existente) {
      return res.status(404).json({
        error: 'Existencia no encontrada',
      });
    }

    const cantidad_minima = enteroNoNegativo(
      req.body.cantidad_minima,
      'La cantidad mínima',
    );

    const existencia = await prisma.existencias.update({
      where: { id },
      data: {
        cantidad_minima,
        actualizado_en: new Date(),
      },
    });

    return res.json(serializar(existencia));
  } catch (error) {
    console.error('Error al actualizar existencia:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo actualizar la existencia',
    });
  }
});

/* =========================================================
   MOVIMIENTOS DE INVENTARIO
   ========================================================= */

app.get('/movimientos', async (req, res) => {
  try {
    const { variante_producto_id, tipo_movimiento } = req.query;

    const where = {};

    if (variante_producto_id) {
      where.variante_producto_id = parseId(
        variante_producto_id,
        'variante_producto_id',
      );
    }

    if (tipo_movimiento) {
      where.tipo_movimiento = validarTipoMovimiento(tipo_movimiento);
    }

    const movimientos = await prisma.movimientos_inventario.findMany({
      where,
      orderBy: {
        id: 'desc',
      },
    });

    return res.json(serializar(movimientos));
  } catch (error) {
    console.error('Error al consultar movimientos:', error);

    return res.status(400).json({
      error: error.message || 'No se pudieron consultar los movimientos',
    });
  }
});

app.post('/movimientos', async (req, res) => {
  try {
    const variante_producto_id = parseId(
      req.body.variante_producto_id,
      'variante_producto_id',
    );

    const tipo_movimiento = validarTipoMovimiento(
      req.body.tipo_movimiento,
    );

    const cantidad = enteroPositivo(
      req.body.cantidad,
      'La cantidad',
    );

    const referencia_tipo = texto(
      req.body.referencia_tipo,
      'El tipo de referencia',
      30,
    );

    const referencia_id = req.body.referencia_id
      ? parseId(req.body.referencia_id, 'referencia_id')
      : null;

    const motivo = texto(
      req.body.motivo,
      'El motivo',
      255,
    );

    const existencia = await prisma.existencias.findUnique({
      where: {
        variante_producto_id,
      },
    });

    if (!existencia) {
      return res.status(404).json({
        error: 'No existe inventario para esta variante de producto',
      });
    }

    let nuevaCantidad = existencia.cantidad;

    if (tipo_movimiento === 'ENTRADA') {
      nuevaCantidad += cantidad;
    }

    if (tipo_movimiento === 'SALIDA') {
      nuevaCantidad -= cantidad;

      if (nuevaCantidad < 0) {
        return res.status(409).json({
          error: 'Stock insuficiente para realizar la salida',
        });
      }
    }

    if (tipo_movimiento === 'AJUSTE') {
      nuevaCantidad = cantidad;
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const existenciaActualizada = await tx.existencias.update({
        where: {
          id: existencia.id,
        },
        data: {
          cantidad: nuevaCantidad,
          actualizado_en: new Date(),
        },
      });

      const movimiento = await tx.movimientos_inventario.create({
        data: {
          variante_producto_id,
          tipo_movimiento,
          cantidad:
            tipo_movimiento === 'AJUSTE'
              ? nuevaCantidad - existencia.cantidad
              : cantidad,
          referencia_tipo,
          referencia_id,
          motivo,
          creado_en: new Date(),
        },
      });

      return {
        existencia: existenciaActualizada,
        movimiento,
      };
    });

    return res.status(201).json(serializar(resultado));
  } catch (error) {
    console.error('Error al registrar movimiento:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo registrar el movimiento',
    });
  }
});

/* =========================================================
   PROVEEDORES
   ========================================================= */

app.get('/proveedores', async (req, res) => {
  try {
    const { buscar, estado } = req.query;

    const where = {};

    if (buscar) {
      where.OR = [
        {
          nombre: {
            contains: String(buscar),
          },
        },
        {
          telefono: {
            contains: String(buscar),
          },
        },
        {
          correo: {
            contains: String(buscar),
          },
        },
      ];
    }

    if (estado) {
      where.estado = validarEstadoProveedor(String(estado));
    }

    const proveedores = await prisma.proveedores.findMany({
      where,
      include: {
        compras: {
          orderBy: {
            id: 'desc',
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });

    return res.json(serializar(proveedores));
  } catch (error) {
    console.error('Error al consultar proveedores:', error);

    return res.status(400).json({
      error: error.message || 'No se pudieron consultar los proveedores',
    });
  }
});

app.get('/proveedores/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);

    const proveedor = await prisma.proveedores.findUnique({
      where: { id },
      include: {
        compras: {
          orderBy: {
            id: 'desc',
          },
        },
      },
    });

    if (!proveedor) {
      return res.status(404).json({
        error: 'Proveedor no encontrado',
      });
    }

    return res.json(serializar(proveedor));
  } catch (error) {
    console.error('Error al consultar proveedor:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo consultar el proveedor',
    });
  }
});

app.post('/proveedores', async (req, res) => {
  try {
    const nombre = textoObligatorio(
      req.body.nombre,
      'El nombre',
      150,
    );

    const telefono = normalizarTelefono(req.body.telefono);
    const correo = normalizarCorreo(req.body.correo);

    const direccion = texto(
      req.body.direccion,
      'La dirección',
      255,
    );

    const proveedor = await prisma.proveedores.create({
      data: {
        nombre,
        telefono,
        correo,
        direccion,
        estado: 'ACTIVO',
        creado_en: new Date(),
        actualizado_en: new Date(),
      },
    });

    return res.status(201).json(serializar(proveedor));
  } catch (error) {
    console.error('Error al crear proveedor:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo crear el proveedor',
    });
  }
});

app.put('/proveedores/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);

    const proveedorActual = await prisma.proveedores.findUnique({
      where: { id },
    });

    if (!proveedorActual) {
      return res.status(404).json({
        error: 'Proveedor no encontrado',
      });
    }

    const nombre = textoObligatorio(
      req.body.nombre,
      'El nombre',
      150,
    );

    const telefono = normalizarTelefono(req.body.telefono);
    const correo = normalizarCorreo(req.body.correo);

    const direccion = texto(
      req.body.direccion,
      'La dirección',
      255,
    );

    const proveedor = await prisma.proveedores.update({
      where: { id },
      data: {
        nombre,
        telefono,
        correo,
        direccion,
        actualizado_en: new Date(),
      },
    });

    return res.json(serializar(proveedor));
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo actualizar el proveedor',
    });
  }
});

app.patch('/proveedores/:id/estado', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const estado = validarEstadoProveedor(req.body.estado);

    const proveedorActual = await prisma.proveedores.findUnique({
      where: { id },
    });

    if (!proveedorActual) {
      return res.status(404).json({
        error: 'Proveedor no encontrado',
      });
    }

    const proveedor = await prisma.proveedores.update({
      where: { id },
      data: {
        estado,
        actualizado_en: new Date(),
      },
    });

    return res.json(serializar(proveedor));
  } catch (error) {
    console.error('Error al cambiar estado del proveedor:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo cambiar el estado del proveedor',
    });
  }
});

/* =========================================================
   COMPRAS
   ========================================================= */

app.get('/compras', async (req, res) => {
  try {
    const { proveedor_id, estado } = req.query;

    const where = {};

    if (proveedor_id) {
      where.proveedor_id = parseId(
        proveedor_id,
        'proveedor_id',
      );
    }

    if (estado) {
      where.estado = validarEstadoCompra(String(estado));
    }

    const compras = await prisma.compras.findMany({
      where,
      include: {
        proveedores: true,
        detalle_compras: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    return res.json(serializar(compras));
  } catch (error) {
    console.error('Error al consultar compras:', error);

    return res.status(400).json({
      error: error.message || 'No se pudieron consultar las compras',
    });
  }
});

app.get('/compras/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);

    const compra = await prisma.compras.findUnique({
      where: { id },
      include: {
        proveedores: true,
        detalle_compras: true,
      },
    });

    if (!compra) {
      return res.status(404).json({
        error: 'Compra no encontrada',
      });
    }

    return res.json(serializar(compra));
  } catch (error) {
    console.error('Error al consultar compra:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo consultar la compra',
    });
  }
});

app.post('/compras', async (req, res) => {
  try {
    const proveedor_id = parseId(
      req.body.proveedor_id,
      'proveedor_id',
    );

    const fecha_compra = fechaValida(
      req.body.fecha_compra,
      'La fecha de compra',
    );

    const detalles = req.body.detalles;

    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        error: 'La compra debe contener al menos un detalle',
      });
    }

    const proveedor = await prisma.proveedores.findUnique({
      where: { id: proveedor_id },
    });

    if (!proveedor) {
      return res.status(404).json({
        error: 'Proveedor no encontrado',
      });
    }

    if (proveedor.estado !== 'ACTIVO') {
      return res.status(409).json({
        error: 'No se puede registrar una compra con un proveedor inactivo',
      });
    }

    const detallesNormalizados = detalles.map((detalle, index) => {
      const variante_producto_id = parseId(
        detalle.variante_producto_id,
        `variante_producto_id del detalle ${index + 1}`,
      );

      const cantidad = enteroPositivo(
        detalle.cantidad,
        `La cantidad del detalle ${index + 1}`,
      );

      const costo_unitario = decimalPositivo(
        detalle.costo_unitario,
        `El costo unitario del detalle ${index + 1}`,
      );

      const subtotal = Math.round(
        (cantidad * costo_unitario + Number.EPSILON) * 100,
      ) / 100;

      return {
        variante_producto_id,
        cantidad,
        costo_unitario,
        subtotal,
      };
    });

    const total = Math.round(
      (
        detallesNormalizados.reduce(
          (suma, detalle) => suma + detalle.subtotal,
          0,
        ) + Number.EPSILON
      ) * 100,
    ) / 100;

    const resultado = await prisma.$transaction(async (tx) => {
      const compra = await tx.compras.create({
        data: {
          proveedor_id,
          fecha_compra,
          estado: 'REGISTRADA',
          total,
          creado_en: new Date(),
          actualizado_en: new Date(),
        },
      });

      for (const detalle of detallesNormalizados) {
        await tx.detalle_compras.create({
          data: {
            compra_id: compra.id,
            variante_producto_id: detalle.variante_producto_id,
            cantidad: detalle.cantidad,
            costo_unitario: detalle.costo_unitario,
            subtotal: detalle.subtotal,
          },
        });

        const existencia =
          await tx.existencias.findUnique({
            where: {
              variante_producto_id:
                detalle.variante_producto_id,
            },
          });

        if (!existencia) {
          await tx.existencias.create({
            data: {
              variante_producto_id:
                detalle.variante_producto_id,
              cantidad: detalle.cantidad,
              cantidad_minima: 0,
              actualizado_en: new Date(),
            },
          });
        } else {
          await tx.existencias.update({
            where: {
              id: existencia.id,
            },
            data: {
              cantidad: existencia.cantidad + detalle.cantidad,
              actualizado_en: new Date(),
            },
          });
        }

        await tx.movimientos_inventario.create({
          data: {
            variante_producto_id:
              detalle.variante_producto_id,
            tipo_movimiento: 'ENTRADA',
            cantidad: detalle.cantidad,
            referencia_tipo: 'COMPRA',
            referencia_id: compra.id,
            motivo: `Entrada por compra #${compra.id}`,
            creado_en: new Date(),
          },
        });
      }

      return tx.compras.findUnique({
        where: {
          id: compra.id,
        },
        include: {
          proveedores: true,
          detalle_compras: true,
        },
      });
    });

    return res.status(201).json(serializar(resultado));
  } catch (error) {
    console.error('Error al registrar compra:', error);

    return res.status(400).json({
      error: error.message || 'No se pudo registrar la compra',
    });
  }
});

app.patch('/compras/:id/anular', async (req, res) => {
  try {
    const id = parseId(req.params.id);

    const compra = await prisma.compras.findUnique({
      where: { id },
      include: {
        detalle_compras: true,
      },
    });

    if (!compra) {
      return res.status(404).json({
        error: 'Compra no encontrada',
      });
    }

    if (compra.estado === 'ANULADA') {
      return res.status(409).json({
        error: 'La compra ya se encuentra anulada',
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      for (const detalle of compra.detalle_compras) {
        const existencia = await tx.existencias.findUnique({
          where: {
            variante_producto_id:
              detalle.variante_producto_id,
          },
        });

        if (!existencia) {
          throw new Error(
            `No existe inventario para la variante ${detalle.variante_producto_id}`,
          );
        }

        if (existencia.cantidad < detalle.cantidad) {
          throw new Error(
            `No se puede anular la compra porque la variante ${detalle.variante_producto_id} ya no tiene stock suficiente para revertirla`,
          );
        }

        await tx.existencias.update({
          where: {
            id: existencia.id,
          },
          data: {
            cantidad:
              existencia.cantidad - detalle.cantidad,
            actualizado_en: new Date(),
          },
        });

        await tx.movimientos_inventario.create({
          data: {
            variante_producto_id:
              detalle.variante_producto_id,
            tipo_movimiento: 'SALIDA',
            cantidad: detalle.cantidad,
            referencia_tipo: 'COMPRA',
            referencia_id: compra.id,
            motivo: `Reversión de compra #${compra.id}`,
            creado_en: new Date(),
          },
        });
      }

      return tx.compras.update({
        where: {
          id,
        },
        data: {
          estado: 'ANULADA',
          actualizado_en: new Date(),
        },
        include: {
          proveedores: true,
          detalle_compras: true,
        },
      });
    });

    return res.json(serializar(resultado));
  } catch (error) {
    console.error('Error al anular compra:', error);

    return res.status(409).json({
      error: error.message || 'No se pudo anular la compra',
    });
  }
});

/* =========================================================
   START
   ========================================================= */

app.listen(port, () => {
  console.log(`inventory-service running on port ${port}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
