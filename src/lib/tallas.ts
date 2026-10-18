// Guía de tallas, sucursales y políticas de envío de BAM! (datos de ejemplo para la demo).
// El chatbot y la ficha del producto leen de aquí, así que hay una sola verdad.

export type Talla = "XS" | "S" | "M" | "L" | "XL";
export const TALLAS: Talla[] = ["XS", "S", "M", "L", "XL"];

// Medidas del CUERPO en cm (rangos) y de la PRENDA oversize ya puesta sobre la mesa.
export const GUIA: Record<Talla, { pecho: [number, number]; cintura: [number, number]; altura: [number, number]; ancho: number; largo: number }> = {
  XS: { pecho: [80, 88],  cintura: [64, 72],  altura: [150, 162], ancho: 56, largo: 66 },
  S:  { pecho: [88, 96],  cintura: [72, 80],  altura: [160, 170], ancho: 59, largo: 69 },
  M:  { pecho: [96, 104], cintura: [80, 88],  altura: [168, 178], ancho: 62, largo: 72 },
  L:  { pecho: [104, 112], cintura: [88, 96], altura: [176, 186], ancho: 65, largo: 75 },
  XL: { pecho: [112, 122], cintura: [96, 106], altura: [184, 196], ancho: 68, largo: 78 },
};

export type Ajuste = "oversize" | "ajustado";

// Recomienda talla con las medidas que haya (pecho manda; si no hay, altura y peso aproximan).
export type Prenda = "playera" | "sudadera" | "pantalon";
export function recomendarTalla(m: { pecho?: number; cintura?: number; altura?: number; peso?: number; ajuste?: Ajuste; prenda?: Prenda }): {
  talla: Talla; alternativa: Talla | null; porque: string; faltan: string[];
} {
  const ajuste = m.ajuste || "oversize";
  let idx = -1; let porque = "";
  if (m.prenda === "pantalon" && m.cintura && m.cintura > 40) {
    const i = TALLAS.findIndex((t) => m.cintura! <= GUIA[t].cintura[1]);
    idx = i === -1 ? TALLAS.length - 1 : i;
    porque = `tu cintura de ${m.cintura} cm cae en la talla ${TALLAS[idx]} (${GUIA[TALLAS[idx]].cintura[0]}–${GUIA[TALLAS[idx]].cintura[1]} cm)`;
  } else if (m.pecho && m.pecho > 40) {
    const i = TALLAS.findIndex((t) => m.pecho! <= GUIA[t].pecho[1]);
    idx = i === -1 ? TALLAS.length - 1 : i;
    porque = `tu pecho de ${m.pecho} cm cae en la talla ${TALLAS[idx]} (${GUIA[TALLAS[idx]].pecho[0]}–${GUIA[TALLAS[idx]].pecho[1]} cm)`;
  } else if (m.altura && m.altura > 100) {
    const i = TALLAS.findIndex((t) => m.altura! <= GUIA[t].altura[1]);
    idx = i === -1 ? TALLAS.length - 1 : i;
    porque = `por tu altura de ${m.altura} cm`;
    if (m.peso && m.peso > 30) {
      const imc = m.peso / Math.pow(m.altura / 100, 2);
      if (imc >= 27 && idx < TALLAS.length - 1) idx += 1;
      if (imc <= 19 && idx > 0) idx -= 1;
      porque += ` y tu peso de ${m.peso} kg`;
    }
  } else if (m.cintura && m.cintura > 40) {
    const i = TALLAS.findIndex((t) => m.cintura! <= GUIA[t].cintura[1]);
    idx = i === -1 ? TALLAS.length - 1 : i;
    porque = `por tu cintura de ${m.cintura} cm`;
  }
  if (idx === -1) return { talla: "M", alternativa: null, porque: "", faltan: ["pecho (cm)", "o altura (cm) y peso (kg)"] };
  const talla = TALLAS[idx];
  // Las playeras BAM! son oversize: tu talla de siempre da el corte holgado de la foto.
  // Si la quieres más pegada, baja una talla; si la quieres MUY holgada, sube una.
  const alt = ajuste === "ajustado" ? TALLAS[Math.max(0, idx - 1)] : TALLAS[Math.min(TALLAS.length - 1, idx + 1)];
  return { talla, alternativa: alt === talla ? null : alt, porque, faltan: [] };
}

export const SUCURSALES = [
  { id: "cdmx", nombre: "BAM! Roma Norte", ciudad: "Ciudad de México", direccion: "Calle de ejemplo 123, Col. Roma Norte", horario: "Lun–Sáb 11:00–20:00" },
  { id: "gdl", nombre: "BAM! Providencia", ciudad: "Guadalajara", direccion: "Av. de ejemplo 456, Providencia", horario: "Lun–Sáb 11:00–20:00" },
  { id: "mty", nombre: "BAM! San Pedro", ciudad: "Monterrey", direccion: "Calzada de ejemplo 789, San Pedro Garza García", horario: "Lun–Dom 12:00–21:00" },
] as const;
export type SucursalId = (typeof SUCURSALES)[number]["id"];

export const ENVIOS = {
  gratisDesde: 999,
  costo: 99,
  dias: "3 a 5 días hábiles a todo México",
  expres: { costo: 189, dias: "1 a 2 días hábiles (CDMX, Guadalajara y Monterrey)" },
  recoger: "Gratis en cualquier sucursal; te avisamos por WhatsApp en cuanto esté lista (normalmente el mismo día).",
  cambios: "Cambios de talla gratis dentro de 15 días, con la prenda sin usar y con etiqueta.",
  pago: "Tarjeta, transferencia, depósito o efectivo en sucursal.",
};
