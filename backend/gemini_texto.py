import os
import json
import logging

from dotenv import load_dotenv
from google import genai
from google.genai import types

logging.getLogger("google_genai.models").setLevel(logging.ERROR)

load_dotenv()
CLIENTE = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODELO_TEXTO = "gemini-3.8-flash"
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
    "bullets, one item per line. Otherwise write plain short sentences, in short paragraphs "
    "separated by a blank line if there's more than one idea, leading with the single most "
    "important takeaway. Default to under 120 words, unless the specific request below asks "
    "you to be thorough — then prioritize being complete and clear over being brief. No "
    "markdown, no headers, no bold, no asterisks — dashes for bullets are the only exception. "
    "If the data includes a perfil_usuario (their stated onboarding goals or income "
    "predictability), weave it into your answer when it's actually relevant — don't force it in."
)

NIVEL_EN = {"bajo": "low", "medio": "medium", "alto": "high"}
BUCKET_LABELS = {
    "balance": "Checking",
    "fondo_lluvia": "Emergency Fund",
    "gastos_fijos": "Routine Bills",
    "alto_rendimiento": "High-Yield Savings",
    "corto_plazo": "Short-term Savings",
}
DRIVER_EN = {
    "tasa_ahorro": "a low savings rate",
    "meses_colchon": "a thin cash cushion",
    "dti": "high debt payments",
    "volatilidad_gasto": "unpredictable spending",
    "estabilidad_ingreso": "unstable income",
    "carga_dependientes": "supporting dependents",
    "exposicion_salud": "health cost exposure",
    "ratio_discrecional": "high discretionary spending",
}
ESCENARIO_EN = {
    "pierde_un_pago": "missing a paycheck would likely leave bills unpaid",
    "pierde_empleo_3m": "losing income for 3 months would use up your savings",
    "emergencia_medica_20k": "a $20,000 medical emergency would not be covered by savings",
}
SIM_ESCENARIO_EN = {"gastar_ahora": "Spend now", "posponer_6m": "Delay", "no_gastar_y_ahorrar": "Save instead"}


def relabel_cuentas(d):
    """Rewrite an account-keyed dict's keys (estado.CUENTAS, or a plan's
    aportaciones) to English labels before it goes anywhere near Gemini —
    otherwise it sometimes echoes the raw snake_case key back verbatim
    ('fondo lluvia') instead of translating it."""
    return {BUCKET_LABELS.get(k, k): v for k, v in d.items()}


def relabel_plan(plan):
    p = dict(plan)
    p["aportaciones"] = relabel_cuentas(plan["aportaciones"])
    return p


def relabel_transferencia(t):
    t = dict(t)
    t["origen"] = BUCKET_LABELS.get(t.get("origen"), t.get("origen"))
    t["destino"] = BUCKET_LABELS.get(t.get("destino"), t.get("destino"))
    return t


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


def _fallback_escenario(resultado, sim):
    nivel = NIVEL_EN.get(resultado["riesgo"], resultado["riesgo"])
    interes = round(sim["costo_oportunidad_12m"])
    cushion = f"{resultado['meses_colchon']:.1f} months of cushion"
    if resultado["escenario"] == "no_gastar_y_ahorrar":
        pros = [f"- Keeps ${round(resultado['ahorro_resultante']):,} saved, about {cushion}.",
                f"- Earns roughly ${interes:,} in interest over the next 12 months."]
        cons = ["- The money isn't available to spend right now."]
    elif resultado["escenario"] == "gastar_ahora":
        pros = ["- Covers the expense immediately, in full."]
        cons = [f"- Drops your cushion to {cushion}.",
                f"- Costs about ${interes:,} in missed interest over 12 months."]
    else:
        pros = ["- Buys time before committing the money.",
                f"- Leaves about {cushion} in the meantime."]
        cons = ["- The expense still has to be paid eventually.", "- Possible late fees if delayed too long."]
    risk = [f"- This puts you at {nivel} risk overall."]
    if resultado["descubierto"]:
        risk.append("- This would leave you overdrawn, with no buffer for anything unexpected.")
    return {"pros": "\n".join(pros), "cons": "\n".join(cons), "risk": "\n".join(risk)}


def _parse_labeled(texto, etiquetas):
    """Splits a reply labeled with 'ETIQUETA:' headers (one per line) into a
    dict of bullet strings keyed by lowercase label. Returns None — falling
    through to the deterministic fallback — if any expected label is
    missing, rather than guessing at a malformed split."""
    secciones = {e: [] for e in etiquetas}
    actual = None
    for linea in texto.splitlines():
        l = linea.strip()
        if not l:
            continue
        clave = l.upper().rstrip(":")
        if clave in secciones:
            actual = clave
            continue
        if actual:
            secciones[actual].append(l if l.startswith("-") else f"- {l}")
    if not all(secciones.values()):
        return None
    return {k.lower(): "\n".join(v) for k, v in secciones.items()}


