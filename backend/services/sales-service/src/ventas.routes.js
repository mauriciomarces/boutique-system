const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:4004';
const INVENTORY_REQUEST_TIMEOUT_MS = Math.max(
  1,
  Number.parseInt(process.env.INVENTORY_REQUEST_TIMEOUT_MS, 10) || 15000,
);
const ANULACION_LEASE_MS = 120000;

class LeaseAnulacionPerdidoError extends Error {
  constructor() {
    super('Se perdió la propiedad de la operación de anulación.');
    this.name = 'LeaseAnulacionPerdidoError';
  }
}

function parseId(value, fieldName = 'id') {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    (typeof value === 'number' && !Number.isSafeInteger(value)) ||
    !/^\d+$/.test(String(value))
  ) {
    const error = new Error(`${fieldName} debe ser un identificador válido`);
    error.status = 400;
    throw error;
  }

  const id = BigInt(value);

  if (id <= 0n) {
    const error = new Error(`${fieldName} debe ser mayor que cero`);
    error.status = 400;
    throw error;
  }

  return id;
}

function enteroPositivo(value, fieldName) {
  const numero = Number(value);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`${fieldName} debe ser un entero mayor que cero`);
  }

  return numero;
}

function decimalPositivo(value, fieldName) {
  const numero = Number(value);

  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error(`${fieldName} debe ser mayor que cero`);
  }

  return Number(numero.toFixed(2));
}

function fechaValida(value) {
  if (value === undefined || value === null || value === '') {
    return new Date();
  }

  const fecha = new Date(value);

  if (Number.isNaN(fecha.getTime())) {
    throw new Error('La fecha de venta no es válida');
  }

  return fecha;
}

function validarEstadoVenta(value) {
  if (!['PENDIENTE', 'CONFIRMADA', 'ANULADA'].includes(value)) {
    const error = new Error('Estado de venta inválido');
    error.status = 400;
    throw error;
  }

  return value;
}

function validarMetodoPago(value) {
  if (typeof value !== 'string') {
    throw new Error('El método de pago es obligatorio');
  }

  const metodo = value.trim().replace(/\s+/g, ' ');

  if (!metodo) {
    throw new Error('El método de pago es obligatorio');
  }

  if (metodo.length > 50) {
    throw new Error(
      'El método de pago no puede superar los 50 caracteres',
    );
  }

  return metodo.toUpperCase();
}

