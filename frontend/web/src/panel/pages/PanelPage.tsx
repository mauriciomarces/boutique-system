import { useState } from "react";
import { Link } from "react-router-dom";
import AdministrationSidebar from "../../administration/components/AdministrationSidebar";
import LogoutButton from "../../auth/components/LogoutButton";
import usePermissions from "../../auth/hooks/usePermissions";

type StoredUser = {
  nombre?: string;
  roles?: Array<{ nombre: string }>;
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
  actions: ModuleAction[];
};

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

/**
 * Panel de inicio para cualquier usuario autenticado. Solo muestra los módulos
 * que el usuario puede consultar y las acciones que puede ejecutar.
 */
function PanelPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loaded, can } = usePermissions();
  const user = readStoredUser();
  const roleNames = (user?.roles ?? []).map((role) => role.nombre).join(", ");

  const visibleModules = panelModules.filter((module) => can(module.read));
  const quickActions = visibleModules.flatMap((module) =>
    module.actions
      .filter((action) => can(action.permission))
      .map((action) => ({ ...action, module: module.title })),
  );

  return (
    <div className="theme-bg min-h-screen lg:flex">
      <AdministrationSidebar
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

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
            Panel
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
        ) : visibleModules.length === 0 ? (
          <section className="glass soft-shadow mt-10 rounded-2xl p-6">
            <p className="theme-text">
              Tu cuenta no tiene módulos asignados. Pide a un administrador que te asigne los permisos necesarios.
            </p>
          </section>
        ) : (
          <>
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
    </div>
  );
}

export default PanelPage;