def _fallback_alerta(aviso):
    nivel = NIVEL_EN.get(aviso["nivel"], aviso["nivel"])
    drivers = [DRIVER_EN.get(d, d) for d in (aviso.get("drivers") or [])[:2]]
    why = [f"- Risk level: {nivel}, with about {aviso['meses_colchon']:.1f} months of cushion" +
           (f", mainly due to {' and '.join(drivers)}." if drivers else ".")]

    whatif = [f"- {ESCENARIO_EN.get(clave, clave.replace('_', ' '))}."
              for clave, activo in (aviso.get("escenarios") or {}).items() if activo]
    hist = aviso.get("historial_gastos")
    if hist and len(hist) >= 2:
        pico = round(max(hist))
        whatif.append(f"- If a month runs as high as your recent peak of ${pico:,}, "
                       f"your cushion would shrink further.")
    if not whatif:
        whatif = ["- No single scenario stands out beyond your overall cushion level."]

    history = []
    if hist and len(hist) >= 2:
        alto, bajo = round(max(hist)), round(min(hist))
        swing = round(((alto - bajo) / bajo) * 100) if bajo else 0
        history.append(f"- Your monthly spending has ranged from ${bajo:,} to ${alto:,} over "
                        f"the last {len(hist)} months, a {swing}% swing.")
    else:
        history.append("- Not enough spending history yet to show a trend.")

    return {"why": "\n".join(why), "whatif": "\n".join(whatif), "history": "\n".join(history)}


def _fallback_mensaje_contacto(nombre):
    return f"Hi, it's {nombre}. Things are financially tight right now and I could use some support."


def _fallback_transferencia(veredicto, datos):
    datos = datos or {}
    t = datos.get("transferencia", {})
    origen = BUCKET_LABELS.get(t.get("origen"), t.get("origen") or "this account")
    destino = BUCKET_LABELS.get(t.get("destino"), t.get("destino") or "this account")
    monto = t.get("monto")
    monto_txt = f"${round(monto):,}" if isinstance(monto, (int, float)) else "this amount"
    riesgo = datos.get("riesgo")
    reminder = (f" You're currently at {NIVEL_EN.get(riesgo['nivel'], riesgo['nivel'])} risk, "
                f"with about {riesgo['meses_colchon']:.1f} months of cushion.") if riesgo else ""
    intro = f"You're transferring {monto_txt} to {destino} from {origen}.{reminder}"

    pro, con = {
        "adecuado": ("This fits your usual pattern and moves you toward your savings.",
                     "No significant downside — this looks reasonable."),
        "demasiado": (f"It builds up {destino} meaningfully in one move.",
                      f"It's larger than your usual transfer, leaving less cushion in {origen}."),
        "muy_poco": ("It's a safe, low-impact move with little downside.",
                     "You could likely move more without straining your budget."),
        "fondo_incompleto": (f"It still grows {destino}.",
                              "Your Emergency Fund isn't full yet — this may not be the best priority "
                              "right now."),
    }.get(veredicto, (f"It moves you toward your goals for {destino}.",
                       f"Consider whether another account needs the money more than {destino} does."))

    return f"{intro}\n\nThe pros of this are:\n- {pro}\n\nThe cons of this are:\n- {con}"


def _fallback_chat(datos):
    if "simulacion" in datos:
        peor = max(datos["simulacion"]["resultados"],
                   key=lambda r: {"bajo": 0, "medio": 1, "alto": 2}.get(r["riesgo"], 0))
        return (f"Saving instead of spending keeps your risk lower — spending now pushes it toward "
                f"{NIVEL_EN.get(peor['riesgo'], peor['riesgo'])} risk with about "
                f"{peor['meses_colchon']:.1f} months of cushion.")
    if "alerta" in datos:
        a = datos["alerta"]
        nivel = NIVEL_EN.get(a["nivel"], a["nivel"])
        return f"You're at {nivel} risk right now, with about {a['meses_colchon']:.1f} months of cushion."
    if "riesgo" in datos and "plan" in datos:
        nivel = NIVEL_EN.get(datos["riesgo"]["nivel"], datos["riesgo"]["nivel"])
        excedente = datos["plan"]["excedente_mensual"]
        if excedente > 0:
            clave = max(datos["plan"]["aportaciones"], key=datos["plan"]["aportaciones"].get)
            return (f"You're at {nivel} risk, with about ${round(excedente):,} free to save each "
                     f"month — your {BUCKET_LABELS.get(clave, clave)} could use it most.")
        return f"You're at {nivel} risk, and your budget is tight this month."
    return "I couldn't reach the server for a detailed answer just now, but the numbers on screen are accurate."


def texto_revision(riesgo, plan, cuentas):
    d = {"riesgo": {k: v for k, v in riesgo.items() if k != "features"},
         "plan": relabel_plan(plan), "cuentas": relabel_cuentas(cuentas)}
    return redactar("Explain the situation they're in in one short sentence, then list the "
                     "key numbers and which account(s) to move money into as bullets, and why.", d) \
        or _fallback_revision(riesgo, plan, cuentas)


