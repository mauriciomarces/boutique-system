const {
  EVENT_TYPES,
  ADMIN_TYPES,
  USER_CHANGE_TYPES,
  STOCK_SALE_WINDOW_MS,
  PRICE_SALE_WINDOW_MS,
  MISSING_TIME_MINUTES,
} = require("./constants");

function toMs(event) {
  return Date.parse(event.timestamp);
}

function sortEvents(events) {
  const sorted = [...events].sort(
    (a, b) => toMs(a) - toMs(b) || String(a.event_id).localeCompare(String(b.event_id)),
  );
  const seen = new Set();
  return sorted.filter((event) => {
    if (event.event_id == null) return true;
    if (seen.has(event.event_id)) return false;
    seen.add(event.event_id);
    return true;
  });
}

function windowEvents(events, referenceMs, minutes) {
  const start = referenceMs - minutes * 60 * 1000;
  return events.filter((event) => {
    const t = toMs(event);
    return t >= start && t <= referenceMs;
  });
}

function countType(events, type) {
  return events.filter((event) =>
    event.tipo_evento === type &&
    (type === EVENT_TYPES.LOGIN_FALLIDO
      ? event.resultado === "FALLIDO"
      : event.resultado !== "FALLIDO"),
  ).length;
}

function minutesSince(events, types, referenceMs) {
  const matches = events.filter((event) => types.includes(event.tipo_evento));
  if (!matches.length) return MISSING_TIME_MINUTES;
  const last = matches[matches.length - 1];
  return Math.max(0, (referenceMs - toMs(last)) / 60000);
}

function countPrecededBy(events, targetType, precursorType, maxGapMs) {
  let count = 0;
  for (let i = 0; i < events.length; i += 1) {
    const current = events[i];
    if (current.tipo_evento !== targetType || current.resultado === "FALLIDO") continue;
    const currentMs = toMs(current);
    const preceded = events.slice(0, i).some((prev) => {
      if (prev.tipo_evento !== precursorType || prev.resultado === "FALLIDO") return false;
      if (
        current.usuario_id != null &&
        prev.usuario_id != null &&
        String(current.usuario_id) !== String(prev.usuario_id)
      ) return false;
      const gap = currentMs - toMs(prev);
      return gap >= 0 && gap < maxGapMs;
    });
    if (preceded) count += 1;
  }
  return count;
}

function linkedStockSales(events) {
  const sales = events.filter((event) =>
    event.tipo_evento === EVENT_TYPES.VENTA_CREADA &&
    event.resultado !== "FALLIDO" &&
    event.entidad === "venta" &&
    event.entidad_id != null,
  );
  const movements = events.filter((event) =>
    event.tipo_evento === EVENT_TYPES.STOCK_MODIFICADO &&
    event.resultado !== "FALLIDO" &&
    event.metadata?.referencia_tipo === "VENTA" &&
    event.metadata?.tipo_movimiento === "SALIDA" &&
    event.metadata?.venta_id != null,
  );
  const links = [];

  for (const movement of movements) {
    const sale = sales.find((candidate) => {
      if (String(candidate.entidad_id) !== String(movement.metadata.venta_id)) return false;
      if (
        candidate.usuario_id != null &&
        movement.usuario_id != null &&
        String(candidate.usuario_id) !== String(movement.usuario_id)
      ) return false;
      const gapMs = toMs(movement) - toMs(candidate);
      return gapMs >= 0 && gapMs < STOCK_SALE_WINDOW_MS;
    });
    if (sale) {
      links.push({
        venta_id: String(sale.entidad_id),
        sale_event_id: sale.event_id,
        stock_event_id: movement.event_id,
        variante_producto_id: movement.entidad_id == null
          ? null
          : String(movement.entidad_id),
      });
    }
  }

  return links;
}

function hasSequenceWithin(events, precursorType, targetType, maxGapMs) {
  return countPrecededBy(events, targetType, precursorType, maxGapMs) > 0;
}

function uniqueEntities(events) {
  const ids = new Set();
  for (const event of events) {
    if (
      event.resultado !== "FALLIDO" &&
      event.entidad_id !== null &&
      event.entidad_id !== undefined
    ) {
      ids.add(`${event.entidad}:${event.entidad_id}`);
    }
  }
  return ids.size;
}

