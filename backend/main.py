from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import estado
from mock_user import PRESETS
from modelo import evaluar_riesgo, UMBRALES
from plan import plan_ahorro, simular_compra, monitorear, comentario_transferencia, ahorro_en_umbrales
from gemini_texto import (texto_revision, texto_escenario, texto_alerta, mensaje_contacto,
                          texto_transferencia, relabel_cuentas, relabel_plan, relabel_transferencia)
from chat import responder

app = FastAPI(title="CapiFrog")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Onboarding answers (src/onboarding) — optional, attached to requests whose
# text generation can meaningfully use it. Loose on purpose: this mirrors the
# frontend's ProfileAnswers shape without duplicating its full structure.
class Perfil(BaseModel):
    goals: List[str] = []
    predictability: Optional[str] = None
    recurring: Optional[str] = None


class Mensaje(BaseModel):
    texto: str
    perfil: Optional[Perfil] = None


class Compra(BaseModel):
    monto: float
    meses_posponer: int = 6


class DetalleEscenario(BaseModel):
    monto: float
    meses_posponer: int = 6
    escenario: str
    perfil: Optional[Perfil] = None


class Transferencia(BaseModel):
    origen: str
    destino: str
    monto: float
    perfil: Optional[Perfil] = None


class Edicion(BaseModel):
    campos: Dict[str, Any]


def _instantanea(extra=None):
    r = evaluar_riesgo(estado.USUARIO)
    r.pop("features", None)
    salida = {"usuario": estado.USUARIO, "cuentas": estado.CUENTAS, "riesgo": r, "umbrales": UMBRALES}
    if extra:
        salida.update(extra)
    return salida


@app.get("/usuario")
def get_usuario():
    return _instantanea({"campos_editables": sorted(estado.RANGOS) + estado.CAMPOS_BOOL + estado.CAMPOS_TEXTO,
                         "rangos": estado.RANGOS, "presets": sorted(PRESETS)})


@app.patch("/usuario")
def patch_usuario(e: Edicion):
    return _instantanea({"cambios": estado.actualizar_usuario(e.campos)})


@app.patch("/cuentas")
def patch_cuentas(e: Edicion):
    return _instantanea({"cambios": estado.actualizar_cuentas(e.campos)})


@app.post("/preset/{nombre}")
def post_preset(nombre: str):
    ok = estado.aplicar_preset(nombre)
    return _instantanea({"ok": ok, "preset": nombre if ok else None, "disponibles": sorted(PRESETS)})


@app.post("/reiniciar")
def post_reiniciar():
    estado.reiniciar()
    return _instantanea({"ok": True})


@app.get("/umbrales/ahorro")
def get_umbrales_ahorro():
    return ahorro_en_umbrales(estado.USUARIO)


@app.get("/revision")
def get_revision():
    riesgo, plan = evaluar_riesgo(estado.USUARIO), plan_ahorro(estado.USUARIO)
    riesgo.pop("features", None)
    return {"riesgo": riesgo, "plan": plan, "texto": texto_revision(riesgo, plan, estado.CUENTAS)}


@app.post("/simulacion")
def post_simulacion(c: Compra):
    # Pure numbers, no Gemini call — the explanation for whichever scenario
    # the user is actually looking at comes from /simulacion/detalle instead,
    # so switching tabs doesn't require re-explaining all three every time.
    return simular_compra(estado.USUARIO, c.monto, c.meses_posponer)


@app.post("/simulacion/detalle")
def post_simulacion_detalle(d: DetalleEscenario):
    sim = simular_compra(estado.USUARIO, d.monto, d.meses_posponer)
    resultado = next((r for r in sim["resultados"] if r["escenario"] == d.escenario), None)
    if resultado is None:
        return {"pros": None, "cons": None, "risk": None}
    perfil = d.perfil.model_dump() if d.perfil else None
    return texto_escenario(resultado, sim, perfil)  # {"pros": ..., "cons": ..., "risk": ...}


@app.get("/monitoreo")
def get_monitoreo():
    aviso = monitorear(estado.USUARIO)
    salida = dict(aviso)
    if aviso["nivel"] != "bajo":
        # Extra financial-history context so the "what ifs" and history
        # callout are grounded in this person's actual numbers, not generic.
        contexto = dict(aviso)
        contexto.update({
            "historial_gastos": estado.USUARIO["historial_gastos"],
            "ingreso_mensual": estado.USUARIO["ingreso_mensual"],
            "gastos_esenciales": estado.USUARIO["gastos_esenciales"],
            "gastos_discrecionales": estado.USUARIO["gastos_discrecionales"],
            "dependientes": estado.USUARIO["dependientes"],
            "seguro_medico": estado.USUARIO["seguro_medico"],
        })
        salida.update(texto_alerta(contexto))  # {"why": ..., "whatif": ..., "history": ...}
    else:
        salida.update({"why": None, "whatif": None, "history": None})
    if aviso["nivel"] == "alto":
        salida["mensaje_contacto"] = mensaje_contacto(estado.USUARIO["nombre"], aviso)
    return salida


def _datos_transferencia(t: Transferencia):
    # The full picture, not just the destination balance — texto_transferencia
    # reasons about the whole financial situation, not one account in isolation.
    riesgo = evaluar_riesgo(estado.USUARIO)
    riesgo.pop("features", None)
    datos = {
        "transferencia": relabel_transferencia(t.model_dump(exclude={"perfil"})),
        "cuentas": relabel_cuentas(estado.CUENTAS),
        "usuario": estado.USUARIO,
        "riesgo": riesgo,
        "plan": relabel_plan(plan_ahorro(estado.USUARIO)),
    }
    if t.perfil:
        datos["perfil_usuario"] = t.perfil.model_dump()
    return datos


@app.post("/transferencia/preview")
def post_transferencia_preview(t: Transferencia):
    if estado.CUENTAS.get(t.origen, 0) < t.monto:
        return {"ok": False, "texto": "No hay suficiente en esa cuenta."}
    veredicto = comentario_transferencia(estado.USUARIO, t.destino, t.monto)
    return {"ok": True, "veredicto": veredicto, "texto": texto_transferencia(veredicto, _datos_transferencia(t))}


@app.post("/transferencia")
def post_transferencia(t: Transferencia):
    if estado.CUENTAS.get(t.origen, 0) < t.monto:
        return {"ok": False, "texto": "No hay suficiente en esa cuenta."}
    veredicto = comentario_transferencia(estado.USUARIO, t.destino, t.monto)
    datos = _datos_transferencia(t)  # snapshot BEFORE moving money — same picture the preview showed
    estado.actualizar_cuentas({t.origen: estado.CUENTAS[t.origen] - t.monto,
                               t.destino: estado.CUENTAS.get(t.destino, 0.0) + t.monto})
    return {"ok": True, "cuentas": estado.CUENTAS, "veredicto": veredicto,
            "texto": texto_transferencia(veredicto, datos)}


@app.post("/chat")
def post_chat(m: Mensaje):
    perfil = m.perfil.model_dump() if m.perfil else None
    return responder(m.texto, estado.USUARIO, perfil)