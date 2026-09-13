from google.genai import types

import estado
from gemini_texto import CLIENTE, MODELO_TEXTO, texto_revision, texto_simulacion, texto_alerta
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
    r = CLIENTE.models.generate_content(
        model=MODELO_TEXTO,
        contents=f"Classify in one word (revision|simulacion|riesgo|general): {mensaje}",
        config=types.GenerateContentConfig(temperature=0, max_output_tokens=5),
    )
    return r.text.strip().lower()


def extraer_monto(mensaje):
    limpio = mensaje.replace("$", " ").replace(",", "")
    nums = [float(t) for t in limpio.split() if t.replace(".", "", 1).isdigit()]
    return max(nums) if nums else None


def responder(mensaje, u):
    intencion = clasificar(mensaje)
    if intencion == "simulacion":
        sim = simular_compra(u, extraer_monto(mensaje) or 15000.0)
        return {"intencion": intencion, "datos": sim, "texto": texto_simulacion(sim)}
    if intencion == "riesgo":
        aviso = monitorear(u)
        return {"intencion": intencion, "datos": aviso, "texto": texto_alerta(aviso)}
    riesgo, plan = evaluar_riesgo(u), plan_ahorro(u)
    return {"intencion": "revision",
            "datos": {"riesgo": {k: v for k, v in riesgo.items() if k != "features"}, "plan": plan},
            "texto": texto_revision(riesgo, plan, estado.CUENTAS)}