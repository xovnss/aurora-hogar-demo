// VERSIÓN DEMO — no hay Odoo.
// Este archivo tiene las MISMAS funciones que el original (los mismos nombres y los mismos
// tipos de regreso), pero en vez de pedirle los datos a Odoo los saca de `demo-datos.ts`.
// Gracias a eso las pantallas no cambiaron ni una línea.
import { unstable_cache } from "next/cache";
import type { ProductGroup } from "./group";
import { buildGroups } from "./group";
import { demoProductos } from "./demo-datos";

/* ---------- Catálogo ---------- */
async function fetchGroups(): Promise<ProductGroup[]> {
  return buildGroups(demoProductos());
}

// En el original esto cachea la respuesta de Odoo 15 segundos. Aquí se deja igual para que
// el comportamiento (y el botón de "Actualizar") se sienta idéntico.
export const getCatalogGroups = unstable_cache(fetchGroups, ["demo-catalogo"], {
  revalidate: 15,
  tags: ["demo-catalogo"],
});

// Sin caché: lo usan las fichas, que siempre quieren el dato del momento.
export async function getCatalogGroupsLive(): Promise<ProductGroup[]> {
  return fetchGroups();
}

/* ---------- Ajustes del catálogo (tema de temporada + portada) ---------- */
export type Ajustes = { tema: string; portadaUrl: string | null; banners: string[] };

async function fetchAjustes(): Promise<Ajustes> {
  // Cambia "ninguno" por "navidad" o "halloween" para ver los temas de temporada.
  return { tema: process.env.NEXT_PUBLIC_TEMA_DEMO || "ninguno", portadaUrl: null, banners: [] };
}
export const getAjustes = unstable_cache(fetchAjustes, ["demo-ajustes"], { revalidate: 300, tags: ["demo-ajustes"] });

/* ---------- Cotización ---------- */
export type CotizLinea = { nombre: string; imageId: number | null; cantidad: number; unitario: number; subtotal: number };
export type CotizacionData = { numero: string; cliente: string; fecha: string; lineas: CotizLinea[]; total: number };

// Demo: cualquier número que empiece con S devuelve una cotización de ejemplo armada con
// productos reales del catálogo falso, para poder enseñar cómo se ve la versión del cliente.
export async function getCotizacion(numero: string): Promise<CotizacionData | null> {
  const n = (numero || "").trim();
  if (!n) return null;
  if (!/^[sS]?\d+$/.test(n.replace(/\s/g, ""))) return null;
  const prods = demoProductos();
  const elegidos = [prods[12], prods[40], prods[95], prods[130]].filter(Boolean);
  const lineas: CotizLinea[] = elegidos.map((p, i) => {
    const cantidad = [2, 1, 3, 1][i] ?? 1;
    const unitario = p.precioMiembro ?? p.precioPublico;
    return { nombre: p.name, imageId: p.id, cantidad, unitario, subtotal: cantidad * unitario };
  });
  return {
    numero: n.toUpperCase().startsWith("S") ? n.toUpperCase() : "S" + n.padStart(5, "0"),
    cliente: "Clienta de ejemplo",
    fecha: new Date().toISOString().slice(0, 10),
    lineas,
    total: lineas.reduce((s, l) => s + l.subtotal, 0),
  };
}

/* ---------- Imagen de producto ----------
   En el original esto baja la foto de Odoo con la cuenta. En la demo no hay fotos reales:
   las rutas /img y /ventas/img dibujan un cuadro de ejemplo, así que esto siempre va vacío. */
export async function imagenProducto(): Promise<{ datos: Buffer; tipo: string } | null> {
  return null;
}
