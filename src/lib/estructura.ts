// Construye los grupos del catálogo a partir de la ESTRUCTURA CURADA (src/data/estructura-catalogo.json)
// — el archivo manda la jerarquía, agrupación y orden — y le sobrepone los datos EN VIVO de Odoo
// (precio, stock, fotos) empatados por SKU. Ver reglas dentro del propio JSON.
// IMPORTANTE: este módulo importa un JSON grande, así que SOLO debe usarse del lado del servidor.
import type { Product } from "./types";
import { buildGroups, tieneTag, type ProductGroup, type Variant } from "./group";
import { searchText, norm } from "./search";
import { SITE } from "./config";
import { TAG_NAVIDAD, TAG_HALLOWEEN } from "./tags";

type JVariante = {
  sku: string;
  codigoBarras?: string;
  nombreCompletoOdoo?: string;
  valores: Record<string, string>;
  precioPublico: number;
  precioComunidad: number;
  precioLiquidacion: number | null;
  stock: number;
  orden: number;
};
type JProducto = {
  nombre: string;
  descripcion?: string;
  publicadoEnTienda: boolean;
  enOferta: boolean;
  portadaElegida?: string;
  galeriaPropia?: string[];
  ordenDentroDeSuCategoria?: number;
  opciones: string[];
  variantes: JVariante[];
};
type JSub = { nombreCompleto: string; nombreCorto: string; orden: number; portada?: string; productos: JProducto[] };
type JCat = { nombre: string; orden: number; portada?: string; ocultoEnTienda?: boolean; subcategorias: JSub[] };
export type Estructura = { categoriasPadre: JCat[]; productosSinCategoria?: JProducto[] };

// Nombres de medida canónicos que entiende el selector de la ficha (product-detail).
// OJO: debe coincidir con el arreglo ORDEN de product-detail.tsx.
const SIZE_ORDER = ["Individual", "Matrimonial", "Matri Queen", "Queen", "King", "King Jumbo", "California King"];
const SIZE_OPTION = /^(tama[nñ]o|talla|medida)s?$/i;

function limpia(s: string) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
// Mapea el valor de "Tamaño" del archivo (que viene en muchas formas) a un nombre canónico.
// Si no la reconoce, devuelve el valor original (funciona igual, sólo no entra al dropdown de medidas).
function normSize(v: string): string {
  const s = limpia(v);
  if (!s) return "";
  // OJO al orden: "California King" y "King Jumbo" contienen "king", así que van ANTES que King.
  if (/california king|cal[.\-\s]?king/.test(s)) return "California King";
  if (/king\s*jumbo|jumbo/.test(s)) return "King Jumbo";
  if (/\bking\b|king size/.test(s)) return "King";
  if (/matri.?queen|matrimonial\s*\/\s*queen|matri\s*\/\s*queen|matri queen/.test(s)) return "Matri Queen";
  if (/\bqueen\b/.test(s)) return "Queen";
  if (/matrimonial|\bfull\b|\bmatri\b/.test(s)) return "Matrimonial";
  if (/individual|\btwin\b/.test(s)) return "Individual";
  return v;
}

// De los valores de opción de una variante saca (size, color, label) para la ficha.
function opcionesAVariante(opciones: string[], valores: Record<string, string>, fallback: string): { size: string; color: string; label: string } {
  const ops = (opciones || []).filter(Boolean);
  let size = "";
  const otros: string[] = [];
  for (const op of ops) {
    const val = (valores || {})[op];
    if (!val) continue;
    if (SIZE_OPTION.test(op) && !size) size = normSize(val);
    else otros.push(val);
  }
  const color = otros.join(" · ");
  const label = [size, color].filter(Boolean).join(" · ") || fallback;
  return { size, color, label };
}

