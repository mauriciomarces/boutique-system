import { useEffect, useState } from "react";

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

function Navbar({ darkMode, setDarkMode }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const links = [
    { label: "Inicio", href: "#inicio" },
    { label: "Colección", href: "#coleccion" },
    { label: "Servicios", href: "#servicios" },
    { label: "Nosotros", href: "#nosotros" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const toggleTheme = () => {
    setDarkMode((value) => !value);
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b theme-border transition-all duration-500 ${
        scrolled
          ? "bg-[var(--nav-bg)] shadow-sm backdrop-blur-2xl"
          : "bg-[var(--nav-bg)] backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-6 lg:px-8">

        {/* LOGO */}

        <a
          href="#inicio"
          onClick={() => setOpen(false)}
          className="group flex items-center gap-3"
        >
          <div
            className="
              relative flex h-10 w-10 items-center justify-center
              overflow-hidden rounded-xl
              bg-[var(--button-dark)]
              text-sm font-semibold
              text-[var(--button-dark-text)]
              shadow-sm
              transition-all duration-500
              group-hover:rotate-[-6deg]
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
                transition-transform duration-500
                group-hover:scale-150
              "
            />
          </div>

          <div className="hidden sm:block">
            <p className="text-sm font-semibold tracking-[0.08em] theme-text">
              BOUTIQUE SPOSABELLA
            </p>

            <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] theme-text-muted">
              Boutique de moda
            </p>
          </div>
        </a>

        {/* DESKTOP NAVIGATION */}

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="
                relative py-2
                text-sm font-medium
                theme-text-soft
                transition-colors duration-300
                hover:theme-text
              "
            >
              {link.label}

              <span
                className="
                  absolute bottom-0 left-1/2
                  h-px w-0
                  -translate-x-1/2
                  bg-[#6CAD91]
                  transition-all duration-300
                  group-hover:w-full
                "
              />
            </a>
          ))}
        </nav>

        {/* DESKTOP ACTIONS */}

        <div className="hidden items-center gap-3 md:flex">

          {/* THEME */}

          <button
            onClick={toggleTheme}
            className="
              group relative flex h-10 w-10
              items-center justify-center
              overflow-hidden rounded-full
              border theme-border
              bg-[var(--bg-secondary)]
              theme-text
              transition-all duration-300
              hover:scale-105
              hover:shadow-md
            "
            aria-label={
              darkMode
                ? "Cambiar a modo claro"
                : "Cambiar a modo oscuro"
            }
            title={
              darkMode
                ? "Cambiar a modo claro"
                : "Cambiar a modo oscuro"
            }
          >
            <span
              className={`absolute text-base transition-all duration-500 ${
                darkMode
                  ? "translate-y-0 rotate-0 scale-100 opacity-100"
                  : "translate-y-8 rotate-90 scale-50 opacity-0"
              }`}
            >
              ☀
            </span>

            <span
              className={`absolute text-base transition-all duration-500 ${
                darkMode
                  ? "-translate-y-8 -rotate-90 scale-50 opacity-0"
                  : "translate-y-0 rotate-0 scale-100 opacity-100"
              }`}
            >
              ☾
            </span>
          </button>

          {/* CTA */}

          <a
            href="#contacto"
            className="
              theme-button-dark
              rounded-full
              px-5 py-2.5
              text-xs font-semibold
              transition-all duration-300
              hover:-translate-y-0.5
              hover:shadow-lg
            "
          >
            Visítanos
          </a>
        </div>

        {/* MOBILE ACTIONS */}

        <div className="flex items-center gap-2 md:hidden">

          <button
            onClick={toggleTheme}
            className="
              flex h-10 w-10
              items-center justify-center
              rounded-full
              border theme-border
              bg-[var(--bg-secondary)]
              theme-text
              transition-all
              hover:scale-105
            "
            aria-label="Cambiar tema"
          >
            <span className="text-sm">
              {darkMode ? "☀" : "☾"}
            </span>
          </button>

          <button
            onClick={() => setOpen((value) => !value)}
            className="
              flex h-10 w-10
              items-center justify-center
              rounded-xl
              border theme-border
              bg-[var(--bg-secondary)]
              theme-text
            "
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
          >
            <div className="relative h-5 w-5">

              <span
                className={`absolute left-0 top-1 block h-px w-5 bg-[var(--text)] transition-all duration-300 ${
                  open
                    ? "top-2.5 rotate-45"
                    : ""
                }`}
              />

              <span
                className={`absolute left-0 top-2.5 block h-px w-5 bg-[var(--text)] transition-all duration-300 ${
                  open
                    ? "opacity-0"
                    : ""
                }`}
              />

              <span
                className={`absolute left-0 top-4 block h-px w-5 bg-[var(--text)] transition-all duration-300 ${
                  open
                    ? "top-2.5 -rotate-45"
                    : ""
                }`}
              />

            </div>
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}

      <div
        className={`
          overflow-hidden
          border-t theme-border
          bg-[var(--bg)]
          transition-all duration-500
          md:hidden
          ${
            open
              ? "max-h-[500px] opacity-100"
              : "max-h-0 opacity-0"
          }
        `}
      >
        <nav className="space-y-1 px-6 py-5">

          {links.map((link, index) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="
                flex items-center justify-between
                rounded-xl
                px-4 py-3.5
                text-sm font-medium
                theme-text-soft
                transition-all duration-300
                hover:bg-[var(--bg-secondary)]
                hover:theme-text
              "
            >
              <span>{link.label}</span>

              <span className="text-[#899397]">
                0{index + 1}
              </span>
            </a>
          ))}

          <a
            href="#contacto"
            onClick={() => setOpen(false)}
            className="
              theme-button-dark
              mt-3 block
              rounded-xl
              px-4 py-3.5
              text-center
              text-sm font-semibold
              shadow-sm
            "
          >
            Visítanos
          </a>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;