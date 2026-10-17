import type { Product } from "./types";
import { searchText, norm } from "./search";
import { TAG_NAVIDAD, TAG_HALLOWEEN, TAG_NUEVO } from "./tags";

export type Variant = Product & { label: string; size: string; color: string };

export type ProductGroup = {
  key: string;
  base: string; // nombre del "producto padre"
  catalogo: string;
  categoria: string;
  variants: Variant[];
  minPublico: number;
  maxPublico: number;
  minMiembro: number | null;
  hasLiq: boolean;
  minLiq: number | null;
  stock: number; // suma de variantes
  image: string | null;
  thumb: string | null;   // miniatura para la tarjeta
  blob: string; // texto para búsqueda (todas las variantes)
  sizeTags: string[]; // medidas presentes (King, Queen, …) para las etiquetas de la ficha
  colorCount: number; // cuántos colores/diseños distintos
  // --- Sólo los llena el catálogo curado (estructura.ts); buildGroups los deja vacíos ---
  orden?: number;          // orden global de traversal del archivo (respeta el orden manual del dueño)
  categoriaOrden?: number; // orden de la subcategoría dentro de su padre
  oferta?: boolean;      // true = aparece ADEMÁS en la sección "Ofertas" al frente
  novedad?: boolean;     // true = aparece ADEMÁS en "Novedades" (producto que aún no se acomoda a mano)
  // Temporada: aparecen ADEMÁS en su sección (independiente de la categoría). Los marca Rosy en /subir.
  esNavidad?: boolean;
  esHalloween?: boolean;
};

// ¿Alguna variante del grupo tiene el tag de temporada?
export function tieneTag(variants: Product[], tagId: number): boolean {
  return variants.some((v) => (v.tags || []).includes(tagId));
}

const SIZE_NAMES: Record<string, string> = { XS: "XS", S: "S", M: "M", L: "L", XL: "XL" };
const SIZE_CODES = new Set(["XS", "S", "M", "L", "XL"]);
const SIZE_ORDER = ["XS", "S", "M", "L", "XL"];
const SIZE_SHORT: Record<string, string> = { XS: "XS", S: "S", M: "M", L: "L", XL: "XL" };

// Un token es "modelo/diseño" (NO se agrupa) si es M1, M2… o un número suelto.
const isModel = (t: string) => /^m\d+$/i.test(t) || /^\d+$/.test(t);

function words(s: string) {
  return (s || "").split(/\s+/).filter(Boolean);
}

// Cuántas palabras iniciales comparten TODOS los nombres (para sacar el nombre padre)
function commonLeadingWords(names: string[]): number {
  if (!names.length) return 0;
  const ws = names.map(words);
  let i = 0;
  outer: for (; i < ws[0].length; i++) {
    const w = ws[0][i].toLowerCase();
    for (const arr of ws) {
      if (i >= arr.length || arr[i].toLowerCase() !== w) break outer;
    }
  }
  return i;
}

