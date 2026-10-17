"use server";

import { revalidatePath, revalidateTag } from "next/cache";

// Actualiza las existencias en tiempo real (fuerza a Odoo, sin esperar el caché de 5 min).
export async function refrescarStockAction() {
  revalidateTag("bam-catalog", "max");
  revalidatePath("/");
  return { ok: true as const };
}
