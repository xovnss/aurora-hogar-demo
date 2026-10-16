"use server";

import { revalidatePath } from "next/cache";
import { checkCajaPass, setCajaCookie, clearCajaCookie, isCajaAuthed } from "./auth";
import { cortePdV, getSalidasCaja, setSalidasCaja, getEntradasCaja, setEntradasCaja, getCajaConteo, setCajaConteo, getPdVAjuste, listaCajasPos, enviosDeCaja, cobrarEnvioCaja } from "@/lib/odoo-write";
import type { CorteLinea } from "@/lib/odoo-write";
import type { CajaPos } from "@/lib/odoo-write";
import type { SalidaCaja, CajaConteo } from "@/lib/odoo-write";

export type CajaData = { fecha: string; caja: number; cajas: CajaPos[]; efectivo: number; tarjeta: number; transferencia: number; salidas: SalidaCaja[]; entradas: SalidaCaja[]; conteo: CajaConteo };

function rangoDiaMx(fecha: string) {
  const desde = `${fecha} 06:00:00`;
  const d = new Date(`${fecha}T06:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const hasta = `${d.toISOString().slice(0, 10)} 05:59:59`;
  return { desde, hasta };
}

export async function loginCajaAction(pass: string) {
  if (!checkCajaPass(pass)) return { ok: false as const, error: "Contraseña incorrecta." };
  await setCajaCookie();
  revalidatePath("/caja");
  return { ok: true as const };
}
export async function logoutCajaAction() {
  await clearCajaCookie();
  revalidatePath("/caja");
}

export async function cargarCajaAction(fecha: string, caja?: number): Promise<{ ok: true; data: CajaData } | { ok: false; error: string }> {
  try {
    if (!(await isCajaAuthed())) return { ok: false as const, error: "Tu sesión expiró. Vuelve a entrar." };
    const cajas = await listaCajasPos();
    // Si aún no eligió caja, se abre en la primera de la lista.
    const cid = caja && cajas.some((c) => c.id === caja) ? caja : (cajas[0]?.id ?? 0);
    const { desde, hasta } = rangoDiaMx(fecha);
    const pdv = await cortePdV(desde, hasta, cid);
    const aj = await getPdVAjuste(fecha); // ajuste manual del día (si existe, reemplaza lo de Odoo)
    const efectivo = aj ? aj.efectivo : pdv.efectivo;
    const tarjeta = aj ? aj.tarjeta : pdv.tarjeta;
    const transferencia = aj ? aj.transferencia : pdv.transferencia;
    const salidas = await getSalidasCaja(fecha, cid);
    const entradas = await getEntradasCaja(fecha, cid);
    const conteo = await getCajaConteo(fecha, cid);
    return { ok: true as const, data: { fecha, caja: cid, cajas, efectivo, tarjeta, transferencia, salidas, entradas, conteo } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, error: "Detalle: " + msg.slice(0, 300) };
  }
}

export async function guardarSalidasAction(fecha: string, salidas: SalidaCaja[], caja?: number) {
  try {
    if (!(await isCajaAuthed())) return { ok: false as const, error: "Sin sesión" };
    await setSalidasCaja(fecha, (salidas || []).filter((s) => (s.concepto || "").trim() || s.monto > 0), caja);
    return { ok: true as const };
  } catch { return { ok: false as const, error: "No se pudo guardar" }; }
}

export async function guardarEntradasAction(fecha: string, entradas: SalidaCaja[], caja?: number) {
  try {
    if (!(await isCajaAuthed())) return { ok: false as const, error: "Sin sesión" };
    await setEntradasCaja(fecha, (entradas || []).filter((s) => (s.concepto || "").trim() || s.monto > 0), caja);
    return { ok: true as const };
  } catch { return { ok: false as const, error: "No se pudo guardar" }; }
}

export async function guardarConteoAction(fecha: string, conteo: CajaConteo, caja?: number) {
  try {
    if (!(await isCajaAuthed())) return { ok: false as const, error: "Sin sesión" };
    await setCajaConteo(fecha, conteo, caja);
    return { ok: true as const };
  } catch { return { ok: false as const, error: "No se pudo guardar" }; }
}

/* ---------- Envíos que cobra la caja (recolección en tienda y contra entrega) ---------- */
export async function enviosCajaAction(fecha: string): Promise<{ ok: true; lineas: CorteLinea[] } | { ok: false; error: string }> {
  try {
    if (!(await isCajaAuthed())) return { ok: false as const, error: "Tu sesión expiró. Vuelve a entrar." };
    const { desde, hasta } = rangoDiaMx(fecha);
    return { ok: true as const, lineas: await enviosDeCaja(desde, hasta, fecha) };
  } catch (e) {
    return { ok: false as const, error: "No se pudieron leer los envíos. " + (e instanceof Error ? e.message : "").slice(0, 120) };
  }
}

export async function cobrarEnvioAction(id: number, fecha: string, cobrado: boolean) {
  try {
    if (!(await isCajaAuthed())) return { ok: false as const, error: "Sin sesión" };
    await cobrarEnvioCaja(id, fecha, cobrado);
    return { ok: true as const };
  } catch { return { ok: false as const, error: "No se pudo marcar. Intenta de nuevo." }; }
}
