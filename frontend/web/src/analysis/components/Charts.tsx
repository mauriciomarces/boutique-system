interface BarChartProps {
  items: Array<{ label: string; value: number }>;
}

export function HorizontalBarChart({ items }: BarChartProps) {
  const max = Math.max(...items.map((item) => item.value), 0.0001);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="truncate theme-text-soft">{item.label}</span>
            <span className="theme-text">{item.value.toFixed(3)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[#b9e2d0]"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const cells = matrix.length === 2 ? matrix : [[0, 0], [0, 0]];
  const labels = ["NORMAL", "ANOMALO"];
  const max = Math.max(...cells.flat(), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left theme-text-muted">Real \ Predicho</th>
            {labels.map((label) => (
              <th key={label} className="p-2 theme-text-soft">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, i) => (
            <tr key={labels[i]}>
              <td className="p-2 font-medium theme-text">{labels[i]}</td>
              {row.map((value, j) => (
                <td key={`${i}-${j}`} className="p-2">
                  <div
                    className="rounded-xl px-3 py-4 text-center font-semibold theme-text"
                    style={{
                      background: `rgba(217, 205, 235, ${0.15 + (value / max) * 0.7})`,
                    }}
                  >
                    {value}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MetricsTrend({
  points,
}: {
  points: Array<{ version: string; accuracy: number; f1: number; precision: number; recall: number }>;
}) {
  if (points.length < 1) {
    return null;
  }

  const width = 520;
  const height = 180;
  const pad = 28;
  const xs = points.map((_, index) =>
    points.length === 1
      ? width / 2
      : pad + (index * (width - pad * 2)) / (points.length - 1),
  );

  const line = (key: "accuracy" | "f1" | "precision" | "recall") =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${xs[index]} ${height - pad - point[key] * (height - pad * 2)}`)
      .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <path d={line("accuracy")} fill="none" stroke="#5b9279" strokeWidth="2" />
      <path d={line("f1")} fill="none" stroke="#8b6bb0" strokeWidth="2" />
      <path d={line("precision")} fill="none" stroke="#c47a8a" strokeWidth="2" />
      <path d={line("recall")} fill="none" stroke="#d4a574" strokeWidth="2" />
      {points.map((point, index) => (
        <text
          key={point.version}
          x={xs[index]}
          y={height - 8}
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
        >
          {point.version}
        </text>
      ))}
    </svg>
  );
}
