import {
  useEffect,
  useState,
} from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AdministrationSidebar from "../../administration/components/AdministrationSidebar";
import LogoutButton from "../../auth/components/LogoutButton";
import type {
  Category,
  Product,
  ProductForm,
  ProductVariant,
  ProductVariantForm,
} from "../types/products.types";

import { getCategories } from "../services/categoriesApi";

import {
  changeProductVariantStatus,
  changeProductStatus,
  createProductVariant,
  createProduct,
  getProduct,
  getProducts,
  updateProductVariant,
  updateProduct,
} from "../services/productsApi";
import { ensureInventoryForVariant } from "../../inventory/services/inventoryApi";

const EMPTY_FORM: ProductForm = {
  categoria_id: "",
  nombre: "",
  descripcion: "",
  sku: "",
  talla: "",
  color: "",
  precio: "",
};

function createVariantForm(): ProductVariantForm {
  return {
    clientKey: `new-${crypto.randomUUID()}`,
    sku: "",
    talla: "",
    color: "",
    precio: "",
    estado: "ACTIVO",
  };
}

function toVariantForm(variant: ProductVariant): ProductVariantForm {
  return {
    clientKey: variant.id,
    id: variant.id,
    sku: variant.sku,
    talla: variant.talla ?? "",
    color: variant.color ?? "",
    precio: String(variant.precio),
    estado: variant.estado,
  };
}

