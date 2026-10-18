import { cookies } from "next/headers";
import { createHash } from "crypto";

const COOKIE = "subir_auth";
const USER_COOKIE = "subir_user";
const ROLE_COOKIE = "subir_rol";
const PASSCODE = process.env.ADMIN_PASSCODE || "demo";
const APPROVER_PIN = process.env.APPROVER_PIN || "1234";

// Nombres que PUEDEN aprobar (necesitan además el PIN de aprobador)
const APPROVERS = ["ana", "luis"];
const normNombre = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function esNombreAprobador(nombre: string): boolean {
  return APPROVERS.includes(normNombre(nombre));
}

// Quiénes PUEDEN entrar a /subir. Ana quitó a Sofía y a Mario el 10-oct-2026.
// Quien no esté en esta lista no entra, aunque sepa la contraseña.
const PERMITIDOS = ["ana", "luis"];
export function puedeEntrar(nombre: string): boolean {
  return PERMITIDOS.includes(normNombre(nombre));
}

// Quiénes ven la pestaña de Historial completo.
const CON_HISTORIAL = ["ana", "luis"];
export function esNombreConHistorial(nombre: string): boolean {
  return CON_HISTORIAL.includes(normNombre(nombre));
}
export function checkApproverPin(pin: string): boolean {
  return (pin || "").trim() === APPROVER_PIN;
}

function token(): string {
  return createHash("sha256").update(PASSCODE + "::bam-subir-v1").digest("hex");
}

export function checkPasscode(input: string): boolean {
  return input.trim() === PASSCODE;
}

// Mario tenía su PROPIA contraseña; se la quitamos junto con el acceso (10-oct-2026).
export function checkPasscodeFor(nombre: string, input: string): boolean {
  if (!puedeEntrar(nombre)) return false;   // Sofía, Mario y cualquier otro nombre: fuera
  return input.trim() === PASSCODE;
}

// Demo abierta: sin contraseña. Todos entran como aprobadores.
export async function isAuthed(): Promise<boolean> {
  return true;
}

export async function setAuthCookie() {
  const c = await cookies();
  c.set(COOKIE, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/subir",
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
}

export async function clearAuthCookie() {
  const c = await cookies();
  c.set(COOKIE, "", { path: "/subir", maxAge: 0 });
  c.set(USER_COOKIE, "", { path: "/subir", maxAge: 0 });
  c.set(ROLE_COOKIE, "", { path: "/subir", maxAge: 0 });
}

// Nombre de la persona que entró (para el historial: "quién lo hizo")
export async function setUserCookie(nombre: string) {
  const c = await cookies();
  c.set(USER_COOKIE, nombre.trim().slice(0, 40), {
    httpOnly: true, sameSite: "lax", secure: true, path: "/subir", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getUsuario(): Promise<string> {
  const c = await cookies();
  return c.get(USER_COOKIE)?.value || "Ana";
}

// Rol: "aprobador" (Ana/Luis con PIN) o "colab" (Sofía/Mario/otros → van a revisión)
export async function setRoleCookie(rol: "aprobador" | "colab") {
  const c = await cookies();
  c.set(ROLE_COOKIE, rol, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/subir", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function esAprobador(): Promise<boolean> {
  return true;
}
