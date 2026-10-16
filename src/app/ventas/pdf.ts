// Cotización FORMAL en PDF (para el cliente) — jsPDF + autotable, con la marca Aurora.
// La arma la app de fichas (/ventas) con los mismos productos/precios de la cotización.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const NAVY: [number, number, number] = [14, 38, 80];
const AZUL: [number, number, number] = [46, 109, 164];
const CIELO: [number, number, number] = [99, 164, 219];
const GRIS: [number, number, number] = [90, 116, 146];
const GRIS_CLARO: [number, number, number] = [237, 242, 248];
const ORO: [number, number, number] = [196, 151, 42];
const BLANCO: [number, number, number] = [255, 255, 255];

const M = 16; // margen mm
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-MX") + ".00";
const fechaLarga = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

const TERMINOS = [
  "Para apartar su pedido necesitamos el 50% de anticipo.",
  "Tiempo estimado de entrega: 2 a 3 semanas.",
  "Los precios incluyen IVA y no incluyen servicios de envío.",
  "No realizamos cambios por ningún motivo.",
];

let logoCache: string | null | undefined;
async function cargarLogo(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = "/aurora-logo.png"; });
    const w = 360, h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    logoCache = c.toDataURL("image/png");
  } catch { logoCache = null; }
  return logoCache;
}

export type ItemCot = { nombre: string; qty: number; precio: number; liq?: boolean };

export async function pdfCotizacion(opts: {
  cliente?: string; asesor?: string; items: ItemCot[]; total: number; whatsapp?: string;
}): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const hoy = new Date();
  const vence = new Date(hoy.getTime() + 15 * 864e5);

  // ---- Encabezado ----
  const logo = await cargarLogo();
  if (logo) {
    const p = doc.getImageProperties(logo);
    const h = 13, w = (p.width / p.height) * h;
    doc.addImage(logo, "PNG", M, 13, w, h);
  } else {
    doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...NAVY).text("AURORA", M, 22);
  }
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...NAVY).text("COTIZACIÓN", W - M, 19, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...GRIS);
  doc.text(`Fecha:  ${fechaLarga(hoy)}`, W - M, 25.5, { align: "right" });
  doc.text(`Válido hasta:  ${fechaLarga(vence)}`, W - M, 30.5, { align: "right" });
  doc.setDrawColor(...CIELO).setLineWidth(0.9).line(M, 35, W - M, 35);

  // ---- Saludo + cliente ----
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...NAVY).text("¡Su pedido está casi listo!", M, 45);
  let y = 52;
  if (opts.cliente || opts.asesor) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...GRIS);
    if (opts.cliente) { doc.setFont("helvetica", "bold").setTextColor(...AZUL).text("Cliente:", M, y); doc.setFont("helvetica", "normal").setTextColor(...NAVY).text(opts.cliente, M + 18, y); }
    if (opts.asesor) doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...GRIS).text(`Le atendió: ${opts.asesor}`, W - M, y, { align: "right" });
    y += 6;
  }

  // ---- Tabla de productos ----
  autoTable(doc, {
    startY: y + 2,
    head: [["DESCRIPCIÓN", "P. UNITARIO\n(IVA incluido)", "CANT.", "TOTAL\n(IVA incluido)"]],
    body: opts.items.map((it) => [
      it.nombre + (it.liq ? "\n(Precio de liquidación)" : ""),
      money(it.precio),
      String(it.qty),
      money(it.precio * it.qty),
    ]),
    margin: { left: M, right: M },
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: 3, textColor: NAVY, lineColor: GRIS_CLARO, lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: BLANCO, fontStyle: "bold", fontSize: 8.5, halign: "center", valign: "middle" },
    alternateRowStyles: { fillColor: [248, 251, 254] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 34 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "right", cellWidth: 36, fontStyle: "bold" },
    },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 0 && /liquidación/i.test(String(d.cell.raw))) d.cell.styles.textColor = ORO;
    },
  });
  // @ts-expect-error autotable agrega lastAutoTable al doc
  y = (doc.lastAutoTable?.finalY ?? y) + 6;

  // ---- Total ----
  if (y > H - 34) { doc.addPage(); y = 22; }
  const tw = 78, th = 12, tx = W - M - tw;
  doc.setFillColor(...NAVY).roundedRect(tx, y, tw, th, 2, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...BLANCO).text("TOTAL", tx + 6, y + 7.8);
  doc.setFontSize(14).text(money(opts.total), tx + tw - 6, y + 8.2, { align: "right" });
  y += th + 12;

  // ---- Términos ----
  if (y > H - 70) { doc.addPage(); y = 22; }
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ORO).text("TÉRMINOS", M, y);
  doc.setDrawColor(...ORO).setLineWidth(0.5).line(M, y + 2, M + 26, y + 2);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...NAVY);
  for (const t of TERMINOS) {
    doc.setFillColor(...ORO).circle(M + 1.2, y - 1.2, 0.9, "F");
    const lines = doc.splitTextToSize(t, W - 2 * M - 6) as string[];
    doc.text(lines, M + 5, y);
    y += lines.length * 5 + 2.5;
  }

  // ---- Pie (gracias + contacto) ----
  const fy = H - 22;
  doc.setDrawColor(...GRIS_CLARO).setLineWidth(0.4).line(M, fy - 4, W - M, fy - 4);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY).text("¡Gracias por cotizar con nosotros!", W / 2, fy + 2, { align: "center" });
  const tel = (opts.whatsapp || "").replace(/\D/g, "").slice(-10);
  const telFmt = tel.length === 10 ? `${tel.slice(0, 3)} ${tel.slice(3, 6)} ${tel.slice(6)}` : (opts.whatsapp || "771 330 8628");
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRIS)
    .text(`WhatsApp ${telFmt}    ·    @aurora.mx    ·    aurora.mx`, W / 2, fy + 8, { align: "center" });

  // ---- Guardar / compartir ----
  const nombre = `Cotizacion Aurora${opts.cliente ? " - " + opts.cliente.replace(/[^\w ]/g, "").trim() : ""}.pdf`.slice(0, 80);
  // En CELULAR: abrir "Compartir" (para mandarlo directo por WhatsApp).
  // En COMPUTADORA: DESCARGAR el archivo (se guarda en Descargas) — la hoja de compartir de
  // Windows no tiene opción de "guardar", por eso allá se sentía que "no dejaba descargar".
  const esMovil = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent || "");
  const blob = doc.output("blob");
  const file = new File([blob], nombre, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (esMovil && nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: "Cotización Aurora" } as ShareData); return; } catch { /* pasa a descarga */ }
  }
  doc.save(nombre);
}
