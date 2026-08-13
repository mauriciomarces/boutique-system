const benefits = [
  {
    number: "01",
    title: "Selección curada",
    text: "Cada pieza entra a nuestra colección porque tiene algo que contar.",
    color: "bg-[#E8F5F7] dark:bg-[#24383D]",
  },
  {
    number: "02",
    title: "Estilo personal",
    text: "No buscamos vestir a todo el mundo igual. Buscamos ayudarte a encontrar lo tuyo.",
    color: "bg-[#F1EDF7] dark:bg-[#322C3C]",
  },
  {
    number: "03",
    title: "Experiencia cercana",
    text: "Una boutique pensada para descubrir, probar y disfrutar sin prisas.",
    color: "bg-[#E9F6EF] dark:bg-[#263A32]",
  },
  {
    number: "04",
    title: "Detalles que importan",
    text: "Desde la primera visita hasta el último detalle, cuidamos cada momento.",
    color: "bg-[#FAEBF0] dark:bg-[#3A2B31]",
  },
];

function Benefits() {
  return (
    <section
      id="experiencia"
      className="section-padding theme-bg"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">

        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">

          {/* INTRO */}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6CAD91]">
              La experiencia Aurora
            </p>

            <h2 className="mt-5 max-w-md text-4xl font-semibold leading-tight tracking-[-0.04em] theme-text sm:text-5xl">
              Más que ropa.
              <br />
              Una forma de expresarte.
            </h2>

            <p className="mt-6 max-w-md text-sm leading-7 theme-text-soft">
              Hemos creado un espacio donde la moda, la personalidad y los
              pequeños detalles encuentran su punto de equilibrio.
            </p>

            <a
              href="#contacto"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold theme-text transition-transform hover:translate-x-1"
            >
              Descubre nuestra filosofía
              <span>→</span>
            </a>
          </div>

          {/* CARDS */}

          <div className="grid gap-4 sm:grid-cols-2">

            {benefits.map((benefit) => (
              <article
                key={benefit.number}
                className={`group rounded-3xl ${benefit.color} p-7 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl`}
              >

                <div className="flex items-start justify-between">

                  <span className="text-xs font-semibold text-black/40 dark:text-white/40">
                    {benefit.number}
                  </span>

                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-sm text-[#263238] transition-transform duration-500 group-hover:rotate-45 dark:bg-black/20 dark:text-white">
                    ↗
                  </span>

                </div>

                <h3 className="mt-14 text-lg font-semibold theme-text">
                  {benefit.title}
                </h3>

                <p className="mt-3 text-sm leading-6 theme-text-soft">
                  {benefit.text}
                </p>

              </article>
            ))}

          </div>
        </div>
      </div>
    </section>
  );
}

export default Benefits;