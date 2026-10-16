// VERSIÓN DEMO — no hay Odoo.
// Mismas funciones y mismos tipos que el original, pero todo vive en memoria: lo que se
// capture en la app de caja dura mientras el servidor esté encendido y se borra al reiniciar.
// Así se puede enseñar la app completa sin tocar datos de nadie.

/* ---------- Tipos (idénticos al original) ---------- */
export type TipoSalida = "gasto" | "traspaso";
export type SalidaCaja = { concepto: string; monto: number; hora?: string; tipo?: TipoSalida };
export type TerminalMov = { nombre: string; monto: number };
export type CajaPos = { id: number; nombre: string };
export type CajaConteo = {
  apertura: Record<string, number>;
  cierre: Record<string, number>;
  terminal: number;
  fondoFijo: number;
  efectivoRecibido: number;
  transferenciaRecibida: number;
  terminales: TerminalMov[];
  notas: string;
};
export type PdVCorte = { efectivo: number; tarjeta: number; transferencia: number; credito: number; total: number };
export type CorteTipo = "local" | "nacional" | "recoleccion" | "contra" | "otro";
export type CorteLinea = {
  id: number;
  name: string;
  cliente: string;
  total: number;
  tipo: CorteTipo;
  guia: number;
  envioCobrado: number;
  formaPago: string;
  pagadoOdoo?: boolean;
  fecha: string;
  viejo?: boolean;
  envioLocal?: number;
  estado?: "cancelado" | "borrador";
};

/* ---------- Almacén en memoria ---------- */
const salidas = new Map<string, SalidaCaja[]>();
const entradas = new Map<string, SalidaCaja[]>();
const conteos = new Map<string, CajaConteo>();
const llave = (fecha: string, caja?: number) => `${fecha}|${caja ?? 0}`;

const CONTEO_VACIO: CajaConteo = {
  apertura: {}, cierre: {}, terminal: 0, fondoFijo: 0,
  efectivoRecibido: 0, transferenciaRecibida: 0, terminales: [], notas: "",
};

// Números "al azar" pero siempre los mismos para una fecha y una caja: la demo no cambia
// de un refresco a otro, que es lo que confunde cuando se está enseñando.
function pseudo(semilla: string, tope: number): number {
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) | 0;
  const x = Math.abs(Math.sin(h) * 43758.5453);
  return Math.floor((x - Math.floor(x)) * tope);
}

export async function listaCajasPos(): Promise<CajaPos[]> {
  return [
    { id: 1, nombre: "Caja 1 · Ana" },
    { id: 2, nombre: "Caja 2 · Luis" },
    { id: 3, nombre: "Caja 3 · Mostrador" },
  ];
}

// Lo que "registró el punto de venta" ese día en esa caja.
export async function cortePdV(desde: string, _hasta: string, caja?: number): Promise<PdVCorte> {
  const dia = desde.slice(0, 10);
  const s = `${dia}-${caja ?? 0}`;
  const efectivo = 4000 + pseudo("e" + s, 12000);
  const tarjeta = 8000 + pseudo("t" + s, 26000);
  const transferencia = pseudo("r" + s, 4) === 0 ? pseudo("m" + s, 3000) : 0;
  return { efectivo, tarjeta, transferencia, credito: 0, total: efectivo + tarjeta + transferencia };
}

// Ajuste manual del día (en el original lo captura la dirección). En la demo no hay.
export async function getPdVAjuste(_fecha: string): Promise<PdVCorte | null> {
  return null;
}

export async function getSalidasCaja(fecha: string, caja?: number): Promise<SalidaCaja[]> {
  const k = llave(fecha, caja);
  if (!salidas.has(k)) {
    salidas.set(k, [
      { concepto: "Garrafón de agua", monto: 45, hora: "11:20 a.m.", tipo: "gasto" },
      { concepto: "Entregado a gerencia", monto: 3000, hora: "02:40 p.m.", tipo: "traspaso" },
    ]);
  }
  return salidas.get(k)!;
}
export async function setSalidasCaja(fecha: string, lista: SalidaCaja[], caja?: number) {
  salidas.set(llave(fecha, caja), lista || []);
}

export async function getEntradasCaja(fecha: string, caja?: number): Promise<SalidaCaja[]> {
  const k = llave(fecha, caja);
  if (!entradas.has(k)) entradas.set(k, []);
  return entradas.get(k)!;
}
export async function setEntradasCaja(fecha: string, lista: SalidaCaja[], caja?: number) {
  entradas.set(llave(fecha, caja), lista || []);
}

export async function getCajaConteo(fecha: string, caja?: number): Promise<CajaConteo> {
  const k = llave(fecha, caja);
  if (!conteos.has(k)) {
    // Un fondo de apertura de ejemplo, para que la pantalla no empiece en blanco.
    conteos.set(k, {
      ...CONTEO_VACIO,
      apertura: { "1": 40, "5": 10, "10": 30, "20": 15, "50": 12, "100": 14, "200": 5 },
      terminales: [{ nombre: "Terminal mostrador", monto: 0 }],
    });
  }
  return conteos.get(k)!;
}
export async function setCajaConteo(fecha: string, c: CajaConteo, caja?: number) {
  conteos.set(llave(fecha, caja), c || { ...CONTEO_VACIO });
}

/* ---------- Envíos que cobra la caja ---------- */
const ENVIOS: CorteLinea[] = [
  { id: 1, name: "S00118", cliente: "Mariana Robles", total: 1240, tipo: "recoleccion", guia: 0, envioCobrado: 0, formaPago: "", fecha: "", pagadoOdoo: false },
  { id: 2, name: "S00121", cliente: "Jorge Medina", total: 690, tipo: "contra", guia: 0, envioCobrado: 120, formaPago: "", fecha: "", pagadoOdoo: true },
  { id: 3, name: "S00126", cliente: "Paola Jiménez", total: 2890, tipo: "recoleccion", guia: 0, envioCobrado: 0, formaPago: "", fecha: "", pagadoOdoo: false },
  { id: 4, name: "S00127", cliente: "Sofía Ramírez", total: 450, tipo: "contra", guia: 0, envioCobrado: 95, formaPago: "", fecha: "", pagadoOdoo: false },
];
const cobrados = new Map<number, string>(); // id → fecha en que se cobró

export async function enviosDeCaja(desde: string, _hasta: string, fecha: string): Promise<CorteLinea[]> {
  const hoy = fecha || desde.slice(0, 10);
  const ayer = (() => { const d = new Date(hoy + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
  const viejo = (() => { const d = new Date(hoy + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 24); return d.toISOString().slice(0, 10); })();
  const fechas = [hoy, hoy, ayer, viejo];
  return ENVIOS.map((e, i) => ({
    ...e,
    fecha: fechas[i],
    viejo: fechas[i] !== hoy,
    formaPago: cobrados.get(e.id) === hoy ? "caja" : "",
  })).filter((e) => !e.formaPago || cobrados.get(e.id) === hoy);
}

export async function cobrarEnvioCaja(id: number, fecha: string, cobrado: boolean) {
  if (cobrado) cobrados.set(id, fecha);
  else cobrados.delete(id);
}
