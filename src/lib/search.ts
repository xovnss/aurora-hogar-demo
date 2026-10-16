import type { Product } from "./types";

// Palabras que se ignoran en la búsqueda
const STOP = new Set([
  "para","de","del","la","el","los","las","con","y","en","a","un","una","por","mi","al","o","su","que",
]);

export function norm(s: string) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Quita plural / género para que "amarillas" empate con "amarillo", "cortinas" con "cortina", etc.
function stem(t: string) {
  let w = t;
  if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
  if (w.length > 4 && (w.endsWith("a") || w.endsWith("o") || w.endsWith("e"))) w = w.slice(0, -1);
  return w;
}

// Texto donde se busca: nombre + SKU + subcategoría + catálogo + descripción
export function searchText(p: Product) {
  return norm([p.name, p.sku, p.categoria, p.catalogo, p.descripcion || ""].join(" "));
}

// true si TODAS las palabras de la búsqueda empatan (por palabra completa o por raíz).
// Normaliza también el texto (acentos/mayúsculas) para que empate aunque venga "crudo".
export function matchSearch(text: string, query: string) {
  const t2 = norm(text);
  const tokens = norm(query)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
  if (!tokens.length) return true;
  return tokens.every((t) => {
    if (t2.includes(t)) return true;
    const s = stem(t);
    return s.length >= 3 && t2.includes(s);
  });
}