function analyzeRules(events10m, events30m, eventsAll) {
  const failedLoginCount10m = countType(events10m, EVENT_TYPES.LOGIN_FALLIDO);
  const cancelled30m = countType(events30m, EVENT_TYPES.VENTA_ANULADA);
  const admin10m = events10m.filter((event) =>
    event.resultado !== "FALLIDO" && ADMIN_TYPES.has(event.tipo_evento),
  ).length;

  const r1 = failedLoginCount10m >= 5;
  const r2 = cancelled30m >= 3;
  const stockSaleLinks = linkedStockSales(eventsAll);
  const r3 = stockSaleLinks.length > 0;
  const salesAfterPriceChange = countPrecededBy(
    eventsAll,
    EVENT_TYPES.VENTA_CREADA,
    EVENT_TYPES.PRECIO_MODIFICADO,
    PRICE_SALE_WINDOW_MS,
  );
  const r4 = false;
  const r5 = admin10m >= 3;
  const firedCount = [r1, r2, r5].filter(Boolean).length;
  const r6 = firedCount >= 2;

  return {
    R1: {
      id: "R1",
      description: ">= 5 LOGIN_FALLIDO en 10 minutos",
      fired: r1,
      value: failedLoginCount10m,
    },
    R2: {
      id: "R2",
      description: ">= 3 VENTA_ANULADA en 30 minutos",
      fired: r2,
      value: cancelled30m,
    },
    R3: {
      id: "R3",
      description: "Salida de stock relacionada por venta_id con una venta en menos de 15 minutos",
      fired: r3,
      value: stockSaleLinks.length,
    },
    R4: {
      id: "R4",
      description: "Relación temporal precio-venta solo contextual; no es una regla de riesgo",
      fired: r4,
      value: salesAfterPriceChange,
    },
    R5: {
      id: "R5",
      description: "Actividad administrativa elevada (>= 3 acciones) en 10 minutos",
      fired: r5,
      value: admin10m,
    },
    R6: {
      id: "R6",
      description: "Combinación de dos o más señales R1, R2 o R5",
      fired: r6,
      value: firedCount,
    },
  };
}

