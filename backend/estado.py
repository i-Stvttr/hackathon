import copy

from mock_user import USUARIO_BASE, CUENTAS_BASE, CUENTAS_LIQUIDAS, PRESETS

USUARIO = copy.deepcopy(USUARIO_BASE)
CUENTAS = copy.deepcopy(CUENTAS_BASE)

RANGOS = {
    "edad": (18, 110),
    "ingreso_mensual": (0, 1_000_000),
    "gastos_esenciales": (0, 1_000_000),
    "gastos_discrecionales": (0, 1_000_000),
    "pago_deuda_mensual": (0, 1_000_000),
    "deuda_total": (0, 10_000_000),
    "ahorro_liquido": (0, 10_000_000),
    "estabilidad_ingreso": (0.0, 1.0),
    "dependientes": (0, 10),
}
CAMPOS_TEXTO = ["nombre"]
CAMPOS_BOOL = ["seguro_medico"]


def _sincronizar_ahorro():
    USUARIO["ahorro_liquido"] = float(sum(CUENTAS[k] for k in CUENTAS_LIQUIDAS))


def _repartir_ahorro(total):
    # al editar ahorro_liquido directo, se reparte manteniendo las proporciones actuales
    actual = sum(CUENTAS[k] for k in CUENTAS_LIQUIDAS)
    if actual <= 0:
        pesos = {"balance": 0.15, "fondo_lluvia": 0.45, "alto_rendimiento": 0.30, "corto_plazo": 0.10}
    else:
        pesos = {k: CUENTAS[k] / actual for k in CUENTAS_LIQUIDAS}
    for k in CUENTAS_LIQUIDAS:
        CUENTAS[k] = round(total * pesos[k], 2)


def actualizar_usuario(cambios):
    aplicados, ignorados = {}, []
    for clave, valor in cambios.items():
        if clave in CAMPOS_TEXTO:
            USUARIO[clave] = str(valor)
        elif clave in CAMPOS_BOOL:
            USUARIO[clave] = bool(valor)
        elif clave == "historial_gastos":
            lista = [float(x) for x in valor][-12:]
            if len(lista) < 3:
                ignorados.append(clave)
                continue
            USUARIO[clave] = lista
        elif clave in RANGOS:
            lo, hi = RANGOS[clave]
            v = min(max(float(valor), lo), hi)
            USUARIO[clave] = int(v) if clave in ("edad", "dependientes") else v
            if clave == "ahorro_liquido":
                _repartir_ahorro(USUARIO[clave])
        else:
            ignorados.append(clave)
            continue
        aplicados[clave] = USUARIO[clave]
    return {"aplicados": aplicados, "ignorados": ignorados}


def actualizar_cuentas(cambios):
    aplicados, ignorados = {}, []
    for clave, valor in cambios.items():
        if clave not in CUENTAS:
            ignorados.append(clave)
            continue
        CUENTAS[clave] = max(float(valor), 0.0)
        aplicados[clave] = CUENTAS[clave]
    _sincronizar_ahorro()
    return {"aplicados": aplicados, "ignorados": ignorados}


def aplicar_preset(nombre):
    if nombre not in PRESETS:
        return False
    reiniciar()
    p = PRESETS[nombre]
    USUARIO.update(copy.deepcopy(p["usuario"]))
    CUENTAS.update(copy.deepcopy(p["cuentas"]))
    _sincronizar_ahorro()
    return True


def reiniciar():
    USUARIO.clear()
    USUARIO.update(copy.deepcopy(USUARIO_BASE))
    CUENTAS.clear()
    CUENTAS.update(copy.deepcopy(CUENTAS_BASE))
    _sincronizar_ahorro()


_sincronizar_ahorro()