function Hero() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden theme-bg"
    >
      {/* Background pastel */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float-slow absolute -left-32 top-10 h-96 w-96 rounded-full bg-[#B9DFE8]/45 blur-3xl" />

        <div className="animate-pulse-soft absolute right-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[#D9CDEB]/45 blur-3xl" />

        <div className="animate-float-slow absolute bottom-[-15%] left-[35%] h-[450px] w-[450px] rounded-full bg-[#B9E2D0]/30 blur-3xl" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--bg)_80%)]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-center gap-16 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">

        {/* LEFT */}

        <div className="relative z-10">

          {/* Badge */}

          <div className="animate-reveal inline-flex items-center gap-2 rounded-full border theme-border bg-[var(--card)] px-4 py-2 backdrop-blur-xl">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#6CAD91]" />

            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] theme-text-soft">
              Nueva colección · 2026
            </span>
          </div>

          {/* Heading */}

          <h1 className="animate-reveal mt-7 max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] theme-text sm:text-6xl lg:text-[5.5rem]">
            Viste tu
            <br />

            <span className="relative inline-block">
              propia historia.

              <svg
                className="pointer-events-none absolute -bottom-3 left-0 h-3 w-full"
                viewBox="0 0 350 12"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M2 8C70 2 130 11 190 6C250 1 300 8 348 4"
                  stroke="#D9CDEB"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          {/* Description */}

          <p className="animate-reveal mt-8 max-w-lg text-base leading-7 theme-text-soft sm:text-lg">
            Piezas seleccionadas para personas que no buscan simplemente
            vestir bien, sino expresar quiénes son.
          </p>

          {/* Actions */}

          <div className="animate-reveal mt-9 flex flex-col gap-3 sm:flex-row">

            <a
              href="#coleccion"
              className="theme-button-dark group inline-flex items-center justify-center gap-3 rounded-full px-7 py-4 text-sm font-semibold transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              Explorar colección

              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-1 dark:bg-white/10">
                →
              </span>
            </a>

            <a
              href="#nosotros"
              className="theme-button-light inline-flex items-center justify-center rounded-full border theme-border px-7 py-4 text-sm font-semibold backdrop-blur transition-all duration-300 hover:-translate-y-1"
            >
              Nuestra historia
            </a>

          </div>

          {/* Stats */}

          <div className="mt-12 flex flex-wrap gap-8 border-t theme-border pt-7">

            <div>
              <p className="text-2xl font-semibold theme-text">
                120+
              </p>

              <p className="mt-1 text-xs theme-text-muted">
                Piezas curadas
              </p>
            </div>

            <div>
              <p className="text-2xl font-semibold theme-text">
                08
              </p>

              <p className="mt-1 text-xs theme-text-muted">
                Colecciones
              </p>
            </div>

            <div>
              <p className="text-2xl font-semibold theme-text">
                4.9/5
              </p>

              <p className="mt-1 text-xs theme-text-muted">
                Experiencia
              </p>
            </div>

          </div>
        </div>

        {/* RIGHT VISUAL */}

        <div className="relative mx-auto h-[570px] w-full max-w-[570px]">

          {/* Rings */}

          <div className="absolute left-1/2 top-1/2 h-[470px] w-[470px] -translate-x-1/2 -translate-y-1/2 rounded-full border theme-border" />

          <div className="absolute left-1/2 top-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D9CDEB]/60" />

          {/* Main image */}

          <div className="group absolute left-1/2 top-1/2 h-[440px] w-[330px] -translate-x-1/2 -translate-y-1/2 rotate-[3deg] overflow-hidden rounded-[180px_180px_30px_30px] border-[10px] border-[var(--bg-secondary)] shadow-2xl transition-transform duration-700 hover:rotate-0">

            <img
              src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=85"
              alt="Modelo luciendo una colección de Boutique SposaBella"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#263238]/30 via-transparent to-transparent" />
          </div>

          {/* Curated card */}

          <div className="glass soft-shadow absolute left-0 top-20 w-44 rotate-[-6deg] rounded-2xl p-4 transition-transform duration-500 hover:rotate-0">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E9F6EF] text-sm text-[#6CAD91]">
                ✦
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-wider theme-text-muted">
                  Curated
                </p>

                <p className="mt-0.5 text-xs font-semibold theme-text">
                  Selección Aurora
                </p>
              </div>

            </div>
          </div>

          {/* Palette card */}

          <div className="glass soft-shadow absolute bottom-20 right-0 w-48 rotate-[6deg] rounded-2xl p-4 transition-transform duration-500 hover:rotate-0">

            <p className="text-[9px] uppercase tracking-[0.16em] theme-text-muted">
              Paleta de temporada
            </p>

            <div className="mt-3 flex gap-2">
              <span className="h-7 w-7 rounded-full bg-[#B9DFE8]" />
              <span className="h-7 w-7 rounded-full bg-[#D9CDEB]" />
              <span className="h-7 w-7 rounded-full bg-[#EFC8D6]" />
              <span className="h-7 w-7 rounded-full bg-[#F3D0B0]" />
            </div>

          </div>

          {/* Floating star */}

          <div className="animate-float absolute right-8 top-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--button-dark)] text-xl text-[var(--button-dark-text)] shadow-xl">
            ✦
          </div>

          {/* Dots */}

          <span className="absolute bottom-8 left-20 h-3 w-3 rounded-full bg-[#EFC8D6]" />

          <span className="absolute right-20 top-32 h-2.5 w-2.5 rounded-full bg-[#F3D0B0]" />

        </div>
      </div>
    </section>
  );
}

export default Hero;