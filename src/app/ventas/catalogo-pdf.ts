// Catálogo en PDF armado desde la app de fichas (/ventas).
// Pensado para ETIQUETA BLANCA: por defecto sale SIN precios y SIN la marca Aurora,
// para que una revendedora lo comparta con sus propias clientas y le ponga su precio.
// (9-oct-2026, a petición de Ximena.)
//
// 12-oct-2026: "quiero que sea un catálogo real". Formato nuevo "revista": MEDIA HOJA por
// producto con foto grande, medidas, descripción y la fotito de cada color; los productos
// con muchos colores (cortina stock: 47) se estiran a lo que necesiten. Además lleva ÍNDICE
// por sección con número de hoja.
import { jsPDF } from "jspdf";

const NAVY: [number, number, number] = [14, 38, 80];
const GRIS: [number, number, number] = [110, 128, 150];
const GRIS_SUAVE: [number, number, number] = [222, 230, 240];
const NEGRO_SUAVE: [number, number, number] = [40, 48, 60];

const M = 12; // margen mm
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
const rango = (a: number, b: number) => (a === b ? money(a) : money(a) + " a " + money(b));
const fechaLarga = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

export type CatColor = { nombre: string; image: string | null };
export type CatProd = {
  nombre: string;
  seccion: string;        // sección del catálogo (Recámara, Baño, Cortinas…) → agrupa el índice
  categoria: string;
  descripcion: string;
  medidas: string[];
  image: string | null;
  colores: CatColor[];
  pub: [number, number];
  mem: [number, number] | null;
  liq: number | null;
};

export type CatOpts = {
  productos: CatProd[];
  tienda?: string;        // nombre que va en la portada y en el pie (etiqueta blanca)
  contacto?: string;      // teléfono / @usuario de quien comparte
  precios: "no" | "publico" | "miembro";
  marca: boolean;         // true = sale el logo y los datos de Aurora
  layout: "compacto" | "revista" | "detallado";
  portada: boolean;
  indice: boolean;
  onProgress?: (hechos: number, total: number) => void;
};

/* ---------- fotos: las bajamos y las encogemos para que el PDF no pese de más ---------- */
const cache = new Map<string, string | null>();

async function foto(url: string | null, px: number): Promise<string | null> {
  if (!url) return null;
  const llave = url + "@" + px;
  const hit = cache.get(llave);
  if (hit !== undefined) return hit;
  let out: string | null = null;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await Promise.race([
      img.decode().catch(() => new Promise((r) => { img.onload = img.onerror = () => r(null); })),
      new Promise((r) => setTimeout(r, 8000)),
    ]);
    if (img.naturalWidth) {
      const c = document.createElement("canvas");
      c.width = px; c.height = px;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, px, px);
        // recorte tipo "cover" (cuadrado, centrado)
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - lado) / 2, sy = (img.naturalHeight - lado) / 2;
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, px, px);
        out = c.toDataURL("image/jpeg", 0.7);
      }
    }
  } catch { out = null; }
  cache.set(llave, out);
  return out;
}

let logoCache: string | null | undefined;
async function cargarLogo(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = "/aurora-logo.png"; });
    const w = 360, h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    logoCache = c.toDataURL("image/png");
  } catch { logoCache = null; }
  return logoCache;
}

