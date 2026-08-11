function Marquee() {
  const items = [
    "DISEÑO",
    "IDENTIDAD",
    "ELEGANCIA",
    "AUTENTICIDAD",
    "ESTILO",
    "AURORA",
  ];

  return (
    <section className="overflow-hidden border-y theme-border theme-bg-secondary py-5">
      <div className="flex w-max animate-marquee">
        {[...items, ...items].map((item, index) => (
          <div key={index} className="flex items-center">
            <span className="px-8 text-[10px] font-semibold tracking-[0.3em] theme-text-muted">
              {item}
            </span>

            <span className="text-sm text-[#D9CDEB]">
              ✦
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Marquee;