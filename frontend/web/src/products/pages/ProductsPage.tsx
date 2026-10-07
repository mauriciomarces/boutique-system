import {
  useEffect,
  useState,
} from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AdministrationSidebar from "../../administration/components/AdministrationSidebar";

import type {
  Category,
  Product,
  ProductForm,
} from "../types/products.types";

import { getCategories } from "../services/categoriesApi";

import {
  changeProductStatus,
  createProduct,
  getProducts,
  updateProduct,
} from "../services/productsApi";

const EMPTY_FORM: ProductForm = {
  categoria_id: "",
  nombre: "",
  descripcion: "",
};

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState<"create" | "edit" | null>(null);

  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  const loadProducts = async (term = search) => {
    setLoading(true);
    setError("");

    try {
      const data = await getProducts(term);
      setProducts(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los productos.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getCategories("");

      setCategories(
        data.filter(
          (category) => category.estado === "ACTIVO",
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las categorías.",
      );
    }
  };

  useEffect(() => {
    void Promise.all([
      loadProducts(""),
      loadCategories(),
    ]);
  }, []);

  const openCreate = () => {
    setError("");
    setNotice("");
    setSelectedProduct(null);

    setForm({
      categoria_id:
        categories.length > 0
          ? categories[0].id
          : "",
      nombre: "",
      descripcion: "",
    });

    setModal("create");
  };

  const openEdit = (product: Product) => {
    setError("");
    setNotice("");
    setSelectedProduct(product);

    setForm({
      categoria_id: product.categoria_id,
      nombre: product.nombre,
      descripcion: product.descripcion || "",
    });

    setModal("edit");
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModal(null);
    setSelectedProduct(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!form.categoria_id) {
      setError("Selecciona una categoría.");
      return;
    }

    if (!form.nombre.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    setError("");
    setNotice("");
    setSaving(true);

    try {
      if (modal === "create") {
        await createProduct(form);
        setNotice("Producto creado correctamente.");
      } else if (modal === "edit" && selectedProduct) {
        await updateProduct(selectedProduct.id, form);
        setNotice("Producto actualizado correctamente.");
      }

      closeModal();
      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el producto.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (product: Product) => {
    setError("");
    setNotice("");

    try {
      const nextStatus =
        product.estado === "ACTIVO"
          ? "INACTIVO"
          : "ACTIVO";

      await changeProductStatus(product.id, nextStatus);

      setNotice(
        nextStatus === "ACTIVO"
          ? "Producto activado correctamente."
          : "Producto desactivado correctamente.",
      );

      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar el estado.",
      );
    }
  };

  const handleSearch = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    await loadProducts(search);
  };    
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="theme-bg min-h-screen">
      <header className="relative border-b theme-border bg-[var(--nav-bg)]">
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
  <div className="flex min-w-0 items-center gap-3">
    <button
      type="button"
      onClick={() => setSidebarOpen(true)}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border theme-border bg-[var(--bg)] theme-text shadow-lg lg:hidden"
      aria-label="Abrir menú de administración"
      aria-expanded={sidebarOpen}
    >
      <span className="flex flex-col gap-1.5">
        <span className="block h-0.5 w-5 rounded-full bg-current" />
        <span className="block h-0.5 w-5 rounded-full bg-current" />
        <span className="block h-0.5 w-5 rounded-full bg-current" />
      </span>
    </button>

    <Link to="/" className="min-w-0 theme-text">
      <p className="text-sm font-semibold tracking-[0.08em]">
        BOUTIQUE SPOSABELLA
      </p>

      <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] theme-text-muted">
        Centro de gestión
      </p>
    </Link>
  </div>

          <div className="flex gap-3">
            <Link
              to="/administracion/categorias"
              className="rounded-xl border theme-border px-4 py-2 text-sm font-semibold theme-text"
            >
              Categorías
            </Link>

            <Link
              to="/administracion"
              className="rounded-xl border theme-border px-4 py-2 text-sm font-semibold theme-text"
            >
              Administración
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <AdministrationSidebar sidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b9279]">
                Gestión comercial
              </p>

              <h1 className="mt-2 text-3xl font-semibold theme-text">
                Productos
              </h1>

              <p className="mt-2 theme-text-soft">
                Registra y administra los productos de la boutique.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              disabled={categories.length === 0}
              className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Nuevo producto
            </button>
          </div>

          {categories.length === 0 && !loading && (
            <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              Debes tener al menos una categoría activa para crear productos.
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
                className="shrink-0 text-lg font-semibold leading-none"
                aria-label="Cerrar error"
              >
                ×
              </button>
            </div>
          )}

          {notice && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              <span>{notice}</span>

              <button
                type="button"
                onClick={() => setNotice("")}
                className="shrink-0 text-lg font-semibold leading-none"
                aria-label="Cerrar aviso"
              >
                ×
              </button>
            </div>
          )}

          <form
            onSubmit={handleSearch}
            className="mb-5 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar producto..."
              className="min-w-0 flex-1 rounded-xl border theme-border bg-transparent px-4 py-3 text-sm theme-text outline-none"
            />

            <button
              type="submit"
              className="rounded-xl border theme-border px-5 py-3 text-sm font-semibold theme-text"
            >
              Buscar
            </button>
          </form>

          <div className="overflow-hidden rounded-2xl border theme-border bg-[var(--card-bg)]">
            {loading ? (
              <div className="p-8 text-center theme-text-soft">
                Cargando productos...
              </div>
            ) : products.length === 0 ? (
              <div className="p-8 text-center theme-text-soft">
                No se encontraron productos.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b theme-border">
                    <tr>
                      <th className="px-5 py-4 font-semibold theme-text">
                        Producto
                      </th>

                      <th className="px-5 py-4 font-semibold theme-text">
                        Categoría
                      </th>

                      <th className="px-5 py-4 font-semibold theme-text">
                        Variantes
                      </th>

                      <th className="px-5 py-4 font-semibold theme-text">
                        Estado
                      </th>

                      <th className="px-5 py-4 text-right font-semibold theme-text">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b theme-border last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium theme-text">
                            {product.nombre}
                          </p>

                          <p className="mt-1 max-w-md text-xs theme-text-soft">
                            {product.descripcion || "Sin descripción"}
                          </p>
                        </td>

                        <td className="px-5 py-4 theme-text-soft">
                          {product.categorias?.nombre || "Sin categoría"}
                        </td>

                        <td className="px-5 py-4 theme-text-soft">
                          {product.variantes?.length || 0}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              product.estado === "ACTIVO"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {product.estado}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(product)}
                              className="rounded-lg border theme-border px-3 py-2 text-xs font-semibold theme-text"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => void toggleStatus(product)}
                              className="rounded-lg border theme-border px-3 py-2 text-xs font-semibold theme-text"
                            >
                              {product.estado === "ACTIVO"
                                ? "Desactivar"
                                : "Activar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border theme-border bg-[var(--bg)] p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold theme-text">
                  {modal === "create"
                    ? "Nuevo producto"
                    : "Editar producto"}
                </h2>

                <p className="mt-1 text-sm theme-text-soft">
                  Completa la información del producto.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="text-xl theme-text-soft"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold theme-text">
                  Categoría
                </label>

                <select
                  value={form.categoria_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      categoria_id: event.target.value,
                    })
                  }
                  required
                  className="w-full rounded-xl border theme-border bg-[var(--card-bg)] px-4 py-3 text-sm theme-text outline-none"
                >
                  <option value="">Seleccionar categoría</option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold theme-text">
                  Nombre
                </label>

                <input
                  value={form.nombre}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      nombre: event.target.value,
                    })
                  }
                  required
                  maxLength={150}
                  className="w-full rounded-xl border theme-border bg-transparent px-4 py-3 text-sm theme-text outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold theme-text">
                  Descripción
                </label>

                <textarea
                  value={form.descripcion}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      descripcion: event.target.value,
                    })
                  }
                  rows={4}
                  className="w-full resize-none rounded-xl border theme-border bg-transparent px-4 py-3 text-sm theme-text outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border theme-border px-5 py-3 text-sm font-semibold theme-text"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductsPage;



