import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import PaginationControls, {
  usePagination,
} from "../../components/PaginationControls";
import AdministrationLayout from "../../administration/components/AdministrationLayout";
import LogoutButton from "../../auth/components/LogoutButton";
import { getProducts } from "../../products/services/productsApi";
import type { Product, ProductVariant } from "../../products/types/products.types";
import usePermissions from "../../auth/hooks/usePermissions";
import { matchesLocalDateRange } from "../../utils/dateFilters";

type Provider = {
  id: string;
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  estado: string;
};

type Purchase = {
  id: string;
  fecha_compra: string;
  estado: string;
  total: string | number;
  proveedores?: Provider;
  detalle_compras?: Array<{ id: string; cantidad: number }>;
};

type Line = {
  variante_producto_id: string;
  cantidad: string;
  costo_unitario: string;
};

const emptyLine = (): Line => ({
  variante_producto_id: "",
  cantidad: "1",
  costo_unitario: "",
});

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const accessToken = localStorage.getItem("sposabella_access_token");
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      body?.error || body?.message || `Error del servidor (${response.status})`,
    );
  }
  return body as T;
}

function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.value)) return obj.value as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function money(value: string | number | undefined) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
  }).format(Number(value ?? 0));
}

function variantLabel(variant: ProductVariant, products: Product[]) {
  const product = products.find((item) => item.id === variant.producto_id);
  const details = [
    variant.talla ? `Talla ${variant.talla}` : "",
    variant.color ? `Color ${variant.color}` : "",
    variant.sku ? `SKU ${variant.sku}` : "",
  ].filter(Boolean);

  return `${product?.nombre ?? "Producto"}${details.length ? ` · ${details.join(" · ")}` : ""}`;
}

const fieldClass =
  "w-full rounded-xl border theme-border bg-transparent px-3 py-3 theme-text";
const buttonClass =
  "rounded-xl border theme-border px-4 py-2.5 text-sm font-medium hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50";

