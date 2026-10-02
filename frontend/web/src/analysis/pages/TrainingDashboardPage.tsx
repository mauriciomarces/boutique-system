import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AnalysisLayout from "../components/AnalysisLayout";
import {
  ConfusionMatrix,
  HorizontalBarChart,
  MetricsTrend,
} from "../components/Charts";
import { getCurrentModel, getMetrics, listTrainings } from "../services/aiApi";
import type { MetricsPayload, ModelMetadata, TrainingSummary } from "../types/training.types";

function formatPct(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(3);
}

function TrainingDashboardPage() {
  const [trainings, setTrainings] = useState<TrainingSummary[]>([]);
  const [model, setModel] = useState<ModelMetadata | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [emptyMessage, setEmptyMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const history = await listTrainings();
        if (cancelled) return;
        setTrainings(history);
        if (!history.length) {
          setEmptyMessage("No existen entrenamientos registrados.");
          setModel(null);
          setMetrics(null);
          return;
        }
        setEmptyMessage("");
        const [current, metricPayload] = await Promise.all([
          getCurrentModel().catch(() => null),
          getMetrics().catch(() => null),
        ]);
        if (cancelled) return;
        setModel(current);
        setMetrics(metricPayload);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar el historial de entrenamiento.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = trainings[0];
  const importances = useMemo(() => {
    const source = model?.feature_importances || latest?.feature_importances || {};
    return Object.entries(source)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, value]) => ({ label, value }));
  }, [latest, model]);

  const trend = useMemo(
    () =>
      [...trainings]
        .reverse()
        .map((item) => ({
          version: item.model_version,
          accuracy: item.accuracy,
          precision: item.precision,
          recall: item.recall,
          f1: item.f1_score,
        })),
    [trainings],
  );

  return (
    <AnalysisLayout
      title="Entrenamiento del modelo"
      subtitle="Evidencia experimental del Árbol de Decisión. Las métricas provienen de ai-service, no de valores simulados."
    >
      {loading && <p className="theme-text-soft">Cargando entrenamientos…</p>}
      {error && (
        <p className="rounded-2xl border theme-border bg-[#efc8d6]/30 px-4 py-3 text-sm theme-text">
          {error}
        </p>
      )}

      {!loading && !error && emptyMessage && (
        <div className="glass soft-shadow rounded-3xl p-8">
          <p className="text-lg theme-text">{emptyMessage}</p>
          <p className="mt-2 text-sm theme-text-soft">
            Genere el dataset y ejecute un entrenamiento explícito en ai-service
            para ver métricas reales.
          </p>
        </div>
      )}

      {!loading && latest && (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Modelo actual" value={model?.model_version || latest.model_version} />
            <Stat label="Dataset" value={model?.dataset_version || latest.dataset_version} />
            <Stat
              label="Fecha"
              value={new Date(model?.fecha_entrenamiento || latest.fecha).toLocaleString()}
            />
            <Stat label="Algoritmo" value={model?.algoritmo || latest.algoritmo} />
            <Stat
              label="Registros"
              value={String(model?.cantidad_registros || latest.cantidad_registros)}
            />
            <Stat
              label="Características"
              value={String(model?.cantidad_features || latest.cantidad_features)}
            />
            <Stat
              label="Accuracy"
              value={formatPct(model?.metricas.accuracy ?? latest.accuracy)}
            />
            <Stat
              label="Precision"
              value={formatPct(model?.metricas.precision ?? latest.precision)}
            />
            <Stat
              label="Recall"
              value={formatPct(model?.metricas.recall ?? latest.recall)}
            />
            <Stat
              label="F1-score"
              value={formatPct(model?.metricas.f1_score ?? latest.f1_score)}
            />
          </section>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="glass soft-shadow rounded-3xl p-6">
              <h2 className="mb-4 text-lg font-semibold theme-text">
                Matriz de confusión
              </h2>
              <ConfusionMatrix
                matrix={
                  model?.metricas.confusion_matrix || latest.confusion_matrix
                }
              />
            </div>
            <div className="glass soft-shadow rounded-3xl p-6">
              <h2 className="mb-4 text-lg font-semibold theme-text">
                Importancia de características
              </h2>
              <HorizontalBarChart items={importances} />
            </div>
          </div>

          <div className="glass soft-shadow mb-6 rounded-3xl p-6">
            <h2 className="mb-2 text-lg font-semibold theme-text">
              Evolución entre iteraciones
            </h2>
            <p className="mb-4 text-xs theme-text-muted">
              Verde accuracy · Violeta F1 · Rosa precision · Durazno recall
            </p>
            <MetricsTrend points={trend} />
          </div>

          <div className="glass soft-shadow rounded-3xl p-6">
            <h2 className="mb-4 text-lg font-semibold theme-text">
              Historial de entrenamientos
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="theme-text-muted">
                    <th className="pb-3">ID</th>
                    <th className="pb-3">Versión</th>
                    <th className="pb-3">Dataset</th>
                    <th className="pb-3">Fecha</th>
                    <th className="pb-3">F1</th>
                    <th className="pb-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {trainings.map((item) => (
                    <tr key={item.training_id} className="border-t theme-border">
                      <td className="py-3">
                        <Link
                          className="underline decoration-[#d9cdeb]"
                          to={`/analisis/entrenamiento/${item.training_id}`}
                        >
                          {item.training_id}
                        </Link>
                      </td>
                      <td>{item.model_version}</td>
                      <td>{item.dataset_version}</td>
                      <td>{new Date(item.fecha).toLocaleString()}</td>
                      <td>{item.f1_score.toFixed(3)}</td>
                      <td>{item.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AnalysisLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass soft-shadow rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] theme-text-muted">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold theme-text">{value}</p>
    </div>
  );
}

export default TrainingDashboardPage;
