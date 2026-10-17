import { cookies } from "next/headers";
import { createHash } from "crypto";

const COOKIE = "caja_auth";
// Contraseña propia del cuadre de caja (para las cajeras).
const PASSCODE = process.env.CAJA_PASSCODE || "demo";

const token = () => createHash("sha256").update(PASSCODE + "::bam-caja-v1").digest("hex");

export function checkCajaPass(input: string): boolean {
  return input.trim() === PASSCODE;
}
export async function isCajaAuthed(): Promise<boolean> {
  const c = await cookies();
  return c.get(COOKIE)?.value === token();
}
export async function setCajaCookie() {
  const c = await cookies();
  c.set(COOKIE, token(), { httpOnly: true, sameSite: "lax", secure: true, path: "/caja", maxAge: 60 * 60 * 24 * 30 });
}
export async function clearCajaCookie() {
  const c = await cookies();
  c.set(COOKIE, "", { path: "/caja", maxAge: 0 });
}
