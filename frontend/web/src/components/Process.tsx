const steps = [
  {
    number: "01",
    title: "Explora",
    description:
      "Conoce nuestras colecciones y encuentra inspiración.",
  },
  {
    number: "02",
    title: "Elige",
    description:
      "Selecciona las piezas que más conecten con tu estilo.",
  },
  {
    number: "03",
    title: "Descubre",
    description:
      "Visítanos para probarlas y recibir asesoramiento personalizado.",
  },
  {
    number: "04",
    title: "Vive",
    description:
      "Lleva contigo una pieza que forme parte de tu propia historia.",
  },
];

function Process() {
  return (
    <section
      id="nosotros"
      className="relative overflow-hidden bg-[#263238] text-white"
    >
      {/* Background decoration */}

      <div className="pointer-events-none absolute -right-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-[#D9CDEB]/10 blur-3xl" />

      <div className="pointer-events-none absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-[#B9DFE8]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">

        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">

          {/* LEFT */}

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
              Cómo funciona
            </p>

            <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              Del primer vistazo
              <br />
              al momento favorito.
            </h2>

            <p className="mt-6 max-w-md text-sm leading-7 text-white/55">
              Queremos que descubrir moda vuelva a sentirse como una
              experiencia y no como una simple compra.
            </p>

            {/* Decorative element */}

            <div className="relative mt-12 flex h-40 w-40 items-center justify-center rounded-full border border-white/10">

              <div className="absolute inset-3 animate-pulse-soft rounded-full border border-[#D9CDEB]/20" />

              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#D9CDEB] text-4xl text-[#263238] shadow-2xl">
                ✦
              </div>

            </div>
          </div>

          {/* STEPS */}

          <div>
            {steps.map((step) => (
              <div
                key={step.number}
                className="group flex gap-6 border-t border-white/10 py-7 transition-colors duration-300 hover:border-[#D9CDEB]/50"
              >

                <span className="w-6 shrink-0 text-xs text-white/30">
                  {step.number}
                </span>

                <div className="flex-1">

                  <h3 className="text-xl font-semibold transition-colors duration-300 group-hover:text-[#D9CDEB]">
                    {step.title}
                  </h3>

                  <p className="mt-2 max-w-lg text-sm leading-6 text-white/45">
                    {step.description}
                  </p>

                </div>

                <span className="text-xl text-white/20 transition-all duration-300 group-hover:translate-x-2 group-hover:text-[#D9CDEB]">
                  →
                </span>

              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

export default Process;