/* ---------- textos ---------- */
// jsPDF escribe en Latin-1: los emojis (🔥 de liquidación) salían como "Ø=ÜY%".
// Los quitamos y cambiamos comillas/guiones finos por los normales.
function limpia(s: string): string {
  return (s || "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x00-\xFF]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function corta(doc: jsPDF, texto: string, ancho: number, maxLineas: number): string[] {
  const l = doc.splitTextToSize(limpia(texto), ancho) as string[];
  if (l.length <= maxLineas) return l;
  const rec = l.slice(0, maxLineas);
  rec[maxLineas - 1] = rec[maxLineas - 1].replace(/\s+\S*$/, "") + "…";
  return rec;
}

function precioTexto(p: CatProd, modo: CatOpts["precios"]): string | null {
  if (modo === "no") return null;
  if (modo === "miembro" && p.mem) return rango(p.mem[0], p.mem[1]);
  return rango(p.pub[0], p.pub[1]);
}

/* ---------- secciones ---------- */
type Grupo = { seccion: string; items: { p: CatProd; idx: number }[] };

// Agrupa respetando el orden en que aparecen las secciones en la selección.
function agrupa(prods: CatProd[]): Grupo[] {
  const out: Grupo[] = [];
  prods.forEach((p, idx) => {
    const sec = p.seccion || p.categoria || "Catálogo";
    let g = out.find((x) => x.seccion === sec);
    if (!g) { g = { seccion: sec, items: [] }; out.push(g); }
    g.items.push({ p, idx });
  });
  return out;
}

/* ---------- PDF ---------- */
export async function pdfCatalogo(opts: CatOpts): Promise<void> {
  const { doc, nombre, base } = await armaCatalogo(opts);
  /* ----- guardar / compartir ----- */
  const esMovil = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent || "");
  const blob = doc.output("blob");
  const file = new File([blob], nombre, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (esMovil && nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: base } as ShareData); return; } catch { /* pasa a descarga */ }
  }
  doc.save(nombre);
}

