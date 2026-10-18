import { isAuthed, getUsuario, esAprobador } from "./auth";
import { listCategories } from "@/lib/odoo-write";
import { Login, Admin } from "./ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "BAM! — Subir productos" };

export default async function SubirPage() {
  const authed = await isAuthed();
  const usuario = await getUsuario();
  if (!authed || !usuario) return <Login />; // pide nombre + contraseña (nombre = "quién" en el historial)
  const [categorias, aprobador] = await Promise.all([listCategories(), esAprobador()]);
  return <Admin categorias={categorias} usuario={usuario} aprobador={aprobador} />;
}
