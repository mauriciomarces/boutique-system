function Features() {
  const features = [
    {
      number: "01",
      title: "Trámites sin desplazamientos",
      description:
        "Inicia y gestiona tus solicitudes desde cualquier lugar, sin depender de horarios de atención ni visitas innecesarias.",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.6}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      ),
    },
    {
      number: "02",
      title: "Seguimiento en tiempo real",
      description:
        "Consulta el progreso de tus solicitudes y mantente informado de cada actualización.",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.6}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"
          />
        </svg>
      ),
    },
    {
      number: "03",
      title: "Toda tu información",
      description:
        "Documentos, solicitudes y datos importantes reunidos en un espacio organizado y fácil de consultar.",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.6}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h3.879a2.25 2.25 0 0 1 1.591.659l6.621 6.621a2.25 2.25 0 0 1 0 3.182l-3.879 3.879a2.25 2.25 0 0 1-3.182 0L5.159 12.22A2.25 2.25 0 0 1 4.5 10.629V6.75Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 8.25h.008v.008H8.25V8.25Z"
          />
        </svg>
      ),
    },
    {
      number: "04",
      title: "Seguridad desde el inicio",
      description:
        "Tu información personal permanece protegida mediante autenticación y controles de acceso.",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.6}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3.75 19.5 6v5.25c0 4.65-3.15 7.92-7.5 9-4.35-1.08-7.5-4.35-7.5-9V6L12 3.75Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m9.25 12 1.75 1.75 3.75-4"
          />
        </svg>
      ),
    },
  ];

  return (
    <section
      id="beneficios"
      className="overflow-hidden bg-[#F8FAFC]"
    >
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
        {/* Encabezado */}
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#167D8D]">
              Una experiencia diferente
            </p>

            <h2 className="mt-4 max-w-lg text-4xl font-semibold leading-tight tracking-[-0.035em] text-[#0B293F] sm:text-5xl">
              Menos pasos.
              <br />
              Más control.
            </h2>
          </div>

          <p className="max-w-xl text-base leading-7 text-[#64748B] lg:justify-self-end lg:text-lg">
            Diseñamos el portal para que las gestiones que antes requerían
            tiempo y desplazamientos puedan realizarse de forma sencilla
            desde un único espacio digital.
          </p>
        </div>

        {/* Línea */}
        <div className="mt-16 h-px bg-[#DCE5E9]" />

        {/* Features */}
        <div className="grid md:grid-cols-2">
          {features.map((feature, index) => (
            <article
              key={feature.number}
              className={`group relative py-10 ${
                index % 2 === 0 ? "md:pr-12" : "md:pl-12"
              } ${
                index < 2 ? "border-b border-[#DCE5E9]" : ""
              } ${
                index % 2 === 0 ? "md:border-r md:border-[#DCE5E9]" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-6">
                <span className="font-mono text-xs text-[#94A3B8]">
                  {feature.number}
                </span>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#DCE5E9] text-[#167D8D] transition-all duration-300 group-hover:border-[#167D8D] group-hover:bg-[#167D8D] group-hover:text-white">
                  {feature.icon}
                </div>
              </div>

              <div className="mt-8 max-w-md">
                <h3 className="text-xl font-semibold tracking-tight text-[#0B293F]">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-[#64748B]">
                  {feature.description}
                </p>
              </div>

              <div className="mt-8 h-px w-0 bg-[#3CB6A0] transition-all duration-500 group-hover:w-16" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;