function productFormFrom(product: Product): ProductForm {
  const firstVariant = product.variantes?.[0];

  return {
    categoria_id: product.categoria_id,
    nombre: product.nombre,
    descripcion: product.descripcion ?? "",
    sku: firstVariant?.sku ?? "",
    talla: firstVariant?.talla ?? "",
    color: firstVariant?.color ?? "",
    precio: firstVariant?.precio ?? "",
  };
}

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
  const [variantForms, setVariantForms] = useState<ProductVariantForm[]>([]);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const variantsEditable =
    modal === "create" || selectedProduct?.estado === "ACTIVO";

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
      ...EMPTY_FORM,
      categoria_id:
        categories.length > 0
          ? categories[0].id
          : "",
    });
    setVariantForms([createVariantForm()]);

    setModal("create");
  };

  const openEdit = async (product: Product) => {
    setError("");
    setNotice("");
    setLoadingProductId(product.id);

    try {
      const detail = await getProduct(product.id);
      setSelectedProduct(detail);
      setForm(productFormFrom(detail));
      setVariantForms((detail.variantes ?? []).map(toVariantForm));
      setModal("edit");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el detalle del producto.",
      );
    } finally {
      setLoadingProductId(null);
    }
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModal(null);
    setSelectedProduct(null);
    setForm(EMPTY_FORM);
    setVariantForms([]);
  };

  const updateVariantForm = (
    clientKey: string,
    field: "sku" | "talla" | "color" | "precio",
    value: string,
  ) => {
    setVariantForms((current) =>
      current.map((variant) =>
        variant.clientKey === clientKey
          ? { ...variant, [field]: value }
          : variant,
      ),
    );
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

    const activeVariants = variantForms.filter(
      (variant) => variant.estado === "ACTIVO",
    );

    if (
      activeVariants.length === 0 &&
      !(modal === "edit" && selectedProduct?.estado === "INACTIVO")
    ) {
      setError("El producto debe tener al menos una variante activa.");
      return;
    }

    for (const variant of activeVariants) {
      if (!variant.sku.trim()) {
        setError("El SKU es obligatorio para cada variante activa.");
        return;
      }

      const price = Number(variant.precio);
      if (
        !variant.precio.trim() ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        setError("El precio de cada variante debe ser mayor que cero.");
        return;
      }
    }

    setError("");
    setNotice("");
    setSaving(true);

    let savedProductId: string | null = null;

    try {
      if (modal === "create") {
        const initialVariant = activeVariants[0];
        const created = await createProduct({
          ...form,
          sku: initialVariant.sku,
          talla: initialVariant.talla,
          color: initialVariant.color,
          precio: initialVariant.precio,
        });
        savedProductId = created.id;
        setSelectedProduct(created);
        setForm(productFormFrom(created));
        setModal("edit");
        const initialSaved = created.variantes?.find(
          (variant) =>
            variant.sku.toUpperCase() ===
            initialVariant.sku.trim().toUpperCase(),
        );
        if (initialSaved) {
          setVariantForms((current) =>
            current.map((variant) =>
              variant.clientKey === initialVariant.clientKey
                ? toVariantForm(initialSaved)
                : variant,
            ),
          );
        }

        const failures: string[] = [];
        const failedKeys = new Set<string>();
        for (const variant of activeVariants.slice(1)) {
          try {
            const createdVariant = await createProductVariant(
              created.id,
              variant,
            );

            await ensureInventoryForVariant(createdVariant.id);
          } catch (err) {
            failedKeys.add(variant.clientKey);
            failures.push(
              `${variant.sku}: ${
                err instanceof Error ? err.message : "No se pudo crear."
              }`,
            );
          }
        }

        const detail = await getProduct(created.id);

        for (const variant of detail.variantes ?? []) {
          if (variant.estado === "ACTIVO") {
            await ensureInventoryForVariant(variant.id);
          }
        }

        setProducts((current) =>
          current.some((product) => product.id === detail.id)
            ? current.map((product) =>
                product.id === detail.id ? detail : product,
              )
            : [detail, ...current],
        );
        setSelectedProduct(detail);

        if (failures.length > 0) {
          const persistedVariants = detail.variantes ?? [];
          setVariantForms(
            variantForms.map((variant) => {
              const saved = persistedVariants.find(
                (item) =>
                  item.sku.toUpperCase() === variant.sku.trim().toUpperCase(),
              );
              if (saved && !failedKeys.has(variant.clientKey)) {
                return toVariantForm(saved);
              }
              return variant;
            }),
          );
          setForm(productFormFrom(detail));
          setModal("edit");
          setError(
            `El producto se creó, pero algunas variantes no se guardaron. Revísalas e inténtalo de nuevo: ${failures.join("; ")}`,
          );
          return;
        }

        setModal(null);
        setSelectedProduct(null);
        setVariantForms([]);
        setForm(EMPTY_FORM);
        setNotice("Producto creado correctamente.");
      } else if (modal === "edit" && selectedProduct) {
        const updated = await updateProduct(selectedProduct.id, form);
        savedProductId = updated.id;

        const failures: string[] = [];
        const failedKeys = new Set<string>();
        for (const variant of variantForms) {
          try {
            if (variant.id) {
              const previous = selectedProduct.variantes?.find(
                (item) => item.id === variant.id,
              );
              const fieldsChanged =
                previous !== undefined &&
                (previous.sku !== variant.sku.trim().toUpperCase() ||
                  (previous.talla ?? "") !== variant.talla.trim() ||
                  (previous.color ?? "") !== variant.color.trim() ||
                  Number(previous.precio) !== Number(variant.precio));
              if (fieldsChanged) {
                await updateProductVariant(
                  variant.id,
                  selectedProduct.id,
                  variant,
                );
              }
              if (
                previous?.estado === "ACTIVO" &&
                variant.estado === "INACTIVO"
              ) {
                await changeProductVariantStatus(variant.id, "INACTIVO");
              }
            } else if (variant.estado === "ACTIVO") {
                const createdVariant = await createProductVariant(
                  selectedProduct.id,
                  variant,
                );

                // Se inicializa el inventario después de persistir la variante.
                await ensureInventoryForVariant(createdVariant.id);
              }
          } catch (err) {
            failedKeys.add(variant.clientKey);
            failures.push(
              `${variant.sku || "Variante nueva"}: ${
                err instanceof Error ? err.message : "No se pudo guardar."
              }`,
            );
          }
        }

        const detail = await getProduct(selectedProduct.id);
        setProducts((current) =>
          current.map((product) =>
            product.id === detail.id ? detail : product,
          ),
        );
        setSelectedProduct(detail);

        if (failures.length > 0) {
          setVariantForms(
            variantForms.map((variant) => {
              if (failedKeys.has(variant.clientKey)) return variant;
              const saved = detail.variantes?.find(
                (item) =>
                  (variant.id && item.id === variant.id) ||
                  (!variant.id &&
                    item.sku.toUpperCase() ===
                      variant.sku.trim().toUpperCase()),
              );
              return saved ? toVariantForm(saved) : variant;
            }),
          );
          setForm(productFormFrom(detail));
          setError(
            `La información general del producto se guardó, pero algunas variantes no se sincronizaron. Revísalas e inténtalo de nuevo: ${failures.join("; ")}`,
          );
          return;
        }

        setModal(null);
        setSelectedProduct(null);
        setVariantForms([]);
        setForm(EMPTY_FORM);
        setNotice("Producto y variantes actualizados correctamente.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido.";
      if (savedProductId) {
        setError(
          `El producto se guardó, pero no se pudo confirmar o actualizar el detalle. ${message}`,
        );
        try {
          const detail = await getProduct(savedProductId);
          setSelectedProduct(detail);
          setProducts((current) =>
            current.some((product) => product.id === detail.id)
              ? current.map((product) =>
                  product.id === detail.id ? detail : product,
                )
              : [detail, ...current],
          );
          setForm(productFormFrom(detail));
          setVariantForms((current) => {
            const serverVariants = detail.variantes ?? [];
            return current.map((variant) => {
              const saved = serverVariants.find(
                (item) =>
                  (variant.id && item.id === variant.id) ||
                  item.sku.toUpperCase() ===
                    variant.sku.trim().toUpperCase(),
              );
              return saved ? toVariantForm(saved) : variant;
            });
          });
          setModal("edit");
        } catch {
          setError(
            `El producto se guardó, pero no se pudo volver a consultar. ${message}`,
          );
        }
      } else {
        setError(message);
      }
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

            <Link to="/administracion" className="rounded-xl border theme-border px-4 py-2 text-sm font-semibold theme-text">
              Administración
            </Link>
            <LogoutButton />
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
                              onClick={() => void openEdit(product)}
                              disabled={loadingProductId === product.id}
                              className="rounded-lg border theme-border px-3 py-2 text-xs font-semibold theme-text"
                            >
                              {loadingProductId === product.id
                                ? "Cargando..."
                                : "Editar"}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 px-3 py-2 sm:items-center sm:px-4">
          <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border theme-border bg-[var(--bg)] shadow-xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b theme-border p-4 sm:p-6">
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
                className="rounded-lg px-2 text-xl theme-text-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}
                <div>
                  <label
                    htmlFor="product-category"
                    className="mb-1 block text-sm font-semibold theme-text"
                  >
                    Categoría
                  </label>
                  <select
                    id="product-category"
                    value={form.categoria_id}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        categoria_id: event.target.value,
                      })
                    }
                    required
                    className="w-full rounded-xl border theme-border bg-[var(--card-bg)] px-4 py-3 text-sm theme-text outline-none focus-visible:outline focus-visible:outline-2"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="product-name"
                    className="mb-1 block text-sm font-semibold theme-text"
                  >
                    Nombre
                  </label>
                  <input
                    id="product-name"
                    value={form.nombre}
                    onChange={(event) =>
                      setForm({ ...form, nombre: event.target.value })
                    }
                    required
                    maxLength={150}
                    className="w-full rounded-xl border theme-border bg-transparent px-4 py-3 text-sm theme-text outline-none focus-visible:outline focus-visible:outline-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="product-description"
                    className="mb-1 block text-sm font-semibold theme-text"
                  >
                    Descripción
                  </label>
                  <textarea
                    id="product-description"
                    value={form.descripcion}
                    onChange={(event) =>
                      setForm({ ...form, descripcion: event.target.value })
                    }
                    rows={3}
                    className="w-full resize-y rounded-xl border theme-border bg-transparent px-4 py-3 text-sm theme-text outline-none focus-visible:outline focus-visible:outline-2"
                  />
                </div>

                <section
                  aria-labelledby="variants-heading"
                  className="space-y-4 rounded-xl border theme-border p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3
                        id="variants-heading"
                        className="text-sm font-semibold theme-text"
                      >
                        Variantes
                      </h3>
                      <p className="mt-1 text-xs theme-text-soft">
                        El producto debe conservar al menos una variante activa.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setVariantForms((current) => [
                          ...current,
                          createVariantForm(),
                        ])
                      }
                      disabled={!variantsEditable || saving}
                      className="rounded-lg border theme-border px-3 py-2 text-xs font-semibold theme-text focus-visible:outline focus-visible:outline-2"
                    >
                      + Añadir variante
                    </button>
                  </div>
                  {!variantsEditable && (
                    <p className="text-xs theme-text-soft">
                      No se pueden modificar variantes mientras el producto esté inactivo.
                    </p>
                  )}

                  {variantForms.map((variant, index) => {
                    const inactive = variant.estado === "INACTIVO";
                    const labelId = `variant-heading-${variant.clientKey}`;

                    return (
                      <fieldset
                        key={variant.clientKey}
                        className="min-w-0 space-y-3 rounded-xl border theme-border p-3 sm:p-4"
                      >
                        <legend id={labelId} className="px-1 text-xs font-semibold theme-text">
                          Variante {index + 1}
                          {inactive ? " · Inactiva" : ""}
                        </legend>
                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="min-w-0">
                            <label
                              htmlFor={`${variant.clientKey}-sku`}
                              className="mb-1 block text-xs font-semibold theme-text"
                            >
                              SKU
                            </label>
                            <input
                              id={`${variant.clientKey}-sku`}
                              value={variant.sku}
                              onChange={(event) =>
                                updateVariantForm(
                                  variant.clientKey,
                                  "sku",
                                  event.target.value,
                                )
                              }
                              required={!inactive}
                              maxLength={100}
                              autoCapitalize="characters"
                              disabled={!variantsEditable || saving}
                              className="w-full min-w-0 rounded-lg border theme-border bg-transparent px-3 py-3 text-sm uppercase theme-text outline-none focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </div>
                          <div className="min-w-0">
                            <label
                              htmlFor={`${variant.clientKey}-size`}
                              className="mb-1 block text-xs font-semibold theme-text"
                            >
                              Talla
                            </label>
                            <input
                              id={`${variant.clientKey}-size`}
                              value={variant.talla}
                              onChange={(event) =>
                                updateVariantForm(
                                  variant.clientKey,
                                  "talla",
                                  event.target.value,
                                )
                              }
                              maxLength={50}
                              disabled={!variantsEditable || saving}
                              className="w-full min-w-0 rounded-lg border theme-border bg-transparent px-3 py-3 text-sm theme-text outline-none focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </div>
                          <div className="min-w-0">
                            <label
                              htmlFor={`${variant.clientKey}-color`}
                              className="mb-1 block text-xs font-semibold theme-text"
                            >
                              Color
                            </label>
                            <input
                              id={`${variant.clientKey}-color`}
                              value={variant.color}
                              onChange={(event) =>
                                updateVariantForm(
                                  variant.clientKey,
                                  "color",
                                  event.target.value,
                                )
                              }
                              maxLength={50}
                              disabled={!variantsEditable || saving}
                              className="w-full min-w-0 rounded-lg border theme-border bg-transparent px-3 py-3 text-sm theme-text outline-none focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </div>
                          <div className="min-w-0">
                            <label
                              htmlFor={`${variant.clientKey}-price`}
                              className="mb-1 block text-xs font-semibold theme-text"
                            >
                              Precio
                            </label>
                            <input
                              id={`${variant.clientKey}-price`}
                              type="number"
                              value={variant.precio}
                              onChange={(event) =>
                                updateVariantForm(
                                  variant.clientKey,
                                  "precio",
                                  event.target.value,
                                )
                              }
                              required={!inactive}
                              min="0.01"
                              step="0.01"
                              inputMode="decimal"
                              disabled={!variantsEditable || saving}
                              className="w-full min-w-0 rounded-lg border theme-border bg-transparent px-3 py-3 text-sm theme-text outline-none focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </div>
                        </div>
                        {variant.id ? (
                          inactive ? (
                            <p className="text-xs theme-text-soft">
                              Esta variante permanece inactiva y no se reactivará al guardar.
                            </p>
                          ) : (
                            <button
                              type="button"
                              disabled={!variantsEditable || saving}
                              onClick={() =>
                                setVariantForms((current) =>
                                  current.map((item) =>
                                    item.clientKey === variant.clientKey
                                      ? { ...item, estado: "INACTIVO" }
                                      : item,
                                  ),
                                )
                              }
                              className="text-xs font-semibold text-red-700 underline focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Desactivar variante
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={!variantsEditable || saving}
                            onClick={() =>
                              setVariantForms((current) =>
                                current.filter(
                                  (item) => item.clientKey !== variant.clientKey,
                                ),
                              )
                            }
                            className="text-xs font-semibold text-red-700 underline focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Quitar variante nueva
                          </button>
                        )}
                      </fieldset>
                    );
                  })}
                </section>
              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t theme-border bg-[var(--bg)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border theme-border px-5 py-3 text-sm font-semibold theme-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
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
