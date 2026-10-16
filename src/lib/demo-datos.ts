// Catálogo de MENTIRAS para la versión demo.
// Aquí no hay Odoo ni base de datos: todo se genera con esta semilla, así que la demo
// se puede enseñar donde sea sin exponer inventario, precios ni ventas de nadie.
// Para cambiar lo que se ve, se edita FAMILIAS y ya.
import type { Product } from "./types";

type Familia = {
  linea: string;          // prefijo del código (SKU)
  nombre: string;
  catalogo: string;       // sección: Recámara, Baño, Cortinas…
  categoria: string;      // subcategoría
  publico: number;
  socio: number;
  colores: string[];      // color o modelo
  medidas?: string[];     // códigos de medida: I, M, Q, K
  descripcion: string;
  liquidacion?: number;   // si trae, la familia sale en 🔥 Liquidación
  tags?: number[];        // 2 = Navidad
};

const M = (s: string) => s.toUpperCase();

export const FAMILIAS: Familia[] = [
  {
    linea: "SAB-ALG", nombre: "Sábana Algodón Premium", catalogo: "Recámara", categoria: "Sábanas",
    publico: 690, socio: 490, medidas: ["I", "M", "Q", "K"],
    colores: ["Blanco", "Arena", "Gris Perla", "Azul Cielo", "Rosa Palo", "Verde Salvia"],
    descripcion: "🛏️ *Sábana de algodón peinado*\n📏 *Medidas:* individual, matrimonial, queen y king.\n✨ *Detalles:* 300 hilos, tacto fresco y bordado sencillo en la vista. Incluye funda o fundas según la medida.",
  },
  {
    linea: "SAB-POL", nombre: "Sábana Polar Invierno", catalogo: "Recámara", categoria: "Sábanas",
    publico: 520, socio: 360, medidas: ["M", "Q", "K"],
    colores: ["Gris Oxford", "Vino", "Marino", "Camel"],
    descripcion: "🛏️ *Sábana polar*\n✨ *Detalles:* tela afelpada de invierno, no da toques y conserva el calor.",
  },
  {
    linea: "COL-FLO", nombre: "Colcha Floral Reversible", catalogo: "Recámara", categoria: "Colchas",
    publico: 890, socio: 650, medidas: ["M", "Q", "K"],
    colores: ["Modelo 1", "Modelo 2", "Modelo 3", "Modelo 4", "Modelo 5", "Modelo 6", "Modelo 7"],
    descripcion: "🌸 *Colcha ligera reversible*\n🎨 *Diseño:* estampado por un lado y liso por el otro, se usan los dos.\n📦 *Presentación:* colcha + 1 o 2 fundas según la medida.",
  },
  {
    linea: "COL-MAT", nombre: "Colcha Matelassé", catalogo: "Recámara", categoria: "Colchas",
    publico: 1190, socio: 850, medidas: ["Q", "K"],
    colores: ["Blanco", "Beige", "Gris", "Azul Noche"],
    descripcion: "✨ *Colcha matelassé*\n✨ *Detalles:* acolchado fino tipo hotel, cae bonito a los lados de la cama.",
  },
  {
    linea: "FRA-BOR", nombre: "Frazada con Borrega", catalogo: "Recámara", categoria: "Frazadas",
    publico: 790, socio: 590, medidas: ["M", "K"],
    colores: ["Gris", "Beige", "Rosa", "Azul", "Verde Olivo", "Chocolate"],
    descripcion: "🧸 *Frazada con borrega*\n✨ *Detalles:* una cara suave y la otra de borrega. Muy calientita, lavable en casa.",
  },
  {
    linea: "FRA-LIG", nombre: "Frazada Ligera", catalogo: "Recámara", categoria: "Frazadas",
    publico: 390, socio: 290, medidas: ["M", "K"],
    colores: ["Gris", "Marfil", "Terracota"],
    descripcion: "🌙 *Frazada ligera*\n✨ *Detalles:* para entretiempo o para poner encima de la colcha.",
    liquidacion: 199,
  },
  {
    linea: "EDR-BOR", nombre: "Edredón Borrega 5 Piezas", catalogo: "Recámara", categoria: "Edredones",
    publico: 1890, socio: 1390, medidas: ["M", "Q", "K"],
    colores: ["Modelo 1", "Modelo 2", "Modelo 3", "Modelo 4"],
    descripcion: "🛏️ *Edredón 5 piezas*\n📦 *Presentación:* edredón, sábana, sabana ajustable y 2 fundas.",
  },
  {
    linea: "COB-DOB", nombre: "Cobertor Doble Vista", catalogo: "Recámara", categoria: "Cobertores",
    publico: 980, socio: 690, medidas: ["M", "K"],
    colores: ["Gris/Plata", "Beige/Café", "Azul/Gris", "Rosa/Blanco"],
    descripcion: "❄️ *Cobertor de doble vista*\n🎨 *Diseño:* un color de cada lado.\n✨ *Detalles:* grueso, de los que pesan bonito.",
  },
  {
    linea: "ALM-ORT", nombre: "Almohada Ortopédica", catalogo: "Recámara", categoria: "Almohadas",
    publico: 299, socio: 199, medidas: ["M", "K"],
    colores: ["Blanco"],
    descripcion: "😴 *Almohada ortopédica*\n✨ *Detalles:* firmeza media, recupera su forma. Se vende por pieza.",
  },
  {
    linea: "ALM-PLU", nombre: "Almohada Tipo Pluma", catalogo: "Recámara", categoria: "Almohadas",
    publico: 390, socio: 250, medidas: ["M", "K"],
    colores: ["Blanco"],
    descripcion: "🪶 *Almohada tipo pluma*\n✨ *Detalles:* suave y mullida, para quien duerme de lado.",
  },
  {
    linea: "TOA-BAN", nombre: "Toalla de Baño Rizo", catalogo: "Baño", categoria: "Toallas",
    publico: 290, socio: 190,
    colores: ["Blanco", "Gris", "Menta", "Coral", "Mostaza", "Azul Marino"],
    descripcion: "🛁 *Toalla de rizo*\n📏 *Medida:* 70 × 140 cm.\n✨ *Detalles:* absorbente y de secado rápido.",
  },
  {
    linea: "TOA-MED", nombre: "Toalla Medio Baño", catalogo: "Baño", categoria: "Toallas",
    publico: 160, socio: 110,
    colores: ["Blanco", "Gris", "Menta", "Coral", "Mostaza"],
    descripcion: "🧼 *Toalla de manos*\n📏 *Medida:* 40 × 70 cm.",
  },
  {
    linea: "TAP-BAN", nombre: "Tapete de Baño Antiderrapante", catalogo: "Baño", categoria: "Tapetes",
    publico: 220, socio: 150,
    colores: ["Gris", "Beige", "Azul", "Rosa"],
    descripcion: "🚿 *Tapete de baño*\n✨ *Detalles:* base antiderrapante, pelo suave, se lava en lavadora.",
  },
  {
    linea: "COR-BLK", nombre: "Cortina Blackout", catalogo: "Cortinas", categoria: "Blackout",
    publico: 850, socio: 590,
    colores: ["Gris", "Arena", "Blanco", "Azul Noche", "Verde Olivo", "Vino", "Negro"],
    descripcion: "🌑 *Cortina blackout*\n📏 *Medida:* 1.40 × 2.20 m por panel.\n✨ *Detalles:* bloquea la luz y baja el calor. *El precio es por panel.*",
  },
  {
    linea: "COR-TRA", nombre: "Cortina Translúcida Bordada", catalogo: "Cortinas", categoria: "Translúcidas",
    publico: 520, socio: 350,
    colores: ["Blanco", "Marfil", "Rosa", "Gris"],
    descripcion: "🌤️ *Cortina translúcida*\n✨ *Detalles:* deja pasar la luz sin que se vea hacia adentro. Bordado discreto.",
  },
  {
    linea: "MAN-MES", nombre: "Mantel Antimanchas", catalogo: "Cocina y Mesa", categoria: "Manteles",
    publico: 450, socio: 320,
    colores: ["Beige", "Gris", "Blanco", "Verde"],
    descripcion: "🍽️ *Mantel antimanchas*\n📏 *Medida:* 1.50 × 2.20 m.\n✨ *Detalles:* el líquido resbala, se limpia con un paño.",
  },
  {
    linea: "JUE-COC", nombre: "Juego de Cocina 3 Piezas", catalogo: "Cocina y Mesa", categoria: "Cocina",
    publico: 260, socio: 180,
    colores: ["Modelo 1", "Modelo 2", "Modelo 3"],
    descripcion: "👩‍🍳 *Juego de cocina*\n📦 *Presentación:* guante, agarradera y repasador.",
  },
  {
    linea: "CUB-SAL", nombre: "Cubresala Elástico", catalogo: "Sala", categoria: "Cubresalas",
    publico: 1390, socio: 990,
    colores: ["Gris", "Chocolate", "Azul", "Vino", "Beige"],
    descripcion: "🛋️ *Cubresala elástico*\n📦 *Presentación:* juego de 3 fundas (sillón, love seat y sofá de 3 plazas).\n✨ *Detalles:* se estira y se ajusta sin herramienta.",
  },
  {
    linea: "COJ-DEC", nombre: "Cojín Decorativo", catalogo: "Sala", categoria: "Cojines",
    publico: 250, socio: 150,
    colores: ["Beige", "Gris", "Mostaza", "Verde", "Terracota", "Negro", "Blanco"],
    descripcion: "🛋️ *Cojín decorativo*\n📏 *Medida:* 45 × 45 cm.\n📦 *Presentación:* incluye relleno.",
  },
  {
    linea: "TAP-SAL", nombre: "Tapete de Sala Pelo Alto", catalogo: "Sala", categoria: "Tapetes",
    publico: 1690, socio: 1190,
    colores: ["Gris", "Marfil", "Café"],
    descripcion: "🏡 *Tapete de pelo alto*\n📏 *Medida:* 1.60 × 2.30 m.\n✨ *Detalles:* suave al pisar, base antiderrapante.",
  },
  {
    linea: "ADO-NAV", nombre: "Adorno Navideño", catalogo: "Decoración", categoria: "Navidad",
    publico: 320, socio: 220, tags: [2],
    colores: ["Modelo 1", "Modelo 2", "Modelo 3", "Modelo 4", "Modelo 5"],
    descripcion: "🎄 *Adorno navideño*\n✨ *Detalles:* figura de peluche para repisa o mesa.",
  },
  {
    linea: "COR-NAV", nombre: "Cortina Navideña Bordada", catalogo: "Decoración", categoria: "Navidad",
    publico: 590, socio: 390, tags: [2],
    colores: ["Modelo 1", "Modelo 2", "Modelo 3"],
    descripcion: "🎄 *Cortina navideña*\n✨ *Detalles:* bordado de temporada, se quita y se guarda para el año que entra.",
  },
];

