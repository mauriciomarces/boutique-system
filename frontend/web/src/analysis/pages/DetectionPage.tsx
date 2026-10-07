import AnalysisLayout from "../components/AnalysisLayout";

function DetectionPage() {
  return (
    <AnalysisLayout
      title="Detección de comportamientos"
      subtitle="Clasificación experimental de eventos mediante correlación lógica y Árbol de Decisión."
    >
      <section className="glass soft-shadow rounded-2xl border theme-border p-6">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border theme-border px-3 py-1 text-xs font-semibold theme-text-muted">
            Integración en desarrollo
          </span>

          <h2 className="mt-5 text-xl font-semibold theme-text">
            Pipeline de detección
          </h2>

          <p className="mt-3 leading-7 theme-text-soft">
            Este módulo analizará los eventos generados por el sistema,
            aplicará las reglas de correlación lógica y construirá las
            características conductuales utilizadas por el modelo de
            Árbol de Decisión.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border theme-border p-4">
              <p className="text-sm font-semibold theme-text">
                1. Eventos del sistema
              </p>
              <p className="mt-1 text-sm theme-text-soft">
                Registro de acciones relevantes realizadas dentro del sistema.
              </p>
            </div>

            <div className="rounded-xl border theme-border p-4">
              <p className="text-sm font-semibold theme-text">
                2. Correlación lógica
              </p>
              <p className="mt-1 text-sm theme-text-soft">
                Identificación de patrones temporales y combinaciones de
                eventos de riesgo.
              </p>
            </div>

            <div className="rounded-xl border theme-border p-4">
              <p className="text-sm font-semibold theme-text">
                3. Características conductuales
              </p>
              <p className="mt-1 text-sm theme-text-soft">
                Generación de las 28 características utilizadas por el modelo.
              </p>
            </div>

            <div className="rounded-xl border theme-border p-4">
              <p className="text-sm font-semibold theme-text">
                4. Clasificación CART
              </p>
              <p className="mt-1 text-sm theme-text-soft">
                Clasificación experimental del comportamiento como NORMAL o
                ANÓMALO.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border theme-border bg-[var(--bg-secondary)] p-4">
            <p className="text-sm font-semibold theme-text">
              Estado
            </p>

            <p className="mt-1 text-sm leading-6 theme-text-soft">
              La pantalla está preparada para la integración con
              logic-correlation-service y ai-service. Todavía no se muestran
              clasificaciones reales hasta completar dicha integración.
            </p>
          </div>
        </div>
      </section>
    </AnalysisLayout>
  );
}

export default DetectionPage;
