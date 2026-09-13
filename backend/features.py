import numpy as np

ORDEN = ["tasa_ahorro", "meses_colchon", "dti", "volatilidad_gasto",
         "estabilidad_ingreso", "carga_dependientes", "exposicion_salud", "ratio_discrecional"]


def calcular_features(u):
    gastos = u["gastos_esenciales"] + u["gastos_discrecionales"]
    excedente = u["ingreso_mensual"] - gastos - u["pago_deuda_mensual"]
    h = np.array(u["historial_gastos"], float)
    return {
        "tasa_ahorro": excedente / u["ingreso_mensual"],
        "meses_colchon": u["ahorro_liquido"] / max(u["gastos_esenciales"], 1.0),
        "dti": u["pago_deuda_mensual"] / u["ingreso_mensual"],
        "volatilidad_gasto": float(h.std() / h.mean()),
        "estabilidad_ingreso": u["estabilidad_ingreso"],
        "carga_dependientes": u["dependientes"] / 3.0,
        "exposicion_salud": (0.0 if u["seguro_medico"] else 1.0) * min(u["edad"] / 80.0, 1.0),
        "ratio_discrecional": u["gastos_discrecionales"] / gastos,
    }


def vectorizar(f):
    return np.array([f[k] for k in ORDEN], float)


def probabilidades_shock(f):
    # p mensual de perder el ingreso y de sufrir una emergencia
    return 0.03 + 0.12 * (1 - f["estabilidad_ingreso"]), 0.04 + 0.09 * f["exposicion_salud"]