async function inventoryRequest(path, options = {}) {
  const internalSecret = process.env.SALES_INVENTORY_INTERNAL_SECRET;
  const {
    timeoutMs = INVENTORY_REQUEST_TIMEOUT_MS,
    ...fetchOptions
  } = options;

  if (!internalSecret) {
    throw new Error(
      'SALES_INVENTORY_INTERNAL_SECRET no está configurado',
    );
  }

  const response = await fetch(
    `${INVENTORY_SERVICE_URL}${path}`,
    {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        'x-sales-inventory-secret': internalSecret,
        ...(fetchOptions.headers || {}),
      },
      signal: fetchOptions.signal || AbortSignal.timeout(timeoutMs),
    },
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && data.error
        ? data.error
        : `Inventory-service respondió con HTTP ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

module.exports = function registrarRutasVentas(app, prisma) {
  /*
   * =========================================================
   * VENTAS
   * =========================================================
   */

  app.get('/ventas/:id', async (req, res) => {
    try {
      const id = parseId(req.params.id);

      const venta = await prisma.ventas.findUnique({
        where: { id },
        include: {
          clientes: true,
          detalle_ventas: true,
          pagos: true,
        },
      });

      if (!venta) {
        return res.status(404).json({
          error: 'Venta no encontrada',
        });
      }

      return res.json(venta);
    } catch (error) {
      console.error('Error al consultar venta:', error);

      return res.status(400).json({
        error: error.message || 'No se pudo consultar la venta',
      });
    }
  });

  app.post('/ventas', async (req, res) => {
    const body = req.body || {};

    let ventaCreada = null;
    const movimientosRealizados = [];

    try {
      /*
       * -------------------------------------------------------
       * 1. Validación de cliente
       * -------------------------------------------------------
       */

      let clienteId = null;

      if (
        body.cliente_id !== undefined &&
        body.cliente_id !== null &&
        body.cliente_id !== ''
      ) {
        clienteId = parseId(body.cliente_id, 'cliente_id');

        const cliente = await prisma.clientes.findUnique({
          where: {
            id: clienteId,
          },
        });

        if (!cliente) {
          return res.status(404).json({
            error: 'Cliente no encontrado',
          });
        }

        if (cliente.estado !== 'ACTIVO') {
          return res.status(409).json({
            error: 'El cliente seleccionado está inactivo',
          });
        }
      }

      /*
       * -------------------------------------------------------
       * 2. Validación de detalles
       * -------------------------------------------------------
       */

      if (!Array.isArray(body.detalles) || body.detalles.length === 0) {
        return res.status(400).json({
          error: 'La venta debe contener al menos un detalle',
        });
      }

      const detalles = body.detalles.map((detalle, index) => {
        const variante_producto_id = parseId(
          detalle.variante_producto_id,
          `detalles[${index}].variante_producto_id`,
        );

        const cantidad = enteroPositivo(
          detalle.cantidad,
          `detalles[${index}].cantidad`,
        );

        const precio_unitario = decimalPositivo(
          detalle.precio_unitario,
          `detalles[${index}].precio_unitario`,
        );

        const subtotal = Number(
          (cantidad * precio_unitario).toFixed(2),
        );

        return {
          variante_producto_id,
          cantidad,
          precio_unitario,
          subtotal,
        };
      });

      /*
       * -------------------------------------------------------
       * 3. Evitar variantes repetidas
       * -------------------------------------------------------
       */

      const variantes = new Set(
        detalles.map((detalle) =>
          detalle.variante_producto_id.toString(),
        ),
      );

      if (variantes.size !== detalles.length) {
        return res.status(400).json({
          error:
            'No se permite repetir una variante de producto dentro de la misma venta',
        });
      }

      /*
       * -------------------------------------------------------
       * 4. Calcular totales en backend
       * -------------------------------------------------------
       */

      const subtotal = Number(
        detalles
          .reduce((total, detalle) => total + detalle.subtotal, 0)
          .toFixed(2),
      );

      const total = subtotal;

      /*
       * -------------------------------------------------------
       * 5. Crear venta PENDIENTE
       * -------------------------------------------------------
       */

      ventaCreada = await prisma.ventas.create({
        data: {
          cliente_id: clienteId,
          fecha_venta: fechaValida(body.fecha_venta),
          estado: 'PENDIENTE',
          subtotal,
          total,
          creado_en: new Date(),
          actualizado_en: new Date(),
          detalle_ventas: {
            create: detalles.map((detalle) => ({
              variante_producto_id: detalle.variante_producto_id,
              cantidad: detalle.cantidad,
              precio_unitario: detalle.precio_unitario,
              subtotal: detalle.subtotal,
            })),
          },
        },
        include: {
          clientes: true,
          detalle_ventas: true,
          pagos: true,
        },
      });

      /*
       * -------------------------------------------------------
       * 6. Descontar inventario
       * -------------------------------------------------------
       */

      try {
        for (const detalle of detalles) {
          const movimiento = await inventoryRequest(
            '/internal/ventas/movimientos',
            {
              method: 'POST',
              body: JSON.stringify({
                variante_producto_id:
                  detalle.variante_producto_id.toString(),
                tipo_movimiento: 'SALIDA',
                cantidad: detalle.cantidad,
                referencia_tipo: 'VENTA',
                referencia_id: ventaCreada.id.toString(),
                motivo: `Salida por venta #${ventaCreada.id}`,
              }),
            },
          );

          movimientosRealizados.push({
            variante_producto_id:
              detalle.variante_producto_id,
            cantidad: detalle.cantidad,
            movimiento,
          });
        }
      } catch (inventoryError) {
        /*
         * -----------------------------------------------------
         * Compensación de movimientos ya realizados
         * -----------------------------------------------------
         */

        for (const movimiento of movimientosRealizados.reverse()) {
          try {
            await inventoryRequest(
              '/internal/ventas/movimientos',
              {
                method: 'POST',
                body: JSON.stringify({
                  variante_producto_id:
                    movimiento.variante_producto_id.toString(),
                  tipo_movimiento: 'ENTRADA',
                  cantidad: movimiento.cantidad,
                  referencia_tipo: 'VENTA',
                  referencia_id: ventaCreada.id.toString(),
                  motivo: `Compensación de venta #${ventaCreada.id}`,
                }),
              },
            );
          } catch (compensacionError) {
            console.error(
              'Error durante la compensación de inventario:',
              compensacionError,
            );
          }
        }

        await prisma.ventas.update({
          where: {
            id: ventaCreada.id,
          },
          data: {
            estado: 'ANULADA',
          },
        });

        return res.status(409).json({
          error: inventoryError.message,
          venta_id: ventaCreada.id.toString(),
        });
      }

      /*
       * -------------------------------------------------------
       * 7. Confirmar venta
       * -------------------------------------------------------
       */

      const ventaConfirmada = await prisma.ventas.update({
        where: {
          id: ventaCreada.id,
        },
        data: {
          estado: 'CONFIRMADA',
        },
        include: {
          clientes: true,
          detalle_ventas: true,
          pagos: true,
        },
      });

      /*
       * -------------------------------------------------------
       * 8. Registrar pago opcional
       * -------------------------------------------------------
       */

      if (body.pago) {
        const metodo_pago = validarMetodoPago(
          body.pago.metodo_pago,
        );

        const monto = decimalPositivo(
          body.pago.monto,
          'El monto del pago',
        );

        if (monto > total) {
          return res.status(400).json({
            error:
              'El monto del pago no puede superar el total de la venta',
          });
        }

        await prisma.pagos.create({
          data: {
            venta_id: ventaConfirmada.id,
            metodo_pago,
            monto,
            estado: monto === total ? 'PAGADO' : 'PENDIENTE',
            fecha_pago: new Date(),
            creado_en: new Date(),
            actualizado_en: new Date(),
          },
        });
      }

      const resultado = await prisma.ventas.findUnique({
        where: {
          id: ventaConfirmada.id,
        },
        include: {
          clientes: true,
          detalle_ventas: true,
          pagos: true,
        },
      });

      return res.status(201).json(resultado);
    } catch (error) {
      console.error('Error al crear venta:', error);

      if (ventaCreada) {
        try {
          await prisma.ventas.update({
            where: {
              id: ventaCreada.id,
            },
            data: {
              estado: 'ANULADA',
            },
          });
        } catch (estadoError) {
          console.error(
            'No se pudo actualizar el estado de la venta:',
            estadoError,
          );
        }
      }

      return res.status(400).json({
        error: error.message || 'No se pudo crear la venta',
      });
    }
  });

  /*
   * =========================================================
   * ESTADO DE VENTA
   * =========================================================
   */

  // Procesa una operacion persistente con lease e idempotencia.
  async function procesarAnulacion(operacionId) {
    const { randomUUID } = require('node:crypto');
    const ahora = new Date();
    const leaseToken = randomUUID();
    const operacionInicial = await prisma.operaciones_anulacion.findUnique({
      where: { id: operacionId },
    });

    if (!operacionInicial) {
      throw new Error('No existe la operación de anulación.');
    }

    if (operacionInicial.estado === 'COMPLETADA') {
      return prisma.operaciones_anulacion.findUnique({
        where: { id: operacionId },
        include: { tareas: true, eventos: { orderBy: { creado_en: 'asc' } } },
      });
    }

    const reclamo = await prisma.operaciones_anulacion.updateMany({
      where: {
        id: operacionId,
        OR: [
          { estado: 'PENDIENTE' },
          { estado: 'REINTENTABLE' },
          {
            estado: 'EN_PROCESO',
            OR: [
              { lease_hasta: { lt: ahora } },
              { lease_hasta: null },
            ],
          },
        ],
      },
      data: {
        estado: 'EN_PROCESO',
        lease_token: leaseToken,
        lease_hasta: new Date(Date.now() + ANULACION_LEASE_MS),
        intentos: { increment: 1 },
        iniciada_en: ahora,
        ultimo_error: null,
      },
    });

    if (reclamo.count === 0) {
      return prisma.operaciones_anulacion.findUnique({
        where: { id: operacionId },
        include: { tareas: true, eventos: { orderBy: { creado_en: 'asc' } } },
      });
    }

    const renovarLease = async (tx) => {
      const ahoraLease = new Date();
      const renovacion = await tx.operaciones_anulacion.updateMany({
        where: {
          id: operacionId,
          estado: 'EN_PROCESO',
          lease_token: leaseToken,
          lease_hasta: { gt: ahoraLease },
        },
        data: {
          lease_hasta: new Date(Date.now() + ANULACION_LEASE_MS),
        },
      });

      if (renovacion.count !== 1) {
        throw new LeaseAnulacionPerdidoError();
      }
    };

    const transaccionConLease = (callback) =>
      prisma.$transaction(callback, { maxWait: 5000, timeout: 10000 });

    try {
      await transaccionConLease(async (tx) => {
        await renovarLease(tx);
        await tx.eventos_anulacion.create({
          data: {
            operacion_id: operacionId,
            tipo_evento: 'ANULACION_INICIADA',
            estado_anterior: operacionInicial.estado,
            estado_nuevo: 'EN_PROCESO',
            mensaje: 'Se inició o reanudó el procesamiento de la anulación.',
          },
        });
      });
    } catch (error) {
      if (!(error instanceof LeaseAnulacionPerdidoError)) throw error;
      return prisma.operaciones_anulacion.findUnique({
        where: { id: operacionId },
        include: { tareas: true, eventos: { orderBy: { creado_en: 'asc' } } },
      });
    }

    const tareas = await prisma.tareas_anulacion.findMany({
      where: { operacion_id: operacionId },
      orderBy: { id: 'asc' },
    });

    if (tareas.length === 0) {
      try {
        await transaccionConLease(async (tx) => {
          await renovarLease(tx);
          const liberacion = await tx.operaciones_anulacion.updateMany({
            where: {
              id: operacionId,
              estado: 'EN_PROCESO',
              lease_token: leaseToken,
            },
            data: {
              estado: 'REINTENTABLE',
              lease_token: null,
              lease_hasta: null,
              ultimo_error: 'La operación no contiene tareas de reversión.',
            },
          });

          if (liberacion.count === 1) {
            await tx.eventos_anulacion.create({
              data: {
                operacion_id: operacionId,
                tipo_evento: 'ANULACION_SIN_TAREAS',
                estado_anterior: 'EN_PROCESO',
                estado_nuevo: 'REINTENTABLE',
                mensaje: 'No se puede completar una anulación sin tareas de reversión.',
              },
            });
          }
        });
      } catch (error) {
        if (!(error instanceof LeaseAnulacionPerdidoError)) throw error;
      }

      return prisma.operaciones_anulacion.findUnique({
        where: { id: operacionId },
        include: { tareas: true, eventos: { orderBy: { creado_en: 'asc' } } },
      });
    }

    for (const tarea of tareas) {
      if (tarea.estado === 'COMPLETADA') continue;

      try {
        const iniciada = await transaccionConLease(async (tx) => {
          await renovarLease(tx);
          const actualizacion = await tx.tareas_anulacion.updateMany({
            where: {
              id: tarea.id,
              operacion_id: operacionId,
              estado: { in: ['PENDIENTE', 'REINTENTABLE', 'EN_PROCESO'] },
            },
            data: {
              estado: 'EN_PROCESO',
              intentos: { increment: 1 },
              iniciada_en: new Date(),
              ultimo_error: null,
            },
          });

          return actualizacion.count === 1;
        });

        if (!iniciada) {
          throw new LeaseAnulacionPerdidoError();
        }

        const respuesta = await inventoryRequest(
          '/internal/ventas/movimientos',
          {
            method: 'POST',
            timeoutMs: INVENTORY_REQUEST_TIMEOUT_MS,
            body: JSON.stringify({
              variante_producto_id: tarea.variante_producto_id.toString(),
              tipo_movimiento: 'ENTRADA',
              cantidad: Number(tarea.cantidad),
              referencia_tipo: 'VENTA',
              referencia_id: operacionInicial.venta_id.toString(),
              motivo: 'Reversión por anulación de venta #' +
                operacionInicial.venta_id.toString(),
              idempotency_key: tarea.idempotency_key,
            }),
          },
        );

        const movimientoId = respuesta?.movimiento?.id;
        let movimientoBigInt;

        try {
          movimientoBigInt = BigInt(movimientoId);
        } catch {
          throw new Error('Inventario devolvió una respuesta no válida.');
        }

        if (movimientoBigInt <= 0n) {
          throw new Error('Inventario devolvió una respuesta no válida.');
        }

        await transaccionConLease(async (tx) => {
          await renovarLease(tx);
          const actualizacion = await tx.tareas_anulacion.updateMany({
            where: {
              id: tarea.id,
              operacion_id: operacionId,
              estado: 'EN_PROCESO',
            },
            data: {
              estado: 'COMPLETADA',
              movimiento_inventario_id: movimientoBigInt,
              completada_en: new Date(),
              ultimo_error: null,
            },
          });

          if (actualizacion.count !== 1) {
            throw new LeaseAnulacionPerdidoError();
          }

          await tx.eventos_anulacion.create({
            data: {
              operacion_id: operacionId,
              tarea_id: tarea.id,
              tipo_evento: respuesta.repetido
                ? 'REVERSA_IDEMPOTENTE_RECONOCIDA'
                : 'REVERSA_INVENTARIO_COMPLETADA',
              estado_anterior: 'EN_PROCESO',
              estado_nuevo: 'COMPLETADA',
              mensaje: respuesta.repetido
                ? 'Inventario confirmó que la reversa ya estaba aplicada.'
                : 'La devolución de inventario fue aplicada.',
              metadata: {
                idempotency_key: tarea.idempotency_key,
                repetido: Boolean(respuesta.repetido),
              },
            },
          });
        });
      } catch (error) {
        if (error instanceof LeaseAnulacionPerdidoError) {
          break;
        }

        const errorSeguro = error.status === 409
          ? 'Inventario rechazó la reversión por un conflicto.'
          : error.name === 'TimeoutError' || error.name === 'AbortError'
            ? 'Se agotó el tiempo de espera al contactar inventario.'
            : 'No se pudo confirmar la reversión en inventario.';

        try {
          await transaccionConLease(async (tx) => {
            await renovarLease(tx);
            const actualizacion = await tx.tareas_anulacion.updateMany({
              where: {
                id: tarea.id,
                operacion_id: operacionId,
                estado: 'EN_PROCESO',
              },
              data: {
                estado: 'REINTENTABLE',
                ultimo_error: errorSeguro,
              },
            });

            if (actualizacion.count !== 1) {
              throw new LeaseAnulacionPerdidoError();
            }

            await tx.eventos_anulacion.create({
              data: {
                operacion_id: operacionId,
                tarea_id: tarea.id,
                tipo_evento: 'REVERSA_INVENTARIO_FALLIDA',
                estado_anterior: 'EN_PROCESO',
                estado_nuevo: 'REINTENTABLE',
                mensaje: errorSeguro,
              },
            });
          });
        } catch (persistenciaError) {
          if (!(persistenciaError instanceof LeaseAnulacionPerdidoError)) {
            throw persistenciaError;
          }
          break;
        }
      }
    }

    const tareasPendientes = await prisma.tareas_anulacion.count({
      where: {
        operacion_id: operacionId,
        estado: { not: 'COMPLETADA' },
      },
    });

    if (tareasPendientes > 0) {
      try {
        await transaccionConLease(async (tx) => {
          await renovarLease(tx);
          const liberacion = await tx.operaciones_anulacion.updateMany({
            where: {
              id: operacionId,
              estado: 'EN_PROCESO',
              lease_token: leaseToken,
            },
            data: {
              estado: 'REINTENTABLE',
              lease_token: null,
              lease_hasta: null,
              ultimo_error: 'Existen tareas pendientes de reintento.',
            },
          });

          if (liberacion.count === 1) {
            await tx.eventos_anulacion.create({
              data: {
                operacion_id: operacionId,
                tipo_evento: 'ANULACION_PENDIENTE_REINTENTO',
                estado_anterior: 'EN_PROCESO',
                estado_nuevo: 'REINTENTABLE',
                mensaje: 'La anulación conserva su progreso y requiere reintento.',
              },
            });
          }
        });
      } catch (error) {
        if (!(error instanceof LeaseAnulacionPerdidoError)) throw error;
      }
    } else {
      try {
        await transaccionConLease(async (tx) => {
          await renovarLease(tx);

          const tareasIncompletas = await tx.tareas_anulacion.count({
            where: {
              operacion_id: operacionId,
              estado: { not: 'COMPLETADA' },
            },
          });

          if (tareasIncompletas > 0) {
            const liberacion = await tx.operaciones_anulacion.updateMany({
              where: {
                id: operacionId,
                estado: 'EN_PROCESO',
                lease_token: leaseToken,
              },
              data: {
                estado: 'REINTENTABLE',
                lease_token: null,
                lease_hasta: null,
                ultimo_error: 'Existen tareas pendientes de reintento.',
              },
            });

            if (liberacion.count !== 1) {
              throw new LeaseAnulacionPerdidoError();
            }

            await tx.eventos_anulacion.create({
              data: {
                operacion_id: operacionId,
                tipo_evento: 'ANULACION_PENDIENTE_REINTENTO',
                estado_anterior: 'EN_PROCESO',
                estado_nuevo: 'REINTENTABLE',
                mensaje: 'La anulación conserva su progreso y requiere reintento.',
              },
            });
            return;
          }

          const actual = await tx.operaciones_anulacion.findUnique({
            where: { id: operacionId },
          });

          if (!actual) throw new Error('No existe la operación de anulación.');

          const venta = await tx.ventas.findUnique({
            where: { id: actual.venta_id },
          });

          if (!venta) throw new Error('La venta asociada ya no existe.');

          if (!['CONFIRMADA', 'ANULADA'].includes(venta.estado)) {
            throw new Error(
              'La venta ya no está CONFIRMADA; se requiere revisión.',
            );
          }

          if (venta.estado === 'CONFIRMADA') {
            const anulacionVenta = await tx.ventas.updateMany({
              where: { id: venta.id, estado: 'CONFIRMADA' },
              data: {
                estado: 'ANULADA',
                actualizado_en: new Date(),
              },
            });

            if (anulacionVenta.count !== 1) {
              throw new Error('La venta cambió de estado durante la anulación.');
            }
          }

          await tx.pagos.updateMany({
            where: { venta_id: venta.id, estado: { not: 'ANULADO' } },
            data: {
              estado: 'ANULADO',
              actualizado_en: new Date(),
            },
          });

          const completada = await tx.operaciones_anulacion.updateMany({
            where: {
              id: operacionId,
              estado: 'EN_PROCESO',
              lease_token: leaseToken,
              lease_hasta: { gt: new Date() },
            },
            data: {
              estado: 'COMPLETADA',
              lease_token: null,
              lease_hasta: null,
              completada_en: new Date(),
              ultimo_error: null,
            },
          });

          if (completada.count !== 1) {
            throw new LeaseAnulacionPerdidoError();
          }

          await tx.eventos_anulacion.create({
            data: {
              operacion_id: operacionId,
              tipo_evento: 'ANULACION_COMPLETADA',
              estado_anterior: 'EN_PROCESO',
              estado_nuevo: 'COMPLETADA',
              mensaje: 'Todas las reversiones fueron confirmadas.',
            },
          });
        });
      } catch (error) {
        if (!(error instanceof LeaseAnulacionPerdidoError)) {
          try {
            await transaccionConLease(async (tx) => {
              await renovarLease(tx);
              const liberacion = await tx.operaciones_anulacion.updateMany({
                where: {
                  id: operacionId,
                  estado: 'EN_PROCESO',
                  lease_token: leaseToken,
                },
                data: {
                  estado: 'REINTENTABLE',
                  lease_token: null,
                  lease_hasta: null,
                  ultimo_error:
                    'No se pudo finalizar la anulación; requiere revisión.',
                },
              });

              if (liberacion.count === 1) {
                await tx.eventos_anulacion.create({
                  data: {
                    operacion_id: operacionId,
                    tipo_evento: 'FINALIZACION_ANULACION_FALLIDA',
                    estado_anterior: 'EN_PROCESO',
                    estado_nuevo: 'REINTENTABLE',
                    mensaje:
                      'No se pudo finalizar la anulación; requiere revisión.',
                  },
                });
              }
            });
          } catch (liberacionError) {
            if (!(liberacionError instanceof LeaseAnulacionPerdidoError)) {
              throw liberacionError;
            }
          }
        }
      }
    }

    return prisma.operaciones_anulacion.findUnique({
      where: { id: operacionId },
      include: { tareas: true, eventos: { orderBy: { creado_en: 'asc' } } },
    });
  }

  async function solicitarAnulacion(req, venta) {
    const actor = req.authenticatedUser || {};
    const actorId = actor.id ?? actor.usuario_id ?? actor.user_id ?? null;
    const solicitadaPor = actorId !== null && /^\d+$/.test(String(actorId))
      ? BigInt(actorId)
      : null;

    const motivoRecibido = req.body?.motivo;
    if (
      motivoRecibido !== undefined &&
      motivoRecibido !== null &&
      typeof motivoRecibido !== 'string'
    ) {
      const error = new Error('El motivo debe ser texto.');
      error.status = 400;
      throw error;
    }

    if (typeof motivoRecibido === 'string' && motivoRecibido.length > 500) {
      const error = new Error('El motivo no puede superar los 500 caracteres.');
      error.status = 400;
      throw error;
    }

    const motivo = typeof motivoRecibido === 'string'
      ? motivoRecibido.trim() || null
      : null;

    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM ventas
          WHERE id = ${venta.id}
          FOR UPDATE
        `;

        const ventaBloqueada = await tx.ventas.findUnique({
          where: { id: venta.id },
          include: { detalle_ventas: true },
        });

        if (!ventaBloqueada || ventaBloqueada.estado !== 'CONFIRMADA') {
          const error = new Error(
            'Solo se puede solicitar la anulación de una venta confirmada.',
          );
          error.status = 409;
          throw error;
        }

        return tx.operaciones_anulacion.create({
          data: {
            venta_id: ventaBloqueada.id,
            estado: 'PENDIENTE',
            solicitada_por_id: solicitadaPor,
            motivo,
            tareas: {
              create: ventaBloqueada.detalle_ventas.map((detalle) => ({
                detalle_venta_id: detalle.id,
                variante_producto_id: BigInt(detalle.variante_producto_id),
                cantidad: Number(detalle.cantidad),
                estado: 'PENDIENTE',
                idempotency_key:
                  `VENTA:${ventaBloqueada.id.toString()}:DETALLE:${detalle.id.toString()}:ANULACION`,
              })),
            },
            eventos: {
              create: {
                tipo_evento: 'ANULACION_SOLICITADA',
                estado_anterior: ventaBloqueada.estado,
                estado_nuevo: 'PENDIENTE',
                actor_id: solicitadaPor,
                mensaje: motivo || 'Solicitud de anulación de venta.',
              },
            },
          },
        });
      });
    } catch (error) {
      if (error.code === 'P2002') {
        const existente = await prisma.operaciones_anulacion.findUnique({
          where: { venta_id: venta.id },
        });
        if (existente) return existente;
      }
      throw error;
    }
  }

  app.patch('/ventas/:id/estado', async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const estado = validarEstadoVenta(req.body?.estado);

      const venta = await prisma.ventas.findUnique({
        where: { id },
        include: { clientes: true, detalle_ventas: true, pagos: true },
      });

      if (!venta) {
        return res.status(404).json({ error: 'Venta no encontrada' });
      }

      if (estado === 'ANULADA') {
        let operacion = await prisma.operaciones_anulacion.findUnique({
          where: { venta_id: id },
        });

        if (!operacion) {
          if (venta.estado !== 'CONFIRMADA') {
            return res.status(409).json({
              error: 'Solo se puede solicitar la anulación de una venta confirmada.',
            });
          }

          if (venta.detalle_ventas.length === 0) {
            return res.status(409).json({
              error: 'No se puede anular una venta sin detalles de inventario.',
            });
          }

          operacion = await solicitarAnulacion(req, venta);
        }

        operacion = await procesarAnulacion(operacion.id);

        const completa = operacion?.estado === 'COMPLETADA';
        const actual = await prisma.ventas.findUnique({
          where: { id },
          include: { clientes: true, detalle_ventas: true, pagos: true },
        });

        const salida = JSON.parse(JSON.stringify({
          venta: actual,
          anulacion: operacion,
        }, (_key, value) => typeof value === 'bigint' ? value.toString() : value));

        return res.status(completa ? 200 : 202).json(salida);
      }

      const actualizada = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM ventas
          WHERE id = ${id}
          FOR UPDATE
        `;

        const actual = await tx.ventas.findUnique({
          where: { id },
        });

        if (!actual) {
          const error = new Error('Venta no encontrada');
          error.status = 404;
          throw error;
        }

        if (actual.estado === 'ANULADA') {
          const error = new Error('Una venta anulada no puede cambiar de estado.');
          error.status = 409;
          throw error;
        }

        const operacion = await tx.operaciones_anulacion.findUnique({
          where: { venta_id: id },
        });

        if (operacion) {
          const error = new Error(
            'No se puede cambiar el estado mientras exista una operación de anulación.',
          );
          error.status = 409;
          throw error;
        }

        return tx.ventas.update({
          where: { id },
          data: { estado, actualizado_en: new Date() },
          include: { clientes: true, detalle_ventas: true, pagos: true },
        });
      });

      return res.json(JSON.parse(JSON.stringify(
        actualizada,
        (_key, value) => typeof value === 'bigint' ? value.toString() : value,
      )));
    } catch (error) {
      console.error('Error al cambiar estado de venta:', error);
      const status = error.status || 500;
      return res.status(status).json({
        error: status < 500
          ? error.message || 'No se pudo cambiar el estado de la venta'
          : 'No se pudo cambiar el estado de la venta',
      });
    }
  });

  app.get('/ventas/:id/anulacion', async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const operacion = await prisma.operaciones_anulacion.findUnique({
        where: { venta_id: id },
        include: {
          tareas: { orderBy: { id: 'asc' } },
          eventos: { orderBy: { creado_en: 'asc' } },
        },
      });

      if (!operacion) {
        return res.status(404).json({ error: 'La venta no tiene una anulacion registrada.' });
      }

      return res.json(JSON.parse(JSON.stringify(
        operacion,
        (_key, value) => typeof value === 'bigint' ? value.toString() : value,
      )));
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({
        error: status < 500
          ? error.message || 'No se pudo consultar la anulación.'
          : 'No se pudo consultar la anulación.',
      });
    }
  });

  app.post('/ventas/:id/anulacion/reintentar', async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const operacion = await prisma.operaciones_anulacion.findUnique({
        where: { venta_id: id },
      });

      if (!operacion) {
        return res.status(404).json({ error: 'No existe una anulacion para esta venta.' });
      }

      if (operacion.estado === 'COMPLETADA') {
        return res.status(409).json({ error: 'La anulacion ya esta completada.' });
      }

      const resultado = await procesarAnulacion(operacion.id);
      const salida = JSON.parse(JSON.stringify(
        resultado,
        (_key, value) => typeof value === 'bigint' ? value.toString() : value,
      ));

      return res.status(resultado?.estado === 'COMPLETADA' ? 200 : 202).json(salida);
    } catch (error) {
      console.error('Error al reintentar anulacion:', error);
      const status = error.status || 500;
      return res.status(status).json({
        error: status < 500
          ? error.message || 'No se pudo reintentar la anulación.'
          : 'No se pudo reintentar la anulación.',
      });
    }
  });
  app.post('/pagos', async (req, res) => {
    try {
      const venta_id = parseId(
        req.body.venta_id,
        'venta_id',
      );

      const metodo_pago = validarMetodoPago(
        req.body.metodo_pago,
      );

      const monto = decimalPositivo(
        req.body.monto,
        'El monto del pago',
      );

      const venta = await prisma.ventas.findUnique({
        where: {
          id: venta_id,
        },
      });

      if (!venta) {
        return res.status(404).json({
          error: 'Venta no encontrada',
        });
      }

      if (venta.estado !== 'CONFIRMADA') {
        return res.status(409).json({
          error:
            'Solo se pueden registrar pagos para ventas confirmadas',
        });
      }

      const pagosActuales = await prisma.pagos.findMany({
        where: {
          venta_id,
        },
      });

      const totalPagado = pagosActuales.reduce(
        (total, pago) => total + Number(pago.monto),
        0,
      );

      const restante = Number(
        (Number(venta.total) - totalPagado).toFixed(2),
      );

      if (monto > restante) {
        return res.status(400).json({
          error:
            `El monto supera el saldo pendiente de ${restante.toFixed(2)}`,
        });
      }

      const pago = await prisma.pagos.create({
        data: {
          venta_id,
          metodo_pago,
          monto,
          estado:
            monto === restante ? 'PAGADO' : 'PENDIENTE',
          fecha_pago: new Date(),
          creado_en: new Date(),
          actualizado_en: new Date(),
        },
      });

      return res.status(201).json(pago);
    } catch (error) {
      console.error('Error al registrar pago:', error);

      return res.status(400).json({
        error: error.message || 'No se pudo registrar el pago',
      });
    }
  });
};
