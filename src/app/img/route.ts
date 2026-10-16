// VERSIÓN DEMO — no hay fotos reales.
// En el original esta ruta trae la foto del producto desde Odoo, ya recortada al tamaño que
// pide cada pantalla. Aquí dibuja un cuadro de ejemplo con el nombre del producto: así se ve
// el diseño del catálogo completo sin tener que cargar un solo archivo de imagen.
import { demoProductos } from "@/lib/demo-datos";

const TAMANOS = new Set([128, 256, 384, 512, 1024, 1920]);

// Paleta suave; el color sale del id, así cada producto siempre tiene el suyo.
const FONDOS = [
  ["#fdf0e6", "#dbe4ef"], ["#f6eeea", "#ead9d1"], ["#eaf1ec", "#d3e3d8"],
  ["#f2eef7", "#ddd3ea"], ["#f7f2e8", "#ebdfc6"], ["#e9f0f4", "#cfe0e8"],
];

const escapa = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Parte el nombre en renglones que quepan en el cuadro.
function renglones(texto: string, porLinea: number, max: number): string[] {
  const palabras = texto.split(/\s+/);
  const out: string[] = [];
  let actual = "";
  for (const p of palabras) {
    if ((actual + " " + p).trim().length > porLinea && actual) { out.push(actual); actual = p; }
    else actual = (actual + " " + p).trim();
    if (out.length === max) break;
  }
  if (actual && out.length < max) out.push(actual);
  return out;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id") || 0);
  const s = Number(searchParams.get("s") || 512);
  const lado = TAMANOS.has(s) ? s : 512;
  if (!id) return new Response("bad id", { status: 400 });

  const p = demoProductos().find((x) => x.id === id);
  const nombre = p ? p.name : "Producto";
  const [c1, c2] = FONDOS[id % FONDOS.length];
  const lineas = renglones(nombre, 18, 3);
  const fuente = Math.round(lado * 0.062);
  const y0 = lado / 2 - ((lineas.length - 1) * fuente * 1.25) / 2 + fuente * 0.35;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="${lado}" height="${lado}" fill="url(#g)"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${Math.max(1, lado * 0.006)}">
    <rect x="${lado * 0.17}" y="${lado * 0.17}" width="${lado * 0.66}" height="${lado * 0.66}" rx="${lado * 0.06}"/>
    <path d="M${lado * 0.17} ${lado * 0.68} q ${lado * 0.165} -${lado * 0.1} ${lado * 0.33} 0 q ${lado * 0.165} ${lado * 0.1} ${lado * 0.33} 0"/>
  </g>
  <text x="50%" y="${y0}" text-anchor="middle" font-family="Poppins, Helvetica, Arial, sans-serif"
        font-size="${fuente}" font-weight="600" fill="#3c4a5e">
    ${lineas.map((l, i) => `<tspan x="50%" dy="${i === 0 ? 0 : fuente * 1.25}">${escapa(l)}</tspan>`).join("")}
  </text>
  <text x="50%" y="${lado * 0.9}" text-anchor="middle" font-family="Poppins, Helvetica, Arial, sans-serif"
        font-size="${Math.round(lado * 0.036)}" fill="#8a97a8">foto de ejemplo</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
