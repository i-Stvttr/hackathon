from google.genai import types

import estado
from gemini_texto import CLIENTE, MODELO_TEXTO, texto_chat, relabel_cuentas, relabel_plan
from modelo import evaluar_riesgo
from plan import plan_ahorro, simular_compra, monitorear

INTENCIONES = {
    "revision": ["how am i doing", "how am i", "situation", "review", "savings", "account", "save"],
    "simulacion": ["if i buy", "if i spend", "spend", "buy", "simulate", "can i afford"],
    "riesgo": ["risk", "emergency", "help", "lose", "job", "alert"],
}


def clasificar(mensaje):
    m = mensaje.lower()
    for intencion, claves in INTENCIONES.items():
        if any(k in m for k in claves):
            return intencion
    try:
        r = CLIENTE.models.generate_content(
            model=MODELO_TEXTO,
            contents=f"Classify in one word (revision|simulacion|riesgo|general): {mensaje}",
            config=types.GenerateContentConfig(temperature=0, max_output_tokens=5),
        )
        return (r.text or "revision").strip().lower()
    except Exception:
        return "revision"  # Gemini unavailable — a general review is a safe default reply.


def extraer_monto(mensaje):
    limpio = mensaje.replace("$", " ").replace(",", "")
    nums = [float(t) for t in limpio.split() if t.replace(".", "", 1).isdigit()]
    return max(nums) if nums else None


def responder(mensaje, u, perfil=None):
    # texto_chat() gets the user's literal message. The context always
    # includes the core riesgo+plan+cuentas picture (not just whichever
    # narrow slice the 3-way classifier picked) so a tangential or
    # follow-up question still has real numbers to draw on instead of
    # forcing every reply into one of three report templates.
    intencion = clasificar(mensaje)
    riesgo, plan = evaluar_riesgo(u), plan_ahorro(u)
    contexto = {
        "riesgo": {k: v for k, v in riesgo.items() if k != "features"},
        "plan": relabel_plan(plan),
        "cuentas": relabel_cuentas(estado.CUENTAS),
    }
    if intencion == "simulacion":
        contexto["simulacion"] = simular_compra(u, extraer_monto(mensaje) or 15000.0)
    elif intencion == "riesgo":
        contexto["alerta"] = monitorear(u)
    else:
        intencion = "revision"
    if perfil:
        contexto["perfil_usuario"] = perfil
    return {"intencion": intencion, "datos": contexto, "texto": texto_chat(mensaje, contexto)}