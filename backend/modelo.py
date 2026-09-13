import os
import joblib
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

from features import ORDEN, calcular_features, vectorizar
from simulador import prob_quiebra

RUTA = os.path.join(os.path.dirname(__file__), "modelo_riesgo.pkl")
UMBRALES = {"medio": 0.30, "alto": 0.60}


def usuario_aleatorio(rng):
    ingreso = float(rng.lognormal(9.7, 0.45))
    esenciales = ingreso * rng.uniform(0.40, 0.85)
    disc = ingreso * rng.uniform(0.02, 0.25)
    base = esenciales + disc
    return {
        "edad": int(rng.integers(55, 86)),
        "ingreso_mensual": ingreso,
        "gastos_esenciales": esenciales,
        "gastos_discrecionales": disc,
        "pago_deuda_mensual": ingreso * rng.uniform(0.0, 0.30),
        "deuda_total": ingreso * rng.uniform(0, 6),
        "ahorro_liquido": ingreso * rng.uniform(0, 6),
        "estabilidad_ingreso": float(rng.uniform(0.10, 1.0)),
        "dependientes": int(rng.integers(0, 4)),
        "seguro_medico": bool(rng.random() < 0.5),
        "historial_gastos": list(base * rng.lognormal(0, 0.10, 6)),
    }


def generar_dataset(n=3000, semilla=7, umbral_label=0.30):
    rng = np.random.default_rng(semilla)
    X, y, p = [], [], []
    for i in range(n):
        u = usuario_aleatorio(rng)
        pq = prob_quiebra(u, n=200, semilla=i)
        X.append(vectorizar(calcular_features(u)))
        p.append(pq)
        y.append(int(pq > umbral_label))
    return np.array(X), np.array(y), np.array(p)


def entrenar(X, y):
    return Pipeline([("esc", StandardScaler()),
                     ("lr", LogisticRegression(max_iter=1000))]).fit(X, y)


def cargar():
    if os.path.exists(RUTA):
        return joblib.load(RUTA)
    X, y, _ = generar_dataset()
    m = entrenar(X, y)
    joblib.dump(m, RUTA)
    return m


MODELO = cargar()


def evaluar_riesgo(u):
    f = calcular_features(u)
    x = vectorizar(f).reshape(1, -1)
    prob = float(MODELO.predict_proba(x)[0, 1])
    z = MODELO.named_steps["esc"].transform(x)[0]
    contrib = MODELO.named_steps["lr"].coef_[0] * z
    drivers = [ORDEN[i] for i in np.argsort(-contrib)[:3] if contrib[i] > 0]
    nivel = "alto" if prob >= UMBRALES["alto"] else "medio" if prob >= UMBRALES["medio"] else "bajo"
    return {
        "probabilidad": prob,
        "nivel": nivel,
        "drivers": drivers,
        "prob_quiebra_6m": prob_quiebra(u),
        "meses_colchon": f["meses_colchon"],
        "features": f,
    }