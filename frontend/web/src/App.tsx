import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

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

import LoginPage from "./auth/pages/LoginPage";
import RegisterPage from "./auth/pages/RegisterPage";
import VerifyEmailPage from "./auth/pages/VerifyEmailPage";
import ForgotPasswordPage from "./auth/pages/ForgotPasswordPage";
import ResetPasswordPage from "./auth/pages/ResetPasswordPage";
import AccountPage from "./auth/pages/AccountPage";

function LandingPage({
  darkMode,
  setDarkMode,
}: {
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}) {
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
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              darkMode={darkMode}
              setDarkMode={setDarkMode}
            />
          }
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/registro"
          element={<RegisterPage />}
        />

        <Route
          path="/verificar-correo"
          element={<VerifyEmailPage />}
        />

        <Route
          path="/recuperar-contrasena"
          element={<ForgotPasswordPage />}
        />

        <Route
          path="/restablecer-contrasena"
          element={<ResetPasswordPage />}
        />

        <Route
          path="/cuenta"
          element={<AccountPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;