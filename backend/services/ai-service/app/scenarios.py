from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4


def make_event(
    usuario_id: int,
    tipo_evento: str,
    timestamp: datetime,
    entidad: str = "sesion",
    entidad_id: int | None = 1,
    resultado: str = "EXITOSO",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "event_id": str(uuid4()),
        "service": "synthetic-generator",
        "usuario_id": usuario_id,
        "tipo_evento": tipo_evento,
        "entidad": entidad,
        "entidad_id": entidad_id,
        "timestamp": timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "resultado": resultado,
        "ip": f"192.168.1.{(usuario_id % 200) + 10}",
        "metadata": metadata or {},
    }


def _base(usuario_id: int, offset_minutes: int = 0) -> datetime:
    return datetime(2026, 3, 15, 14, 0, tzinfo=timezone.utc) + timedelta(
        minutes=offset_minutes,
        days=usuario_id % 20,
    )


def scenario_normal_a(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=4), "venta", 100, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=9), "venta", 101, metadata={"quantity_ref": max(1, quantity_ref - 1)}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=12 + int(rng.integers(0, 8)))),
    ]


def scenario_normal_b(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=3), "venta", 110, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=8), "venta", 111, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=14), "venta", 112, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=20)),
    ]


def scenario_normal_c(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "PRODUCTO_MODIFICADO", t + timedelta(minutes=5), "producto", 50, metadata={"campo": "descripcion"}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=12), "venta", 120, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=18)),
    ]


def scenario_failed_logins(usuario_id: int, rng, _quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [
        make_event(usuario_id, "LOGIN_FALLIDO", t + timedelta(minutes=i), resultado="FALLIDO")
        for i in range(5 + int(rng.integers(0, 2)))
    ]
    events.append(make_event(usuario_id, "LOGIN", t + timedelta(minutes=8)))
    return events


def scenario_cancellations(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    for i in range(3):
        events.append(
            make_event(
                usuario_id,
                "VENTA_CREADA",
                t + timedelta(minutes=2 + i * 4),
                "venta",
                200 + i,
                metadata={"quantity_ref": quantity_ref},
            )
        )
        events.append(
            make_event(
                usuario_id,
                "VENTA_ANULADA",
                t + timedelta(minutes=3 + i * 4),
                "venta",
                200 + i,
            )
        )
    events.append(make_event(usuario_id, "LOGOUT", t + timedelta(minutes=20)))
    return events


def scenario_stock_then_sale(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "STOCK_MODIFICADO", t + timedelta(minutes=1), "producto", 9),
        make_event(usuario_id, "STOCK_MODIFICADO", t + timedelta(minutes=2), "producto", 9),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=4), "venta", 300, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=8)),
    ]


def scenario_price_then_sale(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "PRECIO_MODIFICADO", t + timedelta(minutes=1), "producto", 11),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=3), "venta", 310, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=5), "venta", 311, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=9)),
    ]


def scenario_admin_burst(usuario_id: int, rng, _quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN", t),
        make_event(usuario_id, "USUARIO_MODIFICADO", t + timedelta(minutes=1), "usuario", 80),
        make_event(usuario_id, "USUARIO_MODIFICADO", t + timedelta(minutes=2), "usuario", 81),
        make_event(usuario_id, "CAMBIO_ROL", t + timedelta(minutes=3), "usuario", 80),
        make_event(usuario_id, "USUARIO_DESACTIVADO", t + timedelta(minutes=4), "usuario", 81),
        make_event(usuario_id, "LOGOUT", t + timedelta(minutes=6)),
    ]


def scenario_burst(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    events = [make_event(usuario_id, "LOGIN", t)]
    for i in range(19):
        tipo = "VENTA_CREADA" if i % 3 else "PRODUCTO_MODIFICADO"
        entidad = "venta" if tipo == "VENTA_CREADA" else "producto"
        events.append(
            make_event(
                usuario_id,
                tipo,
                t + timedelta(seconds=5 * (i + 1)),
                entidad,
                400 + i,
                metadata={"quantity_ref": quantity_ref} if tipo == "VENTA_CREADA" else {},
            )
        )
    return events


def scenario_combined(usuario_id: int, rng, quantity_ref: int) -> list[dict[str, Any]]:
    t = _base(usuario_id)
    return [
        make_event(usuario_id, "LOGIN_FALLIDO", t, resultado="FALLIDO"),
        make_event(usuario_id, "LOGIN_FALLIDO", t + timedelta(minutes=1), resultado="FALLIDO"),
        make_event(usuario_id, "LOGIN_FALLIDO", t + timedelta(minutes=2), resultado="FALLIDO"),
        make_event(usuario_id, "LOGIN_FALLIDO", t + timedelta(minutes=3), resultado="FALLIDO"),
        make_event(usuario_id, "LOGIN_FALLIDO", t + timedelta(minutes=4), resultado="FALLIDO"),
        make_event(usuario_id, "LOGIN", t + timedelta(minutes=5)),
        make_event(usuario_id, "STOCK_MODIFICADO", t + timedelta(minutes=6), "producto", 12),
        make_event(usuario_id, "PRECIO_MODIFICADO", t + timedelta(minutes=7), "producto", 12),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=8), "venta", 500, metadata={"quantity_ref": quantity_ref}),
        make_event(usuario_id, "VENTA_ANULADA", t + timedelta(minutes=9), "venta", 500),
        make_event(usuario_id, "VENTA_CREADA", t + timedelta(minutes=10), "venta", 501, metadata={"quantity_ref": quantity_ref}),
    ]


NORMAL_SCENARIOS = {
    "normal_a": scenario_normal_a,
    "normal_b": scenario_normal_b,
    "normal_c": scenario_normal_c,
}

ANOMALY_SCENARIOS = {
    "failed_logins": scenario_failed_logins,
    "cancellations": scenario_cancellations,
    "stock_then_sale": scenario_stock_then_sale,
    "price_then_sale": scenario_price_then_sale,
    "admin_burst": scenario_admin_burst,
    "time_burst": scenario_burst,
    "combined": scenario_combined,
}
