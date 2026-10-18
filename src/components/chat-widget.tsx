"use client";
// Botón flotante + ventana del asistente de BAM! (tallas, existencias por sucursal, envíos).
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };

const SUGERENCIAS = ["¿Qué talla soy?", "¿Quedan Spirit Being en M?", "¿Qué talla de pantalón soy?", "¿Hacen envíos?", "¿Dónde están las tiendas?"];
const SALUDO: Msg = {
  role: "assistant",
  content: "¡Hola! Soy el asistente de BAM! 👋 Te ayudo a elegir **talla**, a ver **cuántas piezas quedan en cada sucursal** y con tus **envíos**.",
};

// **negritas** y saltos de línea, sin dangerouslySetInnerHTML
function Texto({ t }: { t: string }) {
  return (
    <>
      {t.split("\n").map((linea, i) => (
        <span key={i} className="block min-h-[1em]">
          {linea.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
            p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>
          )}
        </span>
      ))}
    </>
  );
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([SALUDO]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [msgs, cargando, abierto]);

  if (pathname.startsWith("/ventas") || pathname.startsWith("/caja")) return null;

  async function enviar(contenido: string) {
    const limpio = contenido.trim().slice(0, 500);
    if (!limpio || cargando) return;
    const nuevos: Msg[] = [...msgs, { role: "user", content: limpio }];
    setMsgs(nuevos);
    setTexto("");
    setCargando(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nuevos.filter((m) => m !== SALUDO).slice(-10) }),
      });
      const d = (await r.json()) as { reply?: string };
      setMsgs([...nuevos, { role: "assistant", content: d.reply || "Uy, no pude responderte. Intenta de nuevo." }]);
    } catch {
      setMsgs([...nuevos, { role: "assistant", content: "Se cortó la conexión. Intenta de nuevo en un momento." }]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir el asistente de BAM!"
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-lg shadow-black/30 transition hover:bg-brand-dark sm:right-5"
        >
          <span aria-hidden>💬</span> ¿Qué talla soy?
        </button>
      )}
      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente de BAM!"
          className="fixed inset-x-3 bottom-20 z-50 flex max-h-[min(34rem,calc(100dvh-7rem))] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:w-96"
        >
          <div className="flex items-center justify-between bg-black px-4 py-3 text-white">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide">BAM! · asistente</p>
              <p className="text-[11px] text-white/60">Tallas · existencias · envíos</p>
            </div>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="rounded-full px-2 py-1 text-lg leading-none text-white/80 hover:bg-white/10">✕</button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-neutral-50 px-3 py-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${m.role === "user" ? "bg-brand text-white" : "border border-black/10 bg-white text-neutral-900"}`}>
                  <Texto t={m.content} />
                </div>
              </div>
            ))}
            {cargando && <p className="px-1 text-xs text-neutral-500">Escribiendo…</p>}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGERENCIAS.map((s) => (
                  <button key={s} onClick={() => enviar(s)} className="rounded-full border border-brand/40 bg-white px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand hover:text-white">{s}</button>
                ))}
              </div>
            )}
            <div ref={fin} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} className="flex gap-2 border-t border-black/10 bg-white p-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={500}
              placeholder="Ej. mido 1.75 y peso 72 kg"
              className="min-w-0 flex-1 rounded-full border border-black/15 px-4 py-2 text-base outline-none focus:border-brand sm:text-sm"
            />
            <button disabled={cargando || !texto.trim()} className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Enviar</button>
          </form>
        </div>
      )}
    </>
  );
}
