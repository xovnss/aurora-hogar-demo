// VERSIÓN DEMO — no hay Odoo. Todo vive en memoria y se reinicia con el servidor.

/* ==========================================================================
   APP DE SUBIR — todo en memoria
   Un "Odoo de juguete": una lista de productos que se puede consultar y
   modificar. Al reiniciar el servidor vuelve a su estado original.
   ========================================================================== */
import type { Tarifa } from "./types";
import type { MotivoAjuste } from "./ajustes";
import { demoProductos, FAMILIAS } from "./demo-datos";

export type Categoria = { id: number; name: string };
export type ProdSimple = { id: number; sku: string; name: string; imageUrl: string };
export type ProdResurtir = { sku: string; id: number; name: string; cantidad: number };
export type ProdDesc = { id: number; sku: string; name: string; categoria: string; desc: string; imageUrl: string };
export type LineaModelo = { linea: string; nombre: string; categoria: string; ultimo: number; cuantos: number; faltan: number[] };
export type ProductoBuscado = {
  id: number; sku: string; name: string; publico: number; miembro: number | null;
  liquidacion: number | null; cantidad: number; imageUrl: string; activo: boolean;
  descripcion: string; tarifas: Tarifa[]; categId: number; tags: number[];
  cantTienda: number; cantBodega: number;
};
export type NuevoProducto = {
  name: string; sku: string; categId: number; publico: number; miembro: number;
  liquidacion: number | null; cantidad: number; imageBase64: string | null;
  detalle?: string; saldo?: boolean; descripcion?: string; imagesExtra?: string[];
  tarifas?: Tarifa[]; loc?: number;
};

type Fila = ProductoBuscado & { categoria: string };

/* ----- categorías ----- */
const CATEGORIAS: Categoria[] = (() => {
  const vistas = new Set<string>();
  const out: Categoria[] = [];
  let id = 50;
  for (const f of FAMILIAS) {
    const nombre = `${f.catalogo} / ${f.categoria}`;
    if (vistas.has(nombre)) continue;
    vistas.add(nombre);
    out.push({ id: ++id, name: nombre });
  }
  out.push({ id: 999, name: "Saldos" });
  return out;
})();
const catIdDe = (nombre: string) => CATEGORIAS.find((c) => c.name === nombre)?.id ?? 51;
const catNombreDe = (id: number) => CATEGORIAS.find((c) => c.id === id)?.name ?? "Sin categoría";

export async function listCategories(): Promise<Categoria[]> {
  return CATEGORIAS.filter((c) => c.name !== "Saldos");
}
export async function categoriaSaldosId(): Promise<number> { return 999; }

/* ----- la "tabla" de productos ----- */
let TABLA: Map<number, Fila> | null = null;
let SIG_ID = 90000;

function tabla(): Map<number, Fila> {
  if (TABLA) return TABLA;
  TABLA = new Map();
  for (const p of demoProductos()) {
    const categoria = `${p.catalogo} / ${p.categoria}`;
    TABLA.set(p.id, {
      id: p.id, sku: p.sku, name: p.name,
      publico: p.precioPublico, miembro: p.precioMiembro, liquidacion: p.precioLiquidacion,
      cantidad: p.fisico, imageUrl: (p.imageUrl || "").replace("-modelo.jpg", "-modelo-512.jpg"), activo: true,
      descripcion: p.descripcion || "", tarifas: p.tarifas, categId: catIdDe(categoria),
      tags: p.tags, cantTienda: p.stockTienda, cantBodega: p.fisico - p.stockTienda,
      categoria,
    });
  }
  semilla();
  return TABLA;
}
const vivos = () => [...tabla().values()].filter((f) => f.activo);
const salida = (f: Fila): ProductoBuscado => ({ ...f });

