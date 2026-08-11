import { useEffect, useState } from "react";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Benefits from "./components/Benefits";
import Collections from "./components/Collections";
import Services from "./components/Services";
import Process from "./components/Process";
import Testimonials from "./components/Testimonials";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("maison-theme");

    if (savedTheme) {
      return savedTheme === "dark";
    }

    return window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      darkMode,
    );

    localStorage.setItem(
      "maison-theme",
      darkMode ? "dark" : "light",
    );
  }, [darkMode]);

  return (
    <div className="theme-bg min-h-screen transition-colors duration-500">

      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <main>

        <section id="inicio">
          <Hero />
        </section>

        <Marquee />

        <section id="experiencia">
          <Benefits />
        </section>

        <section id="coleccion">
          <Collections />
        </section>

        <Services />

        <Process />

        <Testimonials />

        <CTA />

      </main>

      <Footer />

    </div>
  );
}

export default App;