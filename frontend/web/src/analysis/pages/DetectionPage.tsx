import { useCallback, useEffect, useState } from "react";
import AnalysisLayout from "../components/AnalysisLayout";
import {
  classifyEvents,
  listAnalyses,
  listEvents,
  type AnalysisTrace,
  type CorrelationEvent,
  type EventFilters,
} from "../services/correlationApi";

const initialFilters: EventFilters = {};

function toIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function DetectionPage() {
  const [filters, setFilters] = useState<EventFilters>(initialFilters);
  const [userInput, setUserInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [events, setEvents] = useState<CorrelationEvent[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const eventResult = await listEvents(filters);
      setEvents(eventResult.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron consultar los eventos.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void listAnalyses()
      .then((result) => setAnalysis(result.analyses[0] ?? null))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo consultar el historial de análisis.");
      });
  }, []);

  function applyFilters() {
    try {
      setFilters({
        ...(userInput.trim() ? { usuario_id: userInput.trim() } : {}),
        ...(filters.service ? { service: filters.service } : {}),
        ...(filters.tipo_evento ? { tipo_evento: filters.tipo_evento } : {}),
        ...(fromInput ? { from: toIso(fromInput) } : {}),
        ...(toInput ? { to: toIso(toInput) } : {}),
      });
      setAnalysis(null);
    } catch {
      setError("El intervalo temporal no es válido.");
    }
  }

  async function runAnalysis() {
    setClassifying(true);
    setError("");
    try {
      const result = await classifyEvents(filters);
      setAnalysis(result);
      const eventResult = await listEvents(filters);
      setEvents(eventResult.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar la clasificación.");
    } finally {
      setClassifying(false);
    }
  }

  return (
    <AnalysisLayout
      title="Detección de comportamientos"
      subtitle="Consulta los eventos operativos persistidos y ejecuta el análisis experimental con correlación y Árbol de Decisión."
    >
      <div className="space-y-6">
        <section className="glass soft-shadow rounded-2xl border theme-border p-5">
          <h2 className="text-lg font-semibold theme-text">Filtros de eventos</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm theme-text-soft">
              Usuario ID
              <input
                className="mt-1 w-full rounded-lg border theme-border bg-[var(--bg)] p-2 theme-text"
                inputMode="numeric"
                value={userInput}
                onChange={(event) => setUserInput(event.target.value)}
                placeholder="Todos o anonymous"
              />
            </label>
            <label className="text-sm theme-text-soft">
              Servicio
              <select
                className="mt-1 w-full rounded-lg border theme-border bg-[var(--bg)] p-2 theme-text"
                value={filters.service ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    service: event.target.value || undefined,
                  }))
                }
              >
                <option value="">Todos</option>
                <option value="users-service">Usuarios</option>
                <option value="sales-service">Ventas</option>
                <option value="products-service">Productos</option>
                <option value="inventory-service">Inventario</option>
              </select>
            </label>
            <label className="text-sm theme-text-soft">
              Tipo de evento
              <select
                className="mt-1 w-full rounded-lg border theme-border bg-[var(--bg)] p-2 theme-text"
                value={filters.tipo_evento ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    tipo_evento: event.target.value || undefined,
                  }))
                }
              >
                <option value="">Todos</option>
                {[
                  "LOGIN",
                  "LOGIN_FALLIDO",
                  "LOGOUT",
                  "USUARIO_CREADO",
                  "USUARIO_MODIFICADO",
                  "USUARIO_DESACTIVADO",
                  "PRODUCTO_CREADO",
                  "PRODUCTO_MODIFICADO",
                  "PRECIO_MODIFICADO",
                  "STOCK_MODIFICADO",
                  "VENTA_CREADA",
                  "VENTA_ANULADA",
                  "VENTA_ANULACION_SOLICITADA",
                  "VENTA_ANULACION_EN_PROCESO",
                  "PAGO_REGISTRADO",
                ].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm theme-text-soft">
              Desde
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border theme-border bg-[var(--bg)] p-2 theme-text"
                value={fromInput}
                onChange={(event) => setFromInput(event.target.value)}
              />
            </label>
            <label className="text-sm theme-text-soft">
              Hasta
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border theme-border bg-[var(--bg)] p-2 theme-text"
                value={toInput}
                onChange={(event) => setToInput(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-lg border theme-border px-4 py-2 text-sm font-semibold theme-text"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="rounded-lg border theme-border px-4 py-2 text-sm font-semibold theme-text disabled:opacity-50"
            >
              {loading ? "Actualizando…" : "Actualizar eventos"}
            </button>
            <button
              type="button"
              onClick={() => void runAnalysis()}
              disabled={classifying || events.length === 0}
              className="rounded-lg bg-[#5b9279] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {classifying ? "Analizando…" : "Analizar eventos filtrados"}
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" className="rounded-xl border border-red-400/50 bg-red-500/10 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="glass soft-shadow rounded-2xl border theme-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold theme-text">Eventos recibidos</h2>
            <span className="text-sm theme-text-muted">{events.length} eventos cargados</span>
          </div>
          {events.length === 0 ? (
            <p className="mt-4 text-sm theme-text-soft">
              {loading ? "Consultando el registro persistido…" : "No hay eventos para los filtros seleccionados."}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b theme-border theme-text-muted">
                  <tr>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Servicio</th>
                    <th className="p-2">Evento</th>
                    <th className="p-2">Usuario</th>
                    <th className="p-2">Entidad</th>
                    <th className="p-2">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {[...events].reverse().map((event) => (
                    <tr key={event.event_id} className="border-b theme-border theme-text">
                      <td className="whitespace-nowrap p-2">{new Date(event.timestamp).toLocaleString()}</td>
                      <td className="p-2">{event.service}</td>
                      <td className="p-2">{event.tipo_evento}</td>
                      <td className="p-2">{event.usuario_id ?? "Sin identificar"}</td>
                      <td className="p-2">{event.entidad}{event.entidad_id ? ` #${event.entidad_id}` : ""}</td>
                      <td className="p-2">{event.resultado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {analysis && (
          <section className="glass soft-shadow rounded-2xl border theme-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider theme-text-muted">
                  Resultado del modelo {analysis.classification.model_version}
                </p>
                <h2 className="mt-1 text-2xl font-semibold theme-text">
                  {analysis.classification.clasificacion === "ANOMALO" ? "Anomalía detectada" : "Clasificado como normal"}
                </h2>
                <p className="mt-1 text-sm theme-text-soft">
                  Análisis {analysis.analysis_id} · {new Date(analysis.generated_at).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full border theme-border px-3 py-1 text-sm font-semibold theme-text">
                Riesgo {analysis.classification.nivel_riesgo}
              </span>
            </div>
            {analysis.classification.probabilidad !== undefined && (
              <p className="mt-3 text-sm theme-text-soft">
                Score de clase ANÓMALO: {(analysis.classification.probabilidad * 100).toFixed(1)}%. {analysis.classification.probability_semantics}
              </p>
            )}
            <p className="mt-2 text-sm theme-text-soft">
              Intervalo: {new Date(analysis.interval.from).toLocaleString()} – {new Date(analysis.interval.to).toLocaleString()} · Usuario: {analysis.usuario_id ?? "No identificado"}
            </p>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="font-semibold theme-text">Características evaluadas</h3>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                  {Object.entries(analysis.correlation.features).map(([name, value]) => (
                    <div key={name} className="flex justify-between gap-2 border-b theme-border py-1 text-xs">
                      <dt className="theme-text-soft">{name}</dt>
                      <dd className="font-medium theme-text">{Number(value.toFixed(3))}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="space-y-5">
                <div>
                  <h3 className="font-semibold theme-text">Reglas lógicas activadas</h3>
                  <ul className="mt-2 space-y-1 text-sm theme-text-soft">
                    {Object.values(analysis.correlation.rules).filter((rule) => rule.fired).length === 0
                      ? <li>Ninguna regla activada; las reglas son indicadores, no veredictos.</li>
                      : Object.values(analysis.correlation.rules).filter((rule) => rule.fired).map((rule) => (
                        <li key={rule.description}>{rule.description} (valor: {rule.value})</li>
                      ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold theme-text">Explicación del Árbol de Decisión</h3>
                  <ul className="mt-2 space-y-1 text-sm theme-text-soft">
                    {analysis.classification.camino_arbol.length === 0
                      ? <li>No se recibió un camino de decisión del modelo.</li>
                      : analysis.classification.camino_arbol.map((condition) => <li key={condition}>{condition}</li>)}
                  </ul>
                  <ul className="mt-2 space-y-1 text-sm theme-text-soft">
                    {analysis.classification.factores.map((factor) => <li key={factor}>{factor}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            <p className="mt-5 break-all text-xs theme-text-muted">
              Eventos sustentantes ({analysis.event_ids.length}): {analysis.event_ids.join(", ")}
            </p>
            <p className="mt-3 text-xs theme-text-muted">
              Clasificación experimental; no constituye evidencia concluyente de fraude ni validación con datos históricos reales.
            </p>
          </section>
        )}
      </div>
    </AnalysisLayout>
  );
}

export default DetectionPage;
