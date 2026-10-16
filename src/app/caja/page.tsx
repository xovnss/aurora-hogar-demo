import { isCajaAuthed } from "./auth";
import { CajaLogin, CajaApp } from "./ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aurora — Cuadre de caja" };

export default async function CajaPage() {
  if (!(await isCajaAuthed())) return <CajaLogin />;
  return <CajaApp />;
}