// Arma el documento (sin guardarlo). Separado para poder verlo en pantalla al diseñarlo.
export async function armaCatalogo(opts: CatOpts): Promise<{ doc: jsPDF; nombre: string; base: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const hoy = new Date();
  const tienda = limpia(opts.tienda || "");
  const contacto = limpia(opts.contacto || "");
  opts = {
    ...opts,
    contacto,
    productos: opts.productos.map((p) => ({
      ...p,
      nombre: limpia(p.nombre),
      seccion: limpia(p.seccion),
      categoria: limpia(p.categoria),
      descripcion: limpia(p.descripcion),
      medidas: p.medidas.map(limpia),
      colores: p.colores.map((c) => ({ ...c, nombre: limpia(c.nombre) })),
    })),
  };
  const logo = opts.marca ? await cargarLogo() : null;
  const grupos = agrupa(opts.productos);

  // cuántas fotos vamos a necesitar (para la barra de avance)
  const total = opts.layout === "compacto"
    ? opts.productos.length
    : opts.productos.reduce((s, p) => s + 1 + Math.min(p.colores.length, 48), 0);
  let hechas = 0;
  const avisa = () => opts.onProgress?.(++hechas, total);

  /* ----- portada: mosaico de fotos + título (10-oct-2026, la anterior era un rectángulo vacío) ----- */
  if (opts.portada) {
    doc.setFillColor(...NAVY).rect(0, 0, W, H, "F");
    // Mosaico: hasta 6 fotos de los propios productos, arriba, a sangre.
    const conFoto = opts.productos.filter((p) => p.image).slice(0, 6);
    const mw = (W - 2 * 10 - 2 * 4) / 3;          // 3 columnas con 4mm de aire
    const filas = conFoto.length > 3 ? 2 : 1;
    const my0 = 16;
    for (let i = 0; i < conFoto.length; i++) {
      const im = await foto(conFoto[i].image, 620);
      const fx = 10 + (i % 3) * (mw + 4);
      const fy = my0 + Math.floor(i / 3) * (mw + 4);
      if (im) doc.addImage(im, "JPEG", fx, fy, mw, mw);
    }
    const yTitulo = my0 + filas * (mw + 4) + 26;

    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(150, 180, 215);
    doc.text("CATÁLOGO", W / 2, yTitulo - 12, { align: "center", charSpace: 2.2 });
    doc.setFont("helvetica", "bold").setFontSize(30).setTextColor(255, 255, 255);
    const t = corta(doc, tienda || "Blancos y Decoración", W - 44, 2);
    doc.text(t, W / 2, yTitulo, { align: "center" });

    const yReg = yTitulo + t.length * 10 + 2;
    doc.setDrawColor(150, 180, 215).setLineWidth(0.6).line(W / 2 - 18, yReg, W / 2 + 18, yReg);

    doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(185, 208, 232);
    doc.text(`${opts.productos.length} ${opts.productos.length === 1 ? "producto" : "productos"}   ·   ${fechaLarga(hoy)}`,
      W / 2, yReg + 11, { align: "center" });

    if (opts.contacto) {
      doc.setFillColor(255, 255, 255).roundedRect(W / 2 - 42, H - 38, 84, 14, 7, 7, "F");
      doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...NAVY);
      doc.text(opts.contacto, W / 2, H - 28.6, { align: "center" });
    }
    if (logo) {
      const pr = doc.getImageProperties(logo);
      const h = 14, w = (pr.width / pr.height) * h;
      doc.addImage(logo, "PNG", (W - w) / 2, H - (opts.contacto ? 60 : 44), w, h);
    }
    doc.addPage();
  }

  /* ----- índice: se APARTAN las hojas aquí y se escriben al final, cuando ya sabemos ----- */
  /*       en qué hoja cayó cada producto. El plan se calcula antes para apartar las justas. */
  const plan = opts.indice ? planIndice(grupos, H) : null;
  let idxHoja1 = 0;
  if (plan) {
    idxHoja1 = doc.getCurrentPageInfo().pageNumber;
    for (let k = 1; k < plan.length; k++) doc.addPage();
    doc.addPage(); // primera hoja del contenido
  }

  /* ----- cuerpo ----- */
  const paginaDe = new Array<number>(opts.productos.length).fill(0);

  if (opts.layout === "revista") {
    await cuerpoRevista(doc, W, H, grupos, opts, paginaDe, avisa);
  } else if (opts.layout === "detallado") {
    let primera = true;
    for (const g of grupos) {
      for (const it of g.items) {
        if (!primera) doc.addPage();
        primera = false;
        paginaDe[it.idx] = doc.getCurrentPageInfo().pageNumber;
        await hojaDetallada(doc, W, H, it.p, opts, avisa);
      }
    }
  } else {
    // 2 por renglón. La foto es del ancho completo de la tarjeta (antes sobraba hoja en blanco).
    const cols = 2;
    const gutX = 8, gutY = 10;
    const topY = 22, botY = 16;
    const cardW = (W - 2 * M - gutX) / cols;
    const textoH = opts.precios === "no" ? 18 : 25;
    const cardH = cardW + textoH;
    const porHoja = Math.max(1, Math.floor((H - topY - botY + gutY) / (cardH + gutY))) * cols;
    for (let i = 0; i < opts.productos.length; i++) {
      const slot = i % porHoja;
      if (i > 0 && slot === 0) doc.addPage();
      // cuántos renglones trae ESTA hoja (la última puede venir a medias): se centra lo que haya
      const enHoja = Math.min(porHoja, opts.productos.length - (i - slot));
      const filas = Math.ceil(enHoja / cols);
      const alto = filas * cardH + (filas - 1) * gutY;
      const y0 = topY + Math.max(0, (H - topY - botY - alto) / 2);
      const cx = M + (slot % cols) * (cardW + gutX);
      const cy = y0 + Math.floor(slot / cols) * (cardH + gutY);
      paginaDe[i] = doc.getCurrentPageInfo().pageNumber;
      await tarjeta(doc, cx, cy, cardW, cardH, opts.productos[i], opts, avisa);
    }
  }

  /* ----- encabezado y pie en todas las hojas (menos la portada) ----- */
  const paginas = doc.getNumberOfPages();
  const desde = opts.portada ? 2 : 1;
  for (let p = desde; p <= paginas; p++) {
    doc.setPage(p);
    // encabezado
    if (logo) {
      const pr = doc.getImageProperties(logo);
      const h = 8, w = (pr.width / pr.height) * h;
      doc.addImage(logo, "PNG", M, 6, w, h);
    } else if (tienda) {
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY).text(tienda, M, 12);
    }
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS);
    doc.text("Catálogo · " + fechaLarga(hoy), W - M, 12, { align: "right" });
    doc.setDrawColor(...GRIS_SUAVE).setLineWidth(0.3).line(M, 15, W - M, 15);
    // pie
    doc.setDrawColor(...GRIS_SUAVE).line(M, H - 11, W - M, H - 11);
    doc.setFontSize(8).setTextColor(...GRIS);
    const pie = opts.marca
      ? "Aurora · Blancos y Decoración" + (opts.contacto ? "   ·   " + opts.contacto : "")
      : [tienda, opts.contacto].filter(Boolean).join("   ·   ");
    if (pie) doc.text(pie, M, H - 6);
    doc.text(`${p - desde + 1} / ${paginas - desde + 1}`, W - M, H - 6, { align: "right" });
  }

  /* ----- ya con los números, se escribe el índice en las hojas apartadas ----- */
  if (plan) dibujaIndice(doc, W, H, plan, paginaDe, idxHoja1, desde);

  const base = tienda ? "Catalogo " + tienda : opts.marca ? "Catalogo Aurora" : "Catalogo";
  const nombre = (base + " " + hoy.toLocaleDateString("es-MX")).replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) + ".pdf";
  return { doc, nombre, base };
}