/* ----- consultas ----- */
export async function skuExists(sku: string): Promise<boolean> {
  const s = (sku || "").trim().toUpperCase();
  return [...tabla().values()].some((f) => f.sku.toUpperCase() === s);
}
export async function checkSkus(skus: string[]): Promise<string[]> {
  const set = new Set([...tabla().values()].map((f) => f.sku.toUpperCase()));
  return skus.filter((s) => set.has((s || "").trim().toUpperCase()));
}
export async function buscarPorSkus(skus: string[], locId?: number): Promise<ProdResurtir[]> {
  const out: ProdResurtir[] = [];
  for (const s of skus) {
    const f = [...tabla().values()].find((x) => x.sku.toUpperCase() === (s || "").trim().toUpperCase());
    // con ubicación, la cantidad que se muestra es la de ESA bodega (como en el original)
    if (f) out.push({ sku: f.sku, id: f.id, name: f.name, cantidad: locId === 18 ? f.cantBodega : locId ? f.cantTienda : f.cantidad });
  }
  return out;
}
export async function buscarProductos(query: string): Promise<ProductoBuscado[]> {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  return [...tabla().values()]
    .filter((f) => f.name.toLowerCase().includes(q) || f.sku.toLowerCase().includes(q))
    .slice(0, 80).map(salida);
}
export async function listaPorCategoria(nombre: string, limit = 400): Promise<ProductoBuscado[]> {
  return vivos().filter((f) => f.categoria === nombre).slice(0, limit).map(salida);
}
export async function listaLiquidacion(limit = 400): Promise<ProductoBuscado[]> {
  return vivos().filter((f) => f.liquidacion != null).slice(0, limit).map(salida);
}
export async function listaSinStock(limit = 400): Promise<ProductoBuscado[]> {
  return vivos().filter((f) => f.cantidad <= 0).slice(0, limit).map(salida);
}
export async function listaSinFotoBodega(limit = 300): Promise<ProductoBuscado[]> {
  // En la demo todos "tienen foto"; se devuelven unos cuantos para que la pantalla no salga vacía.
  return vivos().filter((f) => f.id % 23 === 0).slice(0, limit).map(salida);
}
export async function listaArchivados(): Promise<ProdSimple[]> {
  return [...tabla().values()].filter((f) => !f.activo)
    .map((f) => ({ id: f.id, sku: f.sku, name: f.name, imageUrl: f.imageUrl }));
}
export async function listarDescripciones(): Promise<ProdDesc[]> {
  return vivos().slice(0, 300).map((f) => ({
    id: f.id, sku: f.sku, name: f.name, categoria: f.categoria, desc: f.descripcion, imageUrl: f.imageUrl,
  }));
}
export async function ultimosModelos(): Promise<LineaModelo[]> {
  // Demo: cada categoría es una "línea"; el número de modelo es el lugar del diseño dentro de ella.
  const porCat = new Map<string, string[]>();
  for (const f of vivos()) {
    const base = f.name.split(" - ")[0];
    const l = porCat.get(f.categoria) || [];
    if (!l.includes(base)) l.push(base);
    porCat.set(f.categoria, l);
  }
  const out: LineaModelo[] = [];
  let i = 0;
  for (const [cat, nombres] of porCat) {
    const cuantos = nombres.length;
    const ultimo = cuantos + (i % 3) + 1;
    const faltan: number[] = [];
    for (let k = 0; k < ultimo - cuantos; k++) faltan.push(2 + k * 3 <= ultimo ? 2 + k * 3 : ultimo - 1 - k);
    out.push({
      linea: cat.split(" / ").map((x) => x.slice(0, 3).toUpperCase()).join("-"),
      nombre: cat.split(" / ")[1] ? `${cat.split(" / ")[0]} · ${cat.split(" / ")[1]}` : cat,
      categoria: cat, ultimo, cuantos, faltan: [...new Set(faltan)].filter((n) => n >= 1 && n < ultimo),
    });
    i++;
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/* ----- cambios ----- */
const pide = (id: number): Fila => {
  const f = tabla().get(id);
  if (!f) throw new Error("Ese producto ya no existe.");
  return f;
};
export async function crearProducto(p: NuevoProducto): Promise<{ id: number; sku: string }> {
  if (await skuExists(p.sku)) throw new Error(`Ya existe un producto con el código "${p.sku}". Cambia el código.`);
  const id = ++SIG_ID;
  const categId = p.saldo ? 999 : p.categId;
  tabla().set(id, {
    id, sku: p.sku, name: p.name, publico: p.publico, miembro: p.miembro || null,
    liquidacion: p.liquidacion ?? null, cantidad: p.cantidad || 0,
    imageUrl: `/img?id=${id}&s=512`, activo: true,
    descripcion: [p.descripcion, p.detalle ? "⚠️ Con detalle: " + p.detalle : ""].filter(Boolean).join("\n\n"),
    tarifas: p.tarifas || [], categId, tags: [],
    cantTienda: p.loc === 18 ? 0 : p.cantidad || 0, cantBodega: p.loc === 18 ? p.cantidad || 0 : 0,
    categoria: catNombreDe(categId),
  });
  return { id, sku: p.sku };
}
export async function setStock(tmplId: number, qty: number, locId?: number) {
  const f = pide(tmplId);
  if (locId === 18) f.cantBodega = qty; else f.cantTienda = qty;
  f.cantidad = f.cantTienda + f.cantBodega;
}
export async function setLiquidacion(tmplId: number, on: boolean, price?: number) {
  const f = pide(tmplId);
  f.liquidacion = on ? (price ?? Math.round(f.publico * 0.5)) : null;
}
export async function actualizarPrecios(tmplId: number, publico: number, miembro: number) {
  const f = pide(tmplId); f.publico = publico; f.miembro = miembro || null;
}
export async function actualizarNombre(tmplId: number, nombre: string) { pide(tmplId).name = nombre; }
export async function actualizarSku(tmplId: number, sku: string) { pide(tmplId).sku = sku; }
export async function setCategoria(tmplId: number, categId: number) {
  const f = pide(tmplId); f.categId = categId; f.categoria = catNombreDe(categId);
}
export async function setTag(tmplId: number, tagId: number, on: boolean) {
  const f = pide(tmplId);
  f.tags = on ? [...new Set([...f.tags, tagId])] : f.tags.filter((t) => t !== tagId);
}
export async function setTarifas(tmplId: number, tarifas: Tarifa[]) { pide(tmplId).tarifas = tarifas || []; }
export async function guardarDescripcion(tmplId: number, texto: string) { pide(tmplId).descripcion = texto || ""; }
export async function cambiarImagen(_tmplId: number, _imageBase64: string) { /* la demo no guarda fotos */ }
export async function agregarImagenes(_tmplId: number, _imgs: string[]) { /* la demo no guarda fotos */ }
export async function archivarProducto(id: number) { pide(id).activo = false; }
export async function restaurarProducto(id: number) { pide(id).activo = true; }
export async function eliminarProducto(id: number): Promise<"no-existe" | "eliminado" | "archivado"> {
  const f = tabla().get(id);
  if (!f) return "no-existe";
  tabla().delete(id);
  return "eliminado";
}

/* ----- parámetros, portada y banners ----- */
const PARAMS = new Map<string, string>();
export async function getConfigParam(key: string): Promise<string> { return PARAMS.get(key) || ""; }
export async function setConfigParam(key: string, value: string) { PARAMS.set(key, value); }
export async function subirPortada(_b64: string, _mime = "image/jpeg"): Promise<number> { return 1; }
export async function subirBanner(_b64: string, _mime = "image/jpeg"): Promise<number> { return 1; }
export function portadaUrl(_id: string | number): string { return "/portada.jpg"; }

/* ----- bitácora ----- */
export type Evento = { fecha: string; persona: string; texto: string };
const BITACORA: Evento[] = [];
export async function logAccion(persona: string, texto: string) {
  BITACORA.unshift({ fecha: new Date().toISOString(), persona: persona || "?", texto });
}
export async function historialReciente(limit = 100): Promise<Evento[]> { return BITACORA.slice(0, limit); }
export async function eliminados(limit = 100): Promise<Evento[]> {
  return BITACORA.filter((e) => /Eliminó/i.test(e.texto)).slice(0, limit);
}

/* ----- pendientes de aprobación ----- */
export type EstadoPend = "pendiente" | "aprobado" | "rechazado";
export type Pendiente = {
  id: number; persona: string; tipo: string; resumen: string; fecha: string;
  payload: Record<string, unknown>; motivo?: string; por?: string; resueltoFecha?: string;
  razon?: string; estado?: EstadoPend;
};
let SIG_PEND = 500;
const PENDIENTES: Pendiente[] = [];
export async function crearPendiente(persona: string, tipo: string, resumen: string, payload: Record<string, unknown>, razon = "") {
  PENDIENTES.unshift({ id: ++SIG_PEND, persona, tipo, resumen, payload, razon, fecha: new Date().toISOString(), estado: "pendiente" });
}
export async function listaPendientes(): Promise<Pendiente[]> { return PENDIENTES.filter((p) => p.estado === "pendiente"); }
export async function leerPendiente(id: number): Promise<Pendiente | null> { return PENDIENTES.find((p) => p.id === id) || null; }
export async function borrarPendiente(id: number) {
  const i = PENDIENTES.findIndex((p) => p.id === id);
  if (i >= 0) PENDIENTES.splice(i, 1);
}
export async function editarPendiente(id: number, resumen: string, payload: Record<string, unknown>, razon?: string) {
  const p = PENDIENTES.find((x) => x.id === id);
  if (p) { p.resumen = resumen; p.payload = payload; if (razon != null) p.razon = razon; p.estado = "pendiente"; delete p.motivo; }
}
export async function rechazarPendienteConMotivo(id: number, motivo: string, quien: string) {
  const p = PENDIENTES.find((x) => x.id === id);
  if (p) { p.estado = "rechazado"; p.motivo = motivo; p.por = quien; p.resueltoFecha = new Date().toISOString(); }
}
export async function marcarAprobado(id: number, quien: string) {
  const p = PENDIENTES.find((x) => x.id === id);
  if (p) { p.estado = "aprobado"; p.por = quien; p.resueltoFecha = new Date().toISOString(); }
}
export async function listaRechazados(persona: string): Promise<Pendiente[]> {
  return PENDIENTES.filter((p) => p.estado === "rechazado" && p.persona === persona);
}
export async function listaAprobados(persona: string): Promise<Pendiente[]> {
  return PENDIENTES.filter((p) => p.estado === "aprobado" && p.persona === persona);
}
export async function historialCompleto(limit = 800): Promise<Pendiente[]> { return PENDIENTES.slice(0, limit); }

/* ----- ajustes de inventario ----- */
export type AjusteInput = {
  tmplId: number; bodega: "tienda" | "bodega"; motivo: MotivoAjuste; antes: number;
  cantidad: number; signo?: 1 | -1; nota?: string; quien?: string; proveedor?: string;
};
export type AjusteRegistro = {
  id: number; fecha: string; persona: string; motivo: MotivoAjuste; tmplId: number; sku: string; nombre: string;
  bodega: string; antes: number; delta: number; despues: number; nota: string; quien: string; proveedor: string;
  ref: string; precio: number;
};
const AJUSTES: AjusteRegistro[] = [];
let SIG_AJ = 1;
export async function aplicarAjuste(persona: string, a: AjusteInput): Promise<AjusteRegistro> {
  const f = pide(a.tmplId);
  const campo = a.bodega === "bodega" ? "cantBodega" : "cantTienda";
  const antes = f[campo];
  if (Math.abs(antes - a.antes) > 0.001) throw new Error(`Alguien más lo movió: ahora hay ${antes}. Vuelve a cargar.`);
  const despues = a.motivo === "conteo" ? a.cantidad : antes + (a.signo ?? -1) * a.cantidad;
  f[campo] = Math.max(0, despues);
  f.cantidad = f.cantTienda + f.cantBodega;
  const reg: AjusteRegistro = {
    id: ++SIG_AJ, fecha: new Date().toISOString(), persona, motivo: a.motivo, tmplId: f.id, sku: f.sku,
    nombre: f.name, bodega: a.bodega, antes, delta: f[campo] - antes, despues: f[campo],
    nota: a.nota || "", quien: a.quien || "", proveedor: a.proveedor || "", ref: "DEMO/" + SIG_AJ, precio: f.publico,
  };
  AJUSTES.unshift(reg);
  return reg;
}
export async function historialAjustes(limit = 3000): Promise<AjusteRegistro[]> { return AJUSTES.slice(0, limit); }

/* ----- notas de compra (en la demo no hay compras capturadas) ----- */
export type NotaLinea = {
  tmplId: number | null; sku: string; nombre: string; imageUrl: string | null;
  pedido: number; llego: number; subido: number; stockHoy: number; precio: number;
};
export type NotaCompra = {
  id: number; folio: string; proveedor: string; refProveedor: string; fecha: string;
  estado: string; total: number; recibida: boolean; lineas: NotaLinea[];
};
export async function notasVsInventario(_dias = 120): Promise<NotaCompra[]> { tabla(); return NOTAS; }
const NOTAS: NotaCompra[] = [];


/* ----- datos de ejemplo para que todas las pestañas se vean vivas ----- */
let SEMBRADO = false;
function semilla() {
  if (SEMBRADO || !TABLA) return;
  SEMBRADO = true;
  const filas = [...TABLA.values()];
  const f = (i: number) => filas[(i * 7 + 3) % filas.length];
  const hace = (min: number) => new Date(Date.now() - min * 60000).toISOString();

  // Saldos, sin stock y archivados
  for (const i of [2, 9, 15, 21]) { const r = f(i); r.categId = 999; r.categoria = "Saldos"; }
  for (const i of [4, 11, 17]) { const r = f(i); r.cantidad = 0; r.cantTienda = 0; r.cantBodega = 0; }
  for (const i of [6, 13]) f(i).activo = false;

  // Historial reciente
  const ev: [number, string, string][] = [
    [18, "Ana", `Subió ${f(1).sku} · ${f(1).name} · 12 pz`],
    [47, "Luis", `Resurtió ${f(5).sku} · +20 pz`],
    [95, "Ana", `Cambió precios de ${f(8).sku}: $${f(8).publico} → $${f(8).publico - 50}`],
    [160, "Luis", `Puso en liquidación ${f(10).sku}`],
    [240, "Ana", `Aprobó la solicitud de Luis: inventario de ${f(12).sku}`],
    [420, "Ana", `Archivó ${f(6).sku} · ${f(6).name}`],
    [600, "Luis", `Eliminó ${f(30).sku} · ${f(30).name} (duplicado)`],
    [1500, "Ana", `Eliminó ${f(33).sku} · ${f(33).name} (error de captura)`],
    [1900, "Luis", `Subió descripción de ${f(14).sku}`],
    [2800, "Ana", `Cambió el tema del catálogo a "ninguno"`],
  ];
  for (const [m, quien, texto] of ev) BITACORA.push({ fecha: hace(m), persona: quien, texto });

  // Solicitudes (pendientes, aprobadas, rechazadas)
  const pend: Pendiente[] = [
    { id: 496, persona: "Luis", tipo: "stock", resumen: `📦 Inventario de "${f(20).name}": ${f(20).cantidad}→${f(20).cantidad + 15} pzs`, fecha: hace(35),
      payload: { id: f(20).id, qty: f(20).cantidad + 15 }, estado: "pendiente", razon: "Llegó la entrega de hoy" },
    { id: 497, persona: "Luis", tipo: "precios", resumen: `💲 Precios de ${f(22).sku}: $${f(22).publico} → $${f(22).publico + 100}`, fecha: hace(80),
      payload: { id: f(22).id, publico: f(22).publico + 100, miembro: (f(22).miembro ?? f(22).publico) + 100 }, estado: "pendiente", razon: "Subió el costo de producción" },
    { id: 498, persona: "Sofi", tipo: "liquidacion", resumen: `🔥 Liquidación para ${f(25).sku}`, fecha: hace(130),
      payload: { id: f(25).id, on: true, price: Math.round(f(25).publico * 0.75) }, estado: "pendiente" },
    { id: 493, persona: "Sofi", tipo: "nombre", resumen: `✏️ Nombre de ${f(26).sku}`, fecha: hace(900),
      payload: { id: f(26).id, nombre: f(26).name }, estado: "aprobado", por: "Ana", resueltoFecha: hace(850) },
    { id: 494, persona: "Luis", tipo: "stock", resumen: `📦 Inventario de "${f(27).name}": +10 pzs`, fecha: hace(1300),
      payload: { id: f(27).id, qty: f(27).cantidad }, estado: "aprobado", por: "Ana", resueltoFecha: hace(1250) },
    { id: 495, persona: "Luis", tipo: "precios", resumen: `💲 Precios de ${f(28).sku}: bajar a $${f(28).publico - 200}`, fecha: hace(2000),
      payload: { id: f(28).id }, estado: "rechazado", por: "Ana", motivo: "Es muy poco margen, déjalo como estaba", resueltoFecha: hace(1900) },
  ];
  PENDIENTES.push(...pend);
  SIG_PEND = 500;

  // Ajustes de inventario
  const aj = (m: number, persona: string, motivo: MotivoAjuste, i: number, bodega: "tienda" | "bodega", delta: number, nota: string, quien = "", proveedor = "") => {
    const r = f(i);
    const despues = Math.max(0, (bodega === "bodega" ? r.cantBodega : r.cantTienda));
    AJUSTES.push({
      id: ++SIG_AJ, fecha: hace(m), persona, motivo, tmplId: r.id, sku: r.sku, nombre: r.name,
      bodega, antes: Math.max(0, despues - delta), delta, despues, nota, quien, proveedor, ref: "DEMO/" + SIG_AJ, precio: r.publico,
    });
  };
  aj(25, "Ana", "conteo", 31, "tienda", -2, "Conteo del anaquel 3");
  aj(70, "Luis", "devolucion", 32, "tienda", 1, "Cliente la regresó, talla incorrecta");
  aj(190, "Ana", "merma", 34, "bodega", -1, "Llegó manchada del cuello");
  aj(330, "Luis", "uso", 35, "tienda", -1, "Para la sesión de fotos", "Ximena");
  aj(700, "Ana", "correccion", 36, "bodega", 4, "Se capturó mal en la entrega anterior");
  aj(1400, "Luis", "conteo", 37, "tienda", 3, "Conteo mensual");
  aj(2100, "Ana", "uso", 38, "bodega", -2, "Regalo para influencer", "Carlos");
  aj(3000, "Luis", "conteo", 39, "tienda", -1, "");

  // Notas de compra vs inventario
  const lin = (i: number, pedido: number, llego: number, subido: number): NotaLinea => {
    const r = f(i);
    return { tmplId: r.id, sku: r.sku, nombre: r.name, imageUrl: r.imageUrl || null, pedido, llego, subido, stockHoy: r.cantidad, precio: r.publico };
  };
  NOTAS.push(
    { id: 1, folio: "P00031", proveedor: "Taller Textil Roma", refProveedor: "NV-2201", fecha: hace(2900).slice(0, 10), estado: "purchase", total: 18400, recibida: true,
      lineas: [lin(40, 24, 24, 24), lin(41, 24, 22, 22), lin(42, 12, 12, 10)] },
    { id: 2, folio: "P00032", proveedor: "Bordados del Centro", refProveedor: "BC-884", fecha: hace(1500).slice(0, 10), estado: "purchase", total: 9600, recibida: true,
      lineas: [lin(43, 30, 30, 0), lin(44, 20, 20, 20)] },
    { id: 3, folio: "P00033", proveedor: "Taller Textil Roma", refProveedor: "NV-2230", fecha: hace(400).slice(0, 10), estado: "purchase", total: 25300, recibida: false,
      lineas: [lin(45, 36, 0, 0), lin(46, 18, 0, 0), lin(47, 12, 0, 0)] },
  );
}
