// Catálogo de la demo de BAM!
// Aquí no hay Odoo ni base de datos: todo se genera con esta semilla, así que la demo
// se puede enseñar donde sea sin exponer inventario, precios ni ventas de nadie.
// Para cambiar lo que se ve, se edita FAMILIAS y ya.
import type { Product } from "./types";
import { SUCURSALES } from "./tallas";

type Familia = {
  prenda?: "playera" | "sudadera" | "pantalon" | "accesorio"; // por defecto playera
  linea: string;          // prefijo del código (SKU): dos bloques, p. ej. BAM-SPI
  nombre: string;
  catalogo: string;       // sección: Playeras…
  categoria: string;      // subcategoría
  publico: number;
  socio: number;
  colores: string[];      // [""] = una sola opción de color (se indica en `color` y en la descripción)
  color: string;          // color de la prenda (para el chatbot y la descripción)
  medidas?: string[];     // tallas: XS, S, M, L, XL
  foto: string;           // nombre de archivo en /public/productos (sin -modelo.jpg / -plana.jpg)
  descripcion: string;
  liquidacion?: number;   // si trae, la familia sale en 🔥 Liquidación
  tags?: number[];
};

const M = (s: string) => s.toUpperCase();

const TALLAS_ROPA = ["XS", "S", "M", "L", "XL"];

// Pantalones y sudaderas comparten el mismo formato; sólo cambian nombre, color y estampado.
function pantalon(linea: string, nombre: string, color: string, foto: string, bordado: string, extra: Partial<Familia> = {}): Familia {
  return {
    prenda: "pantalon", linea, nombre, catalogo: "Pantalones", categoria: "Denim oversize",
    publico: 1099, socio: 949, medidas: TALLAS_ROPA, colores: [""], color, foto,
    descripcion: `👖 *Pantalón wide leg*\n🎨 *Color:* ${color}\n🧵 *Tela:* mezclilla 100% algodón de 12 oz, lavado en prenda.\n🪡 *Detalle:* ${bordado}\n📏 *Corte:* tiro medio, pierna muy ancha. La talla se elige por cintura; pregúntale al chat.`,
    ...extra,
  };
}
function bolsa(linea: string, nombre: string, color: string, foto: string, material: string, detalle: string, publico: number, socio: number, extra: Partial<Familia> = {}): Familia {
  return {
    prenda: "accesorio", linea, nombre, catalogo: "Accesorios", categoria: "Bolsas",
    publico, socio, colores: [""], color, foto,
    descripcion: `👜 *Bolsa*\n🎨 *Color:* ${color}\n🧵 *Material:* ${material}\n🪡 *Detalle:* ${detalle}\n📏 *Talla única.* Etiqueta BAM! en rojo.`,
    ...extra,
  };
}
function lentes(linea: string, nombre: string, color: string, foto: string, armazon: string, lente: string, publico: number, socio: number, extra: Partial<Familia> = {}): Familia {
  return {
    prenda: "accesorio", linea, nombre, catalogo: "Accesorios", categoria: "Lentes",
    publico, socio, colores: [""], color, foto,
    descripcion: `🕶️ *Lentes de sol*\n🎨 *Color:* ${color}\n🧵 *Armazón:* ${armazon}\n🔍 *Lente:* ${lente}, protección UV400.\n📏 *Talla única.* Incluye estuche y paño.`,
    ...extra,
  };
}
function sudadera(linea: string, nombre: string, color: string, foto: string, estampado: string, extra: Partial<Familia> = {}): Familia {
  return {
    prenda: "sudadera", linea, nombre, catalogo: "Sudaderas", categoria: "Hoodies y crewnecks",
    publico: 899, socio: 799, medidas: TALLAS_ROPA, colores: [""], color, foto,
    descripcion: `🧥 *Sudadera oversize*\n🎨 *Color:* ${color}\n🧵 *Tela:* felpa de algodón de 400 g, lavado en prenda.\n🖨️ *Estampado:* ${estampado}\n📏 *Corte:* holgado, hombros caídos; mira la guía de tallas o pregúntale al chat.`,
    ...extra,
  };
}

