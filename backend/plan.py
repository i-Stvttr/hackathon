import copy

import estado
from mock_user import CONTACTO, PROGRAMAS, RENDIMIENTO_HYS
from features import calcular_features
from modelo import evaluar_riesgo, UMBRALES


def plan_ahorro(u):
    f = calcular_features(u)
    meta_meses = 6 if f["estabilidad_ingreso"] < 0.60 else 3
    meta_fondo = meta_meses * u["gastos_esenciales"]
    excedente = max(u["ingreso_mensual"] - u["gastos_esenciales"]
                    - u["gastos_discrecionales"] - u["pago_deuda_mensual"], 0.0)
    faltante = max(meta_fondo - estado.CUENTAS["fondo_lluvia"], 0.0)
    reparto = (0.70, 0.20, 0.10) if faltante > 0 else (0.20, 0.45, 0.35)
    recorte = u["gastos_discrecionales"] * 0.20 if excedente < u["ingreso_mensual"] * 0.05 else 0.0
    disponible = excedente + recorte
    return {
        "excedente_mensual": excedente,
        "recorte_sugerido": recorte,
        "meta_fondo_lluvia": meta_fondo,
        "faltante_fondo": faltante,
        "meses_para_meta": (faltante / disponible) if disponible > 0 else None,
        "aportaciones": {
            "fondo_lluvia": disponible * reparto[0],
            "alto_rendimiento": disponible * reparto[1],
            "corto_plazo": disponible * reparto[2],
        },
        "interes_12m_hys": disponible * reparto[1] * 12 * RENDIMIENTO_HYS / 2,
    }


def _con_ahorro(u, nuevo):
    v = dict(u)
    v["ahorro_liquido"] = nuevo
    return v


def _metricas(v, etiqueta):
    r = evaluar_riesgo(v)
    return {
        "escenario": etiqueta,
        "ahorro_resultante": v["ahorro_liquido"],
        "meses_colchon": r["meses_colchon"],
        "riesgo": r["nivel"],
        "prob_riesgo": r["probabilidad"],
        "prob_quiebra_6m": r["prob_quiebra_6m"],
        "descubierto": v["ahorro_liquido"] < 0,
    }


def simular_compra(u, monto, meses_posponer=6, horizonte=12):
    exc = plan_ahorro(u)["excedente_mensual"]
    r = RENDIMIENTO_HYS / 12
    gastar = _con_ahorro(u, u["ahorro_liquido"] - monto)
    posponer = _con_ahorro(u, u["ahorro_liquido"] + exc * meses_posponer - monto)
    ahorrar = _con_ahorro(u, u["ahorro_liquido"] + exc * horizonte * (1 + r * horizonte / 2))
    return {
        "monto": monto,
        "resultados": [
            _metricas(gastar, "gastar_ahora"),
            _metricas(posponer, f"posponer_{meses_posponer}m"),
            _metricas(ahorrar, "no_gastar_y_ahorrar"),
        ],
        "costo_oportunidad_12m": monto * RENDIMIENTO_HYS,
    }


def monitorear(u):
    r = evaluar_riesgo(u)
    aviso = {"nivel": r["nivel"], "probabilidad": r["probabilidad"],
             "drivers": r["drivers"], "meses_colchon": r["meses_colchon"], "acciones": []}
    if r["nivel"] == "bajo":
        return aviso
    aviso["escenarios"] = {
        "pierde_un_pago": r["meses_colchon"] < 1.5,
        "pierde_empleo_3m": r["meses_colchon"] < 3,
        "emergencia_medica_20k": u["ahorro_liquido"] < 20000,
    }
    aviso["acciones"].append("notificacion")
    if r["nivel"] == "alto":
        aviso["acciones"] += ["alerta", "ofrecer_contacto_confianza", "mostrar_programas"]
        aviso["contacto"] = CONTACTO
        aviso["programas"] = PROGRAMAS
    return aviso


def comentario_transferencia(u, destino, monto):
    exc = plan_ahorro(u)["excedente_mensual"]
    if destino != "fondo_lluvia" and u["ahorro_liquido"] < 3 * u["gastos_esenciales"]:
        return "fondo_incompleto"
    if monto > exc * 1.5:
        return "demasiado"
    if monto < exc * 0.3:
        return "muy_poco"
    return "adecuado"


def ahorro_en_umbrales(u, pasos=60):
    # barrido de ahorro_liquido para saber dónde cruza cada umbral (útil para la demo)
    v = copy.deepcopy(u)
    tope = max(u["gastos_esenciales"] * 12, 1000.0)
    cruces = {"medio": None, "alto": None}
    anterior = None
    for i in range(pasos + 1):
        monto = tope * i / pasos
        v["ahorro_liquido"] = monto
        p = evaluar_riesgo(v)["probabilidad"]
        if anterior is not None:
            for nivel, umbral in UMBRALES.items():
                if cruces[nivel] is None and anterior[1] >= umbral > p:
                    cruces[nivel] = round(anterior[0] + (monto - anterior[0]) / 2, 2)
        anterior = (monto, p)
    return {"umbrales": UMBRALES, "ahorro_de_cruce": cruces, "ahorro_actual": u["ahorro_liquido"]}