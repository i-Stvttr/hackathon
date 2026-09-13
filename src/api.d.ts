// Type declarations for api.js — kept separate since the backend (FastAPI,
// backend/main.py) is still evolving; shapes are intentionally loose (`any`)
// rather than duplicating backend Pydantic models here.
export function getUsuario(): Promise<any>;
export function getRevision(): Promise<any>;
export function getMonitoreo(): Promise<any>;
export function getUmbralesAhorro(): Promise<any>;

export function editarUsuario(campos: Record<string, unknown>): Promise<any>;
export function editarCuentas(campos: Record<string, unknown>): Promise<any>;
export function aplicarPreset(nombre: string): Promise<any>;
export function reiniciar(): Promise<any>;

export function simular(monto: number, meses_posponer?: number): Promise<any>;
export function transferirPreview(origen: string, destino: string, monto: number): Promise<any>;
export function transferir(origen: string, destino: string, monto: number): Promise<any>;
export function chatear(texto: string): Promise<any>;
