// Motivos de "📋 Conteos y ajustes" (solo Ximena y Carlos). Compartido entre la app (ui) y el
// servidor (odoo-write), por eso no importa nada del servidor.
//   signo "±" → puede sumar o restar (ajuste de inventario con el motivo como referencia)
//   signo "-" → solo resta; en Odoo es un traslado real a su ubicación virtual (Merma, Hurto…)
export type MotivoAjuste = "conteo" | "merma" | "hurto" | "devolucion" | "uso" | "correccion";

export type MotivoDef = {
  id: MotivoAjuste;
  emoji: string;
  label: string;
  signo: "±" | "-";
  ayuda: string;
  notaObligatoria: boolean;
  extra?: "quien" | "proveedor";
  placeholder: string;
};

export const MOTIVOS_AJUSTE: MotivoDef[] = [
  { id: "conteo", emoji: "🔁", label: "Conteo cíclico", signo: "±", notaObligatoria: false,
    ayuda: "Cuentas lo que hay físicamente y se ajusta la diferencia.", placeholder: "Ej. conteo del anaquel 3 (opcional)" },
  { id: "merma", emoji: "💔", label: "Merma / daño", signo: "-", notaObligatoria: true,
    ayuda: "Piezas rotas, manchadas o que ya no se pueden vender.", placeholder: "¿Qué le pasó? Ej. llegó manchada, se rompió el empaque…" },
  { id: "hurto", emoji: "🚨", label: "Hurto", signo: "-", notaObligatoria: true,
    ayuda: "Piezas que faltan por robo.", placeholder: "¿Qué pasó? Ej. faltante detectado en conteo del lunes…" },
  { id: "devolucion", emoji: "↩️", label: "Devolución a proveedor", signo: "-", notaObligatoria: false, extra: "proveedor",
    ayuda: "Mercancía que se le regresa al proveedor.", placeholder: "Motivo de la devolución (opcional)" },
  { id: "uso", emoji: "🏠", label: "Uso interno", signo: "-", notaObligatoria: false, extra: "quien",
    ayuda: "Lo que usan o se llevan los dueños o la tienda.", placeholder: "¿Para qué? Ej. para la casa, exhibición… (opcional)" },
  { id: "correccion", emoji: "✏️", label: "Corrección de captura", signo: "±", notaObligatoria: true,
    ayuda: "Algo se capturó mal antes: sumas o restas la diferencia.", placeholder: "¿Cuál fue el error? Ej. se subieron 13 y eran 12" },
];

export const MOTIVO = Object.fromEntries(MOTIVOS_AJUSTE.map((m) => [m.id, m])) as Record<MotivoAjuste, MotivoDef>;

// Accesos rápidos para "¿Quién lo usó?" (también se puede escribir otro nombre)
export const QUIENES_USO = ["Alfonso", "Cecilia", "Iván", "Alan", "Ximena", "Carlos", "Tienda"];