/* ====================== formato revista (media hoja por producto) ====================== */

const TOP = 20;          // donde empieza el contenido (debajo del encabezado)
const BOT = 15;          // aire antes del pie
const BANDA = 10;        // alto de la banda de sección
const GAP = 7;           // aire entre bloques
const PAD = 5.5;         // margen interno del bloque
const FOTO_MIN = 42;     // la foto principal nunca baja de esto

type PlanBloque = {
  cols: number; tw: number; rh: number; filas: number;
  colH: number; fotoW: number; muestra: number; alto: number; headH: number;
};

// Busca el mejor acomodo de la tira de colores: primero que quepan TODOS,
// luego que las fotitos salgan lo más grandes posible.
function planBloque(doc: jsPDF, iw: number, dispo: number, p: CatProd, headH: number): PlanBloque {
  const n = p.colores.length;
  const gut = 3;
  const base = { cols: 0, tw: 0, rh: 0, filas: 0, colH: 0, fotoW: 0, muestra: 0, alto: 0, headH };
  if (n <= 1) {
    const fotoW = Math.max(FOTO_MIN, Math.min(dispo, iw * 0.52, 92));
    return { ...base, fotoW, alto: headH + fotoW + PAD };
  }
  let best: PlanBloque | null = null;
  for (let cols = 6; cols <= 10; cols++) {
    const tw = (iw - (cols - 1) * gut) / cols;
    const rh = tw + 5.2;
    for (let filas = Math.ceil(n / cols); filas >= 1; filas--) {
      const colH = 7 + filas * rh;
      const fotoW = Math.min(dispo - colH, iw * 0.52, 92);
      if (fotoW < FOTO_MIN) continue;
      const muestra = Math.min(n, filas * cols);
      const cand: PlanBloque = { cols, tw, rh, filas, colH, fotoW, muestra, headH, alto: headH + fotoW + colH + PAD };
      if (!best || muestra > best.muestra || (muestra === best.muestra && tw > best.tw)) best = cand;
    }
  }
  if (!best) {
    const fotoW = Math.max(FOTO_MIN, Math.min(dispo, iw * 0.52, 92));
    best = { ...base, fotoW, alto: headH + fotoW + PAD };
  }
  void doc;
  return best;
}

function altoEncabezado(doc: jsPDF, iw: number, p: CatProd): number {
  doc.setFont("helvetica", "bold").setFontSize(15);
  const n = corta(doc, p.nombre, iw - 44, 2).length;
  return PAD + 4.2 + 7.2 * n + 3.5;
}

