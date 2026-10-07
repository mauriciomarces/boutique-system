from __future__ import annotations

from typing import Any

FACTOR_MESSAGES = {
    "failed_login_count": "alta frecuencia de intentos fallidos de acceso",
    "failed_login_ratio": "alta proporción de inicios de sesión fallidos",
    "failed_login_rule": "regla lógica de múltiples LOGIN_FALLIDO en ventana corta",
    "cancelled_sales_count": "varias anulaciones de venta en la ventana analizada",
    "cancellation_ratio": "alta proporción de ventas anuladas respecto de operaciones de venta",
    "cancellation_rule": "regla lógica de anulaciones repetidas",
    "stock_change_count": "modificaciones de stock previas a actividad de venta",
    "sales_after_stock_change": "ventas ocurridas poco después de cambios de stock",
    "stock_sale_rule": "secuencia stock → venta en menos de 15 minutos",
    "price_change_count": "modificaciones de precio próximas a ventas",
    "sales_after_price_change": "ventas ocurridas poco después de cambios de precio",
    "price_sale_rule": "secuencia precio → venta en menos de 15 minutos",
    "admin_action_count": "actividad administrativa concentrada",
    "role_change_count": "cambios de rol en ventana corta",
    "user_change_count": "modificaciones de cuentas de usuario",
    "admin_activity_rule": "regla lógica de actividad administrativa elevada",
    "events_per_minute": "alta concentración temporal de eventos",
    "event_count_5m": "volumen elevado de eventos en 5 minutos",
    "event_count_10m": "volumen elevado de eventos en 10 minutos",
    "combined_pattern_rule": "combinación de varios patrones correlacionados",
    "risk_rule_count": "varias reglas lógicas activadas de forma simultánea",
}


def risk_level(label: int, probability: float | None) -> str:
    if label == 0:
        return "BAJO"
    if probability is None:
        return "MEDIO"
    if probability >= 0.75:
        return "ALTO"
    if probability >= 0.55:
        return "MEDIO"
    return "BAJO"


def explain_prediction(
    features: dict[str, float],
    importances: dict[str, float] | None,
    conditions: list[str],
    label: int,
) -> list[str]:
    ranked: list[tuple[str, float]] = []
    if importances:
        ranked = sorted(importances.items(), key=lambda item: item[1], reverse=True)
    factors: list[str] = []
    for name, importance in ranked:
        if importance <= 0:
            continue
        value = features.get(name, 0)
        if name.endswith("_rule") or name == "risk_rule_count":
            if value <= 0:
                continue
        elif value == 0:
            continue
        message = FACTOR_MESSAGES.get(name)
        if message and message not in factors:
            factors.append(message)
        if len(factors) >= 4:
            break
    if label == 1 and not factors:
        factors.append("el camino del árbol de decisión clasificó el vector como anómalo")
    if conditions:
        factors.append("condiciones del árbol: " + "; ".join(conditions[:6]))
    if label == 0:
        return [
            "comportamiento clasificado como normal según el modelo experimental",
            *factors[:2],
        ]
    return factors


def build_response(
    label: int,
    probability: float | None,
    features: dict[str, float],
    importances: dict[str, float] | None,
    conditions: list[str],
) -> dict[str, Any]:
    clasificacion = "ANOMALO" if label == 1 else "NORMAL"
    payload: dict[str, Any] = {
        "clasificacion": clasificacion,
        "nivel_riesgo": risk_level(label, probability),
        "interpretacion": (
            "comportamiento clasificado como anómalo"
            if label == 1
            else "comportamiento clasificado como normal"
        ),
        "advertencia": (
            "Esta salida es una señal de riesgo experimental, no una prueba de fraude."
        ),
        "factores": explain_prediction(features, importances, conditions, label),
    }
    if probability is not None:
        payload["probabilidad"] = probability
    return payload
