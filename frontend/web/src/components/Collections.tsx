import { useState } from "react";

const categories = [
  "Todo",
  "Nueva temporada",
  "Esenciales",
  "Accesorios",
];

const products = [
  {
    name: "Aurora Silk",
    category: "Nueva temporada",
    price: "$89",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
  },
  {
    name: "Luna Studio",
    category: "Esenciales",
    price: "$74",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=85",
  },
  {
    name: "Nocturne",
    category: "Nueva temporada",
    price: "$96",
    image:
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
  },
  {
    name: "Mila Bag",
    category: "Accesorios",
    price: "$58",
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85",
  },
];

function Collections() {
  const [active, setActive] = useState("Todo");

  const filtered =
    active === "Todo"
      ? products
      : products.filter(
          (product) => product.category === active,
        );

  return (
    <section
      id="coleccion"
      className="section-padding theme-bg-secondary"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">

        {/* HEADER */}

        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#6CAD91]">
              Colección 2026
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] theme-text sm:text-5xl">
              Piezas para recordar.
            </h2>
          </div>

          {/* FILTERS */}

          <div className="flex flex-wrap gap-2">

            {categories.map((category) => {
              const selected = active === category;

              return (
                <button
                  key={category}
                  onClick={() => setActive(category)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                    selected
                      ? "theme-button-dark shadow-md"
                      : "theme-bg border theme-border theme-text-soft hover:theme-bg-tertiary"
                  }`}
                >
                  {category}
                </button>
              );
            })}

          </div>
        </div>

        {/* PRODUCTS */}

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

          {filtered.map((product) => (
            <article
              key={product.name}
              className="group animate-reveal"
            >

              <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-[#E8F5F7] dark:bg-[#253238]">

                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />

                <div className="absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#263238] backdrop-blur dark:bg-[#15191b]/85 dark:text-white">
                  {product.category}
                </div>

                <button
                  className="absolute bottom-4 right-4 flex h-11 w-11 translate-y-3 items-center justify-center rounded-full bg-white text-lg text-[#263238] opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 dark:bg-[#1d2326] dark:text-white"
                  aria-label={`Ver ${product.name}`}
                >
                  +
                </button>

              </div>

              <div className="mt-5 flex items-start justify-between">

                <div>
                  <h3 className="text-sm font-semibold theme-text">
                    {product.name}
                  </h3>

                  <p className="mt-1 text-xs theme-text-muted">
                    Boutique SposaBella
                  </p>
                </div>

                <p className="text-sm font-semibold theme-text">
                  {product.price}
                </p>

              </div>
            </article>
          ))}

        </div>

        {/* CTA */}

        <div className="mt-12 text-center">

          <button className="theme-button-light rounded-full border theme-border px-7 py-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md">
            Ver toda la colección
          </button>

        </div>

      </div>
    </section>
  );
}

export default Collections;