async function cuerpoRevista(
  doc: jsPDF, W: number, H: number, grupos: Grupo[], opts: CatOpts,
  paginaDe: number[], avisa: () => void,
) {
  const w = W - 2 * M;
  const iw = w - 2 * PAD;
  // Cada hoja lleva su banda de sección arriba, así que el espacio útil es siempre el mismo.
  const dispoHoja = H - BOT - (TOP + BANDA + 4);
  const altoMedia = (dispoHoja - GAP) / 2;

  let primeraHoja = true;
  for (const g of grupos) {
    let y = 0;
    const nuevaHoja = () => {
      if (!primeraHoja) doc.addPage();
      primeraHoja = false;
      bandaSeccion(doc, W, TOP, g.seccion);
      y = TOP + BANDA + 4;
    };
    nuevaHoja();

    const yIni = TOP + BANDA + 4;
    for (let k = 0; k < g.items.length; k++) {
      const it = g.items[k];
      const headH = altoEncabezado(doc, iw, it.p);
      const media = planBloque(doc, iw, altoMedia - headH - PAD, it.p, headH);
      const cabe = media.muestra >= it.p.colores.length;
      let pl = media;
      let h = altoMedia;
      if (!cabe) {
        // muchos colores: se le da lo que necesite (hasta la hoja completa)
        pl = planBloque(doc, iw, dispoHoja - headH - PAD, it.p, headH);
        h = Math.min(Math.max(pl.alto, altoMedia), dispoHoja);
      }
      if (h > H - BOT - y + 0.5) nuevaHoja();
      // si es el último de la sección y le tocó hoja solo, se centra (si no, queda un hueco feo)
      if (k === g.items.length - 1 && Math.abs(y - yIni) < 0.1 && h < dispoHoja - 20) y += (dispoHoja - h) / 2;
      paginaDe[it.idx] = doc.getCurrentPageInfo().pageNumber;
      await bloqueRevista(doc, M, y, w, h, pl, it.p, opts, avisa);
      y += h + GAP;
    }
  }
}

function bandaSeccion(doc: jsPDF, W: number, y: number, titulo: string) {
  doc.setFillColor(...NAVY).roundedRect(M, y, W - 2 * M, BANDA, 1.8, 1.8, "F");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
  doc.text((titulo || "Catálogo").toUpperCase(), M + 5, y + 6.7, { charSpace: 1.1 });
}

