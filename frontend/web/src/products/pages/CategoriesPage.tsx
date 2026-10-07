import {
  useEffect,
  useState,
} from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AdministrationSidebar from "../../administration/components/AdministrationSidebar";

import type {
  Category,
  CategoryForm,
} from "../types/products.types";

import {
  changeCategoryStatus,
  createCategory,
  getCategories,
  updateCategory,
} from "../services/categoriesApi";

const EMPTY_FORM: CategoryForm = {
  nombre: "",
  descripcion: "",
};

function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState<"create" | "edit" | null>(null);

  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(null);

  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);

  const loadCategories = async (term = search) => {
    setLoading(true);
    setError("");

    try {
      const data = await getCategories(term);
      setCategories(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las categorías.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories("");
  }, []);

  const openCreate = () => {
    setError("");
    setNotice("");
    setSelectedCategory(null);
    setForm(EMPTY_FORM);
    setModal("create");
  };

  const openEdit = (category: Category) => {
    setError("");
    setNotice("");
    setSelectedCategory(category);

    setForm({
      nombre: category.nombre,
      descripcion: category.descripcion || "",
    });

    setModal("edit");
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModal(null);
    setSelectedCategory(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!form.nombre.trim()) {
      setError("El nombre de la categoría es obligatorio.");
      return;
    }

    setError("");
    setNotice("");
    setSaving(true);

    try {
      if (modal === "create") {
        await createCategory(form);
        setNotice("Categoría creada correctamente.");
      } else if (modal === "edit" && selectedCategory) {
        await updateCategory(selectedCategory.id, form);
        setNotice("Categoría actualizada correctamente.");
      }

      closeModal();
      await loadCategories();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la categoría.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (category: Category) => {
    setError("");
    setNotice("");

    try {
      const nextStatus =
        category.estado === "ACTIVO"
          ? "INACTIVO"
          : "ACTIVO";

      await changeCategoryStatus(category.id, nextStatus);

      setNotice(
        nextStatus === "ACTIVO"
          ? "Categoría activada correctamente."
          : "Categoría desactivada correctamente.",
      );

      await loadCategories();
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
    await loadCategories(search);
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
              to="/administracion/productos"
              className="rounded-xl border theme-border px-4 py-2 text-sm font-semibold theme-text"
            >
              Productos
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
                Gestión de productos
              </p>

              <h1 className="mt-2 text-3xl font-semibold theme-text">
                Categorías
              </h1>

              <p className="mt-2 theme-text-soft">
                Administra las categorías utilizadas para organizar los productos.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold"
            >
              + Nueva categoría
            </button>
          </div>

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
              placeholder="Buscar categoría..."
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
                Cargando categorías...
              </div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center theme-text-soft">
                No se encontraron categorías.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b theme-border">
                    <tr>
                      <th className="px-5 py-4 font-semibold theme-text">
                        Nombre
                      </th>

                      <th className="px-5 py-4 font-semibold theme-text">
                        Descripción
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
                    {categories.map((category) => (
                      <tr
                        key={category.id}
                        className="border-b theme-border last:border-b-0"
                      >
                        <td className="px-5 py-4 font-medium theme-text">
                          {category.nombre}
                        </td>

                        <td className="px-5 py-4 theme-text-soft">
                          {category.descripcion || "Sin descripción"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              category.estado === "ACTIVO"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {category.estado}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(category)}
                              className="rounded-lg border theme-border px-3 py-2 text-xs font-semibold theme-text"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => void toggleStatus(category)}
                              className="rounded-lg border theme-border px-3 py-2 text-xs font-semibold theme-text"
                            >
                              {category.estado === "ACTIVO"
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
                    ? "Nueva categoría"
                    : "Editar categoría"}
                </h2>

                <p className="mt-1 text-sm theme-text-soft">
                  Completa la información de la categoría.
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
                  maxLength={100}
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
                  maxLength={255}
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

export default CategoriesPage;