export default function PurchasesPage() {
  const { can } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyProvider, setHistoryProvider] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [minimumTotal, setMinimumTotal] = useState("");
  const [maximumTotal, setMaximumTotal] = useState("");
  const [providerId, setProviderId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showProvider, setShowProvider] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [providerPhone, setProviderPhone] = useState("");
  const [providerEmail, setProviderEmail] = useState("");
  const [providerAddress, setProviderAddress] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productData, providerData, purchaseData] = await Promise.all([
        getProducts(),
        api<unknown>("/api/proveedores?estado=ACTIVO"),
        api<unknown>("/api/compras"),
      ]);
      setProducts(asList<Product>(productData));
      setProviders(asList<Provider>(providerData));
      setPurchases(asList<Purchase>(purchaseData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const variants = useMemo(
    () =>
      products
        .filter((product) => product.estado === "ACTIVO")
        .flatMap((product) =>
          (product.variantes ?? [])
            .filter((variant) => variant.estado === "ACTIVO")
            .map((variant) => ({
              ...variant,
              label: variantLabel(variant, products),
            })),
        ),
    [products],
  );

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum +
          (Number(line.cantidad) || 0) *
            (Number(line.costo_unitario) || 0),
        0,
      ),
    [lines],
  );
  const visiblePurchases = useMemo(() => {
    const term = historySearch.trim().toLocaleLowerCase("es");
    const min = minimumTotal === "" ? undefined : Number(minimumTotal);
    const max = maximumTotal === "" ? undefined : Number(maximumTotal);

    return purchases.filter((purchase) => {
      const providerName = purchase.proveedores?.nombre ?? "";
      const searchable = [
        purchase.id,
        purchase.estado,
        purchase.fecha_compra,
        providerName,
      ].join(" ").toLocaleLowerCase("es");
      const total = Number(purchase.total);

      return (
        (!term || searchable.includes(term)) &&
        (!historyProvider || providerName === historyProvider) &&
        (!historyStatus || purchase.estado === historyStatus) &&
        matchesLocalDateRange(purchase.fecha_compra?.slice(0, 10), historyFrom, historyTo) &&
        (min === undefined || total >= min) &&
        (max === undefined || total <= max)
      );
    });
  }, [
    historySearch,
    historyProvider,
    historyStatus,
    historyFrom,
    historyTo,
    minimumTotal,
    maximumTotal,
    purchases,
  ]);
  const purchasePagination = usePagination(visiblePurchases);

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    );
  }

  async function registerPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!providerId) {
      setError("Selecciona un proveedor activo.");
      return;
    }

    if (
      lines.some(
        (line) =>
          !line.variante_producto_id ||
          !Number.isInteger(Number(line.cantidad)) ||
          Number(line.cantidad) <= 0 ||
          !Number.isFinite(Number(line.costo_unitario)) ||
          Number(line.costo_unitario) <= 0,
      )
    ) {
      setError("Completa cada producto con una variante, cantidad positiva y costo unitario mayor que cero.");
      return;
    }

    if (
      new Set(lines.map((line) => line.variante_producto_id)).size !== lines.length
    ) {
      setError("Hay variantes repetidas. Combina sus cantidades en una sola línea.");
      return;
    }

    setSaving(true);
    try {
      const purchase = await api<Purchase>("/api/compras", {
        method: "POST",
        body: JSON.stringify({
          proveedor_id: providerId,
          fecha_compra: date,
          detalles: lines.map((line) => ({
            variante_producto_id: line.variante_producto_id,
            cantidad: Number(line.cantidad),
            costo_unitario: Number(line.costo_unitario),
          })),
        }),
      });

      setSuccess(
        `Compra #${purchase.id} registrada. Se procesó la entrada de inventario.`,
      );
      setLines([emptyLine()]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la compra.");
    } finally {
      setSaving(false);
    }
  }

  async function createProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!providerName.trim()) {
      setError("El nombre del proveedor es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const provider = await api<Provider>("/api/proveedores", {
        method: "POST",
        body: JSON.stringify({
          nombre: providerName.trim(),
          telefono: providerPhone.trim() || null,
          correo: providerEmail.trim() || null,
          direccion: providerAddress.trim() || null,
        }),
      });

      setProviders((current) => [provider, ...current]);
      setProviderId(provider.id);
      setProviderName("");
      setProviderPhone("");
      setProviderEmail("");
      setProviderAddress("");
      setShowProvider(false);
      setSuccess(`Proveedor "${provider.nombre}" creado y seleccionado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdministrationLayout
      sidebarOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
    >
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border theme-border theme-text transition hover:bg-[var(--bg-secondary)] lg:hidden"
                aria-label="Abrir menú de navegación"
                aria-expanded={sidebarOpen}
              >
                <span className="flex flex-col gap-1.5" aria-hidden="true">
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </span>
              </button>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] theme-text-muted">
                  Administración / Inventario
                </p>
                <h1 className="text-2xl font-semibold sm:text-3xl">Compras</h1>
                <p className="mt-2 text-sm theme-text-soft">
                  Registra adquisiciones, incrementa las existencias y consulta el historial.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LogoutButton />
              <button
                type="button"
                className={buttonClass}
                onClick={() => void loadData()}
                disabled={loading}
              >
                {loading ? "Actualizando..." : "Actualizar datos"}
              </button>
            </div>
          </header>

          {error && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
              {success}
            </div>
          )}

          <section className="rounded-2xl border theme-border p-4 sm:p-6">
            <h2 className="text-xl font-semibold">Registrar compra</h2>
            <p className="mt-1 text-sm theme-text-muted">
              Al registrar la compra, el backend incrementa el stock y registra los movimientos de entrada.
            </p>

            {!can("INVENTARIO_EDITAR") && (
            <p className="mt-5 rounded-xl bg-[var(--bg-secondary)] px-4 py-3 text-sm theme-text-soft">
              Tu cuenta puede consultar las compras, pero no registrarlas.
            </p>
          )}
          <form onSubmit={registerPurchase} className="mt-5 space-y-6">
          <fieldset disabled={!can("INVENTARIO_EDITAR")} className="contents">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="purchase-provider" className="mb-2 block text-sm font-medium">
                    Proveedor
                  </label>
                  <select
                    id="purchase-provider"
                    className={fieldClass}
                    value={providerId}
                    onChange={(event) => setProviderId(event.target.value)}
                    required
                  >
                    <option value="">Selecciona un proveedor</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.nombre}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium underline underline-offset-4"
                    onClick={() => setShowProvider((value) => !value)}
                  >
                    {showProvider ? "Cerrar formulario" : "+ Crear proveedor"}
                  </button>
                </div>

                <div>
                  <label htmlFor="purchase-date" className="mb-2 block text-sm font-medium">
                    Fecha de compra
                  </label>
                  <input
                    id="purchase-date"
                    type="date"
                    className={fieldClass}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </div>
              </div>

              {showProvider && (
                <div className="rounded-xl border theme-border p-4">
                  <h3 className="mb-4 font-semibold">Nuevo proveedor</h3>
                  <form onSubmit={createProvider} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className={fieldClass}
                        placeholder="Nombre del proveedor *"
                        aria-label="Nombre del proveedor"
                        value={providerName}
                        onChange={(event) => setProviderName(event.target.value)}
                        maxLength={150}
                        required
                      />
                      <input
                        className={fieldClass}
                        placeholder="Teléfono"
                        aria-label="Teléfono del proveedor"
                        value={providerPhone}
                        onChange={(event) => setProviderPhone(event.target.value)}
                      />
                      <input
                        className={fieldClass}
                        type="email"
                        placeholder="Correo electrónico"
                        aria-label="Correo del proveedor"
                        value={providerEmail}
                        onChange={(event) => setProviderEmail(event.target.value)}
                      />
                      <input
                        className={fieldClass}
                        placeholder="Dirección"
                        aria-label="Dirección del proveedor"
                        value={providerAddress}
                        onChange={(event) => setProviderAddress(event.target.value)}
                      />
                    </div>
                    <button type="submit" className={buttonClass} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar proveedor"}
                    </button>
                  </form>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">Productos adquiridos</h3>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => setLines((current) => [...current, emptyLine()])}
                  >
                    + Agregar producto
                  </button>
                </div>

                {lines.map((line, index) => (
                  <div key={index} className="grid gap-3 rounded-xl border theme-border p-3 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <label className="mb-1 block text-xs theme-text-muted">Producto / variante</label>
                      <select
                        className={fieldClass}
                        value={line.variante_producto_id}
                        onChange={(event) => updateLine(index, "variante_producto_id", event.target.value)}
                        required
                      >
                        <option value="">Selecciona una variante</option>
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>{variant.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs theme-text-muted">Cantidad</label>
                      <input
                        className={fieldClass}
                        type="number"
                        min="1"
                        step="1"
                        value={line.cantidad}
                        onChange={(event) => updateLine(index, "cantidad", event.target.value)}
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs theme-text-muted">Costo unitario (Bs)</label>
                      <input
                        className={fieldClass}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.costo_unitario}
                        onChange={(event) => updateLine(index, "costo_unitario", event.target.value)}
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <span className="mb-1 block text-xs theme-text-muted">Subtotal</span>
                      <p className="py-3 font-semibold">
                        {money((Number(line.cantidad) || 0) * (Number(line.costo_unitario) || 0))}
                      </p>
                    </div>

                    <div className="flex items-end sm:col-span-1">
                      <button
                        type="button"
                        className={`${buttonClass} w-full px-2`}
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                        disabled={lines.length === 1}
                        aria-label={`Quitar producto ${index + 1}`}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}

                {variants.length === 0 && !loading && (
                  <p className="text-sm theme-text-muted">
                    No hay variantes activas disponibles. Registra primero los productos y sus variantes.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t theme-border pt-5">
                <div>
                  <p className="text-sm theme-text-muted">Total de la compra</p>
                  <p className="text-2xl font-semibold">{money(total)}</p>
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--primary)] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saving || loading || variants.length === 0 || providers.length === 0}
                >
                  {saving ? "Registrando..." : "Registrar compra y actualizar stock"}
                </button>
              </div>

              {providers.length === 0 && !loading && (
                <p className="text-sm theme-text-muted">Crea un proveedor antes de registrar la compra.</p>
              )}
            </fieldset>
</form>
          </section>

          <section className="rounded-2xl border theme-border p-4 sm:p-6">
            <h2 className="text-xl font-semibold">Historial de compras</h2>
            <p className="mb-4 mt-1 text-sm theme-text-muted">
              Compras registradas, ordenadas de la más reciente a la más antigua.
            </p>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <input
                type="search"
                value={historySearch}
                onChange={(event) => {
                  setHistorySearch(event.target.value);
                  purchasePagination.setPage(1);
                }}
                placeholder="Buscar por número, proveedor o estado"
                aria-label="Buscar compras"
                className={fieldClass}
              />
              <select
                value={historyProvider}
                onChange={(event) => {
                  setHistoryProvider(event.target.value);
                  purchasePagination.setPage(1);
                }}
                aria-label="Filtrar compras por proveedor"
                className={fieldClass}
              >
                <option value="">Todos los proveedores</option>
                {[...new Set(purchases.map((purchase) => purchase.proveedores?.nombre).filter(Boolean))]
                  .sort()
                  .map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
              </select>
              <select
                value={historyStatus}
                onChange={(event) => {
                  setHistoryStatus(event.target.value);
                  purchasePagination.setPage(1);
                }}
                aria-label="Filtrar compras por estado"
                className={fieldClass}
              >
                <option value="">Todos los estados</option>
                {[...new Set(purchases.map((purchase) => purchase.estado))]
                  .sort()
                  .map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
              </select>
              <label className="text-sm theme-text">
                Desde
                <input
                  type="date"
                  value={historyFrom}
                  onChange={(event) => {
                    setHistoryFrom(event.target.value);
                    purchasePagination.setPage(1);
                  }}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="text-sm theme-text">
                Hasta
                <input
                  type="date"
                  value={historyTo}
                  onChange={(event) => {
                    setHistoryTo(event.target.value);
                    purchasePagination.setPage(1);
                  }}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="text-sm theme-text">
                Total mínimo (Bs)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minimumTotal}
                  onChange={(event) => {
                    setMinimumTotal(event.target.value);
                    purchasePagination.setPage(1);
                  }}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <label className="text-sm theme-text">
                Total máximo (Bs)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={maximumTotal}
                  onChange={(event) => {
                    setMaximumTotal(event.target.value);
                    purchasePagination.setPage(1);
                  }}
                  className={`${fieldClass} mt-1`}
                />
              </label>
              <p className="self-end text-sm theme-text-muted">
                {visiblePurchases.length} de {purchases.length} compras
              </p>
            </div>

            {loading ? (
              <p className="py-8 text-center theme-text-muted">Cargando historial...</p>
            ) : purchases.length === 0 ? (
              <p className="py-8 text-center theme-text-muted">Todavía no hay compras registradas.</p>
            ) : visiblePurchases.length === 0 ? (
              <p className="py-8 text-center theme-text-muted">No hay compras que coincidan con los filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead>
                    <tr className="border-b theme-border theme-text-muted">
                      <th className="px-3 py-3 font-medium">N.º</th>
                      <th className="px-3 py-3 font-medium">Fecha</th>
                      <th className="px-3 py-3 font-medium">Proveedor</th>
                      <th className="px-3 py-3 font-medium">Lí­neas</th>
                      <th className="px-3 py-3 font-medium">Total</th>
                      <th className="px-3 py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchasePagination.pageItems.map((purchase) => (
                      <tr key={purchase.id} className="border-b theme-border last:border-0">
                        <td className="px-3 py-3 font-medium">#{purchase.id}</td>
                        <td className="px-3 py-3">
                          {purchase.fecha_compra
                            ? new Date(`${purchase.fecha_compra.slice(0, 10)}T12:00:00`).toLocaleDateString("es-BO")
                            : "Sin fecha"}
                        </td>
                        <td className="px-3 py-3">{purchase.proveedores?.nombre ?? "No disponible"}</td>
                        <td className="px-3 py-3">{purchase.detalle_compras?.length ?? 0}</td>
                        <td className="px-3 py-3 font-medium">{money(purchase.total)}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full border theme-border px-2.5 py-1 text-xs">
                            {purchase.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {purchases.length > 0 && (
              <PaginationControls
                page={purchasePagination.page}
                pageCount={purchasePagination.pageCount}
                pageSize={purchasePagination.pageSize}
                total={purchasePagination.total}
                onPageChange={purchasePagination.setPage}
                onPageSizeChange={purchasePagination.setPageSize}
              />
            )}
          </section>
        </div>
      </main>
    </AdministrationLayout>
  );
}
