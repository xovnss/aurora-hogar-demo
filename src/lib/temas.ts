// Temas de temporada para el catálogo de clientes.
// Cada tema recolorea TODO el catálogo (botones, encabezado, logo, secciones…) y
// cambia el hero (portada grande), el logo y las portadas de cada sección por
// imágenes hechas a la medida de la temporada. Rosy elige el tema en /subir.

export type Tema = {
  id: string;
  label: string;
  emoji: string; // para el botón en /subir
  // Overrides de variables CSS (recolorean todo lo que usa aurora / aurora-deep, etc.)
  vars: Record<string, string>;
  hero: string; // portada grande (con el texto ya incluido en la imagen)
  logo: string; // logo Aurora en el color del tema
  secDir: string; // carpeta de portadas de sección
  secSet: string[]; // slugs de sección que existen para este tema
  swatch: [string, string]; // degradado del botón de este tema en /subir
  caen: string[]; // decoración que cae por la pantalla ([] = ninguna)
  ocultaTemp: string[]; // secciones de temporada a ocultar en este tema ("navidad"/"halloween")
};

// Sección del catálogo → nombre de archivo de su portada.
const SEC_SLUG: Record<string, string> = {
  "Recámara": "recamara",
  "Baño": "bano",
  "Cortinas": "cortinas",
  "Cocina y Mesa": "cocina-y-mesa",
  "Sala": "sala",
  "Decoración": "decoracion",
  "Novedades": "novedades",
  "Liquidación": "liquidacion",
  "Navidad": "navidad",
  "Halloween": "halloween",
};

// URL de la portada de una sección para el tema (o null si no hay).
export function secImgTema(t: Tema, sectionId: string): string | null {
  const slug = SEC_SLUG[sectionId];
  if (!slug || !t.secSet.includes(slug)) return null;
  return `${t.secDir}/${slug}.jpg`;
}

const SECS_FULL = ["bano", "cocina-y-mesa", "cortinas", "decoracion", "halloween", "liquidacion", "navidad", "novedades", "recamara", "sala"];

export const TEMAS: Tema[] = [
  {
    id: "ninguno", label: "Normal", emoji: "🩵",
    vars: {
      "--color-aurora": "#5ba3dc", "--color-aurora-dark": "#2e6da4",
      "--color-aurora-deep": "#0e2650", "--color-aurora-light": "#eaf4fb", "--color-cream": "#fbfdff",
    },
    hero: "/temas/normal/hero.jpg", logo: "/temas/normal/logo.png",
    secDir: "/temas/normal/sec", secSet: SECS_FULL,
    swatch: ["#0e2650", "#5ba3dc"], caen: [], ocultaTemp: [],
  },
  {
    id: "inauguracion", label: "Inauguración", emoji: "🎉",
    vars: {
      "--color-aurora": "#2f5fd0", "--color-aurora-dark": "#1e40af",
      "--color-aurora-deep": "#14307a", "--color-aurora-light": "#e8edfb", "--color-cream": "#f5f8ff",
    },
    hero: "/temas/inauguracion/hero.jpg", logo: "/temas/inauguracion/logo.png",
    secDir: "/temas/inauguracion/sec", secSet: SECS_FULL,
    swatch: ["#1e40af", "#c9a227"], caen: ["✨"], ocultaTemp: [],
  },
  {
    id: "halloween", label: "Halloween", emoji: "🎃",
    vars: {
      "--color-aurora": "#d2691e", "--color-aurora-dark": "#a8511a",
      "--color-aurora-deep": "#3f2a1d", "--color-aurora-light": "#fceee1", "--color-cream": "#fbf6f1",
    },
    hero: "/temas/halloween/hero.jpg", logo: "/temas/halloween/logo.png",
    // Octubre: Ximena pidió (3-oct-2026) que la sección de Navidad SÍ salga en el tema de
    // Halloween, porque la mercancía navideña ya está en piso y se vende desde octubre.
    secDir: "/temas/halloween/sec", secSet: SECS_FULL,
    swatch: ["#3f2a1d", "#d2691e"], caen: ["🦇", "🕸️"], ocultaTemp: [],
  },
  {
    id: "navidad", label: "Navidad", emoji: "🎄",
    vars: {
      "--color-aurora": "#2f7d4a", "--color-aurora-dark": "#1f5c33",
      "--color-aurora-deep": "#143d22", "--color-aurora-light": "#e7f2ea", "--color-cream": "#f4faf5",
    },
    hero: "/temas/navidad/hero.jpg", logo: "/temas/navidad/logo.png",
    secDir: "/temas/navidad/sec", secSet: SECS_FULL.filter((s) => s !== "halloween"),
    swatch: ["#143d22", "#c1121f"], caen: ["❄️"], ocultaTemp: ["halloween"],
  },
  {
    id: "madres", label: "Día de las Madres", emoji: "🌷",
    vars: {
      "--color-aurora": "#6f7d5c", "--color-aurora-dark": "#5c6a49",
      "--color-aurora-deep": "#4a5740", "--color-aurora-light": "#f7edf1", "--color-cream": "#fbf5f7",
    },
    hero: "/temas/madres/hero.jpg", logo: "/temas/madres/logo.png",
    secDir: "/temas/madres/sec", secSet: SECS_FULL,
    swatch: ["#6f7d5c", "#e7a9bf"], caen: ["🌸"], ocultaTemp: ["halloween", "navidad"],
  },
];

export function getTema(id: string | null | undefined): Tema {
  return TEMAS.find((t) => t.id === id) || TEMAS[0];
}
