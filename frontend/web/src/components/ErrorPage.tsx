import { Link } from "react-router-dom";

const errorContent: Record<
  number,
  { title: string; message: string }
> = {
  400: {
    title: "Solicitud incorrecta",
    message:
      "La solicitud no tiene un formato válido. Revisa los datos e inténtalo nuevamente.",
  },
  401: {
    title: "Sesión requerida",
    message: "Necesitas iniciar sesión para continuar.",
  },
  403: {
    title: "Acceso denegado",
    message: "Tu cuenta no tiene permisos para consultar este contenido.",
  },
  404: {
    title: "Página no encontrada",
    message: "La dirección que buscas no existe o ya no está disponible.",
  },
  500: {
    title: "Error del servidor",
    message:
      "Ocurrió un problema inesperado. Inténtalo nuevamente en unos minutos.",
  },
};

function ErrorPage({ code }: { code: number }) {
  const content = errorContent[code] || errorContent[500];
  const requiresLogin = code === 401;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f6f2] px-6 py-12 text-[#263238]">
      <section className="w-full max-w-xl rounded-3xl border border-[#263238]/10 bg-white p-8 text-center shadow-[0_30px_80px_rgba(38,50,56,0.12)] sm:p-12">
        <p className="text-7xl font-semibold tracking-[-0.06em] text-[#5b9279]">
          {code}
        </p>

        <h1 className="mt-5 text-3xl font-semibold text-[#263238]">
          {content.title}
        </h1>

        <p className="mx-auto mt-4 max-w-md leading-7 text-[#59676d]">
          {content.message}
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={requiresLogin ? "/login" : "/"}
            className="theme-button-dark rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          >
            {requiresLogin ? "Ir a iniciar sesión" : "Volver al inicio"}
          </Link>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-[#263238]/15 px-6 py-3 text-sm font-semibold text-[#263238] transition-colors hover:bg-[#efebe4]"
          >
            Reintentar
          </button>
        </div>
      </section>
    </main>
  );
}

export default ErrorPage;