async function bloqueRevista(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  pl: PlanBloque, p: CatProd, opts: CatOpts, avisa: () => void,
) {
  const iw = w - 2 * PAD;
  // marco de la tarjeta
  doc.setDrawColor(...GRIS_SUAVE).setLineWidth(0.3).roundedRect(x, y, w, h, 2, 2, "S");

  /* --- encabezado: categoría, nombre y (si se pidió) el precio a la derecha --- */
  doc.setFont("helvetica", "normal").setFontSize(7.4).setTextColor(...GRIS);
  doc.text(p.categoria.toUpperCase(), x + PAD, y + PAD + 3, { charSpace: 0.4 });
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...NAVY);
  const nom = corta(doc, p.nombre, iw - 44, 2);
  doc.text(nom, x + PAD, y + PAD + 10.6);

  const pr = precioTexto(p, opts.precios);
  if (pr) {
    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...NAVY);
    doc.text(pr, x + w - PAD, y + PAD + 10, { align: "right" });
    if (opts.precios === "miembro") {
      doc.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(...GRIS);
      doc.text("precio de miembro", x + w - PAD, y + PAD + 14, { align: "right" });
    }
  }

  const yTop = y + pl.headH;
  doc.setDrawColor(...GRIS_SUAVE).setLineWidth(0.2).line(x + PAD, yTop - 2.5, x + w - PAD, yTop - 2.5);

  /* --- foto principal + datos a la derecha --- */
  const fw = pl.fotoW;
  const img = await foto(p.image, 820);
  avisa();
  if (img) doc.addImage(img, "JPEG", x + PAD, yTop, fw, fw);
  else {
    doc.setFillColor(246, 248, 251).rect(x + PAD, yTop, fw, fw, "F");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS)
      .text("sin foto", x + PAD + fw / 2, yTop + fw / 2, { align: "center" });
  }
  doc.setDrawColor(...GRIS_SUAVE).setLineWidth(0.2).rect(x + PAD, yTop, fw, fw, "S");

  const ix = x + PAD + fw + 7;
  const iwInfo = x + w - PAD - ix;
  let iy = yTop + 4;

  const dato = (titulo: string, lineas: string[], tam = 9) => {
    doc.setFont("helvetica", "bold").setFontSize(7.6).setTextColor(...NEGRO_SUAVE);
    doc.text(titulo.toUpperCase(), ix, iy, { charSpace: 0.5 });
    iy += 4.4;
    doc.setFont("helvetica", "normal").setFontSize(tam).setTextColor(...GRIS);
    doc.text(lineas, ix, iy);
    iy += lineas.length * (tam * 0.46) + 3.4;
  };

  if (p.medidas.length) dato("Medidas", corta(doc, p.medidas.join("  ·  "), iwInfo, 3), 9);
  if (p.colores.length > 1) {
    dato("Colores", [`${p.colores.length} opciones`], 9);
  }
  if (p.descripcion) {
    const limpio = p.descripcion.replace(/\*\*/g, "").replace(/\r/g, "");
    const cabenLineas = Math.max(1, Math.floor((yTop + fw - iy - 2) / 4));
    if (cabenLineas >= 2) {
      doc.setFont("helvetica", "normal").setFontSize(8.4).setTextColor(...GRIS);
      doc.text(corta(doc, limpio, iwInfo, cabenLineas), ix, iy);
    }
  }

  /* --- tira de colores con su fotito --- */
  if (pl.filas > 0) {
    let cy = yTop + fw + 6.4;
    doc.setFont("helvetica", "bold").setFontSize(7.6).setTextColor(...NEGRO_SUAVE);
    doc.text("COLORES Y MODELOS", x + PAD, cy - 1.6, { charSpace: 0.5 });
    if (pl.muestra < p.colores.length) {
      doc.setFont("helvetica", "normal").setFontSize(7.4).setTextColor(...GRIS);
      doc.text(`y ${p.colores.length - pl.muestra} más, pregunta por ellos`, x + w - PAD, cy - 1.6, { align: "right" });
    }
    cy += 2.4;
    for (let i = 0; i < pl.muestra; i++) {
      const tx = x + PAD + (i % pl.cols) * (pl.tw + 3);
      const ty = cy + Math.floor(i / pl.cols) * pl.rh;
      const t = await foto(p.colores[i].image, 340);
      avisa();
      if (t) doc.addImage(t, "JPEG", tx, ty, pl.tw, pl.tw);
      else doc.setFillColor(246, 248, 251).rect(tx, ty, pl.tw, pl.tw, "F");
      doc.setDrawColor(...GRIS_SUAVE).setLineWidth(0.2).rect(tx, ty, pl.tw, pl.tw, "S");
      doc.setFont("helvetica", "normal").setFontSize(pl.tw < 18 ? 5.9 : 6.8).setTextColor(...NEGRO_SUAVE);
      doc.text(corta(doc, p.colores[i].nombre, pl.tw + 2, 1), tx + pl.tw / 2, ty + pl.tw + 3.2, { align: "center" });
    }
  }
}

/* ====================== índice ====================== */

type IdxLinea = { tipo: "sec" | "prod" | "gap"; texto: string; idx?: number };
const IDX_Y = 34;        // donde empieza la primera línea
const IDX_LH = 5.6;      // alto de renglón