export const FAMILIAS: Familia[] = [
  {
    linea: "BAM-BDA", nombre: "Better Days Ahead", catalogo: "Al frente", categoria: "Algodón clásico",
    publico: 599, socio: 499, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Crema", foto: "better-days-ahead",
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Crema\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* Estampado de colores al frente: BETTER en rojo sobre óvalo amarillo, Days en azul y Ahead en verde. «For God has promised better days — Jeremiah 29:11».\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-SPI", nombre: "Spirit Being", catalogo: "Al frente", categoria: "Algodón clásico",
    publico: 649, socio: 549, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Rojo", foto: "spirit-being",
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Rojo\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* Tipografía gigante en crema sobre rojo intenso. «Spirit over everything».\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-JES", nombre: "Jesus Saves", catalogo: "Al frente", categoria: "Algodón clásico",
    publico: 649, socio: 549, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Negro", foto: "jesus-saves",
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Negro\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* JESUS en rojo y una S pintada a mano en dorado. Negro lavado, tacto suave.\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-MER", nombre: "Mercy Over Ego", catalogo: "Al frente", categoria: "Teñida en prenda",
    publico: 649, socio: 549, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Negro lavado", foto: "mercy-over-ego",
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Negro lavado\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* Letras en crema con textura gastada y una pincelada roja. Teñido en prenda.\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-HEA", nombre: "Heaven Knows", catalogo: "Al frente", categoria: "Algodón clásico",
    publico: 649, socio: 549, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Crema", foto: "heaven-knows",
    tags: [4],
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Crema\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* Corazón con alas en tinta, HEAVEN KNOWS en vino y «Keep the faith».\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-GRA", nombre: "Grace in the Chaos", catalogo: "Al frente", categoria: "Teñida en prenda",
    publico: 649, socio: 549, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Gris lavado", foto: "grace-in-the-chaos",
    tags: [4],
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Gris lavado\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* Tipografía alta en morado oscuro y una etiqueta «in the» pegada. Gris lavado tipo piedra.\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-CHO", nombre: "Chosen", catalogo: "En la espalda", categoria: "Algodón clásico",
    publico: 599, socio: 499, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Azul rey", foto: "chosen",
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Azul rey\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* Etiqueta «Hello my name is CHOSEN» en la espalda. «You are a chosen people — 1 Peter 2:9».\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-CHI", nombre: "Child of God", catalogo: "En la espalda", categoria: "Algodón clásico",
    publico: 599, socio: 499, liquidacion: 399, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Crema", foto: "child-of-god",
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Crema\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* Trazos azules a mano, carita con estrellas y «I am a child of God» en la espalda.\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-FUL", nombre: "Full of Grace", catalogo: "En la espalda", categoria: "Teñida en prenda",
    publico: 649, socio: 549, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Rosa lavado", foto: "full-of-grace",
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Rosa lavado\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* FULL ♥ OF GRACE en rojo coral sobre rosa lavado, con texto pequeño en el hombro.\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-NOT", nombre: "Not Alone", catalogo: "En la espalda", categoria: "Teñida en prenda",
    publico: 649, socio: 549, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Azul marino lavado", foto: "not-alone",
    tags: [4],
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Azul marino lavado\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* NOT ALONE en amarillo mantequilla con las manos que se sostienen. «You never walk alone».\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  {
    linea: "BAM-STI", nombre: "Still Held", catalogo: "En la espalda", categoria: "Teñida en prenda",
    publico: 649, socio: 549, medidas: ["XS", "S", "M", "L", "XL"],
    colores: [""], color: "Café lavado", foto: "still-held",
    tags: [4],
    descripcion: "👕 *Playera oversize*\n🎨 *Color:* Café lavado\n🧵 *Tela:* algodón 100% de 220 g, cuello reforzado y hombros caídos.\n🖨️ *Estampado:* Manos abiertas con un sol, STILL HELD en azul polvo sobre café lavado. «Even here».\n📏 *Corte:* holgado; mira la guía de tallas o pregúntale al chat.",
  },
  // ── Pantalones ──
  pantalon("BAM-CAR", "Evergreen Cargo", "Verde olivo", "cargo-olivo", "Rama de hojas bordada en la pierna y en el bolsillo cargo; estrella en la bolsa.", { tags: [4] }),
  pantalon("BAM-ORB", "Orbit Stars", "Azul claro", "orbit-stars", "Estrellas con órbita bordadas en vino sobre azul desgastado."),
  pantalon("BAM-WIN", "Winged Denim", "Café lavado", "winged-denim", "Alas de plumas en crema sobre toda la pierna y corazón en el bolsillo.", { tags: [4] }),
  pantalon("BAM-FLA", "Holy Fire", "Gris humo", "holy-fire", "Flamas azules bordadas en los dos bajos; flama pequeña en el bolsillo."),
  pantalon("BAM-LUN", "Moon & Stars", "Crudo", "moon-and-stars", "Luna y estrellas bordadas en negro, con trayecto de puntadas."),
  pantalon("BAM-THO", "Thorn Star", "Morado lavado", "thorn-star", "Estrellas rojas y corona de espinas bordada en relieve.", { liquidacion: 849 }),
  pantalon("BAM-KOI", "Koi Stream", "Azul índigo", "koi-stream", "Dos carpas koi estampadas con efecto grabado y agua en puntadas."),
  // ── Accesorios ──
  bolsa("BAM-EVT", "Evergreen Tote", "Verde olivo", "evergreen-tote", "lona encerada con base y asas de piel sintética negra.", "Dos bolsas con broche y rama de hojas bordada en crema; cierre completo.", 1499, 1299, { tags: [4] }),
  bolsa("BAM-WSA", "Wing Satchel", "Vino", "wing-satchel", "piel sintética lisa, herrajes plateados y patas metálicas.", "Ala bordada en relieve al tono, placa BAM! y asas rígidas.", 1799, 1549),
  bolsa("BAM-MNB", "Moonlight Box", "Crema y negro", "moonlight-box", "piel sintética granulada con vivos negros.", "Luna y estrellas bordadas en negro con trayecto de puntadas; asa rígida.", 1299, 1149, { tags: [4] }),
  bolsa("BAM-SLH", "Starlight Hobo", "Negro", "starlight-hobo", "piel sintética grabada, cierre metálico.", "Tres estrellas bordadas con contorno crema y etiqueta roja BAM!.", 1199, 1049),
  bolsa("BAM-SUE", "Suede Star Tote", "Chocolate", "suede-star-tote", "ante sintético con asas de piel sintética.", "Estrella bordada al tono, placa redonda BAM! y forro interior.", 1699, 1499),
  lentes("BAM-IVR", "Ivory Frame", "Marfil", "ivory-frame", "acetato grueso facetado con remache rojo.", "café sólido", 799, 699, { tags: [4] }),
  lentes("BAM-HAV", "Havana Oval", "Carey", "havana-oval", "acetato carey con remaches dorados.", "verde G-15", 699, 599),
  lentes("BAM-BOR", "Bordeaux Cat", "Vino translúcido", "bordeaux-cat", "acetato translúcido tipo cat-eye con estrella plateada.", "café degradado", 799, 699),
  lentes("BAM-SMK", "Smoke Shield", "Humo", "smoke-shield", "máscara de una sola pieza en policarbonato translúcido.", "café espejado", 899, 799, { tags: [4] }),
  lentes("BAM-NOI", "Noir Frame", "Negro", "noir-frame", "acetato negro con placas plateadas en las esquinas.", "gris oscuro", 749, 649),
  lentes("BAM-CHR", "Chrome Wrap", "Plata cepillada", "chrome-wrap", "metal cepillado envolvente con puntas de silicón.", "gris espejado", 999, 899),
  // ── Sudaderas ──
  sudadera("BAM-ZIP", "Starbound Zip", "Ciruela lavado", "starbound-zip", "Estrellas con borde deshilachado en el pecho y la manga; cierre completo.", { tags: [4] }),
  sudadera("BAM-LOV", "Still Loved", "Crema", "still-loved", "Corazón con espinas bordado en vino y «STILL LOVED» debajo.", { categoria: "Crewneck" }),
  sudadera("BAM-GRO", "Grow in Grace", "Verde salvia", "grow-in-grace", "«GROW IN GRACE» en vino con ramas bordadas en crema.", { categoria: "Crewneck" }),
  sudadera("BAM-FAI", "Faith Over Fear", "Negro lavado", "faith-over-fear", "Tipografía gigante en crema con brochazo rojo y estrellas en las mangas."),
  sudadera("BAM-HSE", "Heaven Sent", "Azul rey", "heaven-sent", "«HEAVEN SENT — NOT BY CHANCE» en amarillo en la espalda y estrella en la manga.", { tags: [4] }),
  sudadera("BAM-UND", "Under His Wings", "Café", "under-his-wings", "Alas de plumas en crema por toda la espalda y «UNDER HIS WINGS» en azul."),
];

// Números "al azar" pero SIEMPRE los mismos: así la demo no cambia de un refresco a otro.
function pseudo(n: number, tope: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * tope);
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);

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
        const nombre = M([f.nombre, color, med ? "- " + med : ""].filter(Boolean).join(" "));
        // existencias por sucursal: las tallas del centro (S, M, L) se venden más y se acaban antes
        const centro = med === "S" || med === "M" || med === "L" ? 1 : 0;
        const stockSucursal: Record<string, number> = {};
        let k = 0;
        for (const s of SUCURSALES) {
          k++;
          const n = pseudo(id * 7 + k * 13, centro ? 7 : 10); // 0–6 en tallas centrales, 0–9 en las demás
          stockSucursal[s.id] = n < 2 && pseudo(id + k, 4) === 0 ? 0 : n;
        }
        stockSucursal.bodega = pseudo(id * 3 + 5, 16);
        const enSucursales = SUCURSALES.reduce((a, s) => a + stockSucursal[s.id], 0);
        const vendible = enSucursales + stockSucursal.bodega;
        const apartado = vendible > 6 ? pseudo(id + 7, 3) : 0;
        const extra = med === "XL" ? 0 : 0;
        out.push({
          id,
          sku,
          name: nombre,
          catalogo: f.catalogo,
          categoria: f.categoria,
          precioPublico: f.publico + extra,
          precioMiembro: f.socio + extra,
          precioLiquidacion: f.liquidacion ? f.liquidacion + extra : null,
          tarifas: [{ qty: 3, price: Math.round((f.socio + extra) * 0.9) }],
          stock: vendible,
          stockTienda: enSucursales,
          stockBodega: stockSucursal.bodega,
          stockSucursal,
          fisico: vendible + apartado,
          apartado,
          imageUrl: `/productos/${f.foto}-modelo.jpg`,
          thumbUrl: `/productos/${f.foto}-modelo-512.jpg`,
          imagenes: [`/productos/${f.foto}-plana.jpg`],
          descripcion: f.descripcion,
          tags: f.tags || [],
        });
      }
    }
  }
  CACHE = out;
  return out;
}

// Para el chatbot: ¿qué diseños hay y cuántas piezas quedan por talla y sucursal?
export function disenos(): { nombre: string; prenda: string; linea: string; color: string; catalogo: string; categoria: string; precio: number; precioSocio: number; liquidacion: number | null; descripcion: string }[] {
  return FAMILIAS.map((f) => ({ nombre: f.nombre, prenda: f.prenda || "playera", linea: f.linea, color: f.color, catalogo: f.catalogo, categoria: f.categoria, precio: f.publico, precioSocio: f.socio, liquidacion: f.liquidacion ?? null, descripcion: f.descripcion }));
}
