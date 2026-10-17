// Configuración pública del sitio (se puede usar en el navegador)
export const SITE = {
  name: "BAM!",
  // Número de WhatsApp a donde llega el pedido (solo dígitos con lada). Ej: "5277112345678"
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP || "",
  // Link a la comunidad (para el precio de socios)
  communityUrl: process.env.NEXT_PUBLIC_COMMUNITY_URL || "",
  // Si quedan <= a este número, se muestra "¡Solo quedan X!"
  lowStock: Number(process.env.NEXT_PUBLIC_LOW_STOCK || 10),
  // Mientras NO haya conteo, ignora el stock y muestra todo disponible (sin "Agotado").
  // Cuando ya esté el conteo, pon NEXT_PUBLIC_IGNORE_STOCK=false para activar el stock.
  ignoreStock: (process.env.NEXT_PUBLIC_IGNORE_STOCK ?? "true") !== "false",
  // Mostrar los productos aunque estén en CERO, marcados como "Agotado" (Ximena, 5-oct-2026).
  // Antes se escondían; ahora la clienta los ve y puede preguntar si va a entrar mercancía.
  mostrarAgotados: (process.env.NEXT_PUBLIC_MOSTRAR_AGOTADOS ?? "true") !== "false",
  brand: "#e10b0b",
  brandDark: "#b50808",
  // Aclaración del precio de socios (se valida al cerrar el pedido con un asesor)
  memberNote: "Tu precio de socios se aplica al finalizar tu pedido con un asesor.",
};

export function waLink(message: string) {
  const num = SITE.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}
