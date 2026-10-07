import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import AdministrationSidebar from "../../administration/components/AdministrationSidebar";

interface AnalysisLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

function AnalysisLayout({
  title,
  subtitle,
  children,
}: AnalysisLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="theme-bg min-h-screen">
      <header className="relative border-b theme-border bg-[var(--nav-bg)]">
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-6 lg:px-8">
          <Link
            to="/"
            className="theme-text"
          >
            <p className="text-sm font-semibold tracking-[0.08em]">
              BOUTIQUE SPOSABELLA
            </p>

            <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] theme-text-muted">
              Análisis experimental
            </p>
          </Link>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen((value) => !value)
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border theme-border bg-[var(--bg)] theme-text shadow-lg lg:hidden"
            aria-label="Abrir menú"
          >
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <AdministrationSidebar
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5b9279]">
            Pipeline experimental
          </p>

          <h1 className="mt-2 text-3xl font-semibold theme-text">
            {title}
          </h1>

          <p className="mt-2 mb-6 theme-text-soft">
            {subtitle}
          </p>

          {children}
        </main>
      </div>
    </div>
  );
}

export default AnalysisLayout;