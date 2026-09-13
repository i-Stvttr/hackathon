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
    f"Your name is '{NOMBRE_ASISTENTE}'. That is your only name; never use another. "
    "You are a financial assistant for older adults. "
    "Write in simple, plain English: short sentences, no jargon, no technical terms. "
    "Use EXCLUSIVELY the numbers from the JSON you receive; never invent figures. "
    "Write amounts in dollars, rounded to the nearest whole number, and months with one decimal. "
    "You never give orders — you explain the options and leave the decision to the user. "
    "Structure your reply as 2 to 4 short paragraphs (1-3 sentences each), separated by a "
    "blank line. Open the first paragraph with the single most important takeaway. "
    "Maximum 150 words. No markdown, no headers, no bullet symbols — plain sentences only."
)


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
    limpio = json.dumps(_redondear(datos), ensure_ascii=False, default=float)
    prompt = f"{instruccion}\n\nDATA:\n{limpio}"
    try:
        r = CLIENTE.models.generate_content(model=MODELO_TEXTO, contents=prompt, config=_config(temp))
        texto = (r.text or "").strip()
        return texto or "(no text: the model returned nothing)"
    except Exception:
        # A transient Gemini outage/quota error shouldn't 500 the whole
        # request — callers (main.py) already computed real numbers/verdicts
        # before this text, and for /transferencia the money has already
        # moved by the time this runs, so raising here would desync the
        # frontend from a transfer that actually succeeded.
        return "(CapiFrog's explanation is temporarily unavailable — the numbers above are still accurate.)"


def listar_modelos():
    for m in CLIENTE.models.list():
        print(m.name)


def texto_revision(riesgo, plan, cuentas):
    d = {"riesgo": {k: v for k, v in riesgo.items() if k != "features"},
         "plan": plan, "cuentas": cuentas}
    return redactar("Explain the situation they're in and what to move into each account, and why.", d)


def texto_simulacion(sim):
    return redactar("For each scenario, give 1 advantage, 1 disadvantage, and 1 risk. Compare them at the end.", sim)


def texto_alerta(aviso):
    ins = ("Calmly explain the detected risk and what would happen in each scenario."
           if aviso["nivel"] == "medio" else
           "Calmly raise the alarm without frightening them. Mention the option to notify "
           "their trusted contact and the assistance programs.")
    return redactar(ins, aviso)


def mensaje_contacto(nombre, aviso):
    return redactar(f"Draft a short message {nombre} could send their trusted contact asking for support.",
                    aviso, temp=0.6)


def texto_transferencia(veredicto, datos):
    return redactar(f"Comment on this transfer before they commit to it, and whether it looks reasonable. "
                     f"Computed verdict: {veredicto}. Maximum 40 words.", datos)