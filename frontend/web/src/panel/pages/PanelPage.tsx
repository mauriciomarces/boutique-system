import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdministrationLayout from "../../administration/components/AdministrationLayout";
import LogoutButton from "../../auth/components/LogoutButton";
import PaginationControls, { usePagination } from "../../components/PaginationControls";
import { getInventory, getInventoryMovements } from "../../inventory/services/inventoryApi";
import type { InventoryMovement } from "../../inventory/types/inventory.types";
import { getMonthlyReport } from "../../reports/services/reportsApi";
import type { SalesReport } from "../../reports/services/reportsApi";
import usePermissions from "../../auth/hooks/usePermissions";

type StoredUser = {
  nombre?: string;
  roles?: Array<{ nombre: string; estado?: string }>;
};

type ModuleAction = {
  label: string;
  to: string;
  permission: string;
};

type PanelModule = {
  title: string;
  description: string;
  to: string;
  read: string;
  allowedRoles?: string[];
  actions: ModuleAction[];
};

type DashboardSummary = {
  loading: boolean;
  sales?: SalesReport;
  salesError?: string;
  lowStockCount?: number;
  inventoryError?: string;
  movements?: InventoryMovement[];
  movementError?: string;
};

const EMPTY_MOVEMENTS: InventoryMovement[] = [];

const panelModules: PanelModule[] = [
  {
    title: "Ventas",
    description: "Consulta de ventas y pagos. El registro y la anulación dependen de tus permisos.",
    to: "/administracion/ventas",
    read: "VENTAS_LEER",
    actions: [
      { label: "Registrar venta", to: "/administracion/ventas", permission: "VENTAS_CREAR" },
    ],
  },
  {
    title: "Clientes",
    description: "Directorio de clientes para la atención y el registro de ventas.",
    to: "/administracion/clientes",
    read: "CLIENTES_LEER",
    actions: [
      { label: "Nuevo cliente", to: "/administracion/clientes", permission: "CLIENTES_CREAR" },
    ],
  },
  {
    title: "Productos",
    description: "Catálogo, precios y disponibilidad de productos.",
    to: "/administracion/productos",
    read: "PRODUCTOS_LEER",
    actions: [
      { label: "Nuevo producto", to: "/administracion/productos", permission: "PRODUCTOS_CREAR" },
    ],
  },
  {
    title: "Inventario",
    description: "Existencias y movimientos de inventario.",
    to: "/administracion/inventario",
    read: "INVENTARIO_LEER",
    actions: [],
  },
  {
    title: "Compras",
    description: "Compras a proveedores y actualización de existencias.",
    to: "/administracion/compras",
    read: "INVENTARIO_LEER",
    actions: [
      { label: "Registrar compra", to: "/administracion/compras", permission: "INVENTARIO_EDITAR" },
    ],
  },
  {
    title: "Reportes",
    description: "Resumen de ventas e ingresos reales por período.",
    to: "/administracion/reportes",
    read: "VENTAS_LEER",
    allowedRoles: ["ADMIN", "SUPERVISOR"],
    actions: [],
  },
  {
    title: "Notificaciones",
    description: "Alertas y avisos del sistema.",
    to: "/administracion/notificaciones",
    read: "NOTIFICACIONES_LEER",
    actions: [],
  },
];

function readStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem("sposabella_user");
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
  }).format(value ?? 0);
}

function formatMovementDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Panel de inicio para cualquier usuario autenticado. Solo muestra los módulos
 * que el usuario puede consultar y las acciones que puede ejecutar.
 */
function PanelPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loaded, can, hasRole, error } = usePermissions();
  const isAdmin = loaded && hasRole("ADMIN");
  const canReadSales = can("VENTAS_LEER");
  const canReadInventory = can("INVENTARIO_LEER");
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [dashboard, setDashboard] = useState<DashboardSummary>({
    loading: false,
  });
  const movementPagination = usePagination(
    dashboard.movements ?? EMPTY_MOVEMENTS,
  );
  const user = readStoredUser();
  const activeRoles = (user?.roles ?? [])
    .filter((role) => !role.estado || role.estado.toUpperCase() === "ACTIVO")
    .map((role) => role.nombre.toUpperCase());
  const roleNames = activeRoles.join(", ");
  const panelTitle = activeRoles.includes("ADMIN")
    ? "Panel de administración"
    : activeRoles.includes("SUPERVISOR")
      ? "Panel de supervisión"
      : activeRoles.includes("INVENTARIO")
        ? "Panel de inventario"
        : activeRoles.includes("VENDEDOR")
          ? "Panel de ventas"
          : activeRoles.includes("CONSULTA")
            ? "Panel de consulta"
            : "Panel de trabajo";

  const visibleModules = panelModules.filter(
    (module) =>
      can(module.read) &&
      (!module.allowedRoles ||
        module.allowedRoles.some((role) => hasRole(role))),
  );
  const quickActions = visibleModules.flatMap((module) =>
    module.actions
      .filter((action) => can(action.permission))
      .map((action) => ({ ...action, module: module.title })),
  );

  useEffect(() => {
    if (!isAdmin) return;

    let active = true;
    setDashboard({ loading: true });

    const tasks: Promise<void>[] = [];
    if (canReadSales) {
      const now = new Date();
      tasks.push(
        getMonthlyReport(now.getMonth() + 1, now.getFullYear())
          .then((sales) => {
            if (active) setDashboard((current) => ({ ...current, sales }));
          })
          .catch((cause: unknown) => {
            if (active) {
              setDashboard((current) => ({
                ...current,
                salesError: cause instanceof Error
                  ? cause.message
                  : "No se pudo consultar el resumen de ventas.",
              }));
            }
          }),
      );
    }

    if (canReadInventory) {
      tasks.push(
        getInventory({ stock_bajo: true })
          .then((items) => {
            if (active) {
              setDashboard((current) => ({ ...current, lowStockCount: items.length }));
            }
          })
          .catch((cause: unknown) => {
            if (active) {
              setDashboard((current) => ({
                ...current,
                inventoryError: cause instanceof Error
                  ? cause.message
                  : "No se pudo consultar el inventario.",
              }));
            }
          }),
      );
      tasks.push(
        getInventoryMovements(100)
          .then((movements) => {
            if (active) setDashboard((current) => ({ ...current, movements }));
          })
          .catch((cause: unknown) => {
            if (active) {
              setDashboard((current) => ({
                ...current,
                movementError: cause instanceof Error
                  ? cause.message
                  : "No se pudieron consultar los movimientos.",
              }));
            }
          }),
      );
    }

    void Promise.all(tasks).finally(() => {
      if (active) setDashboard((current) => ({ ...current, loading: false }));
    });

    return () => {
      active = false;
    };
  }, [isAdmin, canReadSales, canReadInventory, dashboardRefresh]);

  return (
    <AdministrationLayout
      sidebarOpen={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
    >
      <main className="flex-1 p-6 lg:p-10">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl border theme-border px-4 py-2 text-sm theme-text lg:hidden"
          >
            Menú
          </button>

          <div className="ml-auto flex items-center gap-3">
            <Link to="/cuenta" className="text-sm theme-text-soft hover:underline">
              Mi cuenta
            </Link>
            <LogoutButton />
          </div>
        </div>

        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] theme-text-muted">
            {panelTitle}
          </p>
          <h1 className="mt-2 text-3xl font-semibold theme-text">
            Hola{user?.nombre ? `, ${user.nombre}` : ""}
          </h1>
          {roleNames && (
            <p className="mt-2 text-sm theme-text-soft">Rol: {roleNames}</p>
          )}
        </header>

        {!loaded ? (
          <p className="mt-10 theme-text-soft">Cargando tus módulos...</p>
        ) : error ? (
          <section role="alert" className="glass soft-shadow mt-10 rounded-2xl p-6">
            <p className="theme-text">
              No fue posible consultar tus permisos. Recarga la página o inicia sesión de nuevo.
            </p>
          </section>
        ) : visibleModules.length === 0 ? (
          <section className="glass soft-shadow mt-10 rounded-2xl p-6">
            <p className="theme-text">
              Tu cuenta no tiene módulos asignados. Pide a un administrador que te asigne los permisos necesarios.
            </p>
          </section>
        ) : (
          <>
            {isAdmin && (
              <section className="mt-10">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.15em] theme-text-muted">
                      Resumen operativo
                    </h2>
                    <p className="mt-1 text-sm theme-text-soft">
                      Ventas del mes, alertas de inventario y actividad reciente.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDashboardRefresh((current) => current + 1)}
                    disabled={dashboard.loading}
                    className="rounded-xl border theme-border px-4 py-2 text-sm font-semibold theme-text disabled:opacity-50"
                  >
                    {dashboard.loading ? "Actualizando..." : "Actualizar resumen"}
                  </button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {canReadSales && (
                    <>
                      <SummaryCard
                        label="Ventas válidas del mes"
                        value={dashboard.loading && !dashboard.sales
                          ? "Cargando..."
                          : dashboard.salesError
                            ? "No disponible"
                            : String(dashboard.sales?.cantidadVentas ?? 0)}
                        error={dashboard.salesError}
                      />
                      <SummaryCard
                        label="Ingresos por ventas válidas"
                        value={dashboard.loading && !dashboard.sales
                          ? "Cargando..."
                          : dashboard.salesError
                            ? "No disponible"
                            : formatCurrency(dashboard.sales?.ingresosPorVentas)}
                        error={dashboard.salesError}
                      />
                      <SummaryCard
                        label="Ventas anuladas del mes"
                        value={dashboard.loading && !dashboard.sales
                          ? "Cargando..."
                          : dashboard.salesError
                            ? "No disponible"
                            : String(dashboard.sales?.ventasCanceladas ?? 0)}
                        error={dashboard.salesError}
                      />
                    </>
                  )}
                  {canReadInventory && (
                    <SummaryCard
                      label="Variantes con stock bajo"
                      value={dashboard.loading && dashboard.lowStockCount === undefined
                        ? "Cargando..."
                        : dashboard.inventoryError
                          ? "No disponible"
                          : String(dashboard.lowStockCount ?? 0)}
                      error={dashboard.inventoryError}
                    />
                  )}
                </div>

                {canReadInventory && (
                  <section className="glass soft-shadow mt-5 rounded-2xl p-5">
                    <h3 className="font-semibold theme-text">Movimientos recientes de inventario</h3>
                    <p className="mt-1 text-sm theme-text-soft">
                      Últimos movimientos disponibles (máximo 100), organizados en páginas.
                    </p>
                    {dashboard.movementError && (
                      <p role="alert" className="mt-3 text-sm text-red-700">
                        {dashboard.movementError}
                      </p>
                    )}
                    {dashboard.loading && !dashboard.movements ? (
                      <p className="mt-3 text-sm theme-text-soft">Cargando movimientos...</p>
                    ) : dashboard.movements?.length ? (
                      <>
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full min-w-[600px] text-left text-sm">
                            <thead>
                              <tr className="border-b theme-border theme-text-muted">
                                <th className="px-3 py-2">Fecha</th>
                                <th className="px-3 py-2">Tipo</th>
                                <th className="px-3 py-2">Cantidad</th>
                                <th className="px-3 py-2">Referencia</th>
                                <th className="px-3 py-2">Motivo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {movementPagination.pageItems.map((movement) => (
                                <tr key={String(movement.id)} className="border-b theme-border theme-text">
                                  <td className="px-3 py-3">{formatMovementDate(movement.creado_en || movement.created_at)}</td>
                                  <td className="px-3 py-3">{movement.tipo_movimiento}</td>
                                  <td className="px-3 py-3">{movement.cantidad}</td>
                                  <td className="px-3 py-3">
                                    {movement.referencia_tipo
                                      ? `${movement.referencia_tipo}${movement.referencia_id ? ` #${movement.referencia_id}` : ""}`
                                      : "Sin referencia"}
                                  </td>
                                  <td className="px-3 py-3">{movement.motivo || "Sin motivo"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {movementPagination.total > movementPagination.pageSize && (
                          <PaginationControls
                            page={movementPagination.page}
                            pageCount={movementPagination.pageCount}
                            pageSize={movementPagination.pageSize}
                            total={movementPagination.total}
                            onPageChange={movementPagination.setPage}
                            onPageSizeChange={movementPagination.setPageSize}
                          />
                        )}
                      </>
                    ) : (
                      <p className="mt-3 text-sm theme-text-soft">
                        {dashboard.loading
                          ? "Cargando movimientos..."
                          : dashboard.movementError
                            ? "No se pudieron cargar los movimientos."
                            : "No hay movimientos recientes."}
                      </p>
                    )}
                  </section>
                )}
              </section>
            )}

            {quickActions.length > 0 && (
              <section className="mt-10">
                <h2 className="text-sm font-semibold uppercase tracking-[0.15em] theme-text-muted">
                  Acciones rápidas
                </h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {quickActions.map((action) => (
                    <Link
                      key={`${action.module}-${action.label}`}
                      to={action.to}
                      className="theme-button-dark rounded-xl px-5 py-3 text-sm font-semibold"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] theme-text-muted">
                Módulos
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleModules.map((module) => {
                  const canWrite = module.actions.some((action) =>
                    can(action.permission),
                  );

                  return (
                    <article
                      key={module.title}
                      className="glass soft-shadow flex flex-col rounded-2xl p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold theme-text">{module.title}</h3>
                        {!canWrite && (
                          <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-xs theme-text-soft">
                            Solo consulta
                          </span>
                        )}
                      </div>
                      <p className="mt-2 flex-1 text-sm theme-text-soft">
                        {module.description}
                      </p>
                      <Link
                        to={module.to}
                        className="mt-4 text-sm font-semibold theme-text hover:underline"
                      >
                        Abrir módulo
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </AdministrationLayout>
  );
}

function SummaryCard({
  label,
  value,
  error,
}: {
  label: string;
  value: string;
  error?: string;
}) {
  return (
    <article className="glass soft-shadow rounded-2xl p-5">
      <p className="text-sm theme-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold theme-text">{value}</p>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </article>
  );
}

export default PanelPage;
