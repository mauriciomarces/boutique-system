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

function formatName(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "Sin datos";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return Number(value.toFixed(3)).toString();
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function StructuredData({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data);

  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="font-semibold theme-text">{title}</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg border theme-border p-3">
            <p className="text-xs font-semibold theme-text-muted">{formatName(key)}</p>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs theme-text-soft">
              {formatValue(value)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
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
      const result = await listEvents(filters);
      setEvents(result.events);
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
      const from = toIso(fromInput);
      const to = toIso(toInput);

      if (from && to && new Date(from) > new Date(to)) {
        setError("La fecha inicial no puede ser posterior a la fecha final.");
        return;
      }

      setError("");
      setFilters({
        ...(userInput.trim() ? { usuario_id: userInput.trim() } : {}),
        ...(filters.service ? { service: filters.service } : {}),
        ...(filters.tipo_evento ? { tipo_evento: filters.tipo_evento } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setAnalysis(null);
    } catch {
      setError("El intervalo temporal no es válido.");
    }
  }

  async function runAnalysis() {
    const selectedUser = filters.usuario_id?.trim();

    if (
      selectedUser &&
      selectedUser !== "anonymous" &&
      !/^[1-9]\d*$/.test(selectedUser)
    ) {
      setError("Seleccione un usuario válido de la lista.");
      return;
    }

    const eventActors = new Set(
      events.map((event) =>
        event.usuario_id === null ? "anonymous" : String(event.usuario_id),
      ),
    );

    if (!selectedUser && eventActors.size > 1) {
      setError(
        "Los eventos pertenecen a varios usuarios. Seleccione un usuario o Anónimo y aplique los filtros antes de clasificar.",
      );
      return;
    }

    if (
      selectedUser &&
      Array.from(eventActors).some((actor) => actor !== selectedUser)
    ) {
      setError(
        "Los eventos cargados no corresponden al usuario seleccionado. Actualice los eventos antes de clasificar.",
      );
      return;
    }

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

  const userOptions = Array.from(
    new Set(
      events.map((event) =>
        event.usuario_id === null ? "anonymous" : String(event.usuario_id),
      ),
    ),
  ).sort((a, b) => {
    if (a === "anonymous") return -1;
    if (b === "anonymous") return 1;
    return Number(a) - Number(b);
  });

  const isAnomalous = analysis?.classification.clasificacion === "ANOMALO";

  const supportingEvents = analysis
    ? analysis.event_ids
        .map((id) => events.find((event) => event.event_id === id))
        .filter((event): event is CorrelationEvent => Boolean(event))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const featureEntries = analysis ? Object.entries(analysis.correlation.features) : [];
  const maxFeatureValue = Math.max(
    1,
    ...featureEntries.map(([, value]) => Math.abs(Number(value) || 0)),
  );

  function explainCondition(condition: string) {
    const match = condition.match(/^([a-zA-Z0-9_]+)\s*(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)$/);

    if (!match || !analysis) return condition;

    const [, feature, operator, threshold] = match;
    const observed = analysis.correlation.features[feature];

    if (observed === undefined) return condition;

    const limit = Number(threshold);
    const passed =
      operator === "<=" ? observed <= limit :
      operator === ">=" ? observed >= limit :
      operator === "<" ? observed < limit :
      observed > limit;

    return `${formatName(feature)}: valor observado ${formatValue(observed)} ${operator} ${limit} (umbral del árbol). Condición ${passed ? "satisfecha" : "no satisfecha"}.`;
  }

  function notificationMessage() {
    if (!isAnomalous) return "No corresponde generar una notificación para una clasificación NORMAL.";

    switch (analysis?.notification_status) {
      case "CREATED":
        return "Se creó una notificación de anomalía para el usuario correspondiente.";
      case "ALREADY_EXISTS":
        return "La notificación ya existía. No se generó un duplicado.";
      case "ERROR":
        return "La clasificación se completó, pero ocurrió un error al generar la notificación.";
      default:
        return "El backend no devolvió el estado de la notificación. Verifica la respuesta del API Gateway.";
    }
  }

  return (
    <AnalysisLayout
      title="Detección de comportamientos"
      subtitle="Consulta eventos operativos, examina sus relaciones y revisa la clasificación realizada por el árbol de decisión."
    >
      <div className="space-y-6">
        <section className="glass soft-shadow rounded-2xl border theme-border p-5">
          <h2 className="text-lg font-semibold theme-text">Filtros de eventos</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm theme-text-soft">
              Usuario
              <select
                className="mt-1 w-full rounded-lg border theme-border bg-[var(--bg)] p-2 theme-text"
                value={userInput}
                onChange={(event) => setUserInput(event.target.value)}
              >
                <option value="">Todos los usuarios</option>
                {userOptions.map((userId) => (
                  <option key={userId} value={userId}>
                    {userId === "anonymous"
                      ? "Anónimo (sin usuario)"
                      : `Usuario ${userId}`}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs theme-text-muted">
                Opciones obtenidas de los eventos cargados.
              </span>
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
                  <option key={type} value={type}>{type}</option>
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
              {loading ? "Actualizando..." : "Actualizar eventos"}
            </button>

            <button
              type="button"
              onClick={() => void runAnalysis()}
              disabled={classifying || loading || events.length === 0}
              className="rounded-lg bg-[#5b9279] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {classifying ? "Analizando..." : "Analizar eventos filtrados"}
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
              {loading ? "Consultando el registro persistido..." : "No hay eventos para los filtros seleccionados."}
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
                  {[...events].sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                  ).map((event) => (
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
          <div className="space-y-5">
            <section className="glass soft-shadow rounded-2xl border theme-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider theme-text-muted">
                    Resultado del modelo {analysis.classification.model_version}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold theme-text">
                    {isAnomalous ? "Anomalía detectada" : "Clasificado como normal"}
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
                <div className="mt-4">
                  <div className="flex justify-between text-sm theme-text-soft">
                    <span>Score de clase ANOMALO</span>
                    <strong>{(analysis.classification.probabilidad * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--bg)]">
                    <div
                      className="h-full rounded-full bg-[#5b9279]"
                      style={{
                        width: `${Math.max(0, Math.min(100, analysis.classification.probabilidad * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs theme-text-muted">
                    {analysis.classification.probability_semantics}
                  </p>
                </div>
              )}

              <p className="mt-3 text-sm theme-text-soft">
                Intervalo: {new Date(analysis.interval.from).toLocaleString()} – {new Date(analysis.interval.to).toLocaleString()}
                {" · "}Usuario: {analysis.usuario_id ?? "No identificado"}
              </p>
            </section>

            <section className="glass soft-shadow rounded-2xl border theme-border p-5">
              <h2 className="text-lg font-semibold theme-text">Secuencia cronológica de eventos relacionados</h2>
              <p className="mt-1 text-sm theme-text-muted">
                Eventos incluidos en el análisis y devueltos como sustento de la correlación.
              </p>

              {supportingEvents.length === 0 ? (
                <p className="mt-3 text-sm theme-text-soft">
                  No se encontraron en la lista actual los eventos asociados a este análisis.
                  Los identificadores se conservan en el resultado.
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {supportingEvents.map((event, index) => (
                    <li key={event.event_id} className="relative flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border theme-border text-xs font-semibold theme-text">
                          {index + 1}
                        </span>
                        {index < supportingEvents.length - 1 && (
                          <span className="mt-1 h-full min-h-6 w-px bg-[var(--border)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 rounded-lg border theme-border p-3">
                        <div className="flex flex-wrap justify-between gap-2">
                          <strong className="text-sm theme-text">{event.tipo_evento}</strong>
                          <span className="text-xs theme-text-muted">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-xs theme-text-soft">
                          {event.service} · {event.entidad}
                          {event.entidad_id ? ` #${event.entidad_id}` : ""}
                          {" · "}Usuario {event.usuario_id ?? "no identificado"}
                        </p>
                        <p className="mt-1 text-xs theme-text-muted">
                          Resultado: {event.resultado} · ID: {event.event_id}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <p className="mt-4 break-all text-xs theme-text-muted">
                Identificadores del análisis ({analysis.event_ids.length}): {analysis.event_ids.join(", ")}
              </p>
            </section>

            <section className="glass soft-shadow rounded-2xl border theme-border p-5">
              <h2 className="text-lg font-semibold theme-text">Características utilizadas por el clasificador</h2>
              <p className="mt-1 text-sm theme-text-muted">
                Valores obtenidos mediante la extracción de características del servicio de correlación.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {featureEntries.map(([name, value]) => {
                  const numericValue = Number(value) || 0;
                  const width = Math.max(0, Math.min(100, Math.abs(numericValue) / maxFeatureValue * 100));

                  return (
                    <div key={name} className="rounded-lg border theme-border p-3">
                      <div className="flex justify-between gap-3 text-xs">
                        <span className="theme-text-soft">{formatName(name)}</span>
                        <strong className="theme-text">{formatValue(value)}</strong>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg)]">
                        <div className="h-full rounded-full bg-[#5b9279]" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="glass soft-shadow rounded-2xl border theme-border p-5">
              <h2 className="text-lg font-semibold theme-text">Correlación lógica</h2>
              <p className="mt-1 text-sm theme-text-muted">
                Las reglas, secuencias y relaciones describen conexiones entre eventos. No representan por sí mismas el veredicto del clasificador.
              </p>

              <div className="mt-4">
                <h3 className="font-semibold theme-text">Reglas evaluadas</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Object.entries(analysis.correlation.rules).map(([key, rule]) => (
                    <div key={key} className="rounded-lg border theme-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm theme-text">{key}</strong>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          rule.fired ? "bg-amber-500/15 text-amber-700" : "bg-[var(--bg)] theme-text-muted"
                        }`}>
                          {rule.fired ? "Activada" : "No activada"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm theme-text-soft">{rule.description}</p>
                      <p className="mt-1 text-xs theme-text-muted">Valor observado: {formatValue(rule.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {analysis.correlation.sequences && (
                <div className="mt-5">
                  <StructuredData
                    title="Secuencias identificadas"
                    data={analysis.correlation.sequences}
                  />
                </div>
              )}

              {analysis.correlation.relations && (
                <div className="mt-5">
                  <StructuredData
                    title="Relaciones entre eventos"
                    data={analysis.correlation.relations}
                  />
                </div>
              )}
            </section>

            <section className="glass soft-shadow rounded-2xl border theme-border p-5">
              <h2 className="text-lg font-semibold theme-text">Explicación de la decisión CART</h2>
              <p className="mt-1 text-sm theme-text-muted">
                Se contrastan las condiciones del camino de decisión con los valores obtenidos para este análisis.
              </p>

              <ol className="mt-3 space-y-2">
                {analysis.classification.camino_arbol.length === 0 ? (
                  <li className="text-sm theme-text-soft">El modelo no devolvió condiciones del camino de decisión.</li>
                ) : (
                  analysis.classification.camino_arbol.map((condition, index) => (
                    <li key={`${condition}-${index}`} className="rounded-lg border theme-border p-3 text-sm theme-text-soft">
                      <span className="mr-2 font-semibold theme-text">{index + 1}.</span>
                      {explainCondition(condition)}
                    </li>
                  ))
                )}
              </ol>

              {analysis.classification.factores.length > 0 && (
                <div className="mt-5">
                  <h3 className="font-semibold theme-text">Factores generales del modelo</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm theme-text-soft">
                    {analysis.classification.factores.map((factor, index) => (
                      <li key={`${factor}-${index}`}>{factor}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs theme-text-muted">
                    Estos factores describen la importancia global de características en el modelo. No deben interpretarse como causas individuales de esta clasificación.
                  </p>
                </div>
              )}
            </section>

            <section className="glass soft-shadow rounded-2xl border theme-border p-5">
              <h2 className="text-lg font-semibold theme-text">Notificación del resultado</h2>
              <div className="mt-3 rounded-lg border theme-border p-4">
                <p className="text-sm theme-text-soft">{notificationMessage()}</p>
                {isAnomalous && (
                  <p className="mt-2 text-xs theme-text-muted">
                    La notificación se gestiona en el backend y se asocia al usuario correspondiente. La deduplicación evita crear otra para el mismo análisis.
                  </p>
                )}
              </div>
            </section>

            <p className="rounded-xl border theme-border p-4 text-xs theme-text-muted">
              Clasificación experimental con datos sintéticos. Una anomalía representa un comportamiento que requiere revisión y no constituye evidencia concluyente de fraude. El rendimiento observado durante la evaluación no garantiza el mismo resultado con datos reales.
            </p>
          </div>
        )}
      </div>
    </AnalysisLayout>
  );
}

export default DetectionPage;


