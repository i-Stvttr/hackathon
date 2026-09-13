from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import estado
from mock_user import PRESETS
from modelo import evaluar_riesgo, UMBRALES
from plan import plan_ahorro, simular_compra, monitorear, comentario_transferencia, ahorro_en_umbrales
from gemini_texto import texto_revision, texto_simulacion, texto_alerta, mensaje_contacto, texto_transferencia
from chat import responder

app = FastAPI(title="CapiFrog")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Mensaje(BaseModel):
    texto: str


class Compra(BaseModel):
    monto: float
    meses_posponer: int = 6


class Transferencia(BaseModel):
    origen: str
    destino: str
    monto: float


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
    sim = simular_compra(estado.USUARIO, c.monto, c.meses_posponer)
    return {**sim, "texto": texto_simulacion(sim)}


@app.get("/monitoreo")
def get_monitoreo():
    aviso = monitorear(estado.USUARIO)
    salida = dict(aviso)
    salida["texto"] = texto_alerta(aviso) if aviso["nivel"] != "bajo" else None
    if aviso["nivel"] == "alto":
        salida["mensaje_contacto"] = mensaje_contacto(estado.USUARIO["nombre"], aviso)
    return salida


@app.post("/transferencia/preview")
def post_transferencia_preview(t: Transferencia):
    if estado.CUENTAS.get(t.origen, 0) < t.monto:
        return {"ok": False, "texto": "No hay suficiente en esa cuenta."}
    veredicto = comentario_transferencia(estado.USUARIO, t.destino, t.monto)
    datos = {"transferencia": t.model_dump(), "cuentas": estado.CUENTAS}
    return {"ok": True, "veredicto": veredicto, "texto": texto_transferencia(veredicto, datos)}


@app.post("/transferencia")
def post_transferencia(t: Transferencia):
    if estado.CUENTAS.get(t.origen, 0) < t.monto:
        return {"ok": False, "texto": "No hay suficiente en esa cuenta."}
    estado.actualizar_cuentas({t.origen: estado.CUENTAS[t.origen] - t.monto,
                               t.destino: estado.CUENTAS.get(t.destino, 0.0) + t.monto})
    veredicto = comentario_transferencia(estado.USUARIO, t.destino, t.monto)
    return {"ok": True, "cuentas": estado.CUENTAS, "veredicto": veredicto,
            "texto": texto_transferencia(veredicto, {"transferencia": t.model_dump(), "cuentas": estado.CUENTAS})}


@app.post("/chat")
def post_chat(m: Mensaje):
    return responder(m.texto, estado.USUARIO)