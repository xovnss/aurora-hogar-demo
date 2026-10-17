import { getCatalogGroupsLive } from "@/lib/odoo";
import { isVentasAuthed } from "./auth";
import { VentasLogin, Fichas, type Ficha } from "./ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "BAM! — Fichas para ventas" };

export default async function VentasPage() {
  if (!(await isVentasAuthed())) return <VentasLogin />;
  // Misma estructura CURADA que el catálogo (categorías, agrupación y orden del archivo).
  // Oculta de las fichas los productos que quedaron en 0 (sin disponible).
  // Aquí NO se filtra por vendible: si una pieza existe pero está apartada, la asesora debe verla.
  const groups = (await getCatalogGroupsLive()).filter((g) => g.variants.some((v) => v.fisico > 0));
  // sirve las imágenes desde nuestro dominio (para poder exportar la ficha a PNG)
  const proxy = (v: { imageUrl: string | null }) => v.imageUrl as string;
  const fichas: Ficha[] = groups.map((g) => {
    const withImg = g.variants.find((v) => v.imageUrl) || g.variants[0];
    return {
      key: g.key,
      base: g.base,
      categoria: g.categoria,
      catalogo: g.catalogo,
      minPublico: g.minPublico,
      maxPublico: g.maxPublico,
      minMiembro: g.minMiembro,
      hasLiq: g.hasLiq,
      minLiq: g.minLiq,
      colorCount: g.colorCount,
      image: withImg?.imageUrl ? proxy(withImg) : null,
      blob: g.blob,
      descripcion: g.variants.find((v) => v.descripcion && v.descripcion.trim())?.descripcion || "",
      // precios por mayoreo (mismos para el producto): se toman de la 1a variante que los tenga
      tarifas: (g.variants.find((v) => v.tarifas && v.tarifas.length)?.tarifas) || [],
      variants: g.variants.map((v) => ({
        sku: v.sku,
        label: v.label || v.color || v.size || "Único",
        size: v.size || "",
        color: (v.color || v.label || "").trim(),
        imageUrl: v.imageUrl ? proxy(v) : null,
        pub: v.precioPublico,
        mem: v.precioMiembro,
        liq: v.precioLiquidacion,
        stock: v.stock,
        tienda: v.stockTienda,
        bodega: v.stockBodega,
        apartado: v.apartado,
        descripcion: v.descripcion || "",
      })),
    };
  });
  return <Fichas fichas={fichas} />;
}
