function Footer() {
  const exploreLinks = [
    { label: "Inicio", href: "#inicio" },
    { label: "Colección", href: "#coleccion" },
    { label: "Servicios", href: "#servicios" },
    { label: "Nosotros", href: "#nosotros" },
  ];

  const informationLinks = [
    { label: "Privacidad", href: "#privacidad" },
    { label: "Términos", href: "#terminos" },
  ];

  return (
    <footer className="relative overflow-hidden bg-[#263238] text-white">

      {/* Decorative pastel glow */}

      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#D9CDEB]/10 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-[#B9DFE8]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">

        {/* Main grid */}

        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">

          {/* BRAND */}

          <div>

            <a
              href="#inicio"
              className="group inline-flex items-center gap-3"
            >
              <div
                className="
                  relative flex h-10 w-10
                  items-center justify-center
                  overflow-hidden rounded-xl
                  bg-white
                  text-sm font-semibold
                  text-[#263238]
                  transition-transform duration-500
                  group-hover:rotate-[-6deg]
                "
              >
                <span className="relative z-10">
                  MA
                </span>

                <span
                  className="
                    absolute -bottom-3 -right-3
                    h-7 w-7 rounded-full
                    bg-[#D9CDEB]
                    opacity-70
                  "
                />
              </div>

              <div>
                <p className="text-sm font-semibold tracking-[0.08em]">
                  BOUTIQUE SPOSABELLA
                </p>

                <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-white/40">
                  Boutique de moda
                </p>
              </div>
            </a>

            <p className="mt-6 max-w-xs text-sm leading-6 text-white/45">
              Una boutique creada para descubrir piezas, expresar
              identidad y disfrutar de la moda de una manera diferente.
            </p>

            {/* Social */}

            <div className="mt-7 flex gap-2">

              {["IG", "FB", "TK"].map((social) => (
                <a
                  key={social}
                  href="#contacto"
                  aria-label={`Síguenos en ${social}`}
                  className="
                    flex h-9 w-9
                    items-center justify-center
                    rounded-full
                    border border-white/10
                    text-[9px] font-medium
                    uppercase
                    text-white/50
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:border-white
                    hover:bg-white
                    hover:text-[#263238]
                  "
                >
                  {social}
                </a>
              ))}

            </div>
          </div>

          {/* EXPLORE */}

          <div>

            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
              Explorar
            </h3>

            <nav className="mt-5 space-y-3">

              {exploreLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="
                    group flex items-center gap-2
                    text-sm text-white/45
                    transition-colors duration-300
                    hover:text-white
                  "
                >
                  <span
                    className="
                      h-px w-0
                      bg-[#D9CDEB]
                      transition-all duration-300
                      group-hover:w-3
                    "
                  />

                  {link.label}
                </a>
              ))}

            </nav>
          </div>

          {/* BOUTIQUE */}

          <div>

            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
              Boutique
            </h3>

            <div className="mt-5 space-y-3 text-sm text-white/45">

              <p>
                Av. Aurora 124
              </p>

              <p>
                La Paz, Bolivia
              </p>

              <p>
                Mar - Sáb · 10:00 - 19:00
              </p>

            </div>
          </div>

          {/* CONTACT */}

          <div id="contacto">

            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
              Contacto
            </h3>

            <div className="mt-5 space-y-3">

              <a
                href="mailto:hola@boutiquesposabella.com"
                className="
                  block text-sm text-white/45
                  transition-colors duration-300
                  hover:text-white
                "
              >
                hola@boutiquesposabella.com
              </a>

              <a
                href="tel:+59170000000"
                className="
                  block text-sm text-white/45
                  transition-colors duration-300
                  hover:text-white
                "
              >
                +591 700 000 00
              </a>

              <a
                href="#contacto"
                className="
                  mt-5 inline-flex
                  items-center gap-2
                  text-xs font-semibold
                  text-[#D9CDEB]
                  transition-all duration-300
                  hover:gap-3
                "
              >
                Reservar una visita
                <span>→</span>
              </a>

            </div>
          </div>
        </div>

        {/* Bottom */}

        <div
          className="
            mt-14
            flex flex-col
            justify-between
            gap-4
            border-t border-white/10
            pt-7
            text-[10px] text-white/30
            sm:flex-row
          "
        >

          <p>
            © 2026 Boutique SposaBella. Todos los derechos reservados.
          </p>

          <div className="flex gap-5">

            {informationLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}

          </div>
        </div>

      </div>
    </footer>
  );
}

export default Footer;