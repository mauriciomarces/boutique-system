import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="theme-bg min-h-screen">
      <header className="border-b theme-border">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center px-6 lg:px-8">
          <Link to="/" className="group flex items-center gap-3">
            <div
              className="
                relative flex h-10 w-10 items-center justify-center
                overflow-hidden rounded-xl
                bg-[var(--button-dark)]
                text-sm font-semibold
                text-[var(--button-dark-text)]
                shadow-sm
                transition-transform duration-300
                group-hover:scale-105
              "
            >
              <span className="relative z-10">BS</span>

              <span
                className="
                  absolute -bottom-4 -right-4
                  h-8 w-8 rounded-full
                  bg-[#D9CDEB]
                  opacity-60
                "
              />
            </div>

            <div>
              <p className="text-sm font-semibold tracking-[0.08em] theme-text">
                BOUTIQUE SPOSABELLA
              </p>

              <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] theme-text-muted">
                Boutique de moda
              </p>
            </div>
          </Link>
        </div>
      </header>

      <main className="relative flex min-h-[calc(100vh-76px)] items-center justify-center overflow-hidden px-6 py-12">
        <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#D9CDEB]/30 blur-3xl" />

        <div className="pointer-events-none absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-[#B9E2D0]/25 blur-3xl" />

        <div className="relative z-10 w-full max-w-md">
          <div className="glass soft-shadow rounded-3xl p-7 sm:p-9">
            <div className="mb-8 text-center">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6CAD91]">
                SposaBella
              </p>

              <h1 className="text-2xl font-semibold tracking-tight theme-text sm:text-3xl">
                {title}
              </h1>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 theme-text-soft">
                {subtitle}
              </p>
            </div>

            {children}

            {footer && (
              <div className="mt-7 border-t theme-border pt-6 text-center">
                {footer}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
