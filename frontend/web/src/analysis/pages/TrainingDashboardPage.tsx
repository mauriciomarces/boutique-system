import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AnalysisLayout from "../components/AnalysisLayout";
import {
  ConfusionMatrix,
  HorizontalBarChart,
  MetricsTrend,
} from "../components/Charts";
import {
  getCurrentModel,
  listTrainings,
} from "../services/aiApi";
import type {
  ModelMetadata,
  TrainingSummary,
} from "../types/training.types";

function formatPct(value?: number) {
  if (
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function TrainingDashboardPage() {
  const [trainings, setTrainings] = useState<
    TrainingSummary[]
  >([]);

  const [model, setModel] =
    useState<ModelMetadata | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [emptyMessage, setEmptyMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setEmptyMessage("");

        const history = await listTrainings();

        if (cancelled) return;

        setTrainings(history);

        if (!history.length) {
          setEmptyMessage(
            "No existen entrenamientos registrados.",
          );
          setModel(null);
          return;
        }

        const current =
          await getCurrentModel().catch(() => null);

        if (cancelled) return;

        setModel(current);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No fue posible cargar el historial de entrenamiento.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const latest = trainings[0];

  const importances = useMemo(() => {
    const source =
      model?.feature_importances ||
      latest?.feature_importances ||
      {};

    return Object.entries(source)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, value]) => ({
        label,
        value,
      }));
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
      subtitle="Evidencia experimental del Árbol de Decisión. Las métricas provienen de ai-service y corresponden a ejecuciones registradas."
    >
      {loading && (
        <p className="theme-text-soft">
          Cargando entrenamientos…
        </p>
      )}

      {error && (
        <p className="rounded-2xl border theme-border bg-[#efc8d6]/30 px-4 py-3 text-sm theme-text">
          {error}
        </p>
      )}

      {!loading &&
        !error &&
        emptyMessage && (
          <div className="glass soft-shadow rounded-3xl p-8">
            <p className="text-lg theme-text">
              {emptyMessage}
            </p>

            <p className="mt-2 text-sm theme-text-soft">
              Genere el dataset y ejecute un
              entrenamiento explícito en ai-service
              para registrar una nueva iteración.
            </p>
          </div>
        )}

      {!loading && latest && (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Modelo actual"
              value={
                model?.model_version ||
                latest.model_version
              }
            />

            <Stat
              label="Dataset"
              value={
                model?.dataset_version ||
                latest.dataset_version
              }
            />

            <Stat
              label="Fecha"
              value={new Date(
                model?.fecha_entrenamiento ||
                  latest.fecha,
              ).toLocaleString()}
            />

            <Stat
              label="Algoritmo"
              value={
                model?.algoritmo ||
                latest.algoritmo
              }
            />

            <Stat
              label="Registros"
              value={String(
                model?.cantidad_registros ||
                  latest.cantidad_registros,
              )}
            />

            <Stat
              label="Características"
              value={String(
                model?.cantidad_features ||
                  latest.cantidad_features,
              )}
            />

            <Stat
              label="Accuracy"
              value={formatPct(
                latest.accuracy,
              )}
            />

            <Stat
              label="Precision"
              value={formatPct(
                latest.precision,
              )}
            />

            <Stat
              label="Recall"
              value={formatPct(
                latest.recall,
              )}
            />

            <Stat
              label="F1-score"
              value={formatPct(
                latest.f1_score,
              )}
            />
          </section>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="glass soft-shadow rounded-3xl p-6">
              <h2 className="mb-4 text-lg font-semibold theme-text">
                Matriz de confusión
              </h2>

              <ConfusionMatrix
                matrix={
                  latest.confusion_matrix
                }
              />
            </div>

            <div className="glass soft-shadow rounded-3xl p-6">
              <h2 className="mb-4 text-lg font-semibold theme-text">
                Importancia de características
              </h2>

              <HorizontalBarChart
                items={importances}
              />
            </div>
          </div>

          <div className="glass soft-shadow mb-6 rounded-3xl p-6">
            <h2 className="mb-2 text-lg font-semibold theme-text">
              Evolución entre iteraciones
            </h2>

            <p className="mb-4 text-xs theme-text-muted">
              Accuracy · F1 · Precision · Recall
            </p>

            <MetricsTrend points={trend} />
          </div>

          <div className="glass soft-shadow rounded-3xl p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold theme-text">
                  Historial de entrenamientos
                </h2>

                <p className="mt-1 text-sm theme-text-soft">
                  Cada ejecución se conserva como una
                  iteración independiente del modelo.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="theme-text-muted">
                    <th className="pb-3">
                      ID
                    </th>

                    <th className="pb-3">
                      Versión
                    </th>

                    <th className="pb-3">
                      Dataset
                    </th>

                    <th className="pb-3">
                      Registros
                    </th>

                    <th className="pb-3">
                      Accuracy
                    </th>

                    <th className="pb-3">
                      F1
                    </th>

                    <th className="pb-3">
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {trainings.map((item) => (
                    <tr
                      key={item.training_id}
                      className="border-t theme-border"
                    >
                      <td className="py-3">
                        <Link
                          className="font-medium underline decoration-[#d9cdeb] underline-offset-4"
                          to={`/analisis/entrenamiento/${item.training_id}`}
                        >
                          Ver detalle
                        </Link>
                      </td>

                      <td>
                        {item.model_version}
                      </td>

                      <td>
                        {item.dataset_version}
                      </td>

                      <td>
                        {item.cantidad_registros}
                      </td>

                      <td>
                        {formatPct(
                          item.accuracy,
                        )}
                      </td>

                      <td>
                        {formatPct(
                          item.f1_score,
                        )}
                      </td>

                      <td>
                        <span className="inline-flex rounded-full border theme-border px-3 py-1 text-xs font-medium theme-text">
                          {item.estado}
                        </span>
                      </td>
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

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="glass soft-shadow rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] theme-text-muted">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold theme-text">
        {value}
      </p>
    </div>
  );
}

export default TrainingDashboardPage;