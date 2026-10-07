require('dotenv').config();

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

const app = express();

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const port = Number(process.env.PORT || 3000);

const adapter = new PrismaMariaDb({
  host: 'mysql-products',
  port: 3306,
  user: 'boutique',
  password: 'secret',
  database: 'boutique_products',
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    service: 'products-service',
    status: 'ok',
    port,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'products-service',
    message: 'Microservice ready',
  });
});

app.get('/categorias', async (req, res) => {
  try {
    const { buscar } = req.query;

    const categorias = await prisma.categorias.findMany({
      where: buscar
        ? {
            nombre: {
              contains: String(buscar).trim(),
            },
          }
        : undefined,
      orderBy: {
        id: 'desc',
      },
    });

    return res.json(categorias);
  } catch (error) {
    console.error('Error al consultar categorías:', error);

    return res.status(500).json({
      error: 'No se pudieron consultar las categorías',
    });
  }
});

app.get('/categorias/:id', async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const categoria = await prisma.categorias.findUnique({
      where: { id },
    });

    if (!categoria) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
      });
    }

    return res.json(categoria);
  } catch (error) {
    console.error('Error al consultar categoría:', error);

    return res.status(500).json({
      error: 'No se pudo consultar la categoría',
    });
  }
});

app.post('/categorias', async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre) {
      return res.status(400).json({
        error: 'El nombre de la categoría es obligatorio',
      });
    }

    const nombreLimpio = String(nombre).trim();
    const descripcionLimpia =
      descripcion !== undefined && descripcion !== null
        ? String(descripcion).trim() || null
        : null;

    if (!nombreLimpio) {
      return res.status(400).json({
        error: 'El nombre de la categoría es obligatorio',
      });
    }

    const existente = await prisma.categorias.findUnique({
      where: {
        nombre: nombreLimpio,
      },
    });

    if (existente) {
      return res.status(409).json({
        error: 'Ya existe una categoría con ese nombre',
      });
    }

    const categoria = await prisma.categorias.create({
      data: {
        nombre: nombreLimpio,
        descripcion: descripcionLimpia,
      },
    });

    return res.status(201).json(categoria);
  } catch (error) {
    console.error('Error al crear categoría:', error);

    return res.status(500).json({
      error: 'No se pudo crear la categoría',
    });
  }
});

app.put('/categorias/:id', async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const categoriaActual = await prisma.categorias.findUnique({
      where: { id },
    });

    if (!categoriaActual) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
      });
    }

    const { nombre, descripcion } = req.body;

    if (!nombre) {
      return res.status(400).json({
        error: 'El nombre de la categoría es obligatorio',
      });
    }

    const nombreLimpio = String(nombre).trim();
    const descripcionLimpia =
      descripcion !== undefined && descripcion !== null
        ? String(descripcion).trim() || null
        : null;

    if (!nombreLimpio) {
      return res.status(400).json({
        error: 'El nombre de la categoría es obligatorio',
      });
    }

    const existente = await prisma.categorias.findFirst({
      where: {
        nombre: nombreLimpio,
        NOT: {
          id,
        },
      },
    });

    if (existente) {
      return res.status(409).json({
        error: 'Ya existe otra categoría con ese nombre',
      });
    }

    if (
      categoriaActual.estado === 'ACTIVO' &&
      estado === 'INACTIVO'
    ) {
      const productosAsignados = await prisma.productos.count({
        where: {
          categoria_id: id,
        },
      });

      if (productosAsignados > 0) {
        return res.status(409).json({
          error:
            'No se puede desactivar la categoría porque tiene productos asociados.',
          productos_asignados: productosAsignados,
        });
      }
    }
    const categoria = await prisma.categorias.update({
      where: { id },
      data: {
        nombre: nombreLimpio,
        descripcion: descripcionLimpia,
      },
    });

    return res.json(categoria);
  } catch (error) {
    console.error('Error al actualizar categoría:', error);

    return res.status(500).json({
      error: 'No se pudo actualizar la categoría',
    });
  }
});

app.patch('/categorias/:id/estado', async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const { estado } = req.body;

    if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({
        error: 'Estado inválido',
      });
    }

    const categoriaActual = await prisma.categorias.findUnique({
      where: { id },
    });

    if (!categoriaActual) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
      });
    }

    if (
      categoriaActual.estado === 'ACTIVO' &&
      estado === 'INACTIVO'
    ) {
      const productosAsignados = await prisma.productos.count({
        where: {
          categoria_id: id,
        },
      });

      if (productosAsignados > 0) {
        return res.status(409).json({
          error:
            'No se puede desactivar la categoría porque tiene productos asociados.',
          productos_asignados: productosAsignados,
        });
      }
    }
    const categoria = await prisma.categorias.update({
      where: { id },
      data: {
        estado,
      },
    });

    return res.json(categoria);
  } catch (error) {
    console.error('Error al cambiar el estado de la categoría:', error);

    return res.status(500).json({
      error: 'No se pudo cambiar el estado de la categoría',
    });
  }
});

