const express = require('express');
const { publishSystemEvent } = require('../../../contracts/event-publisher');
const { verifiedActorId } = require('../../../contracts/event-actor');

function texto(valor) {
  return String(valor ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function opcional(valor) {
  const limpio = texto(valor);
  return limpio || null;
}

function precio(valor) {
  const numero = Number(String(valor ?? '').trim());

  if (!Number.isFinite(numero) || numero <= 0) {
    return null;
  }

  return Number(numero.toFixed(2));
}

module.exports = function registrarRutasVariantes(app, prisma) {
  app.get('/variantes', async (req, res) => {
    try {
      const { producto_id, buscar, estado } = req.query;
      const where = {};

      if (producto_id !== undefined && String(producto_id).trim() !== '') {
        try {
          where.producto_id = BigInt(producto_id);
        } catch {
          return res.status(400).json({
            error: 'El producto seleccionado no es válido',
          });
        }
      }

      if (estado !== undefined && String(estado).trim() !== '') {
        const estadoLimpio = String(estado).trim().toUpperCase();

        if (!['ACTIVO', 'INACTIVO'].includes(estadoLimpio)) {
          return res.status(400).json({
            error: 'Estado inválido',
          });
        }

        where.estado = estadoLimpio;
      }

      const termino = buscar ? texto(buscar) : '';

      if (termino) {
        where.OR = [
          { sku: { contains: termino } },
          { talla: { contains: termino } },
          { color: { contains: termino } },
        ];
      }

      const variantes = await prisma.variantes.findMany({
        where,
        include: {
          productos: true,
        },
        orderBy: {
          id: 'desc',
        },
      });

      return res.json(variantes);
    } catch (error) {
      console.error('Error al consultar variantes:', error);

      return res.status(500).json({
        error: 'No se pudieron consultar las variantes',
      });
    }
  });

  app.get('/variantes/:id', async (req, res) => {
    try {
      const id = BigInt(req.params.id);

      const variante = await prisma.variantes.findUnique({
        where: { id },
        include: {
          productos: true,
        },
      });

      if (!variante) {
        return res.status(404).json({
          error: 'Variante no encontrada',
        });
      }

      return res.json(variante);
    } catch (error) {
      console.error('Error al consultar variante:', error);

      return res.status(500).json({
        error: 'No se pudo consultar la variante',
      });
    }
  });

  app.post('/variantes', async (req, res) => {
    try {
      const { producto_id, sku, talla, color, precio: precioEntrada } = req.body;

      if (producto_id === undefined || String(producto_id).trim() === '') {
        return res.status(400).json({
          error: 'El producto es obligatorio',
        });
      }

      let productoId;

      try {
        productoId = BigInt(producto_id);
      } catch {
        return res.status(400).json({
          error: 'El producto seleccionado no es válido',
        });
      }

      const producto = await prisma.productos.findUnique({
        where: { id: productoId },
      });

      if (!producto) {
        return res.status(404).json({
          error: 'El producto seleccionado no existe',
        });
      }

      if (producto.estado !== 'ACTIVO') {
        return res.status(400).json({
          error: 'No se puede crear una variante para un producto inactivo',
        });
      }

      const skuLimpio = texto(sku).toUpperCase();

      if (!skuLimpio) {
        return res.status(400).json({
          error: 'El SKU es obligatorio',
        });
      }

      if (skuLimpio.length > 100) {
        return res.status(400).json({
          error: 'El SKU no puede superar los 100 caracteres',
        });
      }

      const precioLimpio = precio(precioEntrada);

      if (precioLimpio === null) {
        return res.status(400).json({
          error: 'El precio debe ser un número mayor que 0',
        });
      }

      const existente = await prisma.variantes.findUnique({
        where: { sku: skuLimpio },
      });

      if (existente) {
        return res.status(409).json({
          error: 'Ya existe una variante con ese SKU',
        });
      }

      const variante = await prisma.variantes.create({
        data: {
          producto_id: productoId,
          sku: skuLimpio,
          talla: opcional(talla),
          color: opcional(color),
          precio: precioLimpio,
        },
        include: {
          productos: true,
        },
      });

      return res.status(201).json(variante);
    } catch (error) {
      console.error('Error al crear variante:', error);

      if (error.code === 'P2002') {
        return res.status(409).json({
          error: 'Ya existe una variante con ese SKU',
        });
      }

      return res.status(500).json({
        error: 'No se pudo crear la variante',
      });
    }
  });

  app.put('/variantes/:id', async (req, res) => {
    try {
      const id = BigInt(req.params.id);

      const actual = await prisma.variantes.findUnique({
        where: { id },
      });

      if (!actual) {
        return res.status(404).json({
          error: 'Variante no encontrada',
        });
      }

      const { producto_id, sku, talla, color, precio: precioEntrada } = req.body;

      if (producto_id === undefined || String(producto_id).trim() === '') {
        return res.status(400).json({
          error: 'El producto es obligatorio',
        });
      }

      let productoId;

      try {
        productoId = BigInt(producto_id);
      } catch {
        return res.status(400).json({
          error: 'El producto seleccionado no es válido',
        });
      }

      const producto = await prisma.productos.findUnique({
        where: { id: productoId },
      });

      if (!producto) {
        return res.status(404).json({
          error: 'El producto seleccionado no existe',
        });
      }

      if (producto.estado !== 'ACTIVO') {
        return res.status(400).json({
          error: 'No se puede asignar la variante a un producto inactivo',
        });
      }

      const skuLimpio = texto(sku).toUpperCase();

      if (!skuLimpio) {
        return res.status(400).json({
          error: 'El SKU es obligatorio',
        });
      }

      const precioLimpio = precio(precioEntrada);

      if (precioLimpio === null) {
        return res.status(400).json({
          error: 'El precio debe ser un número mayor que 0',
        });
      }

      const existente = await prisma.variantes.findFirst({
        where: {
          sku: skuLimpio,
          NOT: { id },
        },
      });

      if (existente) {
        return res.status(409).json({
          error: 'Ya existe otra variante con ese SKU',
        });
      }

      const variante = await prisma.variantes.update({
        where: { id },
        data: {
          producto_id: productoId,
          sku: skuLimpio,
          talla: opcional(talla),
          color: opcional(color),
          precio: precioLimpio,
        },
        include: {
          productos: true,
        },
      });

      if (Number(actual.precio) !== precioLimpio) {
        publishSystemEvent({
          usuario_id: verifiedActorId(req),
          tipo_evento: 'PRECIO_MODIFICADO',
          entidad: 'variante_producto',
          entidad_id: variante.id.toString(),
          metadata: { precio_anterior: Number(actual.precio), precio_nuevo: precioLimpio },
        });
      }

      return res.json(variante);
    } catch (error) {
      console.error('Error al actualizar variante:', error);

      return res.status(500).json({
        error: 'No se pudo actualizar la variante',
      });
    }
  });

  app.patch('/variantes/:id/estado', async (req, res) => {
    try {
      const id = BigInt(req.params.id);
      const estado = String(req.body.estado ?? '').trim().toUpperCase();

      if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
        return res.status(400).json({
          error: 'Estado inválido',
        });
      }

      const actual = await prisma.variantes.findUnique({
        where: { id },
      });

      if (!actual) {
        return res.status(404).json({
          error: 'Variante no encontrada',
        });
      }

      const variante = await prisma.variantes.update({
        where: { id },
        data: { estado },
        include: {
          productos: true,
        },
      });

      return res.json(variante);
    } catch (error) {
      console.error('Error al cambiar estado de variante:', error);

      return res.status(500).json({
        error: 'No se pudo cambiar el estado de la variante',
      });
    }
  });
};
