// Chatbot de BAM!: POST /api/chat  { messages: [{ role: "user" | "assistant", content }] }
//   · Con OPENROUTER_API_KEY usa un modelo de IA con "function calling": el modelo decide qué
//     herramienta llamar (talla, existencias, envíos) y redacta con los datos que regresan.
//   · Sin llave (o si el proveedor falla) responde por reglas, sin costo.
// Protecciones: tope de mensajes y de largo, límite de peticiones por IP, tope diario de llamadas
// al modelo y fecha límite de 20 s. La llave nunca sale del servidor.
import { TOOLS, ejecutar, responderPorReglas, type Msg } from "@/lib/chat-tools";
import { ENVIOS, SUCURSALES } from "@/lib/tallas";

export const maxDuration = 30;

const MAX_MENSAJES = 12;
const MAX_CHARS = 500;
const POR_VENTANA = 25;          // peticiones por IP…
const VENTANA_MS = 10 * 60_000;  // …cada 10 minutos
const TOPE_DIARIO_IA = Number(process.env.CHAT_DAILY_LLM_CAP || 300);

const visitas = new Map<string, number[]>();
let dia = ""; let llamadasHoy = 0;

function limitado(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (visitas.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  recientes.push(ahora);
  visitas.set(ip, recientes);
  if (visitas.size > 5000) for (const [k, v] of visitas) if (!v.some((t) => ahora - t < VENTANA_MS)) visitas.delete(k);
  return recientes.length > POR_VENTANA;
}
function hayPresupuesto(): boolean {
  const hoy = new Date().toISOString().slice(0, 10);
  if (hoy !== dia) { dia = hoy; llamadasHoy = 0; }
  return llamadasHoy < TOPE_DIARIO_IA;
}

const SISTEMA = `Eres el asistente de BAM!, una marca mexicana de playeras oversize con mensaje («a brand made for you»). Hablas en español de México, cálido y directo, con respuestas cortas (máximo 5 renglones) y sin relleno.
Reglas:
- Para tallas, existencias, precios y envíos SIEMPRE usa las herramientas; nunca inventes cifras, piezas ni políticas.
- Para recomendar talla necesitas pecho en cm, o altura y peso. Si faltan, pídelos en una sola pregunta. Aclara que las playeras son oversize (tu talla de siempre queda holgada; una talla menos la deja más pegada).
- Si preguntan por existencias sin decir el diseño, pregunta cuál (o lista los diseños). Di claramente en qué sucursales hay y cuántas; «envío a domicilio» es la bodega.
- Políticas: envío estándar $${ENVIOS.costo} (gratis desde $${ENVIOS.gratisDesde}); recoger en sucursal gratis (${SUCURSALES.map((s) => s.ciudad).join(", ")}); cambios de talla gratis a 15 días.
- Esta es una demo: los datos son de ejemplo. Si te piden algo fuera de tienda, de tallas, existencias, envíos, cambios o pagos, di amablemente que solo ayudas con eso.
- No pidas datos personales ni de pago. Usa **negritas** solo para tallas, diseños y cifras clave.`;

type Llamada = { id: string; function?: { name: string; arguments: string } };
type MsgIA = { role: string; content?: string | null; tool_calls?: Llamada[]; tool_call_id?: string };

async function conIA(historial: Msg[], llave: string): Promise<string> {
  const modelo = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const mensajes: MsgIA[] = [{ role: "system", content: SISTEMA }, ...historial];
  for (let ronda = 0; ronda < 4; ronda++) {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${llave}`, "X-Title": "BAM! demo" },
      body: JSON.stringify({
        model: modelo, temperature: 0.3, max_tokens: 400, messages: mensajes,
        tools: TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
        tool_choice: "auto",
      }),
      signal: AbortSignal.timeout(20_000),
    });
    llamadasHoy++;
    if (!r.ok) throw new Error(`proveedor de IA: HTTP ${r.status}`); // sin cuerpo ni llave en el error
    const data = (await r.json()) as { choices?: { message?: { content?: string | null; tool_calls?: Llamada[] } }[] };
    const m = data.choices?.[0]?.message;
    if (!m) throw new Error("respuesta vacía");
    if (!m.tool_calls?.length) return (m.content || "").trim() || "¿Me lo repites? No te entendí bien.";
    mensajes.push({ role: "assistant", content: m.content ?? null, tool_calls: m.tool_calls });
    for (const c of m.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* argumentos mal formados */ }
      mensajes.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(ejecutar(c.function?.name || "", args)) });
    }
  }
  throw new Error("demasiadas rondas de herramientas");
}

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",").pop()?.trim() || "local";
  if (limitado(ip)) return Response.json({ reply: "Vas muy rápido 😅 Espera unos minutos y seguimos.", modo: "limite" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }); }
  const crudos = (body as { messages?: unknown }).messages;
  if (!Array.isArray(crudos) || !crudos.length) return Response.json({ error: "Faltan mensajes" }, { status: 400 });
  const historial: Msg[] = crudos
    .slice(-MAX_MENSAJES)
    .filter((m): m is { role: "user" | "assistant"; content: string } => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!historial.length || historial[historial.length - 1].role !== "user") return Response.json({ error: "El último mensaje debe ser del usuario" }, { status: 400 });

  const llave = process.env.OPENROUTER_API_KEY;
  if (llave && hayPresupuesto()) {
    try {
      return Response.json({ reply: await conIA(historial, llave), modo: "ia" });
    } catch (e) {
      console.error("chat: la IA falló, se usa el modo por reglas —", e instanceof Error ? e.message : "error");
    }
  }
  return Response.json({ reply: responderPorReglas(historial), modo: "reglas" });
}