function planIndice(grupos: Grupo[], H: number): IdxLinea[][][] {
  const porCol = Math.max(8, Math.floor((H - IDX_Y - 20) / IDX_LH));
  const cols: IdxLinea[][] = [];
  let cur: IdxLinea[] = [];
  const cierra = () => { cols.push(cur); cur = []; };
  for (const g of grupos) {
    // que el título de la sección no quede huérfano al final de la columna
    if (cur.length && cur.length + 3 > porCol) cierra();
    if (cur.length) cur.push({ tipo: "gap", texto: "" });
    cur.push({ tipo: "sec", texto: g.seccion });
    for (const it of g.items) {
      if (cur.length >= porCol) cierra();
      cur.push({ tipo: "prod", texto: it.p.nombre, idx: it.idx });
    }
  }
  if (cur.length) cierra();
  const paginas: IdxLinea[][][] = [];
  for (let i = 0; i < cols.length; i += 2) paginas.push([cols[i], cols[i + 1] || []]);
  return paginas.length ? paginas : [[[], []]];
}

function dibujaIndice(
  doc: jsPDF, W: number, H: number, plan: IdxLinea[][][],
  paginaDe: number[], hoja1: number, desde: number,
) {
  const unaCol = plan.length === 1 && plan[0][1].length === 0;
  const colW = unaCol ? W - 2 * M : (W - 2 * M - 10) / 2;
  for (let k = 0; k < plan.length; k++) {
    doc.setPage(hoja1 + k);
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...NAVY);
    doc.text(k === 0 ? "Índice" : "Índice (continúa)", M, 27);
    doc.setDrawColor(...GRIS_SUAVE).setLineWidth(0.4).line(M, 30, W - M, 30);
    for (let c = 0; c < (unaCol ? 1 : 2); c++) {
      const cx = M + c * (colW + 10);
      let y = IDX_Y + 4;
      for (const l of plan[k][c]) {
        if (l.tipo === "gap") { y += IDX_LH; continue; }
        if (l.tipo === "sec") {
          doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY);
          doc.text(l.texto.toUpperCase(), cx, y, { charSpace: 0.6 });
          doc.setDrawColor(...NAVY).setLineWidth(0.3).line(cx, y + 1.6, cx + colW, y + 1.6);
          y += IDX_LH;
          continue;
        }
        const hoja = l.idx != null ? paginaDe[l.idx] - desde + 1 : 0;
        const num = hoja > 0 ? String(hoja) : "";
        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...NEGRO_SUAVE);
        const nombre = corta(doc, l.texto, colW - 12, 1);
        doc.text(nombre, cx, y);
        if (num) {
          doc.setTextColor(...GRIS);
          doc.text(num, cx + colW, y, { align: "right" });
        }
        y += IDX_LH;
      }
    }
  }
}

/* ---------- tarjeta compacta (10-oct-2026: foto a todo lo ancho y nombre más grande) ---------- */
async function tarjeta(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  p: CatProd, opts: CatOpts, avisa: () => void,
) {
  const img = await foto(p.image, 700);
  avisa();
  // La foto ocupa TODO el ancho de la tarjeta; el texto va debajo, sobre blanco.
  if (img) doc.addImage(img, "JPEG", x, y, w, w);
  else {
    doc.setFillColor(246, 248, 251).rect(x, y, w, w, "F");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS)
       .text("sin foto", x + w / 2, y + w / 2, { align: "center" });
  }
  // marco delgado alrededor de toda la tarjeta
  doc.setDrawColor(...GRIS_SUAVE).setLineWidth(0.3).rect(x, y, w, h, "S");
  doc.line(x, y + w, x + w, y + w);

  const padd = 4;
  const fw = w - 2 * padd;
  let ty = y + w + 6.5;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NEGRO_SUAVE);
  const nom = corta(doc, p.nombre, fw, 2);
  doc.text(nom, x + padd, ty);
  ty += nom.length * 4.8 + 0.5;

  doc.setFont("helvetica", "normal").setFontSize(7.6).setTextColor(...GRIS);
  const det: string[] = [];
  if (p.medidas.length) det.push(p.medidas.join(" · "));
  det.push(p.colores.length === 1 ? "1 modelo" : p.colores.length + " colores");
  doc.text(corta(doc, det.join("   ·   "), fw, 1), x + padd, ty + 2.6);

  const pr = precioTexto(p, opts.precios);
  if (pr) {
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...NAVY);
    doc.text(pr, x + padd, ty + 10);
  }
}

