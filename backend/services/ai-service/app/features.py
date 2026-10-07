from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

STOCK_SALE_WINDOW = timedelta(minutes=15)
PRICE_SALE_WINDOW = timedelta(minutes=15)
MISSING_TIME_MINUTES = 9999.0

ADMIN_TYPES = {
    "USUARIO_CREADO",
    "USUARIO_MODIFICADO",
    "USUARIO_DESACTIVADO",
    "CAMBIO_ROL",
}
USER_CHANGE_TYPES = {
    "USUARIO_CREADO",
    "USUARIO_MODIFICADO",
    "USUARIO_DESACTIVADO",
}


def _ts(event: dict[str, Any]) -> datetime:
    value = event["timestamp"]
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def sort_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(events, key=lambda item: (_ts(item), str(item.get("event_id", ""))))


def window_events(events: list[dict[str, Any]], reference: datetime, minutes: int) -> list[dict[str, Any]]:
    start = reference - timedelta(minutes=minutes)
    return [event for event in events if start <= _ts(event) <= reference]


def count_type(events: list[dict[str, Any]], tipo: str) -> int:
    return sum(1 for event in events if event["tipo_evento"] == tipo)


def minutes_since(events: list[dict[str, Any]], tipos: set[str], reference: datetime) -> float:
    matches = [event for event in events if event["tipo_evento"] in tipos]
    if not matches:
        return MISSING_TIME_MINUTES
    last = matches[-1]
    return max(0.0, (reference - _ts(last)).total_seconds() / 60.0)


def count_preceded_by(
    events: list[dict[str, Any]],
    target: str,
    precursor: str,
    max_gap: timedelta,
) -> int:
    count = 0
    for index, current in enumerate(events):
        if current["tipo_evento"] != target:
            continue
        current_ts = _ts(current)
        if any(
            prev["tipo_evento"] == precursor
            and timedelta(0) <= current_ts - _ts(prev) <= max_gap
            for prev in events[:index]
        ):
            count += 1
    return count


def unique_entities(events: list[dict[str, Any]]) -> int:
    values = {
        f"{event.get('entidad')}:{event.get('entidad_id')}"
        for event in events
        if event.get("entidad_id") is not None
    }
    return len(values)


