import { useLocation, useNavigate } from "react-router-dom";

type AdministrationSidebarProps = {
  sidebarOpen: boolean;
  onClose: () => void;
};

function AdministrationSidebar({
  sidebarOpen,
  onClose,
}: AdministrationSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  const navButton = (label: string, path: string) => {
    const active =
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`);

    return (
      <button
        key={path}
        type="button"
        onClick={() => goTo(path)}
        className={`flex w-full justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
          active
            ? "bg-[var(--bg-secondary)] theme-text"
            : "theme-text-soft hover:bg-[var(--bg-secondary)]"
        }`}
      >
        {label}
      </button>
    );
  };

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
          <p className="px-4 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted">
            Usuarios y acceso
          </p>

          <nav className="space-y-1">
            {navButton("Usuarios activos", "/administracion/usuarios")}
            {navButton(
              "Usuarios inactivos",
              "/administracion/usuarios-inactivos",
            )}
            {navButton("Roles", "/administracion/roles")}
            {navButton("Permisos", "/administracion/permisos")}
            {navButton("Clientes", "/administracion/clientes")}
          </nav>

          <p className="px-4 pb-3 pt-7 text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted">
            Otros microservicios
          </p>

          <nav className="space-y-1">
            {navButton("Productos", "/administracion/productos")}
            {navButton("Categorías", "/administracion/categorias")}

            {navButton("Inventario", "/administracion/inventario")}
            {navButton("Compras", "/administracion/compras")}

            {navButton("Ventas", "/administracion/ventas")}

            {navButton("Notificaciones", "/administracion/notificaciones")}
          </nav>

          <p className="px-4 pb-3 pt-7 text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted">
            Análisis e IA
          </p>

          <nav className="space-y-1">
            {navButton("Entrenamiento", "/analisis/entrenamiento")}
            {navButton("Detección", "/analisis/deteccion")}
          </nav>
        </div>
      </aside>
    </>
  );
}

export default AdministrationSidebar;

