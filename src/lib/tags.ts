// Etiquetas de TEMPORADA (product.tag en Odoo). Marcan un producto como de Navidad/Halloween
// INDEPENDIENTEMENTE de su categoría — así un producto de cualquier catálogo (blancos, decoración…)
// puede aparecer además en su sección de temporada. Rosy las marca desde /subir.
export const TAG_NAVIDAD = 2;
export const TAG_HALLOWEEN = 3;

export type Temporada = { id: string; tagId: number; emoji: string };
// El orden aquí es el orden en que salen las secciones en el catálogo.
export const TEMPORADAS: Temporada[] = [
  { id: "Navidad", tagId: TAG_NAVIDAD, emoji: "🎄" },
  { id: "Halloween", tagId: TAG_HALLOWEEN, emoji: "🎃" },
];
