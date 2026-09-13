import os
import json
import logging

from dotenv import load_dotenv
from google import genai
from google.genai import types

logging.getLogger("google_genai.models").setLevel(logging.ERROR)

load_dotenv()
CLIENTE = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODELO_TEXTO = "gemini-3.6-flash"
NOMBRE_ASISTENTE = "CapiFrog"

SISTEMA = (
    f"Your name is '{NOMBRE_ASISTENTE}'. That is your only name — never use another. "
    "Do not introduce yourself or restate your own name in a reply; the user already knows "
    "who they're talking to. Only mention your name if they explicitly ask what you're called. "
    "You are a financial assistant for older adults. "
    "Write in simple, plain English: short sentences, no jargon, no technical terms. "
    "Use EXCLUSIVELY the numbers from the JSON you receive; never invent figures. "
    "Write amounts in dollars, rounded to the nearest whole number, and months with one decimal. "
    "You never give orders — you explain the options and leave the decision to the user. "
    "When listing 2 or more distinct items (options, reasons, steps), use short dash-prefixed "
    "bullets, one item per line. Otherwise write plain short sentences, in 1-3 short paragraphs "
    "separated by a blank line if there's more than one idea, leading with the single most "
    "important takeaway. Maximum 120 words. No markdown, no headers, no bold, no asterisks — "
    "dashes for bullets are the only exception."
)

NIVEL_EN = {"bajo": "low", "medio": "medium", "alto": "high"}
BUCKET_LABELS = {
    "fondo_lluvia": "Emergency Fund",
    "alto_rendimiento": "High-Yield Savings",
    "corto_plazo": "Short-term Savings",
}


def _redondear(v):
    # limpia floats largos antes de mandarlos al modelo
    if isinstance(v, bool):
        return v
    if isinstance(v, float):
        return round(v, 2)
    if isinstance(v, dict):
        return {k: _redondear(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_redondear(x) for x in v]
    return v


def _config(temp):
    base = dict(system_instruction=SISTEMA, temperature=temp, max_output_tokens=2048)
    try:
        return types.GenerateContentConfig(
            **base, thinking_config=types.ThinkingConfig(thinking_level="low"))
    except Exception:
        return types.GenerateContentConfig(**base)


def redactar(instruccion, datos, temp=0.4):
    """Ask Gemini to write the text. Returns None (never raises) on any
    failure — quota, outage, empty response — so callers can fall back to a
    templated answer built from the same real numbers instead of erroring."""
    limpio = json.dumps(_redondear(datos), ensure_ascii=False, default=float)
    prompt = f"{instruccion}\n\nDATA:\n{limpio}"
    try:
        r = CLIENTE.models.generate_content(model=MODELO_TEXTO, contents=prompt, config=_config(temp))
        texto = (r.text or "").strip()
        return texto or None
    except Exception:
        return None


def listar_modelos():
    for m in CLIENTE.models.list():
        print(m.name)


# ─── Fallback templates ────────────────────────────────────────────────────
# Used only when Gemini is unavailable (quota, outage). Plain, deterministic,
# and built from the same real numbers — never a generic "unavailable" notice.

def _fallback_revision(riesgo, plan, cuentas):
    nivel = NIVEL_EN.get(riesgo["nivel"], riesgo["nivel"])
    intro = f"You're at {nivel} risk, with about {riesgo['meses_colchon']:.1f} months of cushion."
    if plan["excedente_mensual"] > 0:
        clave = max(plan["aportaciones"], key=plan["aportaciones"].get)
        intro += f" You have about ${round(plan['excedente_mensual']):,} free each month."
        bullet = f"- Put ${round(plan['aportaciones'][clave]):,} toward your {BUCKET_LABELS.get(clave, clave)}."
        return f"{intro}\n\n{bullet}"
    intro += " Your budget is tight this month, with little left over to save."
    return intro


def _fallback_simulacion(sim):
    lineas = []
    for r in sim["resultados"]:
        nivel = NIVEL_EN.get(r["riesgo"], r["riesgo"])
        etiqueta = r["escenario"].replace("_", " ").title()
        extra = ", would leave you overdrawn" if r["descubierto"] else ""
        lineas.append(f"- {etiqueta}: {nivel} risk, {r['meses_colchon']:.1f} months of cushion{extra}.")
    return "\n".join(lineas)


def _fallback_alerta(aviso):
    nivel = NIVEL_EN.get(aviso["nivel"], aviso["nivel"])
    intro = f"Risk level: {nivel}, with about {aviso['meses_colchon']:.1f} months of cushion."
    bullets = [f"- Watch out: {clave.replace('_', ' ')}."
               for clave, activo in (aviso.get("escenarios") or {}).items() if activo]
    if aviso["nivel"] == "alto":
        bullets.append("- Consider notifying your trusted contact and reviewing assistance programs.")
    if not bullets:
        return intro
    return intro + "\n\n" + "\n".join(bullets)


def _fallback_mensaje_contacto(nombre):
    return f"Hi, it's {nombre}. Things are financially tight right now and I could use some support."


def _fallback_transferencia(veredicto):
    return {
        "adecuado": "This transfer looks reasonable given your usual amounts.",
        "demasiado": "This is larger than your usual transfer — consider a smaller amount.",
        "muy_poco": "This is smaller than your usual transfer amount.",
        "fondo_incompleto": "Your emergency fund isn't full yet — consider prioritizing that first.",
    }.get(veredicto, "Here is your transfer summary.")


def texto_revision(riesgo, plan, cuentas):
    d = {"riesgo": {k: v for k, v in riesgo.items() if k != "features"},
         "plan": plan, "cuentas": cuentas}
    return redactar("Explain the situation they're in in one short sentence, then list the "
                     "key numbers and which account(s) to move money into as bullets, and why.", d) \
        or _fallback_revision(riesgo, plan, cuentas)


def texto_simulacion(sim):
    return redactar("For each scenario, give 1 advantage, 1 disadvantage, and 1 risk as a bullet. "
                     "Compare them in one closing sentence.", sim) \
        or _fallback_simulacion(sim)


def texto_alerta(aviso):
    ins = ("Explain the detected risk in one calm sentence, then list what would happen in "
           "each scenario as bullets."
           if aviso["nivel"] == "medio" else
           "Calmly raise the alarm without frightening them, then list as bullets: the "
           "affected scenarios, the option to notify their trusted contact, and the assistance "
           "programs.")
    return redactar(ins, aviso) or _fallback_alerta(aviso)


def mensaje_contacto(nombre, aviso):
    return redactar(f"Draft a short message {nombre} could send their trusted contact asking for support.",
                    aviso, temp=0.6) or _fallback_mensaje_contacto(nombre)


def texto_transferencia(veredicto, datos):
    return redactar(f"Comment on this transfer before they commit to it, and whether it looks reasonable. "
                     f"Computed verdict: {veredicto}. Maximum 40 words.", datos) \
        or _fallback_transferencia(veredicto)
