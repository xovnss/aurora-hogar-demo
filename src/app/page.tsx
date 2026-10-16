import { getCatalogGroups, getAjustes } from "@/lib/odoo";
import Catalog from "@/components/catalog";

export const revalidate = 15; // refresca stock/datos cada 15s (antes 5 min) — casi en vivo pero rápido

export default async function Home() {
  const [grupos, ajustes] = await Promise.all([getCatalogGroups(), getAjustes()]);
  return <Catalog grupos={grupos} tema={ajustes.tema} portadaUrl={ajustes.portadaUrl} banners={ajustes.banners} />;
}
