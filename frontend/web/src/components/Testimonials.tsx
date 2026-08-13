import { useState } from "react";

const testimonials = [
  {
    quote:
      "Entré buscando un vestido y terminé encontrando una forma completamente nueva de combinar mi estilo.",
    name: "Valentina R.",
    role: "Cliente Aurora",
    initials: "VR",
    color: "bg-[#E8F5F7] dark:bg-[#25363A]",
  },
  {
    quote:
      "La atención es increíble. Se siente más como descubrir algo especial que como simplemente ir de compras.",
    name: "Camila M.",
    role: "Cliente Aurora",
    initials: "CM",
    color: "bg-[#F1EDF7] dark:bg-[#322C3B]",
  },
  {
    quote:
      "Las prendas tienen personalidad. Cada vez que llevo algo de Aurora alguien termina preguntándome dónde lo encontré.",
    name: "Sofía A.",
    role: "Cliente Aurora",
    initials: "SA",
    color: "bg-[#FAEBF0] dark:bg-[#3A2B31]",
  },
];

function Testimonials() {
  const [current, setCurrent] = useState(0);

  const testimonial = testimonials[current];

  return (
    <section className="section-padding theme-bg-secondary">
      <div className="mx-auto max-w-5xl px-6 text-center">

        {/* Heading */}

        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6CAD91]">
          Lo que dicen de nosotros
        </p>

        <div className="mt-12">

          {/* Quote icon */}

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#263238] text-xl text-white shadow-lg">
            “
          </div>

          {/* Quote */}

          <blockquote
            key={testimonial.quote}
            className="animate-reveal mx-auto mt-8 max-w-3xl text-3xl font-medium leading-tight tracking-[-0.035em] theme-text sm:text-4xl"
          >
            {testimonial.quote}
          </blockquote>

          {/* Person */}

          <div
            key={testimonial.name}
            className="animate-reveal mt-8"
          >
            <div
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${testimonial.color} text-xs font-semibold theme-text`}
            >
              {testimonial.initials}
            </div>

            <p className="mt-3 text-sm font-semibold theme-text">
              {testimonial.name}
            </p>

            <p className="mt-1 text-xs theme-text-muted">
              {testimonial.role}
            </p>
          </div>
        </div>

        {/* Navigation */}

        <div className="mt-10 flex items-center justify-center gap-2">

          {testimonials.map((item, index) => (
            <button
              key={item.name}
              onClick={() => setCurrent(index)}
              aria-label={`Ver testimonio de ${item.name}`}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                index === current
                  ? "w-8 bg-[#263238] dark:bg-[#D9CDEB]"
                  : "w-1.5 bg-[#D9CDEB] dark:bg-white/20"
              }`}
            />
          ))}

        </div>

      </div>
    </section>
  );
}

export default Testimonials;