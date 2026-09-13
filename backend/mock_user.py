USUARIO_BASE = {
    "nombre": "Ramón",
    "edad": 68,
    "ingreso_mensual": 18500.0,
    "gastos_esenciales": 11200.0,
    "gastos_discrecionales": 2600.0,
    "pago_deuda_mensual": 1800.0,
    "deuda_total": 42000.0,
    "ahorro_liquido": 25200.0,
    "estabilidad_ingreso": 0.55,
    "dependientes": 1,
    "seguro_medico": False,
    "historial_gastos": [13500, 14100, 13200, 16800, 13900, 14400],
}

CUENTAS_BASE = {
    "balance": 4200.0,
    "fondo_lluvia": 8000.0,
    "gastos_fijos": 3800.0,
    "alto_rendimiento": 9000.0,
    "corto_plazo": 4000.0,
}

# cuentas que cuentan como ahorro disponible ante una emergencia
CUENTAS_LIQUIDAS = ["balance", "fondo_lluvia", "alto_rendimiento", "corto_plazo"]

CONTACTO = {"nombre": "Luisa (daughter)", "canal": "WhatsApp", "telefono": "81-0000-0000"}

PROGRAMAS = [
    {"nombre": "Older Adults' Wellbeing Pension", "via": "gob.mx — Bienestar program"},
    {"nombre": "IMSS Bienestar — free healthcare without social security", "via": "imssbienestar.gob.mx"},
    {"nombre": "Municipal DIF office — food and emergency assistance", "via": "Your local DIF office"},
]

RENDIMIENTO_HYS = 0.09

# escenarios para la demo: cada uno empuja al usuario a un nivel de riesgo distinto
PRESETS = {
    "sano": {
        "usuario": {"ingreso_mensual": 22000.0, "gastos_esenciales": 9800.0,
                    "gastos_discrecionales": 2000.0, "pago_deuda_mensual": 900.0,
                    "estabilidad_ingreso": 0.90, "seguro_medico": True,
                    "historial_gastos": [11600, 11900, 11700, 12100, 11800, 11750]},
        "cuentas": {"balance": 9000.0, "fondo_lluvia": 42000.0, "gastos_fijos": 4000.0,
                    "alto_rendimiento": 26000.0, "corto_plazo": 8000.0},
    },
    "ajustado": {
        "usuario": {"ingreso_mensual": 18500.0, "gastos_esenciales": 11200.0,
                    "gastos_discrecionales": 2600.0, "pago_deuda_mensual": 1800.0,
                    "estabilidad_ingreso": 0.55, "seguro_medico": False,
                    "historial_gastos": [13500, 14100, 13200, 16800, 13900, 14400]},
        "cuentas": {"balance": 4200.0, "fondo_lluvia": 8000.0, "gastos_fijos": 3800.0,
                    "alto_rendimiento": 9000.0, "corto_plazo": 4000.0},
    },
    "critico": {
        "usuario": {"ingreso_mensual": 14200.0, "gastos_esenciales": 11900.0,
                    "gastos_discrecionales": 2100.0, "pago_deuda_mensual": 3100.0,
                    "deuda_total": 96000.0, "estabilidad_ingreso": 0.22,
                    "dependientes": 2, "seguro_medico": False,
                    "historial_gastos": [12800, 15900, 13100, 18400, 14200, 16700]},
        "cuentas": {"balance": 1100.0, "fondo_lluvia": 2400.0, "gastos_fijos": 900.0,
                    "alto_rendimiento": 0.0, "corto_plazo": 800.0},
    },
}