app.get('/productos', async (req, res) => {
  try {
    const { buscar } = req.query;
    const termino = buscar ? String(buscar).trim() : '';

    const productos = await prisma.productos.findMany({
      where: termino
        ? {
            OR: [
              {
                nombre: {
                  contains: termino,
                },
              },
              {
                descripcion: {
                  contains: termino,
                },
              },
            ],
          }
        : undefined,
      include: {
        categorias: true,
        variantes: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    return res.json(productos);
  } catch (error) {
    console.error('Error al consultar productos:', error);

    return res.status(500).json({
      error: 'No se pudieron consultar los productos',
    });
  }
});

app.get('/productos/:id', async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const producto = await prisma.productos.findUnique({
      where: { id },
      include: {
        categorias: true,
        variantes: true,
      },
    });

    if (!producto) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    return res.json(producto);
  } catch (error) {
    console.error('Error al consultar producto:', error);

    return res.status(500).json({
      error: 'No se pudo consultar el producto',
    });
  }
});

app.post('/productos', async (req, res) => {
  try {
    const { categoria_id, nombre, descripcion } = req.body;

    if (
      categoria_id === undefined ||
      categoria_id === null ||
      String(categoria_id).trim() === ''
    ) {
      return res.status(400).json({
        error: 'La categoría es obligatoria',
      });
    }

    if (!nombre) {
      return res.status(400).json({
        error: 'El nombre del producto es obligatorio',
      });
    }

    const nombreLimpio = String(nombre).trim();

    if (!nombreLimpio) {
      return res.status(400).json({
        error: 'El nombre del producto es obligatorio',
      });
    }

    let categoriaId;

    try {
      categoriaId = BigInt(categoria_id);
    } catch {
      return res.status(400).json({
        error: 'La categoría seleccionada no es válida',
      });
    }

    const categoria = await prisma.categorias.findUnique({
      where: {
        id: categoriaId,
      },
    });

    if (!categoria) {
      return res.status(404).json({
        error: 'La categoría seleccionada no existe',
      });
    }

    if (categoria.estado !== 'ACTIVO') {
      return res.status(400).json({
        error: 'La categoría seleccionada está inactiva',
      });
    }

    const descripcionLimpia =
      descripcion !== undefined && descripcion !== null
        ? String(descripcion).trim() || null
        : null;

    const producto = await prisma.productos.create({
      data: {
        categoria_id: categoriaId,
        nombre: nombreLimpio,
        descripcion: descripcionLimpia,
      },
      include: {
        categorias: true,
        variantes: true,
      },
    });

    return res.status(201).json(producto);
  } catch (error) {
    console.error('Error al crear producto:', error);

    return res.status(500).json({
      error: 'No se pudo crear el producto',
    });
  }
});

app.put('/productos/:id', async (req, res) => {
  try {
    const id = BigInt(req.params.id);

    const productoActual = await prisma.productos.findUnique({
      where: { id },
    });

    if (!productoActual) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    const { categoria_id, nombre, descripcion } = req.body;

    if (
      categoria_id === undefined ||
      categoria_id === null ||
      String(categoria_id).trim() === ''
    ) {
      return res.status(400).json({
        error: 'La categoría es obligatoria',
      });
    }

    if (!nombre) {
      return res.status(400).json({
        error: 'El nombre del producto es obligatorio',
      });
    }

    const nombreLimpio = String(nombre).trim();

    if (!nombreLimpio) {
      return res.status(400).json({
        error: 'El nombre del producto es obligatorio',
      });
    }

    let categoriaId;

    try {
      categoriaId = BigInt(categoria_id);
    } catch {
      return res.status(400).json({
        error: 'La categoría seleccionada no es válida',
      });
    }

    const categoria = await prisma.categorias.findUnique({
      where: {
        id: categoriaId,
      },
    });

    if (!categoria) {
      return res.status(404).json({
        error: 'La categoría seleccionada no existe',
      });
    }

    if (categoria.estado !== 'ACTIVO') {
      return res.status(400).json({
        error: 'La categoría seleccionada está inactiva',
      });
    }

    const descripcionLimpia =
      descripcion !== undefined && descripcion !== null
        ? String(descripcion).trim() || null
        : null;

    const producto = await prisma.productos.update({
      where: { id },
      data: {
        categoria_id: categoriaId,
        nombre: nombreLimpio,
        descripcion: descripcionLimpia,
      },
      include: {
        categorias: true,
        variantes: true,
      },
    });

    return res.json(producto);
  } catch (error) {
    console.error('Error al actualizar producto:', error);

    return res.status(500).json({
      error: 'No se pudo actualizar el producto',
    });
  }
});

app.patch('/productos/:id/estado', async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const { estado } = req.body;

    if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({
        error: 'Estado inválido',
      });
    }

    const productoActual = await prisma.productos.findUnique({
      where: { id },
    });

    if (!productoActual) {
      return res.status(404).json({
        error: 'Producto no encontrado',
      });
    }

    const producto = await prisma.productos.update({
      where: { id },
      data: {
        estado,
      },
      include: {
        categorias: true,
        variantes: true,
      },
    });

    return res.json(producto);
  } catch (error) {
    console.error('Error al cambiar el estado del producto:', error);

    return res.status(500).json({
      error: 'No se pudo cambiar el estado del producto',
    });
  }
});



app.listen(port, () => {
  console.log(`products-service running on port ${port}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});