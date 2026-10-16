// Tema del catálogo (solo el normal, en naranja).
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

const SECS_FULL = ["bano", "cocina-y-mesa", "cortinas", "decoracion", "liquidacion", "novedades", "recamara", "sala"];

export const TEMAS: Tema[] = [
  {
    id: "ninguno", label: "Normal", emoji: "🧡",
    vars: {
      "--color-aurora": "#f97316", "--color-aurora-dark": "#c2410c",
      "--color-aurora-deep": "#7c2d12", "--color-aurora-light": "#fff1e6", "--color-cream": "#fffdfb",
    },
    hero: "/temas/normal/hero.jpg", logo: "/temas/normal/logo.png",
    secDir: "/temas/normal/sec", secSet: SECS_FULL,
    swatch: ["#7c2d12", "#f97316"], caen: [], ocultaTemp: ["halloween", "navidad"],
  },
];

export function getTema(id: string | null | undefined): Tema {
  return TEMAS.find((t) => t.id === id) || TEMAS[0];
}
