const services = [
  {
    number: "01",
    title: "Descubre",
    text: "Explora nuestras colecciones y encuentra piezas que conecten contigo.",
    icon: "✦",
    bg: "bg-[#E8F5F7] dark:bg-[#25363A]",
  },
  {
    number: "02",
    title: "Prueba",
    text: "Visítanos y descubre cómo se sienten las piezas fuera de una pantalla.",
    icon: "◌",
    bg: "bg-[#F1EDF7] dark:bg-[#322C3B]",
  },
  {
    number: "03",
    title: "Personaliza",
    text: "Te ayudamos a combinar piezas y crear un estilo verdaderamente tuyo.",
    icon: "◇",
    bg: "bg-[#E9F6EF] dark:bg-[#263A32]",
  },
];

function Services() {
  return (
    <section
      id="servicios"
      className="section-padding theme-bg"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">

        {/* Heading */}

        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6CAD91]">
            Nuestra propuesta
          </p>

          <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] theme-text sm:text-5xl">
            Todo empieza con
            <br />
            una buena elección.
          </h2>

          <p className="mt-5 max-w-lg text-sm leading-7 theme-text-soft">
            Creemos que encontrar una pieza especial debería ser una
            experiencia. Por eso cada visita está pensada para descubrir,
            probar y crear.
          </p>
        </div>

        {/* Cards */}

        <div className="mt-14 grid gap-5 lg:grid-cols-3">

          {services.map((service) => (
            <article
              key={service.number}
              className={`group relative min-h-[330px] overflow-hidden rounded-[32px] ${service.bg} p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl`}
            >

              {/* Number + icon */}

              <div className="flex items-start justify-between">

                <span className="text-xs font-semibold text-black/35 dark:text-white/35">
                  {service.number}
                </span>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-xl text-[#263238] shadow-sm transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 dark:bg-black/15 dark:text-white">
                  {service.icon}
                </div>

              </div>

              {/* Content */}

              <div className="absolute bottom-8 left-8 right-8">

                <h3 className="text-2xl font-semibold theme-text">
                  {service.title}
                </h3>

                <p className="mt-3 max-w-sm text-sm leading-6 theme-text-soft">
                  {service.text}
                </p>

                <div className="mt-6 flex items-center gap-2 text-xs font-semibold theme-text">
                  Descubrir

                  <span className="transition-transform duration-300 group-hover:translate-x-2">
                    →
                  </span>
                </div>

              </div>

              {/* Decorative circle */}

              <div className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-white/20 transition-transform duration-700 group-hover:scale-150" />

            </article>
          ))}

        </div>
      </div>
    </section>
  );
}

export default Services;