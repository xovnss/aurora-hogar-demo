"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  isAuthed, checkPasscodeFor, setAuthCookie, clearAuthCookie, setUserCookie, getUsuario,
  esNombreAprobador, checkApproverPin, setRoleCookie, esAprobador, esNombreConHistorial,
} from "./auth";
import * as odoo from "@/lib/odoo-write";
import { MOTIVO } from "@/lib/ajustes";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error. Intenta de nuevo.");
const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-MX");

async function guard() {
  if (!(await isAuthed())) throw new Error("Tu sesión expiró. Vuelve a entrar.");
}
// registra en el historial quién hizo qué (nunca rompe la acción)
async function log(texto: string) {
  await odoo.logAccion(await getUsuario(), texto);
}

// Aplica directo (si es aprobador) o manda a revisión (si es colaborador). razon = por qué lo pide el colaborador.
async function accion(
  tipo: string, resumen: string, payload: Record<string, unknown>, ejec: () => Promise<void>, razon = "",
): Promise<{ ok: true; pendiente: boolean }> {
  const persona = await getUsuario();
  if (await esAprobador()) {
    await ejec();
    // La razón es OPCIONAL: si la escribieron, se guarda pegada al historial.
    await odoo.logAccion(persona, razon ? `${resumen} — 📝 ${razon}` : resumen);
    return { ok: true, pendiente: false };
  }
  await odoo.crearPendiente(persona, tipo, resumen, payload, razon);
  return { ok: true, pendiente: true };
}

export async function loginAction(passcode: string, nombre: string, pin = "") {
  if (!nombre.trim()) return { ok: false as const, error: "Escribe tu nombre." };
  if (!checkPasscodeFor(nombre, passcode)) return { ok: false as const, error: "Contraseña incorrecta." };
  let rol: "aprobador" | "colab" = "colab";
  if (esNombreAprobador(nombre)) {
    if (!checkApproverPin(pin)) return { ok: false as const, error: "PIN de aprobador incorrecto." };
    rol = "aprobador";
  }
  await setAuthCookie();
  await setUserCookie(nombre);
  await setRoleCookie(rol);
  revalidatePath("/subir");
  return { ok: true as const };
}

export async function logoutAction() {
  await clearAuthCookie();
  revalidatePath("/subir");
}

export async function crearProductoAction(p: odoo.NuevoProducto) {
  try {
    await guard();
    // No permitir SKU repetido — ni al crear directo ni al mandar a revisión
    if (await odoo.skuExists(p.sku)) return { ok: false as const, error: `Ya existe un producto con el código "${p.sku}". Cámbialo antes de continuar.` };
    const esSaldo = !!(p.detalle && p.detalle.trim());
    const resumen = `${esSaldo ? "🏷️ Saldo · " : ""}Creó "${p.name}" (${p.sku}) · público ${money(p.publico)}${p.miembro ? ` / miembro ${money(p.miembro)}` : ""}${p.cantidad ? ` · ${p.cantidad} pzs` : ""}${p.liquidacion ? ` · 🔥 liq ${money(p.liquidacion)}` : ""}${esSaldo ? ` · detalle: ${p.detalle!.trim()}` : ""}`;
    const persona = await getUsuario();
    if (await esAprobador()) {
      const r = await odoo.crearProducto(p);
      await odoo.logAccion(persona, resumen);
      return { ok: true as const, pendiente: false, id: r.id, sku: r.sku };
    }
    await odoo.crearPendiente(persona, "crear", resumen, p as unknown as Record<string, unknown>);
    return { ok: true as const, pendiente: true, sku: p.sku };
  } catch (e) {
    return { ok: false as const, error: msg(e) };
  }
}

export async function buscarAction(q: string): Promise<odoo.ProductoBuscado[]> {
  await guard();
  return odoo.buscarProductos(q);
}

export async function ultimosModelosAction(): Promise<odoo.LineaModelo[]> {
  await guard();
  return odoo.ultimosModelos();
}

export async function saldosListaAction(): Promise<odoo.ProductoBuscado[]> {
  await guard();
  return odoo.listaPorCategoria("Saldos");
}
export async function liquidacionListaAction(): Promise<odoo.ProductoBuscado[]> {
  await guard();
  return odoo.listaLiquidacion();
}

