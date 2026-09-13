import argparse
import copy

import estado
from mock_user import PRESETS
from modelo import evaluar_riesgo, UMBRALES
from plan import plan_ahorro, simular_compra, monitorear, ahorro_en_umbrales

LINEA = "-" * 72


def resumen(etiqueta):
    u = estado.USUARIO
    r = evaluar_riesgo(u)
    p = plan_ahorro(u)
    print(f"{etiqueta:<12} nivel={r['nivel']:<6} prob={r['probabilidad']:.3f} "
          f"sim={r['prob_quiebra_6m']:.3f} colchon={r['meses_colchon']:.2f}m "
          f"excedente={p['excedente_mensual']:,.0f}")
    print(f"{'':<12} drivers={', '.join(r['drivers']) or 'ninguno'}")
    return r


def probar_presets():
    print(LINEA, "\nPRESETS\n", LINEA, sep="")
    for nombre in ["sano", "ajustado", "critico"]:
        estado.aplicar_preset(nombre)
        resumen(nombre)
    estado.reiniciar()


def probar_monotonia():
    # el riesgo debe subir cuando baja el ahorro y cuando baja la estabilidad
    print(LINEA, "\nMONOTONIA (debe ser creciente hacia abajo)\n", LINEA, sep="")
    estado.reiniciar()
    base = copy.deepcopy(estado.USUARIO)

    print("ahorro_liquido:")
    previo, ok_a = 0.0, True
    for monto in [80000, 60000, 40000, 25000, 15000, 8000, 3000, 0]:
        v = dict(base, ahorro_liquido=float(monto))
        p = evaluar_riesgo(v)["probabilidad"]
        print(f"  {monto:>7,.0f} -> {p:.3f}")
        ok_a &= p >= previo - 1e-9
        previo = p
    print(f"  monotono: {ok_a}")

    print("estabilidad_ingreso:")
    previo, ok_e = 0.0, True
    for est in [1.0, 0.8, 0.6, 0.4, 0.2, 0.05]:
        v = dict(base, estabilidad_ingreso=est)
        p = evaluar_riesgo(v)["probabilidad"]
        print(f"  {est:>7.2f} -> {p:.3f}")
        ok_e &= p >= previo - 1e-9
        previo = p
    print(f"  monotono: {ok_e}")
    return ok_a and ok_e


def probar_umbrales():
    print(LINEA, "\nCRUCE DE UMBRALES (usuario base)\n", LINEA, sep="")
    estado.reiniciar()
    d = ahorro_en_umbrales(estado.USUARIO)
    print(f"  umbrales        : {d['umbrales']}")
    print(f"  ahorro actual   : {d['ahorro_actual']:,.0f}")
    for nivel, monto in d["ahorro_de_cruce"].items():
        print(f"  cruza a {nivel:<6}: {'ahorro ' + format(monto, ',.0f') if monto else 'no cruza en el rango'}")


def probar_alertas():
    print(LINEA, "\nALERTAS\n", LINEA, sep="")
    for nombre in ["sano", "ajustado", "critico"]:
        estado.aplicar_preset(nombre)
        a = monitorear(estado.USUARIO)
        print(f"{nombre:<12} nivel={a['nivel']:<6} acciones={a['acciones']}")
        if "escenarios" in a:
            print(f"{'':<12} escenarios={a['escenarios']}")
        if a["nivel"] == "alto":
            print(f"{'':<12} contacto={a['contacto']['nombre']} programas={len(a['programas'])}")
    estado.reiniciar()


def probar_simulacion(monto=25000.0):
    print(LINEA, f"\nSIMULACION DE COMPRA (${monto:,.0f})\n", LINEA, sep="")
    estado.reiniciar()
    sim = simular_compra(estado.USUARIO, monto)
    for r in sim["resultados"]:
        print(f"  {r['escenario']:<20} ahorro={r['ahorro_resultante']:>10,.0f} "
              f"colchon={r['meses_colchon']:>5.2f}m riesgo={r['riesgo']:<6} "
              f"prob={r['prob_riesgo']:.3f} descubierto={r['descubierto']}")
    print(f"  costo de oportunidad 12m: {sim['costo_oportunidad_12m']:,.0f}")


def probar_edicion():
    print(LINEA, "\nEDICION EN VIVO\n", LINEA, sep="")
    estado.reiniciar()
    resumen("inicial")
    estado.actualizar_usuario({"estabilidad_ingreso": 0.20, "ahorro_liquido": 6000})
    resumen("editado")
    print(f"  cuentas: { {k: round(v) for k, v in estado.CUENTAS.items()} }")
    print(f"  ignorado: {estado.actualizar_usuario({'campo_falso': 1})['ignorados']}")
    estado.reiniciar()
    resumen("reiniciado")


def probar_gemini():
    print(LINEA, "\nGEMINI\n", LINEA, sep="")
    from gemini_texto import texto_revision, texto_alerta
    estado.reiniciar()
    riesgo, plan = evaluar_riesgo(estado.USUARIO), plan_ahorro(estado.USUARIO)
    riesgo.pop("features", None)
    print("[revision]\n", texto_revision(riesgo, plan, estado.CUENTAS), sep="")
    estado.aplicar_preset("critico")
    print("\n[alerta]\n", texto_alerta(monitorear(estado.USUARIO)), sep="")
    estado.reiniciar()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--con-texto", action="store_true", help="tambien prueba Gemini (consume cuota)")
    args = ap.parse_args()

    probar_presets()
    ok = probar_monotonia()
    probar_umbrales()
    probar_alertas()
    probar_simulacion()
    probar_edicion()
    if args.con_texto:
        probar_gemini()

    print(LINEA)
    print(f"MONOTONIA: {'OK' if ok else 'FALLA — revisa los coeficientes o el dataset'}")