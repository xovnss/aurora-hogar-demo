import { cookies } from "next/headers";
import { createHash } from "crypto";

const COOKIE = "ventas_auth";
const PASSCODE = process.env.VENTAS_PASSCODE || process.env.ADMIN_PASSCODE || "demo";

const token = () => createHash("sha256").update(PASSCODE + "::bam-ventas-v1").digest("hex");

export function checkVentasPass(input: string): boolean {
  return input.trim() === PASSCODE;
}
export async function isVentasAuthed(): Promise<boolean> {
  const c = await cookies();
  return c.get(COOKIE)?.value === token();
}
export async function setVentasCookie() {
  const c = await cookies();
  c.set(COOKIE, token(), { httpOnly: true, sameSite: "lax", secure: true, path: "/ventas", maxAge: 60 * 60 * 24 * 30 });
}
export async function clearVentasCookie() {
  const c = await cookies();
  c.set(COOKIE, "", { path: "/ventas", maxAge: 0 });
}
