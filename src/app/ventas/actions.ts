"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { checkVentasPass, setVentasCookie, clearVentasCookie, isVentasAuthed } from "./auth";
import { getCotizacion, type CotizacionData } from "@/lib/odoo";

export async function loginVentasAction(pass: string) {
  if (!checkVentasPass(pass)) return { ok: false as const, error: "Contraseña incorrecta." };
  await setVentasCookie();
  revalidatePath("/ventas");
  return { ok: true as const };
}

export async function logoutVentasAction() {
  await clearVentasCookie();
  revalidatePath("/ventas");
}

// Refresca el catálogo (stock) — el botón "Actualizar" de las fichas.
export async function refrescarCatalogoAction() {
  revalidateTag("bam-catalog", "max");
  revalidatePath("/ventas");
  return { ok: true as const };
}

// Trae una cotización de Odoo por número y la deja lista para la versión limpia (foto + nombre + precio).
export async function cotizacionAction(numero: string): Promise<{ ok: true; data: CotizacionData } | { ok: false; error: string }> {
  try {
    if (!(await isVentasAuthed())) return { ok: false as const, error: "Tu sesión expiró. Vuelve a entrar." };
    const data = await getCotizacion(numero);
    if (!data) return { ok: false as const, error: `No encontré la cotización “${numero}”. Revisa el número (ej. S00123).` };
    return { ok: true as const, data };
  } catch {
    return { ok: false as const, error: "No se pudo leer la cotización. Intenta de nuevo." };
  }
}