export async function sinStockListaAction(): Promise<odoo.ProductoBuscado[]> {
  await guard();
  return odoo.listaSinStock();
}
export async function sinFotoBodegaAction(): Promise<odoo.ProductoBuscado[]> {
  await guard();
  return odoo.listaSinFotoBodega();
}

export async function setStockAction(id: number, qty: number, label = "", antQty: number | null = null, razon = "", loc?: number) {
  try { await guard(); const de = antQty != null ? `${antQty}→` : ""; const donde = loc ? " en Bodega" : ""; return await accion("stock", `Inventario de "${label}"${donde}: ${de}${qty} pzs`, { id, qty, loc }, () => odoo.setStock(id, qty, loc), razon); }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

/* ---------- 📋 Conteos y ajustes (solo Ana y Luis) — directo a Odoo, sin aprobación, con historial ---------- */
export async function ajusteAction(a: odoo.AjusteInput) {
  try {
    await guard();
    if (!(await esAprobador())) return { ok: false as const, error: "Solo Ana y Luis pueden hacer conteos y ajustes." };
    const persona = await getUsuario();
    const r = await odoo.aplicarAjuste(persona, a);
    const d = r.delta > 0 ? `+${r.delta}` : String(r.delta);
    await odoo.logAccion(persona, `📋 ${MOTIVO[r.motivo].label}: "${r.nombre} (${r.sku})" en ${r.bodega}: ${r.antes}→${r.despues} pzs (${d})${r.quien ? ` · usó: ${r.quien}` : ""}${r.proveedor ? ` · proveedor: ${r.proveedor}` : ""}${r.nota ? ` — 📝 ${r.nota}` : ""}`);
    return { ok: true as const, registro: r };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function historialAjustesAction(): Promise<odoo.AjusteRegistro[]> {
  await guard();
  if (!(await esAprobador())) return [];
  return odoo.historialAjustes();
}

export async function notasVsInventarioAction(): Promise<{ ok: true; notas: odoo.NotaCompra[] } | { ok: false; error: string }> {
  try {
    await guard();
    if (!(await esAprobador())) return { ok: false, error: "Solo Ana y Luis pueden ver las notas de compra." };
    return { ok: true, notas: await odoo.notasVsInventario() };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function setLiqAction(id: number, on: boolean, price: number, label = "", antLiq: number | null = null, razon = "") {
  try {
    await guard();
    const resumen = on
      ? `🔥 Liquidación de "${label}": ${antLiq != null ? money(antLiq) + "→" : ""}${money(price)}`
      : `Quitó 🔥 liquidación de "${label}"${antLiq != null ? ` (era ${money(antLiq)})` : ""}`;
    return await accion("liquidacion", resumen, { id, on, price }, () => odoo.setLiquidacion(id, on, price), razon);
  }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function setPreciosAction(id: number, publico: number, miembro: number, label = "", antPub: number | null = null, antMem: number | null = null, razon = "") {
  try {
    await guard();
    const dp = antPub != null ? money(antPub) + "→" : "";
    const dm = antMem != null ? money(antMem) + "→" : "";
    return await accion("precios", `Precios de "${label}": público ${dp}${money(publico)} · miembro ${dm}${money(miembro)}`, { id, publico, miembro }, () => odoo.actualizarPrecios(id, publico, miembro), razon);
  }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

// La imagen se aplica DIRECTO (como las descripciones), para que Sofía la vea cambiar al momento.
export async function cambiarImagenAction(id: number, imageBase64: string, label = "") {
  try { await guard(); await odoo.cambiarImagen(id, imageBase64); await log(`Cambió la foto de "${label}"`); return { ok: true as const, pendiente: false }; }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

// Cambiar categoría (directo, como descripción/imagen)
export async function setCategoriaAction(id: number, categId: number, label = "") {
  try { await guard(); await odoo.setCategoria(id, categId); await log(`Cambió la categoría de "${label}"`); return { ok: true as const, pendiente: false }; }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

// Marcar/desmarcar temporada (Navidad, Halloween…) — directo, es clasificación de bajo riesgo
export async function setTagAction(id: number, tagId: number, on: boolean, tagNombre = "", label = "") {
  try { await guard(); await odoo.setTag(id, tagId, on); await log(`${on ? "Marcó" : "Quitó"} ${tagNombre} en "${label}"`); return { ok: true as const, pendiente: false }; }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function setNombreAction(id: number, nombre: string, anterior = "", razon = "") {
  try { await guard(); return await accion("nombre", `Nombre: de "${anterior}" a "${nombre}"`, { id, nombre }, () => odoo.actualizarNombre(id, nombre), razon); }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function setSkuAction(id: number, sku: string, anterior = "", razon = "") {
  try {
    await guard();
    const nuevo = (sku || "").trim().toUpperCase();
    if (!nuevo) return { ok: false as const, error: "El SKU no puede quedar vacío." };
    if (nuevo !== (anterior || "").toUpperCase() && (await odoo.skuExists(nuevo))) return { ok: false as const, error: `Ya existe un producto con el código "${nuevo}".` };
    return await accion("sku", `SKU: de "${anterior}" a "${nuevo}"`, { id, sku: nuevo }, () => odoo.actualizarSku(id, nuevo), razon);
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function checkSkusAction(skus: string[]): Promise<string[]> {
  await guard();
  return odoo.checkSkus(skus);
}

export async function archivarAction(id: number, label = "") {
  try { await guard(); return await accion("archivar", `Archivó "${label}"`, { id }, () => odoo.archivarProducto(id)); }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function restaurarAction(id: number, label = "") {
  try { await guard(); return await accion("restaurar", `Restauró "${label}"`, { id }, () => odoo.restaurarProducto(id)); }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function eliminarAction(id: number, label = "") {
  try { await guard(); return await accion("eliminar", `Eliminó "${label}"`, { id }, async () => { await odoo.eliminarProducto(id); }); }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

/* ---------- Acciones en lote (selección múltiple estilo carrito) ---------- */
type ResMulti = { id: number; estado: "hecho" | "pendiente" | "error"; error?: string };

// Archivar varios de un jalón. Respeta el rol: aprobador aplica directo; colaborador manda cada uno a revisión.
// Nunca aborta el lote: si uno falla, sigue con los demás y lo reporta.
export async function archivarMultiAction(items: { id: number; label: string }[]) {
  try {
    await guard();
    const resultados: ResMulti[] = [];
    for (const it of items) {
      try {
        const r = await accion("archivar", `Archivó "${it.label}"`, { id: it.id }, () => odoo.archivarProducto(it.id));
        resultados.push({ id: it.id, estado: r.pendiente ? "pendiente" : "hecho" });
      } catch (e) { resultados.push({ id: it.id, estado: "error", error: msg(e) }); }
    }
    return { ok: true as const, resultados };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

// Eliminar varios de un jalón (mismo criterio de rol y tolerancia a fallos).
export async function eliminarMultiAction(items: { id: number; label: string }[]) {
  try {
    await guard();
    const resultados: ResMulti[] = [];
    for (const it of items) {
      try {
        const r = await accion("eliminar", `Eliminó "${it.label}"`, { id: it.id }, async () => { await odoo.eliminarProducto(it.id); });
        resultados.push({ id: it.id, estado: r.pendiente ? "pendiente" : "hecho" });
      } catch (e) { resultados.push({ id: it.id, estado: "error", error: msg(e) }); }
    }
    return { ok: true as const, resultados };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function historialAction(): Promise<odoo.Evento[]> {
  await guard();
  if (!(await esAprobador())) return []; // el historial completo es solo para aprobadores
  return odoo.historialReciente();
}

// Historial de solicitudes (auditoría): quién pidió qué, cuándo, razón, estado y quién lo resolvió.
// Disponible para aprobadores (Ana/Luis) y para Mario.
export async function historialSolicitudesAction(): Promise<odoo.Pendiente[]> {
  await guard();
  if (!esNombreConHistorial(await getUsuario())) return [];
  return odoo.historialCompleto();
}

export async function archivadosAction(): Promise<odoo.ProdSimple[]> {
  await guard();
  return odoo.listaArchivados();
}

export async function eliminadosAction(): Promise<odoo.Evento[]> {
  await guard();
  return odoo.eliminados();
}

// Fotos extra también DIRECTO.
export async function agregarImagenesAction(id: number, imgs: string[], label = "") {
  try { await guard(); await odoo.agregarImagenes(id, imgs); await log(`Agregó ${imgs.length} foto(s) a "${label}"`); return { ok: true as const, pendiente: false }; }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

// Tarifas por volumen (hasta 3 escalones, ej. 2×$100, 3×$80, 5×$60). Aplican en PdV y catálogo.
export async function setTarifasAction(id: number, tarifas: { qty: number; price: number }[], label = "") {
  try {
    await guard();
    const validas = (tarifas || []).filter((t) => t.qty >= 2 && t.price > 0);
    const txt = validas.map((t) => `${t.qty}×${money(t.price)}`).join(", ");
    const resumen = txt ? `Tarifas de "${label}": ${txt}` : `Quitó las tarifas por volumen de "${label}"`;
    return await accion("tarifas", resumen, { id, tarifas: validas }, () => odoo.setTarifas(id, validas));
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

/* ---------- Ajustes del catálogo de clientes (tema de temporada + portada) ---------- */
const parseIds = (s: string): number[] => (s || "").split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0);
const conUrl = (ids: number[]) => ids.map((id) => ({ id, url: odoo.portadaUrl(id) }));

export async function getAjustesCatalogoAction() {
  await guard();
  const [tema, pid, bstr] = await Promise.all([odoo.getConfigParam("bam.tema"), odoo.getConfigParam("bam.portada"), odoo.getConfigParam("bam.banners")]);
  return { tema: tema || "ninguno", portadaUrl: pid ? odoo.portadaUrl(pid) : null, banners: conUrl(parseIds(bstr)) };
}
async function refrescarCatalogo() { revalidateTag("bam-ajustes", "max"); revalidatePath("/"); }

export async function addBannerAction(base64: string, mimetype: string) {
  try {
    await guard();
    const id = await odoo.subirBanner(base64, mimetype);
    const cur = parseIds(await odoo.getConfigParam("bam.banners"));
    cur.push(id);
    await odoo.setConfigParam("bam.banners", cur.join(","));
    await log("Agregó un banner promocional"); await refrescarCatalogo();
    return { ok: true as const, banners: conUrl(cur) };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}
export async function removeBannerAction(id: number) {
  try {
    await guard();
    const cur = parseIds(await odoo.getConfigParam("bam.banners")).filter((x) => x !== id);
    await odoo.setConfigParam("bam.banners", cur.join(","));
    await log("Quitó un banner promocional"); await refrescarCatalogo();
    return { ok: true as const, banners: conUrl(cur) };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}
export async function setTemaAction(id: string) {
  try { await guard(); await odoo.setConfigParam("bam.tema", id); await log(`Cambió el tema del catálogo a "${id}"`); await refrescarCatalogo(); return { ok: true as const }; }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}
export async function setPortadaAction(base64: string, mimetype: string) {
  try { await guard(); const id = await odoo.subirPortada(base64, mimetype); await odoo.setConfigParam("bam.portada", String(id)); await log("Cambió la portada del catálogo"); await refrescarCatalogo(); return { ok: true as const, portadaUrl: odoo.portadaUrl(id) }; }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}
export async function quitarPortadaAction() {
  try { await guard(); await odoo.setConfigParam("bam.portada", ""); await log("Quitó la portada del catálogo"); await refrescarCatalogo(); return { ok: true as const }; }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

// Contadores para las notificaciones (aprobador: pendientes; colaborador: sus aprobadas/rechazadas)
export async function notifCountsAction() {
  await guard();
  const u = await getUsuario();
  if (await esAprobador()) {
    const all = await odoo.listaPendientes();
    return { rol: "aprobador" as const, pendientes: all.length, aprobadas: 0, rechazadas: 0 };
  }
  const [pend, apr, rej] = await Promise.all([odoo.listaPendientes(), odoo.listaAprobados(u), odoo.listaRechazados(u)]);
  return { rol: "colab" as const, pendientes: pend.filter((p) => p.persona === u).length, aprobadas: apr.length, rechazadas: rej.length };
}

export async function descripcionesAction(): Promise<odoo.ProdDesc[]> {
  await guard();
  return odoo.listarDescripciones();
}
// Descripciones: se aplican DIRECTO para todos (Sofía incluida). Son texto del catálogo (bajo
// riesgo) y no pasan por revisión, para que se vean al momento.
export async function setDescripcionAction(id: number, texto: string, label = "") {
  try {
    await guard();
    const corta = texto.trim() ? `“${texto.trim().slice(0, 70)}${texto.trim().length > 70 ? "…" : ""}”` : "(la dejó en blanco)";
    await odoo.guardarDescripcion(id, texto);
    await log(`Descripción de "${label}": ${corta}`);
    return { ok: true as const, pendiente: false };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}
// Aplica la MISMA descripción a varios productos de un jalón. Directo para todos.
export async function setDescripcionMultiAction(ids: number[], texto: string) {
  try {
    await guard();
    let hechos = 0;
    for (const id of ids) { try { await odoo.guardarDescripcion(id, texto); hechos++; } catch { /* sigue con los demás */ } }
    await log(`Aplicó la misma descripción a ${hechos} producto(s)${texto.trim() ? "" : " (la dejó en blanco)"}`);
    return { ok: true as const, hechos, pendiente: false };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

// Aprobar VARIAS solicitudes de un jalón (para "Aceptar todas" las descripciones).
export async function aprobarMultiAction(ids: number[]) {
  try {
    await guard();
    if (!(await esAprobador())) return { ok: false as const, error: "Solo Ana o Luis pueden aprobar." };
    const quien = await getUsuario();
    let hechos = 0;
    for (const id of ids) {
      const p = await odoo.leerPendiente(id);
      if (!p) continue;
      try {
        await ejecutarPendiente(p.tipo, p.payload);
      } catch (e) {
        const m = msg(e).toLowerCase();
        if (!(m.includes("does not exist") || m.includes("no existe") || m.includes("deleted") || m.includes("has been deleted"))) continue; // error real: se salta
      }
      await odoo.marcarAprobado(id, quien);
      await odoo.logAccion(quien, `Aprobó (pedido por ${p.persona}): ${p.resumen}`);
      hechos++;
    }
    return { ok: true as const, hechos };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function resurtirBuscarAction(skus: string[], loc?: number): Promise<odoo.ProdResurtir[]> {
  await guard();
  return odoo.buscarPorSkus(skus, loc);
}

export async function resurtirAction(id: number, nueva: number, label: string, delta: number, loc?: number) {
  try { await guard(); const donde = loc ? " en Bodega" : ""; return await accion("resurtir", `Resurtió ${delta >= 0 ? "+" : ""}${delta} a "${label}"${donde} (quedó en ${nueva} pzs)`, { id, nueva, loc }, () => odoo.setStock(id, nueva, loc)); }
  catch (e) { return { ok: false as const, error: msg(e) }; }
}

/* ---------- Cola de aprobación ---------- */
const num = (v: unknown) => Number(v) || 0;
const str = (v: unknown) => String(v ?? "");

async function ejecutarPendiente(tipo: string, d: Record<string, unknown>) {
  switch (tipo) {
    case "crear": await odoo.crearProducto(d as unknown as odoo.NuevoProducto); break;
    case "precios": await odoo.actualizarPrecios(num(d.id), num(d.publico), num(d.miembro)); break;
    case "stock": await odoo.setStock(num(d.id), num(d.qty), d.loc ? num(d.loc) : undefined); break;
    case "resurtir": await odoo.setStock(num(d.id), num(d.nueva), d.loc ? num(d.loc) : undefined); break;
    case "nombre": await odoo.actualizarNombre(num(d.id), str(d.nombre)); break;
    case "sku": await odoo.actualizarSku(num(d.id), str(d.sku)); break;
    case "liquidacion": await odoo.setLiquidacion(num(d.id), Boolean(d.on), num(d.price)); break;
    case "imagen": await odoo.cambiarImagen(num(d.id), str(d.imageBase64)); break;
    case "imagenes": await odoo.agregarImagenes(num(d.id), (d.imgs as string[]) || []); break;
    case "tarifas": await odoo.setTarifas(num(d.id), (d.tarifas as { qty: number; price: number }[]) || []); break;
    case "archivar": await odoo.archivarProducto(num(d.id)); break;
    case "restaurar": await odoo.restaurarProducto(num(d.id)); break;
    case "eliminar": await odoo.eliminarProducto(num(d.id)); break;
    case "descripcion": await odoo.guardarDescripcion(num(d.id), str(d.texto)); break;
    default: throw new Error("Tipo de solicitud desconocido: " + tipo);
  }
}

// Lista de pendientes: aprobador ve todos; colaborador ve solo los suyos
export async function pendientesAction(): Promise<odoo.Pendiente[]> {
  await guard();
  const all = await odoo.listaPendientes();
  if (await esAprobador()) return all;
  const u = await getUsuario();
  return all.filter((p) => p.persona === u);
}

export async function aprobarAction(id: number) {
  try {
    await guard();
    if (!(await esAprobador())) return { ok: false as const, error: "Solo Ana o Luis pueden aprobar." };
    const p = await odoo.leerPendiente(id);
    if (!p) return { ok: false as const, error: "Esa solicitud ya no existe." };
    let nota = "";
    try {
      await ejecutarPendiente(p.tipo, p.payload);
    } catch (e) {
      const m = msg(e).toLowerCase();
      // Si el producto ya no existe (fue borrado), la solicitud es moot: se resuelve igual y sale de la lista.
      if (m.includes("does not exist") || m.includes("no existe") || m.includes("deleted") || m.includes("has been deleted")) {
        nota = " (el producto ya no existía)";
      } else { throw e; }
    }
    await odoo.marcarAprobado(id, await getUsuario());
    await log(`Aprobó (pedido por ${p.persona}): ${p.resumen}${nota}`);
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

export async function rechazarAction(id: number, motivo = "") {
  try {
    await guard();
    if (!(await esAprobador())) return { ok: false as const, error: "Solo Ana o Luis pueden rechazar." };
    const p = await odoo.leerPendiente(id);
    if (!p) return { ok: false as const, error: "Esa solicitud ya no existe." };
    await odoo.rechazarPendienteConMotivo(id, motivo, await getUsuario());
    await log(`Rechazó (pedido por ${p.persona}): ${p.resumen}${motivo ? ` — Motivo: ${motivo}` : ""}`);
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

// Rechazadas de la persona actual (para corregir y reenviar)
export async function misRechazadosAction(): Promise<odoo.Pendiente[]> {
  await guard();
  return odoo.listaRechazados(await getUsuario());
}

// Aprobadas de la persona actual (para verlas en verde)
export async function misAprobadosAction(): Promise<odoo.Pendiente[]> {
  await guard();
  return odoo.listaAprobados(await getUsuario());
}

// Editar una solicitud que sigue en revisión (la persona se dio cuenta del error sola)
export async function editarPendienteAction(id: number, payload: Record<string, unknown>, resumen: string) {
  try {
    await guard();
    const p = await odoo.leerPendiente(id);
    if (!p) return { ok: false as const, error: "Esa solicitud ya no existe." };
    const u = await getUsuario();
    if (p.persona !== u && !(await esAprobador())) return { ok: false as const, error: "Solo puedes editar tus propias solicitudes." };
    await odoo.editarPendiente(id, resumen || p.resumen, payload);
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

// Cancelar una solicitud propia que sigue en revisión (Sofía ya no quiere enviarla)
export async function cancelarPendienteAction(id: number) {
  try {
    await guard();
    const p = await odoo.leerPendiente(id);
    if (!p) return { ok: false as const, error: "Esa solicitud ya no existe." };
    const u = await getUsuario();
    if (p.persona !== u && !(await esAprobador())) return { ok: false as const, error: "Solo puedes cancelar tus propias solicitudes." };
    await odoo.borrarPendiente(id);
    await log(`Canceló su solicitud: ${p.resumen}`);
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}

// Reenviar una rechazada ya corregida: crea un nuevo pendiente y borra la rechazada
export async function reenviarAction(id: number, payload: Record<string, unknown>, resumen: string) {
  try {
    await guard();
    const p = await odoo.leerPendiente(id);
    if (!p) return { ok: false as const, error: "Esa solicitud ya no existe." };
    const persona = await getUsuario();
    await odoo.crearPendiente(persona, p.tipo, resumen || p.resumen, payload);
    await odoo.borrarPendiente(id);
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: msg(e) }; }
}
