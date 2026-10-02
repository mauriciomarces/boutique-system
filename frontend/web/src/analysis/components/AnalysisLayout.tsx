import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

interface AnalysisLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

function AnalysisLayout({ title, subtitle, children }: AnalysisLayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="theme-bg min-h-screen">
      <header className="border-b theme-border bg-[var(--nav-bg)]">
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-6 lg:px-8">
          <Link to="/" className="theme-text">
            <p className="text-sm font-semibold tracking-[0.08em]">
              BOUTIQUE SPOSABELLA
            </p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] theme-text-muted">
              Análisis experimental
            </p>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border theme-border theme-text lg:hidden"
              aria-label="Abrir menú de análisis"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={() => navigate("/administracion")}
              className="rounded-full border theme-border px-4 py-2 text-sm font-semibold theme-text"
            >
              Administración
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}

      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-40 w-72 border-r theme-border bg-[var(--bg)] p-4 pt-24 shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:block lg:w-64 lg:translate-x-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          <div className="glass soft-shadow rounded-2xl p-4 lg:sticky lg:top-6">
            <p className="px-4 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-muted">
              Análisis e IA
            </p>
            <nav className="space-y-1">
              <Link
                to="/analisis/entrenamiento"
                className="block rounded-xl px-4 py-3 text-sm theme-text"
              >
                Entrenamiento
              </Link>
              <Link
                to="/analisis/deteccion"
                className="block rounded-xl px-4 py-3 text-sm theme-text-soft"
              >
                Detección
              </Link>
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b9279]">
            Pipeline experimental
          </p>
          <h1 className="mt-2 text-3xl font-semibold theme-text">{title}</h1>
          <p className="mt-2 mb-6 theme-text-soft">{subtitle}</p>
          {children}
        </main>
      </div>
    </div>
  );
}

export default AnalysisLayout;
