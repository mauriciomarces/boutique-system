import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchEffectivePermissions } from "../../auth/services/permissions";

type AdministrationSidebarProps = {
  sidebarOpen: boolean;
  onClose: () => void;
};

type NavItem = {
  label: string;
  path: string;
  /** Permiso requerido para mostrar la opción. Sin valor: visible para cualquier sesión. */
  permission?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    title: "Usuarios y acceso",
    items: [
      { label: "Usuarios activos", path: "/administracion/usuarios", permission: "USUARIOS_LEER" },
      { label: "Usuarios inactivos", path: "/administracion/usuarios-inactivos", permission: "USUARIOS_LEER" },
      { label: "Roles", path: "/administracion/roles", permission: "ROLES_LEER" },
      { label: "Permisos", path: "/administracion/permisos", permission: "PERMISOS_LEER" },
      { label: "Clientes", path: "/administracion/clientes", permission: "CLIENTES_LEER" },
    ],
  },
  {
    title: "Otros microservicios",
    items: [
      { label: "Productos", path: "/administracion/productos", permission: "PRODUCTOS_LEER" },
      { label: "Categorías", path: "/administracion/categorias", permission: "PRODUCTOS_LEER" },
      { label: "Inventario", path: "/administracion/inventario", permission: "INVENTARIO_LEER" },
      { label: "Compras", path: "/administracion/compras", permission: "INVENTARIO_LEER" },
      { label: "Ventas", path: "/administracion/ventas", permission: "VENTAS_LEER" },
      { label: "Notificaciones", path: "/administracion/notificaciones", permission: "NOTIFICACIONES_LEER" },
    ],
  },
  {
    title: "Análisis e IA",
    items: [
      { label: "Entrenamiento", path: "/analisis/entrenamiento" },
      { label: "Detección", path: "/analisis/deteccion" },
    ],
  },
];

function AdministrationSidebar({
  sidebarOpen,
  onClose,
}: AdministrationSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [permisos, setPermisos] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchEffectivePermissions()
      .then((set) => {
        if (!cancelled) setPermisos(set);
      })
      .catch(() => {
        // Sin permisos conocidos no se muestran opciones restringidas.
        if (!cancelled) setPermisos(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  const navButton = (item: NavItem) => {
    const active =
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`);

    return (
      <button
        key={item.path}
        type="button"
        onClick={() => goTo(item.path)}
        className={`flex w-full justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
          active
            ? "bg-[var(--bg-secondary)] theme-text"
            : "theme-text-soft hover:bg-[var(--bg-secondary)]"
        }`}
      >
        {item.label}
      </button>
    );
  };

  const visibleItems = (items: NavItem[]) =>
    permisos === null
      ? []
      : items.filter(
          (item) => !item.permission || permisos.has(item.permission),
        );

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto overscroll-contain border-r theme-border bg-[var(--bg)] p-4 pt-24 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:block lg:h-[100dvh] lg:max-h-[100dvh] lg:w-64 lg:shrink-0 lg:translate-x-0 lg:overflow-y-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
      >
        <div className="glass soft-shadow min-h-full rounded-2xl p-4">
          {navGroups.map((group, index) => {
            const items = visibleItems(group.items);
            if (items.length === 0) return null;

            return (
              <div key={group.title}>
                <p
                  className={`px-4 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted ${
                    index > 0 ? "pt-7" : ""
                  }`}
                >
                  {group.title}
                </p>

                <nav className="space-y-1">{items.map(navButton)}</nav>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

export default AdministrationSidebar;