// Agrupa productos sueltos (cada medida/color es un product.template) en familias.
export function buildGroups(products: Product[]): ProductGroup[] {
  // Clave de familia: conserva el prefijo (línea) + "Modelo N" + el TIPO de pieza,
  // y quita medida y color. Si tras la línea hay ≥2 tokens que no son medida ni
  // modelo, el ÚLTIMO se considera el "tipo" (Facial/Lavabo/Medio Baño…) y se
  // conserva para NO mezclar productos distintos; los previos son color y se quitan.
  function keyOf(sku: string): string {
    const toks = (sku || "").split("-");
    if (toks.length <= 2) return sku || "";
    const head = toks.slice(0, 2);
    const rest = toks.slice(2);
    const nonModelIdx: number[] = [];
    rest.forEach((x, i) => {
      if (!SIZE_CODES.has(x.toUpperCase()) && !isModel(x)) nonModelIdx.push(i);
    });
    const keepLast = nonModelIdx.length >= 2 ? nonModelIdx[nonModelIdx.length - 1] : -1;
    const out: string[] = [];
    rest.forEach((x, i) => {
      if (SIZE_CODES.has(x.toUpperCase())) return; // quita medida
      if (isModel(x)) return;                        // junta modelos (se tratan como variante, igual que el color)
      if (i === keepLast) out.push(x);              // conserva tipo (si hay ≥2)
      // el resto (color) se quita
    });
    return [...head, ...out].join("-");
  }

  // separa cada familia por estado de liquidación: los de liquidación van a su
  // propio grupo (aparecen SOLO en la sección Liquidación, no mezclados).
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const k = keyOf(p.sku || p.name) + (p.precioLiquidacion != null ? "|L" : "|N");
    const a = map.get(k);
    if (a) a.push(p);
    else map.set(k, [p]);
  }

  const groups: ProductGroup[] = [];
  for (const [key, arr] of map) {
    const multi = arr.length > 1;

    // nombre padre = palabras comunes; etiqueta variante = lo que sobra del nombre
    const cpw = multi ? commonLeadingWords(arr.map((a) => a.name)) : 0;
    let base = multi
      ? words(arr[0].name).slice(0, cpw).join(" ").replace(/[-–\s]+$/, "").trim()
      : arr[0].name;
    if (!base) base = arr[0].name;
    // si el nombre común termina en "Modelo" (familias de puros modelos), lo quitamos
    // del título y se lo devolvemos a cada opción ("1" → "Modelo 1").
    const baseModelo = /\s(modelos?|mod\.?)$/i.test(base);
    // ojo: al quitar "Modelo" puede quedar el guion suelto al final
    // ("CASITAS PORTALLAVES MDF - MODELO" → "CASITAS PORTALLAVES MDF -"), así que se vuelve a limpiar.
    if (baseModelo) base = base.replace(/\s+(modelos?|mod\.?)\s*$/i, "").replace(/[-–·\s]+$/, "").trim();
    if (!base) base = arr[0].name;

    const variants: Variant[] = arr.map((p) => {
      let label = "";
      if (multi) {
        label = words(p.name).slice(cpw).join(" ").replace(/^[-–\s]+/, "").trim();
        if (baseModelo && /^\d/.test(label)) label = "Modelo " + label;
        if (!label) {
          const tail = (p.sku || "").split("-").pop() || "";
          label = SIZE_NAMES[tail.toUpperCase()] || tail || "Opción";
        }
      }
      // separa MEDIDA y COLOR/DISEÑO para poder elegirlos por separado
      let sizeCode = "";
      for (const t of (p.sku || "").split("-")) {
        const u = t.toUpperCase();
        if (SIZE_CODES.has(u)) { sizeCode = u; break; }
      }
      const size = sizeCode ? SIZE_NAMES[sizeCode] : "";
      let color = label;
      if (size) {
        color = label.replace(new RegExp("[-–\\s]*\\b" + size + "\\s*$", "i"), "").replace(/[-–]/g, " ").replace(/\s+/g, " ").trim();
      }
      return { ...p, label, size, color };
    });
    // ordena por precio y luego por etiqueta
    variants.sort((a, b) => a.precioPublico - b.precioPublico || a.label.localeCompare(b.label, "es"));

    const pubs = variants.map((v) => v.precioPublico);
    const mems = variants.map((v) => v.precioMiembro).filter((x): x is number => x != null);
    const liqs = variants.map((v) => v.precioLiquidacion).filter((x): x is number => x != null);
    const withImg = variants.find((v) => v.imageUrl) || variants[0];

    // medidas y colores presentes (para las etiquetas de la ficha)
    const sizeSet = new Set<string>();
    const colorSet = new Set<string>();
    for (const v of variants) {
      const toks = (v.sku || "").split("-");
      let size = "";
      const rest: string[] = [];
      for (const t of toks) {
        const u = t.toUpperCase();
        if (!size && SIZE_CODES.has(u)) size = u;
        else rest.push(t);
      }
      if (size) sizeSet.add(size);
      colorSet.add(rest.join("-")); // "color/diseño" = SKU sin la medida
    }
    const sizeTags = SIZE_ORDER.filter((c) => sizeSet.has(c)).map((c) => SIZE_SHORT[c]);

    groups.push({
      key,
      base,
      catalogo: variants[0].catalogo,
      categoria: variants[0].categoria,
      variants,
      minPublico: Math.min(...pubs),
      maxPublico: Math.max(...pubs),
      minMiembro: mems.length ? Math.min(...mems) : null,
      hasLiq: liqs.length > 0,
      minLiq: liqs.length ? Math.min(...liqs) : null,
      stock: variants.reduce((s, v) => s + (v.stock || 0), 0),
      image: withImg.imageUrl,
      thumb: withImg.thumbUrl ?? withImg.imageUrl,
      blob: norm(variants.map((v) => searchText(v)).join(" ")),
      sizeTags,
      colorCount: colorSet.size,
      novedad: tieneTag(variants, TAG_NUEVO),
      esNavidad: tieneTag(variants, TAG_NAVIDAD),
      esHalloween: tieneTag(variants, TAG_HALLOWEEN),
    });
  }

  // familias con más variantes primero (se ven más ricas), luego por nombre
  groups.sort((a, b) => b.variants.length - a.variants.length || a.base.localeCompare(b.base, "es"));
  return groups;
}
