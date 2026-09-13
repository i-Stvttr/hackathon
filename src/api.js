const BASE = "http://localhost:8000";

async function pedir(ruta, opciones) {
  const r = await fetch(`${BASE}${ruta}`, opciones);
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

const cuerpo = (metodo, datos) => ({
  method: metodo,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(datos),
});

export const getUsuario = () => pedir("/usuario");
export const getRevision = () => pedir("/revision");
export const getMonitoreo = () => pedir("/monitoreo");
export const getUmbralesAhorro = () => pedir("/umbrales/ahorro");

export const editarUsuario = (campos) => pedir("/usuario", cuerpo("PATCH", { campos }));
export const editarCuentas = (campos) => pedir("/cuentas", cuerpo("PATCH", { campos }));
export const aplicarPreset = (nombre) => pedir(`/preset/${nombre}`, cuerpo("POST", {}));
export const reiniciar = () => pedir("/reiniciar", cuerpo("POST", {}));

export const simular = (monto, meses_posponer = 6) =>
  pedir("/simulacion", cuerpo("POST", { monto, meses_posponer }));
export const simularDetalle = (monto, escenario, perfil, meses_posponer = 6) =>
  pedir("/simulacion/detalle", cuerpo("POST", { monto, meses_posponer, escenario, perfil }));
export const transferirPreview = (origen, destino, monto, perfil) =>
  pedir("/transferencia/preview", cuerpo("POST", { origen, destino, monto, perfil }));
export const transferir = (origen, destino, monto, perfil) =>
  pedir("/transferencia", cuerpo("POST", { origen, destino, monto, perfil }));
export const chatear = (texto, perfil) => pedir("/chat", cuerpo("POST", { texto, perfil }));