def analyze_rules(
    events_10m: list[dict[str, Any]],
    events_30m: list[dict[str, Any]],
    events_all: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    failed_10m = count_type(events_10m, "LOGIN_FALLIDO")
    cancelled_30m = count_type(events_30m, "VENTA_ANULADA")
    admin_10m = sum(1 for event in events_10m if event["tipo_evento"] in ADMIN_TYPES)
    r1 = failed_10m >= 5
    r2 = cancelled_30m >= 3
    r3 = count_preceded_by(events_all, "VENTA_CREADA", "STOCK_MODIFICADO", STOCK_SALE_WINDOW) > 0
    r4 = count_preceded_by(events_all, "VENTA_CREADA", "PRECIO_MODIFICADO", PRICE_SALE_WINDOW) > 0
    r5 = admin_10m >= 3
    fired = sum([r1, r2, r3, r4, r5])
    r6 = fired >= 2
    return {
        "R1": {"fired": r1, "value": failed_10m},
        "R2": {"fired": r2, "value": cancelled_30m},
        "R3": {"fired": r3, "value": int(r3)},
        "R4": {"fired": r4, "value": int(r4)},
        "R5": {"fired": r5, "value": admin_10m},
        "R6": {"fired": r6, "value": fired},
    }


def extract_features(events_input: list[dict[str, Any]], reference: datetime | None = None) -> dict[str, float]:
    events = sort_events(events_input)
    if not events:
        return empty_features()

    reference_ts = reference or _ts(events[-1])
    events_5m = window_events(events, reference_ts, 5)
    events_10m = window_events(events, reference_ts, 10)
    events_30m = window_events(events, reference_ts, 30)
    span_minutes = max((_ts(events[-1]) - _ts(events[0])).total_seconds() / 60.0, 1 / 60)

    failed_login_count = count_type(events_10m, "LOGIN_FALLIDO")
    successful_login_count = count_type(events_10m, "LOGIN")
    login_total = failed_login_count + successful_login_count
    sales_count = count_type(events_30m, "VENTA_CREADA")
    cancelled_sales_count = count_type(events_30m, "VENTA_ANULADA")
    sale_ops = sales_count + cancelled_sales_count
    rules = analyze_rules(events_10m, events_30m, events)

    return {
        "event_count_5m": float(len(events_5m)),
        "event_count_10m": float(len(events_10m)),
        "event_count_30m": float(len(events_30m)),
        "failed_login_count": float(failed_login_count),
        "successful_login_count": float(successful_login_count),
        "failed_login_ratio": failed_login_count / login_total if login_total else 0.0,
        "sales_count": float(sales_count),
        "cancelled_sales_count": float(cancelled_sales_count),
        "cancellation_ratio": cancelled_sales_count / sale_ops if sale_ops else 0.0,
        "stock_change_count": float(count_type(events_30m, "STOCK_MODIFICADO")),
        "price_change_count": float(count_type(events_30m, "PRECIO_MODIFICADO")),
        "admin_action_count": float(sum(1 for event in events_10m if event["tipo_evento"] in ADMIN_TYPES)),
        "role_change_count": float(count_type(events_10m, "CAMBIO_ROL")),
        "user_change_count": float(sum(1 for event in events_10m if event["tipo_evento"] in USER_CHANGE_TYPES)),
        "sales_after_stock_change": float(
            count_preceded_by(events, "VENTA_CREADA", "STOCK_MODIFICADO", STOCK_SALE_WINDOW)
        ),
        "sales_after_price_change": float(
            count_preceded_by(events, "VENTA_CREADA", "PRECIO_MODIFICADO", PRICE_SALE_WINDOW)
        ),
        "time_since_last_login": minutes_since(events, {"LOGIN"}, reference_ts),
        "time_since_last_stock_change": minutes_since(events, {"STOCK_MODIFICADO"}, reference_ts),
        "time_since_last_price_change": minutes_since(events, {"PRECIO_MODIFICADO"}, reference_ts),
        "events_per_minute": len(events) / span_minutes,
        "unique_entities_modified": float(unique_entities(events)),
        "failed_login_rule": 1.0 if rules["R1"]["fired"] else 0.0,
        "cancellation_rule": 1.0 if rules["R2"]["fired"] else 0.0,
        "stock_sale_rule": 1.0 if rules["R3"]["fired"] else 0.0,
        "price_sale_rule": 1.0 if rules["R4"]["fired"] else 0.0,
        "admin_activity_rule": 1.0 if rules["R5"]["fired"] else 0.0,
        "combined_pattern_rule": 1.0 if rules["R6"]["fired"] else 0.0,
        "risk_rule_count": float(sum(1 for key in ("R1", "R2", "R3", "R4", "R5", "R6") if rules[key]["fired"])),
    }


def empty_features() -> dict[str, float]:
    return {
        "event_count_5m": 0.0,
        "event_count_10m": 0.0,
        "event_count_30m": 0.0,
        "failed_login_count": 0.0,
        "successful_login_count": 0.0,
        "failed_login_ratio": 0.0,
        "sales_count": 0.0,
        "cancelled_sales_count": 0.0,
        "cancellation_ratio": 0.0,
        "stock_change_count": 0.0,
        "price_change_count": 0.0,
        "admin_action_count": 0.0,
        "role_change_count": 0.0,
        "user_change_count": 0.0,
        "sales_after_stock_change": 0.0,
        "sales_after_price_change": 0.0,
        "time_since_last_login": MISSING_TIME_MINUTES,
        "time_since_last_stock_change": MISSING_TIME_MINUTES,
        "time_since_last_price_change": MISSING_TIME_MINUTES,
        "events_per_minute": 0.0,
        "unique_entities_modified": 0.0,
        "failed_login_rule": 0.0,
        "cancellation_rule": 0.0,
        "stock_sale_rule": 0.0,
        "price_sale_rule": 0.0,
        "admin_activity_rule": 0.0,
        "combined_pattern_rule": 0.0,
        "risk_rule_count": 0.0,
    }
