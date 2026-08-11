function CTA() {
  return (
    <section
      id="contacto"
      className="relative overflow-hidden theme-bg-tertiary"
    >
      {/* Decorative shapes */}

      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#B9DFE8]/60 blur-2xl" />

      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-[#EFC8D6]/50 blur-3xl" />

      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">

        <div className="relative max-w-2xl">

          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#59676D] dark:text-[#B7C0C2]">
            Tu próxima historia
          </p>

          <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.045em] theme-text sm:text-5xl lg:text-6xl">
            Ven a descubrir
            <br />
            Boutique SposaBella.
          </h2>

          <p className="mt-6 max-w-lg text-sm leading-7 theme-text-soft">
            Te esperamos para descubrir nuevas piezas, probar estilos y
            encontrar aquello que simplemente se siente como tú.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">

            <a
              href="#inicio"
              className="theme-button-dark inline-flex items-center justify-center rounded-full px-7 py-4 text-sm font-semibold transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              Explorar Boutique SposaBella
            </a>

            <a
              href="#contacto"
              className="theme-button-light inline-flex items-center justify-center rounded-full border theme-border px-7 py-4 text-sm font-semibold transition-all duration-300 hover:-translate-y-1"
            >
              Reservar una visita
            </a>

          </div>
        </div>

        <div className="absolute bottom-8 right-8 hidden h-32 w-32 items-center justify-center rounded-full border theme-border lg:flex">

          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--card)] text-3xl theme-text">
            ✦
          </div>

        </div>
      </div>
    </section>
  );
}

export default CTA;