/* ---------- hoja detallada (1 por hoja, con todos los colores) ---------- */
async function hojaDetallada(
  doc: jsPDF, W: number, H: number,
  p: CatProd, opts: CatOpts, avisa: () => void,
) {
  let y = 24;
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRIS);
  doc.text(p.categoria.toUpperCase(), M, y);
  y += 6;
  doc.setFont("helvetica", "bold").setFontSize(19).setTextColor(...NAVY);
  const nom = corta(doc, p.nombre, W - 2 * M, 2);
  doc.text(nom, M, y);
  y += nom.length * 8 + 2;

  const fotoW = 86;
  const infoX = M + fotoW + 8;
  const infoW = W - M - infoX;
  const img = await foto(p.image, 820);
  avisa();
  if (img) doc.addImage(img, "JPEG", M, y, fotoW, fotoW);
  else { doc.setFillColor(245, 247, 250).rect(M, y, fotoW, fotoW, "F"); }

  let iy = y + 5;
  if (p.medidas.length) {
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NEGRO_SUAVE).text("Medidas", infoX, iy);
    iy += 4.6;
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...GRIS);
    const l = corta(doc, p.medidas.join(", "), infoW, 3);
    doc.text(l, infoX, iy); iy += l.length * 4.8 + 3;
  }
  const pr = precioTexto(p, opts.precios);
  if (pr) {
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NEGRO_SUAVE).text("Precio", infoX, iy);
    iy += 6.5;
    doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...NAVY).text(pr, infoX, iy);
    iy += 7;
  }
  if (p.descripcion) {
    doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...GRIS);
    const limpio = p.descripcion.replace(/\*\*/g, "").replace(/\r/g, "");
    const lineas = corta(doc, limpio, infoW, Math.max(2, Math.floor((y + fotoW - iy) / 4.2)));
    doc.text(lineas, infoX, iy);
  }
  y += fotoW + 10;

  // rejilla de colores
  const vis = p.colores.slice(0, 15);
  if (vis.length > 1) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...NEGRO_SUAVE);
    doc.text(`Colores y modelos (${p.colores.length})`, M, y);
    y += 5;
    const cols = 5, gut = 4;
    const tw = (W - 2 * M - (cols - 1) * gut) / cols;
    for (let i = 0; i < vis.length; i++) {
      const cx = M + (i % cols) * (tw + gut);
      const cy = y + Math.floor(i / cols) * (tw + 9);
      if (cy + tw + 9 > H - 14) break;
      const t = await foto(vis[i].image, 300);
      avisa();
      if (t) doc.addImage(t, "JPEG", cx, cy, tw, tw);
      else {
        doc.setFillColor(245, 247, 250).rect(cx, cy, tw, tw, "F");
        doc.setDrawColor(...GRIS_SUAVE).setLineWidth(0.2).rect(cx, cy, tw, tw, "S");
      }
      doc.setFont("helvetica", "normal").setFontSize(7.2).setTextColor(...NEGRO_SUAVE);
      doc.text(corta(doc, vis[i].nombre, tw, 1), cx + tw / 2, cy + tw + 3.6, { align: "center" });
    }
    if (p.colores.length > vis.length) {
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS);
      doc.text(`+ ${p.colores.length - vis.length} colores más`, M, Math.min(H - 16, y + Math.ceil(vis.length / 5) * (tw + 9) + 2));
    }
  }
}