function extractFeatures(eventsInput, referenceTimestamp) {
  let events = sortEvents(eventsInput);
  if (!events.length) {
    return emptyFeatures();
  }

  const referenceMs = referenceTimestamp
    ? Date.parse(referenceTimestamp)
    : toMs(events[events.length - 1]);

  if (!Number.isFinite(referenceMs)) {
    throw new Error("referenceTimestamp no es una fecha válida.");
  }

  events = events.filter((event) => toMs(event) <= referenceMs);
  if (!events.length) {
    return emptyFeatures();
  }

  const events5m = windowEvents(events, referenceMs, 5);
  const events10m = windowEvents(events, referenceMs, 10);
  const events30m = windowEvents(events, referenceMs, 30);
  const spanMs = Math.max(toMs(events[events.length - 1]) - toMs(events[0]), 1);
  const spanMinutes = spanMs / 60000;

  const failedLoginCount = countType(events10m, EVENT_TYPES.LOGIN_FALLIDO);
  const successfulLoginCount = countType(events10m, EVENT_TYPES.LOGIN);
  const loginTotal = failedLoginCount + successfulLoginCount;
  const salesCount = countType(events30m, EVENT_TYPES.VENTA_CREADA);
  const cancelledSalesCount = countType(events30m, EVENT_TYPES.VENTA_ANULADA);
  const saleOps = salesCount + cancelledSalesCount;
  const stockChangeCount = countType(events30m, EVENT_TYPES.STOCK_MODIFICADO);
  const priceChangeCount = countType(events30m, EVENT_TYPES.PRECIO_MODIFICADO);
  const adminActionCount = events10m.filter((event) =>
    event.resultado !== "FALLIDO" && ADMIN_TYPES.has(event.tipo_evento),
  ).length;
  const roleChangeCount = countType(events10m, EVENT_TYPES.CAMBIO_ROL);
  const userChangeCount = events10m.filter((event) =>
    event.resultado !== "FALLIDO" && USER_CHANGE_TYPES.has(event.tipo_evento),
  ).length;

  const rules = analyzeRules(events10m, events30m, events);
  const stockSaleLinks = linkedStockSales(events);
  const linkedSaleIds = new Set(stockSaleLinks.map((link) => String(link.venta_id)));
  const cancelledSaleIds = new Set(
    events30m
      .filter((event) =>
        event.tipo_evento === EVENT_TYPES.VENTA_ANULADA &&
        event.resultado !== "FALLIDO" &&
        event.entidad === "venta" &&
        event.entidad_id != null,
      )
      .map((event) => String(event.entidad_id)),
  );
  const matureSales = events30m.filter((event) =>
    event.tipo_evento === EVENT_TYPES.VENTA_CREADA &&
    event.resultado !== "FALLIDO" &&
    event.entidad === "venta" &&
    event.entidad_id != null &&
    referenceMs - toMs(event) >= STOCK_SALE_WINDOW_MS,
  );
  const salesWithoutStockLinkCount = new Set(
    matureSales
      .filter((event) =>
        !linkedSaleIds.has(String(event.entidad_id)) &&
        !cancelledSaleIds.has(String(event.entidad_id)),
      )
      .map((event) => String(event.entidad_id)),
  ).size;

  const features = {
    event_count_5m: events5m.length,
    event_count_10m: events10m.length,
    event_count_30m: events30m.length,
    failed_login_count: failedLoginCount,
    successful_login_count: successfulLoginCount,
    failed_login_ratio: loginTotal ? failedLoginCount / loginTotal : 0,
      sales_count_5m: countType(events5m, EVENT_TYPES.VENTA_CREADA),
    sales_count: salesCount,
      sales_without_stock_link_count: salesWithoutStockLinkCount,
    cancelled_sales_count: cancelledSalesCount,
    cancellation_ratio: saleOps ? cancelledSalesCount / saleOps : 0,
    stock_change_count: stockChangeCount,
    price_change_count: priceChangeCount,
    admin_action_count: adminActionCount,
    role_change_count: roleChangeCount,
    user_change_count: userChangeCount,
    sales_after_stock_change: new Set(stockSaleLinks.map((link) => link.venta_id)).size,
    sales_after_price_change: countPrecededBy(
      events,
      EVENT_TYPES.VENTA_CREADA,
      EVENT_TYPES.PRECIO_MODIFICADO,
      PRICE_SALE_WINDOW_MS,
    ),
    time_since_last_login: minutesSince(events, [EVENT_TYPES.LOGIN], referenceMs),
    time_since_last_stock_change: minutesSince(
      events,
      [EVENT_TYPES.STOCK_MODIFICADO],
      referenceMs,
    ),
    time_since_last_price_change: minutesSince(
      events,
      [EVENT_TYPES.PRECIO_MODIFICADO],
      referenceMs,
    ),
    events_per_minute: events.length / Math.max(spanMinutes, 1 / 60),
    unique_entities_modified: uniqueEntities(events),
    failed_login_rule: rules.R1.fired ? 1 : 0,
    cancellation_rule: rules.R2.fired ? 1 : 0,
    stock_sale_rule: rules.R3.fired ? 1 : 0,
    price_sale_rule: rules.R4.fired ? 1 : 0,
    admin_activity_rule: rules.R5.fired ? 1 : 0,
    combined_pattern_rule: rules.R6.fired ? 1 : 0,
    risk_rule_count: [rules.R1, rules.R2, rules.R5].filter((rule) => rule.fired).length,
  };

  return { features, rules, events5m, events10m, events30m, referenceMs };
}
function emptyFeatures() {
  return {
    features: {
      event_count_5m: 0,
      event_count_10m: 0,
      event_count_30m: 0,
      failed_login_count: 0,
      successful_login_count: 0,
      failed_login_ratio: 0,
      sales_count_5m: 0,
      sales_count: 0,
      sales_without_stock_link_count: 0,
      cancelled_sales_count: 0,
      cancellation_ratio: 0,
      stock_change_count: 0,
      price_change_count: 0,
      admin_action_count: 0,
      role_change_count: 0,
      user_change_count: 0,
      sales_after_stock_change: 0,
      sales_after_price_change: 0,
      time_since_last_login: MISSING_TIME_MINUTES,
      time_since_last_stock_change: MISSING_TIME_MINUTES,
      time_since_last_price_change: MISSING_TIME_MINUTES,
      events_per_minute: 0,
      unique_entities_modified: 0,
      failed_login_rule: 0,
      cancellation_rule: 0,
      stock_sale_rule: 0,
      price_sale_rule: 0,
      admin_activity_rule: 0,
      combined_pattern_rule: 0,
      risk_rule_count: 0,
    },
    rules: analyzeRules([], [], []),
    events5m: [],
    events10m: [],
    events30m: [],
    referenceMs: Date.now(),
  };
}

function correlate(eventsInput, options = {}) {
  const events = sortEvents(eventsInput);
  const analysis = extractFeatures(events, options.reference_timestamp);

  return {
    usuario_id: Object.hasOwn(options, "usuario_id")
      ? options.usuario_id
      : (events[0] ? events[0].usuario_id : null),
    event_count: events.length,
    windows: {
      "5m": analysis.events5m.length,
      "10m": analysis.events10m.length,
      "30m": analysis.events30m.length,
    },
    sequences: {
      failed_logins_before_success: countType(
        analysis.events10m,
        EVENT_TYPES.LOGIN_FALLIDO,
      ),
      cancelled_after_created: analysis.features.cancelled_sales_count,
      stock_then_sale: analysis.features.sales_after_stock_change,
      price_then_sale: analysis.features.sales_after_price_change,
    },
    relations: {
      stock_to_sale: linkedStockSales(events),
    },
    rules: analysis.rules,
    features: analysis.features,
  };
}

module.exports = {
  correlate,
  extractFeatures,
  sortEvents,
  windowEvents,
  countType,
  hasSequenceWithin,
  linkedStockSales,
};
