const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildAnomalyMessage } = require('../src/anomaly-message');

test('genera una alerta legible con señales observadas y sin tecnicismos del árbol', () => {
  const message = buildAnomalyMessage({
    risk: 'HIGH',
    eventCount: 22,
    referenceText: 'Referencia del análisis: test-123.',
    ruleEvidence: [
      ['R1', { fired: true }],
      ['R2', { fired: true }],
      ['R5', { fired: true }],
      ['R6', { fired: true }],
    ],
  });

  assert.match(message, /varios intentos fallidos de inicio de sesión/);
  assert.match(message, /varias ventas anuladas/);
  assert.match(message, /22 eventos relacionados/);
  assert.match(message, /Prioridad de revisión: alta/);
  assert.match(message, /no demuestra fraude/);
  assert.doesNotMatch(message, /CART|admin_action_count|condiciones del árbol/i);
  assert.match(message, /test-123/);
});

test('usa una explicación neutral si no hay señales individuales que describir', () => {
  const message = buildAnomalyMessage({
    risk: 'MEDIUM',
    eventCount: 0,
    referenceText: 'Referencia del análisis: test-456.',
    ruleEvidence: [['R6', { fired: true }]],
  });

  assert.match(message, /combinación de eventos que conviene revisar/);
  assert.match(message, /Prioridad de revisión: media/);
  assert.doesNotMatch(message, /eventos relacionados/);
});
