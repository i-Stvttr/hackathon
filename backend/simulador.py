import numpy as np
from features import calcular_features, probabilidades_shock


def prob_quiebra(u, meses=6, n=400, semilla=0):
    f = calcular_features(u)
    p_perdida, p_emerg = probabilidades_shock(f)
    rng = np.random.default_rng(semilla)
    saldo = np.full(n, float(u["ahorro_liquido"]))
    empleado = np.ones(n, bool)
    quiebra = np.zeros(n, bool)
    for _ in range(meses):
        empleado &= ~(rng.random(n) < p_perdida)
        ingreso = np.where(empleado, u["ingreso_mensual"], u["ingreso_mensual"] * 0.25)
        gasto = u["gastos_esenciales"] * rng.lognormal(0, 0.08, n) + \
                np.where(empleado, u["gastos_discrecionales"], u["gastos_discrecionales"] * 0.5)
        emergencia = (rng.random(n) < p_emerg) * rng.lognormal(9.0, 0.7, n)
        saldo = saldo + ingreso - gasto - u["pago_deuda_mensual"] - emergencia
        quiebra |= saldo < 0
    return float(quiebra.mean())