// modo "catalogo": sólo lo VENDIBLE (lo apartado no se ofrece al público).
// modo "fichas":   todo lo que existe físicamente, para que la asesora vea disponibles Y apartadas.
export function buildGroupsFromEstructura(products: Product[], est: Estructura, modo: "catalogo" | "fichas" = "catalogo"): ProductGroup[] {
  const bySku = new Map<string, Product>();
  for (const p of products) if (p.sku) bySku.set(p.sku, p);

  const groups: ProductGroup[] = [];
  let orden = 0;
  const curados = new Set<string>(); // todos los SKU del archivo curado, tengan stock o no
  // Mapa aprendido del propio archivo: categoría de Odoo (ej. "Cortinas") -> dónde la acomodó
  // Ximena (ej. Cortinas / Para habitación). Sirve para que un producto nuevo caiga solo en su
  // lugar en vez de irse al cajón de "Novedades".
  const votos = new Map<string, Map<string, number>>();

  for (const cat of est.categoriasPadre) {
    if (cat.ocultoEnTienda) continue; // Saldos: nunca al público
    const catalogo = cat.nombre;
    for (const sub of cat.subcategorias || []) {
      const categoria = sub.nombreCorto || sub.nombreCompleto;
      const categoriaOrden = sub.orden ?? 0;
      for (const prod of sub.productos || []) {
        if (prod.publicadoEnTienda === false) continue; // existe pero no se muestra
        const jvars = [...(prod.variantes || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
        if (!jvars.length) continue;
        for (const jv of jvars) if (jv.sku) curados.add(jv.sku);

        const variants: Variant[] = jvars.map((jv) => {
          const od = jv.sku ? bySku.get(jv.sku) : undefined;
          const { size, color, label } = opcionesAVariante(prod.opciones, jv.valores, jv.nombreCompletoOdoo || jv.sku || prod.nombre);
          const base: Product = {
            id: od?.id ?? 0,
            sku: jv.sku || "",
            name: od?.name ?? (jv.nombreCompletoOdoo || prod.nombre || "").replace(/^🔥\s*/, "").trim().toUpperCase(),
            catalogo,
            categoria,
            precioPublico: od?.precioPublico ?? jv.precioPublico ?? 0,
            precioMiembro: od?.precioMiembro ?? (jv.precioComunidad ?? null),
            precioLiquidacion: od?.precioLiquidacion ?? jv.precioLiquidacion ?? null,
            tarifas: od?.tarifas ?? [],
            stock: od?.stock ?? 0, // sin match en Odoo => sin stock en vivo
            stockTienda: od?.stockTienda ?? 0,
            stockBodega: od?.stockBodega ?? 0,
            fisico: od?.fisico ?? 0,
            apartado: od?.apartado ?? 0,
            imageUrl: od?.imageUrl ?? null,
            thumbUrl: od?.thumbUrl ?? null,
            imagenes: od?.imagenes ?? [],
            descripcion: od?.descripcion ?? (prod.descripcion?.trim() || null),
            tags: od?.tags ?? [],
          };
          if (od?.categoria) {
            const k = norm(od.categoria);
            const v = `${catalogo}|||${categoria}|||${categoriaOrden}`;
            let mm = votos.get(k);
            if (!mm) { mm = new Map(); votos.set(k, mm); }
            mm.set(v, (mm.get(v) || 0) + 1);
          }
          return { ...base, label, size, color };
        });

        // Agotados fuera: una variante sin existencia vendible no se muestra ni como opción de
        // color/medida, y si el producto se queda sin piezas no aparece en el catálogo.
        const disponibles = (SITE.ignoreStock || SITE.mostrarAgotados) ? variants
          : modo === "fichas" ? variants.filter((v) => v.fisico > 0)
          : variants.filter((v) => v.stock > 0);
        if (!disponibles.length) continue;

        const pubs = disponibles.map((v) => v.precioPublico);
        const mems = disponibles.map((v) => v.precioMiembro).filter((x): x is number => x != null);
        const liqs = disponibles.map((v) => v.precioLiquidacion).filter((x): x is number => x != null);
        const withImg = disponibles.find((v) => v.imageUrl) || disponibles[0];

        const sizeSet = new Set<string>();
        const colorSet = new Set<string>();
        for (const v of disponibles) {
          if (v.size) sizeSet.add(v.size);
          colorSet.add(v.color || v.label);
        }
        const sizeTags = SIZE_ORDER.filter((c) => sizeSet.has(c));

        groups.push({
          key: `g${orden}`,
          base: prod.nombre,
          catalogo,
          categoria,
          variants: disponibles,
          minPublico: Math.min(...pubs),
          maxPublico: Math.max(...pubs),
          minMiembro: mems.length ? Math.min(...mems) : null,
          hasLiq: liqs.length > 0,
          minLiq: liqs.length ? Math.min(...liqs) : null,
          stock: disponibles.reduce((s, v) => s + (v.stock || 0), 0),
          image: withImg.imageUrl,
          thumb: withImg.thumbUrl ?? withImg.imageUrl,
          blob: norm([prod.nombre, ...disponibles.map((v) => searchText(v))].join(" ")),
          sizeTags,
          colorCount: colorSet.size,
          orden: orden++,
          categoriaOrden,
          oferta: !!prod.enOferta,
          esNavidad: tieneTag(disponibles, TAG_NAVIDAD),
          esHalloween: tieneTag(disponibles, TAG_HALLOWEEN),
        });
      }
    }
  }

  // Productos que EXISTEN en Odoo (vendibles, con SKU, no saldos) pero NO están en el archivo curado
  // —p. ej. subidos nuevos desde /subir— se agrupan aparte y salen en una sección "Novedades",
  // así aparecen solos sin tener que curar el archivo cada vez.
  const sobrantes = products.filter((p) => p.sku && !curados.has(p.sku)
    && (SITE.ignoreStock || SITE.mostrarAgotados || (modo === "fichas" ? p.fisico > 0 : p.stock > 0)));
  if (sobrantes.length) {
    // de los votos nos quedamos con el destino más usado de cada categoría de Odoo
    const destino = new Map<string, { catalogo: string; categoria: string; orden: number }>();
    for (const [k, mm] of votos) {
      let mejor = "", n = 0;
      for (const [v, c] of mm) if (c > n) { mejor = v; n = c; }
      const [cl, ca, or] = mejor.split("|||");
      destino.set(k, { catalogo: cl, categoria: ca, orden: Number(or) || 0 });
    }
    const catOrden = new Map<string, number>();
    for (const g of buildGroups(sobrantes)) {
      const d = destino.get(norm(g.categoria));
      if (d) {
        // Entra DONDE LA CLIENTA LO BUSCA y además se marca como novedad, así sale en las dos
        // partes. Antes todo caía en "Novedades" y esa sección llegó a tener un tercio del
        // catálogo, dejando categorías como Recámara incompletas. (10-oct-2026)
        groups.push({ ...g, catalogo: d.catalogo, categoria: d.categoria, categoriaOrden: d.orden,
                      orden: orden++, oferta: false, novedad: true });
      } else {
        if (!catOrden.has(g.categoria)) catOrden.set(g.categoria, catOrden.size);
        groups.push({ ...g, catalogo: "Novedades", categoriaOrden: catOrden.get(g.categoria) ?? 0,
                      orden: orden++, oferta: false, novedad: true });
      }
    }
  }
  return groups;
}
