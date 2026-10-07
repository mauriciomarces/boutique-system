const EVENT_TYPES = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  LOGIN_FALLIDO: "LOGIN_FALLIDO",
  VENTA_CREADA: "VENTA_CREADA",
  VENTA_ANULADA: "VENTA_ANULADA",
  VENTA_MODIFICADA: "VENTA_MODIFICADA",
  PRODUCTO_CREADO: "PRODUCTO_CREADO",
  PRODUCTO_MODIFICADO: "PRODUCTO_MODIFICADO",
  STOCK_MODIFICADO: "STOCK_MODIFICADO",
  PRECIO_MODIFICADO: "PRECIO_MODIFICADO",
  USUARIO_CREADO: "USUARIO_CREADO",
  USUARIO_MODIFICADO: "USUARIO_MODIFICADO",
  USUARIO_DESACTIVADO: "USUARIO_DESACTIVADO",
  CAMBIO_ROL: "CAMBIO_ROL",
};

const ADMIN_TYPES = new Set([
  EVENT_TYPES.USUARIO_CREADO,
  EVENT_TYPES.USUARIO_MODIFICADO,
  EVENT_TYPES.USUARIO_DESACTIVADO,
  EVENT_TYPES.CAMBIO_ROL,
]);

const USER_CHANGE_TYPES = new Set([
  EVENT_TYPES.USUARIO_CREADO,
  EVENT_TYPES.USUARIO_MODIFICADO,
  EVENT_TYPES.USUARIO_DESACTIVADO,
]);

const WINDOWS_MINUTES = [5, 10, 30, 60];

const STOCK_SALE_WINDOW_MS = 15 * 60 * 1000;
const PRICE_SALE_WINDOW_MS = 15 * 60 * 1000;
const MISSING_TIME_MINUTES = 9999;

const FEATURE_COLUMNS = [
  "event_count_5m",
  "event_count_10m",
  "event_count_30m",
  "failed_login_count",
  "successful_login_count",
  "failed_login_ratio",
  "sales_count",
  "cancelled_sales_count",
  "cancellation_ratio",
  "stock_change_count",
  "price_change_count",
  "admin_action_count",
  "role_change_count",
  "user_change_count",
  "sales_after_stock_change",
  "sales_after_price_change",
  "time_since_last_login",
  "time_since_last_stock_change",
  "time_since_last_price_change",
  "events_per_minute",
  "unique_entities_modified",
  "failed_login_rule",
  "cancellation_rule",
  "stock_sale_rule",
  "price_sale_rule",
  "admin_activity_rule",
  "combined_pattern_rule",
  "risk_rule_count",
];

const REQUIRED_EVENT_FIELDS = [
  "event_id",
  "usuario_id",
  "tipo_evento",
  "entidad",
  "timestamp",
  "resultado",
];

module.exports = {
  EVENT_TYPES,
  ADMIN_TYPES,
  USER_CHANGE_TYPES,
  WINDOWS_MINUTES,
  STOCK_SALE_WINDOW_MS,
  PRICE_SALE_WINDOW_MS,
  MISSING_TIME_MINUTES,
  FEATURE_COLUMNS,
  REQUIRED_EVENT_FIELDS,
};