def texto_escenario(resultado, sim, perfil=None):
    """Pros/cons/risk for ONE simulated scenario (backend/plan.py
    simular_compra() picks a scenario by name) — not a comparison across all
    three. Returns a dict with 'pros'/'cons'/'risk' bullet strings, each with
    enough detail to make the point clear without padding."""
    d = {"escenario": resultado, "monto": sim["monto"], "costo_oportunidad_12m": sim["costo_oportunidad_12m"]}
    if perfil:
        d["perfil_usuario"] = perfil
    texto = redactar(
        "Explain this one scenario in exactly three labeled sections, in this order: "
        "'PROS:', 'CONS:', 'RISK:'. Each section header goes on its own line, followed by "
        "1-3 short dash-prefixed bullets. The PROS and CONS bullets should be concrete, using "
        "the real numbers — not generic. The RISK bullets should state the resulting risk "
        "level and a realistic future consequence or reward this choice could lead to, e.g. "
        "what happens if an emergency hit at that cushion level. Give enough detail to make "
        "each point land, but don't pad. Use only these three headers, no other text.",
        d, temp=0.5,
    )
    return (texto and _parse_labeled(texto, ["PROS", "CONS", "RISK"])) or _fallback_escenario(resultado, sim)


def texto_alerta(aviso):
    """Structured into three labeled sections so the frontend can color each
    kind of information differently. `aviso` is expected to carry
    historial_gastos/ingreso_mensual/etc. (see main.py get_monitoreo) so the
    what-ifs and history callout are grounded in this person's actual
    numbers, not generic. Deliberately excludes trusted contact / assistance
    programs — those have their own dedicated bubbles."""
    calm = aviso["nivel"] == "medio"
    instruccion = (
        ("Calmly explain this" if calm else "Calmly raise the alarm without frightening them, explaining this")
        + " in exactly three labeled sections, in this order: 'WHY:', 'WHATIF:', 'HISTORY:'. "
        "Each header goes on its own line, followed by 1-3 short dash-prefixed bullets. "
        "WHY: the main drivers behind this risk level, in plain terms. "
        "WHATIF: several realistic what-if scenarios — include the already-flagged scenarios "
        "if present, PLUS at least one or two more grounded specifically in this person's own "
        "spending history and income pattern (e.g. a month as high as their actual highest "
        "recent spending, a stretch of reduced income given how unstable it's been, an "
        "unexpected cost related to their dependents or lack of health insurance if relevant). "
        "Make every bullet concrete and tied to their real numbers, not generic. "
        "HISTORY: 1-2 bullets pulling out a concrete fact from their spending history — e.g. "
        "how much monthly spending has varied recently, or how their income stability compares "
        "to what would be safer. "
        "Do NOT mention notifying a trusted contact or assistance programs anywhere in this — "
        "those are shown separately elsewhere on screen. Use only these three headers, no "
        "other text."
    )
    texto = redactar(instruccion, aviso, temp=0.5)
    return (texto and _parse_labeled(texto, ["WHY", "WHATIF", "HISTORY"])) or _fallback_alerta(aviso)


def mensaje_contacto(nombre, aviso):
    return redactar(f"Draft a short message {nombre} could send their trusted contact asking for support.",
                    aviso, temp=0.6) or _fallback_mensaje_contacto(nombre)


def texto_transferencia(veredicto, datos):
    """datos carries the full picture (usuario, riesgo, plan, cuentas,
    transferencia, optionally perfil_usuario) so the reasoning can draw on
    the whole financial situation, not just the destination balance. Shaped
    as one flowing message: statement, context reminder, then pros and cons."""
    return redactar(
        "Write this as one flowing message in exactly this shape: start with a one-sentence "
        "summary — \"You're transferring $X to <destination account> from <origin account>\" "
        "using the real amount and account names — then one reminder sentence connecting it "
        "to their actual financial context (current risk level, monthly cushion, how full the "
        "destination or emergency fund already is, or a stated goal). Then write "
        "'The pros of this are:' followed by 1-2 short dash-prefixed bullets, then 'The cons "
        "of this are:' followed by 1-2 short dash-prefixed bullets. Keep every bullet concrete "
        f"and tied to their real numbers. Computed verdict: {veredicto}.", datos, temp=0.5,
    ) or _fallback_transferencia(veredicto, datos)


def texto_chat(mensaje, datos):
    """Conversational chat reply (backend/chat.py) — distinct from the report-style
    texto_revision/texto_alerta/texto_escenario above: short, answers the specific
    question asked, prose by default (bullets only when comparing 2+ options). `datos`
    always carries the full riesgo+plan+cuentas picture plus whatever's relevant to
    the detected intent, so off-script follow-ups still have real context to draw on."""
    instruccion = (
        f"The user just asked: \"{mensaje}\". Answer that specific question directly and "
        "conversationally, in 1-3 short sentences, and stay on that topic — this is a chat "
        "reply, not a report, so don't restate every number in the data, just the ones "
        "relevant to what they asked. Only use bullets if you're comparing two or more "
        "options. Maximum 40 words."
    )
    return redactar(instruccion, datos, temp=0.6) or _fallback_chat(datos)