const SIZE_NAMES: Record<string, string> = { I: "Individual", M: "Matrimonial", Q: "Queen", K: "King" };

// Números "al azar" pero SIEMPRE los mismos: así la demo no cambia de un refresco a otro.
function pseudo(n: number, tope: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * tope);
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);

let CACHE: Product[] | null = null;

export function demoProductos(): Product[] {
  if (CACHE) return CACHE;
  const out: Product[] = [];
  let id = 1000;
  for (const f of FAMILIAS) {
    const medidas = f.medidas && f.medidas.length ? f.medidas : [""];
    for (const color of f.colores) {
      for (const med of medidas) {
        id++;
        const sku = [f.linea, slug(color), med].filter(Boolean).join("-");
        const nombre = M([f.nombre, color, med ? "- " + SIZE_NAMES[med] : ""].filter(Boolean).join(" "));
        // la medida grande cuesta un poco más, como en la vida real
        const extra = med === "K" ? 120 : med === "Q" ? 60 : 0;
        const fisico = pseudo(id, 26);
        const apartado = fisico > 3 ? pseudo(id + 7, 3) : 0;
        const vendible = Math.max(0, fisico - apartado);
        const tienda = Math.min(vendible, pseudo(id + 3, 6));
        out.push({
          id,
          sku,
          name: nombre,
          catalogo: f.catalogo,
          categoria: f.categoria,
          precioPublico: f.publico + extra,
          precioMiembro: f.socio + extra,
          precioLiquidacion: f.liquidacion ? f.liquidacion + extra : null,
          tarifas: f.publico >= 500 ? [{ qty: 3, price: Math.round((f.socio + extra) * 0.92) }] : [],
          stock: vendible,
          stockTienda: tienda,
          stockBodega: vendible - tienda,
          fisico,
          apartado,
          imageUrl: `/img?id=${id}&s=1024&v=1`,
          thumbUrl: `/img?id=${id}&s=512&v=1`,
          imagenes: [],
          descripcion: f.descripcion,
          tags: f.tags || [],
        });
      }
    }
  }
  CACHE = out;
  return out;
}
