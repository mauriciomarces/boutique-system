const RISK_LABELS = {
  ALTO: 'alta',
  HIGH: 'alta',
  MEDIO: 'media',
  MEDIUM: 'media',
  BAJO: 'baja',
  LOW: 'baja',
};

const SIGNAL_LABELS = {
  R1: 'varios intentos fallidos de inicio de sesión',
  R2: 'varias ventas anuladas',
  R3: 'un movimiento de inventario relacionado con una venta',
  R5: 'varias acciones administrativas',
};

function buildAnomalyMessage({ risk, ruleEvidence, eventCount, referenceText }) {
  const riskLabel = RISK_LABELS[String(risk).toUpperCase()] || 'por determinar';
  const activeSignals = ruleEvidence
    .filter(([id, rule]) => rule.fired && id !== 'R6')
    .map(([id]) => SIGNAL_LABELS[id])
    .filter(Boolean);

  return [
    'Se observó una actividad poco habitual que conviene revisar.',
    activeSignals.length
      ? `Entre las señales observadas están: ${activeSignals.join(', ')}.`
      : 'El sistema encontró una combinación de eventos que conviene revisar.',
    eventCount ? `Se revisaron ${eventCount} eventos relacionados.` : null,
    `Prioridad de revisión: ${riskLabel}.`,
    'Esta alerta no demuestra fraude. Verifica si las acciones fueron esperadas.',
    referenceText,
  ].filter(Boolean).join(' ');
}

module.exports = { buildAnomalyMessage };
