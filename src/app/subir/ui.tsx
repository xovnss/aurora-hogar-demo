"use client";

import { useState, useTransition, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Categoria, ProductoBuscado, Evento, ProdResurtir, Pendiente, ProdDesc, ProdSimple, LineaModelo, AjusteRegistro, NotaCompra, NotaLinea } from "@/lib/odoo-write";
import { MOTIVOS_AJUSTE, MOTIVO, QUIENES_USO, type MotivoAjuste } from "@/lib/ajustes";
import {
  loginAction, logoutAction, crearProductoAction, buscarAction,
  setStockAction, setLiqAction, setPreciosAction, cambiarImagenAction,
  checkSkusAction, archivarAction, restaurarAction, eliminarAction, historialSolicitudesAction,
  resurtirBuscarAction, resurtirAction, setNombreAction, setSkuAction, setCategoriaAction, setTagAction,
  saldosListaAction, liquidacionListaAction,
  archivadosAction, eliminadosAction, agregarImagenesAction, setTarifasAction, notifCountsAction,
  getAjustesCatalogoAction, setTemaAction, setPortadaAction, quitarPortadaAction, addBannerAction, removeBannerAction,
  pendientesAction, aprobarAction, rechazarAction, aprobarMultiAction,
  descripcionesAction, setDescripcionAction, setDescripcionMultiAction,
  archivarMultiAction, eliminarMultiAction,
  sinStockListaAction, ultimosModelosAction, sinFotoBodegaAction, ajusteAction, historialAjustesAction, notasVsInventarioAction,
  misRechazadosAction, misAprobadosAction, reenviarAction, editarPendienteAction, cancelarPendienteAction,
} from "./actions";
import { renderNegritas } from "@/lib/richtext";
import { TEMAS } from "@/lib/temas";
import { TEMPORADAS } from "@/lib/tags";
import { matchSearch } from "@/lib/search";

// Borradores de descripciones: guardan lo que se va escribiendo (aunque no se guarde ni se cambie de pestaña)
const DESC_DRAFTS = "bam-desc-drafts";
function leerBorradores(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(DESC_DRAFTS) || "{}"); } catch { return {}; }
}
function guardarBorrador(id: number, val: string, guardado: string) {
  try {
    const d = leerBorradores();
    if (val.trim() === (guardado || "").trim()) delete d[id]; else d[id] = val;
    localStorage.setItem(DESC_DRAFTS, JSON.stringify(d));
  } catch { /* noop */ }
}
function borrarBorrador(id: number) {
  try { const d = leerBorradores(); delete d[id]; localStorage.setItem(DESC_DRAFTS, JSON.stringify(d)); } catch { /* noop */ }
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");

/* ---------- Piezas de estilo de la plataforma (mismo look que el sidebar) ---------- */
// Cabecera de sección con "sticker" de emoji, título redondo y subtítulo. Da el aire jugetón/azul.
function PanelHead({ emoji, titulo, sub, right }: {
  emoji: string; tono?: string; titulo: string; sub?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="pf-sticker grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl">{emoji}</span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-bold leading-tight text-[#0e2650]">{titulo}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
// Chip "refrescar" tech, reutilizable
const REFRESH = "pf-chip px-3.5 py-1.5 text-xs";

// Guarda/restaura el "previo" de un formulario en localStorage: no se pierde al cambiar de pestaña ni al recargar.
function useDraft(key: string, snapshot: () => Record<string, unknown>, restore: (d: Record<string, unknown>) => void, deps: unknown[]) {
  const listo = useRef(false);
  useEffect(() => {
    try { const r = localStorage.getItem(key); if (r) restore(JSON.parse(r)); } catch { /* noop */ }
    listo.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!listo.current) return;
    try { localStorage.setItem(key, JSON.stringify(snapshot())); } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
const limpiarDraft = (key: string) => { try { localStorage.removeItem(key); } catch { /* noop */ } };

/* ---------- Selección múltiple (estilo carrito) ---------- */
function useSeleccion() {
  const [modo, setModo] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const toggle = useCallback((id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const limpiar = useCallback(() => setSel(new Set()), []);
  const salir = useCallback(() => { setModo(false); setSel(new Set()); }, []);
  // Marca/desmarca todos los ids dados (si faltaba alguno, los marca todos; si ya estaban todos, los quita)
  const alternarTodos = useCallback((ids: number[]) => setSel((s) => {
    const n = new Set(s);
    const faltan = ids.some((i) => !n.has(i));
    if (faltan) ids.forEach((i) => n.add(i)); else ids.forEach((i) => n.delete(i));
    return n;
  }), []);
  return { modo, setModo, sel, toggle, limpiar, salir, alternarTodos };
}

// Pone/quita *asteriscos* (negritas) al texto seleccionado de un textarea cualquiera.
function toggleNegritasEn(ta: HTMLTextAreaElement | null, val: string, set: (v: string) => void) {
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  if (s === e) {
    const nuevo = val.slice(0, s) + "**" + val.slice(e);
    set(nuevo);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + 1; });
    return;
  }
  const sel = val.slice(s, e);
  const ya = sel.startsWith("*") && sel.endsWith("*") && sel.length >= 2;
  const nuevoSel = ya ? sel.replace(/^\*+/, "").replace(/\*+$/, "") : `*${sel}*`;
  const nuevo = val.slice(0, s) + nuevoSel + val.slice(e);
  set(nuevo);
  requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s; ta.selectionEnd = s + nuevoSel.length; });
}

// Barra flotante de acciones para productos seleccionados (archivar / eliminar)
function BarraSelProductos({ n, pend, onArchivar, onEliminar, onTodo, onCancelar }: {
  n: number; pend: boolean; onArchivar: () => void; onEliminar: () => void; onTodo: () => void; onCancelar: () => void;
}) {
  return (
    <div className="sticky bottom-3 z-20 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-white/95 px-4 py-3 shadow-[0_18px_40px_-20px_rgba(14,38,80,.6)] backdrop-blur">
      <span className="font-display text-sm font-bold text-brand-dark">{n} seleccionado{n === 1 ? "" : "s"}</span>
      <button onClick={onTodo} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Todos</button>
      <div className="ml-auto flex gap-2">
        <button onClick={onArchivar} disabled={pend || n === 0} className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50">🗄️ Archivar</button>
        <button onClick={onEliminar} disabled={pend || n === 0} className="rounded-lg bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50">🗑️ Eliminar</button>
        <button onClick={onCancelar} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50">Cancelar</button>
      </div>
    </div>
  );
}

// Lista de productos con edición + selección múltiple (se usa en Buscar y en Productos)
function ListaEditable({ items, setItems, categorias, aprobador }: {
  items: ProductoBuscado[];
  setItems: React.Dispatch<React.SetStateAction<ProductoBuscado[]>>;
  categorias: Categoria[];
  aprobador: boolean;
}) {
  const s = useSeleccion();
  const [pend, start] = useTransition();
  const [nota, setNota] = useState("");
  const visibles = items.filter((p) => s.sel.has(p.id));

  function reportar(resultados: { id: number; estado: string }[], verbo: string) {
    const hechos = resultados.filter((r) => r.estado === "hecho").map((r) => r.id);
    const pendientes = resultados.filter((r) => r.estado === "pendiente").length;
    const errores = resultados.filter((r) => r.estado === "error").length;
    if (hechos.length) setItems((xs) => xs.filter((x) => !hechos.includes(x.id)));
    const partes: string[] = [];
    if (hechos.length) partes.push(`✅ ${hechos.length} ${verbo}`);
    if (pendientes) partes.push(`🕒 ${pendientes} a revisión`);
    if (errores) partes.push(`❌ ${errores} con error`);
    setNota(partes.join(" · "));
    s.salir();
    setTimeout(() => setNota(""), 6000);
  }
  function bulkArchivar() {
    if (!visibles.length) return;
    if (!confirm(`¿Archivar ${visibles.length} producto(s)? Salen del catálogo y del PdV; se pueden restaurar en 🗄️ Archivados.`)) return;
    start(async () => {
      const r = await archivarMultiAction(visibles.map((p) => ({ id: p.id, label: `${p.name} (${p.sku})` })));
      if (r.ok) reportar(r.resultados, "archivado(s)"); else setNota("❌ " + r.error);
    });
  }
  function bulkEliminar() {
    if (!visibles.length) return;
    if (!confirm(`¿ELIMINAR ${visibles.length} producto(s) de forma definitiva? No se puede deshacer. Si alguno no deja (está en una venta), se archiva.`)) return;
    start(async () => {
      const r = await eliminarMultiAction(visibles.map((p) => ({ id: p.id, label: `${p.name} (${p.sku})` })));
      if (r.ok) reportar(r.resultados, "eliminado(s)"); else setNota("❌ " + r.error);
    });
  }
  return (
    <>
      {(items.length > 0 || s.modo) && (
        <div className="flex items-center gap-2">
          {!s.modo
            ? <button onClick={() => s.setModo(true)} className="pf-chip px-3.5 py-1.5 text-xs">☑️ Seleccionar varios</button>
            : <button onClick={s.salir} className="pf-chip px-3.5 py-1.5 text-xs">Salir de selección</button>}
          {nota && <span className="text-[12px] font-semibold text-slate-600">{nota}</span>}
        </div>
      )}
      <div className="space-y-3">
        {items.map((p) => (
          <EditCard key={p.id} p={p} categorias={categorias} aprobador={aprobador}
            sel={s.modo ? { on: true, checked: s.sel.has(p.id), toggle: () => s.toggle(p.id) } : undefined} />
        ))}
      </div>
      {s.modo && visibles.length > 0 && (
        <BarraSelProductos n={visibles.length} pend={pend}
          onArchivar={bulkArchivar} onEliminar={bulkEliminar}
          onTodo={() => s.alternarTodos(items.map((p) => p.id))} onCancelar={s.salir} />
      )}
    </>
  );
}

// Etiqueta de color por tipo de solicitud (nuevo, precio, nombre, resurtido, etc.)
const TIPO_INFO: Record<string, { label: string; cls: string }> = {
  crear: { label: "🆕 Nuevo", cls: "bg-emerald-100 text-emerald-700" },
  precios: { label: "💲 Precio", cls: "bg-amber-100 text-amber-700" },
  nombre: { label: "✏️ Nombre", cls: "bg-violet-100 text-violet-700" },
  stock: { label: "📦 Inventario", cls: "bg-sky-100 text-sky-700" },
  resurtir: { label: "🔄 Resurtido", cls: "bg-blue-100 text-blue-700" },
  liquidacion: { label: "🔥 Liquidación", cls: "bg-orange-100 text-orange-700" },
  imagen: { label: "🖼️ Foto", cls: "bg-pink-100 text-pink-700" },
  archivar: { label: "🗄️ Archivar", cls: "bg-slate-200 text-slate-700" },
  restaurar: { label: "♻️ Restaurar", cls: "bg-teal-100 text-teal-700" },
  eliminar: { label: "🗑️ Eliminar", cls: "bg-red-100 text-red-700" },
};
function TipoTag({ tipo }: { tipo: string }) {
  const i = TIPO_INFO[tipo] || { label: tipo || "otro", cls: "bg-slate-100 text-slate-600" };
  return <span className={"inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " + i.cls}>{i.label}</span>;
}

/* ---------- Notificaciones con sonido (campanita en el encabezado) ---------- */
function Notif({ usuario, aprobador }: { usuario: string; aprobador: boolean }) {
  const [on, setOn] = useState(false);
  const [aviso, setAviso] = useState("");
  const seenRef = useRef<{ pendientes: number; aprobadas: number; rechazadas: number } | null>(null);
  const key = "bam-notif-seen-" + norm(usuario);

  function beep() {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      o.start(); o.stop(ctx.currentTime + 0.42);
      o.onended = () => ctx.close();
    } catch { /* noop */ }
  }
  function notificar(titulo: string, cuerpo: string) {
    beep();
    setAviso(titulo + " — " + cuerpo);
    setTimeout(() => setAviso(""), 8000);
    try { if ("Notification" in window && Notification.permission === "granted") new Notification(titulo, { body: cuerpo }); } catch { /* noop */ }
  }

  const revisar = useCallback(async () => {
    try {
      const c = await notifCountsAction();
      const seen = seenRef.current;
      if (seen) {
        if (c.rol === "aprobador") {
          if (c.pendientes > seen.pendientes) notificar("🔔 Nueva solicitud", "Sofía mandó algo para revisar.");
        } else {
          if (c.aprobadas > seen.aprobadas) notificar("✅ Te aprobaron", "Una de tus solicitudes fue aprobada.");
          if (c.rechazadas > seen.rechazadas) notificar("🔴 Te regresaron una", "Corrige y reenvía tu solicitud.");
        }
      }
      seenRef.current = { pendientes: c.pendientes, aprobadas: c.aprobadas, rechazadas: c.rechazadas };
      try { localStorage.setItem(key, JSON.stringify(seenRef.current)); } catch { /* noop */ }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) seenRef.current = JSON.parse(s); } catch { /* noop */ }
    try { if (localStorage.getItem("bam-notif-on") === "1") setOn(true); } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!on) return;
    revisar();
    const t = setInterval(revisar, 45000);
    return () => clearInterval(t);
  }, [on, revisar]);

  async function toggle() {
    if (!on) {
      try { if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission(); } catch { /* noop */ }
      beep();
      setOn(true);
      try { localStorage.setItem("bam-notif-on", "1"); } catch { /* noop */ }
    } else {
      setOn(false);
      try { localStorage.setItem("bam-notif-on", "0"); } catch { /* noop */ }
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {aviso && <span className="hidden max-w-[260px] truncate rounded-full bg-brand-light px-3 py-1 text-[11px] font-semibold text-brand-dark md:inline">{aviso}</span>}
      <button onClick={toggle} title={on ? `Notificaciones activadas${aprobador ? " (avisos de nuevas solicitudes)" : " (avisos de tus aprobaciones)"}` : "Activar notificaciones con sonido"}
        className={"grid h-10 w-10 place-items-center rounded-full border text-lg transition " + (on ? "border-brand bg-brand-light" : "border-slate-200 bg-white opacity-70 hover:opacity-100")}>
        {on ? "🔔" : "🔕"}
      </button>
    </div>
  );
}

/* ---------- utilidades ---------- */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// quita el precio (todo lo que va desde "$") y separadores sobrantes
export function limpiarNombre(nombre: string): string {
  return nombre.split("$")[0].replace(/[-–\s]+$/, "").trim();
}

const COLOR_MULTI: [string, string][] = [
  ["gris oscuro", "GRO"], ["gris claro", "GRC"], ["azul oscuro", "AZO"], ["azul claro", "AZC"],
  ["azul rey", "AZR"], ["rosa palo", "RSP"], ["rosa claro", "RCL"], ["rosa grisaceo", "RSG"],
  ["cafe claro", "CCL"], ["beige oscuro", "BEO"],
];
const COLOR_UNO: Record<string, string> = {
  negro: "NEG", blanco: "BLA", gris: "GRI", azul: "AZL", marino: "AZO", rojo: "ROJ", vino: "VIN",
  rosa: "ROS", morado: "MOR", lila: "LIL", verde: "VRD", olivo: "OLI", menta: "MEN", turquesa: "TUR",
  cafe: "CAF", chocolate: "CHO", beige: "BEI", crema: "CRM", coral: "CRL", plata: "PLT", dorado: "DOR",
  oro: "ORO", naranja: "NAR", amarillo: "AMA", pistache: "PIS", fucsia: "FUC", uva: "UVA", marfil: "MRF",
  ivory: "IVR", teal: "TEA", esmeralda: "ESM",
};
const SIZE_UNO: Record<string, string> = { king: "K", matrimonial: "M", queen: "Q", individual: "I", matriqueen: "MQ" };
const STOP = new Set(["de", "la", "el", "con", "y", "para", "-", "modelo"]);

// Prefijo de categoría (misma convención que usa el equipo). El más específico primero.
const CAT_MAP: [string, string][] = [
  ["playera", "PLA"], ["camiseta", "PLA"], ["sudadera", "SUD"], ["hoodie", "SUD"], ["chamarra", "CHA"],
  ["pantalon", "PAN"], ["cargo", "PAN"], ["jean", "PAN"], ["bolsa", "BOL"], ["tote", "BOL"],
  ["lentes", "LEN"], ["gafas", "LEN"],
];

// Sugerencia de SKU con la MISMA lógica del equipo:
// PREFIJO(categoría)-LÍNEA(3 letras)-MODELO-COLOR-DISEÑO-(PLAZA o MEDIDA). Editable.
function sugerirSku(nombre: string): string {
  let s = " " + norm(limpiarNombre(nombre)) + " ";
  let color = "", size = "", model = "", plaza = "";
  // COLOR por nombre compuesto ("gris oscuro"), nombre simple ("café") o CÓDIGO ("GRO", "CAF"). Cualquiera sirve.
  for (const [w, c] of COLOR_MULTI) if (s.includes(w)) { color = c; s = s.replace(w, " "); break; }
  if (!color) for (const w of Object.keys(COLOR_UNO)) if (new RegExp("\\b" + w + "\\b").test(s)) { color = COLOR_UNO[w]; s = s.replace(new RegExp("\\b" + w + "\\b"), " "); break; }
  if (!color) {
    const codes = new Set([...Object.values(COLOR_UNO), ...COLOR_MULTI.map((x) => x[1])].map((c) => c.toLowerCase()));
    for (const tok of s.split(/[^a-z0-9]+/)) if (tok && codes.has(tok)) { color = tok.toUpperCase(); s = s.replace(new RegExp("\\b" + tok + "\\b"), " "); break; }
  }
  for (const w of Object.keys(SIZE_UNO)) if (new RegExp("\\b" + w + "\\b").test(s)) { size = SIZE_UNO[w]; s = s.replace(new RegExp("\\b" + w + "\\b"), " "); break; }
  const pl = s.match(/(\d+)\s*plazas?/); if (pl) { plaza = pl[1] + "P"; s = s.replace(pl[0], " "); }
  // MODELO: M1, M-1, M 1, MOD 1, MODELO 1
  const md = s.match(/\bmodelos?\s*(\d+)\b/) || s.match(/\bmod\.?\s*(\d+)\b/) || s.match(/\bm[\s-]*(\d+)\b/);
  if (md) { model = "M" + md[1]; s = s.replace(md[0], " "); }
  // DISEÑO: D099 / D-099 / DK094 / LKA12
  let design = "";
  const dm = s.match(/\b([a-z]{1,3})-?(\d{2,4})\b/);
  if (dm) { design = (dm[1] + dm[2]).toUpperCase(); s = s.replace(dm[0], " "); }
  // prefijo de categoría (por el inicio del nombre)
  let rest = s.replace(/\s+/g, " ").trim();
  let pref = "";
  for (const [w, c] of CAT_MAP) if (rest.startsWith(w)) { pref = c; rest = rest.slice(w.length).trim(); break; }
  const words = rest.split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
  let line = "";
  if (!pref) { pref = (words[0] || "PRD").slice(0, 3).toUpperCase(); line = (words[1] || "").slice(0, 3).toUpperCase(); }
  else line = (words[0] || "").slice(0, 3).toUpperCase();
  return [pref, line, model, color, design, plaza || size].filter(Boolean).join("-");
}

async function fileToBase64(file: File, max = 1600): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = () => res(null); img.onerror = rej; img.src = url; });
  let w = img.naturalWidth, h = img.naturalHeight;
  if (w > max || h > max) { const s = Math.min(max / w, max / h); w = Math.round(w * s); h = Math.round(h * s); }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

/* ---------- Carga rápida: parseo de lista + emparejado de imágenes ---------- */
// Convierte el texto pegado de WhatsApp en productos {name, pub, mem}
export function parseLote(text: string): { name: string; pub: number; mem: number }[] {
  const out: { name: string; pub: number; mem: number }[] = [];
  let pend = "";
  const priceRe = /\$?\s*([\d][\d.,]*)\s*\/\s*\$?\s*([\d][\d.,]*)/;
  for (const raw of text.split(/\r?\n/)) {
    // quita prefijo de WhatsApp: "[27/07/26, 10:40] Ana: "
    const l = raw.replace(/^\[[^\]]*\]\s*[^:]*:\s*/, "").trim();
    if (!l) continue;
    if (/^(nuevo producto|agregar producto|producto nuevo|agregar productos)/i.test(l)) { pend = ""; continue; }
    if (/^\d+\s*x\s*\$/i.test(l)) continue; // línea de mayoreo "2 X $399"
    const pm = l.match(priceRe);
    if (pm) { if (pend) { out.push({ name: pend, pub: parseInt(pm[1].replace(/[.,]/g, "")) || 0, mem: parseInt(pm[2].replace(/[.,]/g, "")) || 0 }); pend = ""; } continue; }
    pend = l.replace(/\s*[·\-]?\s*\$.*$/, "").trim();
  }
  return out;
}

const IMG_STOP = new Set(["de", "la", "el", "con", "y", "para", "modelo", "nuevo", "producto", "agregar", "pza", "pzas", "piezas"]);
function tokensFor(name: string): string[] {
  return norm(limpiarNombre(name)).split(/[^a-z0-9]+/).filter((t) => t && !IMG_STOP.has(t) && (t.length >= 3 || /\d/.test(t)));
}
// Empareja un producto con su imagen por nombre de archivo (como se hace a mano)
export function matchImageFile(name: string, files: File[]): File | null {
  const toks = tokensFor(name);
  if (!toks.length || !files.length) return null;
  let best: File | null = null, bestScore = -1;
  for (const f of files) {
    const fn = norm(f.name);
    let s = 0;
    for (const t of toks) if (fn.includes(t)) s++;
    if (s > bestScore) { bestScore = s; best = f; }
  }
  return bestScore >= Math.max(2, Math.ceil(toks.length * 0.6)) ? best : null;
}

// Parser: UN PRODUCTO POR RENGLÓN con marcadores fijos.
//   NOMBRE (con modelo/color/diseño)   $PUB/$MIEM   x CANTIDAD   L:LIQUIDACIÓN
//   ej:  CUBRESALA CHENILLA M1 CAFÉ $530/$430 x30 L:300
// También tolera el formato viejo "NOMBRE" (renglón) + "$pub/$mem" (renglón).
export type FilaCruda = { name: string; pub: number; mem: number; liq: number | null; qty: number | null };
export function parseLoteQty(text: string): FilaCruda[] {
  const out: FilaCruda[] = [];
  const priceRe = /\$?\s*([\d][\d.,]*)\s*\/\s*\$?\s*([\d][\d.,]*)/;
  const num = (s: string) => parseInt(s.replace(/[.,]/g, ""), 10) || 0;
  const cleanName = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s·|,:-]+|[\s·|,:-]+$/g, "").trim();
  let pend = "";
  const flushPend = () => { if (pend) { out.push({ name: pend, pub: 0, mem: 0, liq: null, qty: null }); pend = ""; } };
  for (const raw of text.split(/\r?\n/)) {
    let l = raw.replace(/^\[[^\]]*\]\s*[^:]*:\s*/, "").trim(); // quita "[fecha] Rosa: "
    if (!l) continue;
    if (/^(nuevo producto|agregar producto|producto nuevo|agregar productos)/i.test(l)) { flushPend(); continue; }
    if (/^\d+\s*x\s*\$/i.test(l)) continue; // mayoreo "2 X $399"

    // Liquidación: "L:200", "L=200", "LIQ 200", "LIQ:200"
    let liq: number | null = null;
    const lm = l.match(/(?:^|\s)(?:l\s*[:=]|liq\.?\s*[:=]?)\s*\$?\s*(\d[\d.,]*)/i);
    if (lm) { liq = num(lm[1]); l = l.replace(lm[0], " "); }
    // Cantidad: "x30" / "x 30"
    let qty: number | null = null;
    const xm = l.match(/\bx\s*(\d+)\b/i);
    if (xm) { qty = parseInt(xm[1], 10); l = l.replace(xm[0], " "); }
    // Precio: "$300/$150"
    const pm = l.match(priceRe);
    let pub = 0, mem = 0, hasPrice = false;
    if (pm) { pub = num(pm[1]); mem = num(pm[2]); l = l.replace(pm[0], " "); hasPrice = true; }
    const name = cleanName(l);

    if (hasPrice) {
      if (!name && pend) { out.push({ name: pend, pub, mem, liq, qty }); pend = ""; }
      else { flushPend(); if (name) out.push({ name, pub, mem, liq, qty }); }
    } else if (qty != null || liq != null) {
      flushPend(); if (name) out.push({ name, pub: 0, mem: 0, liq, qty }); // trae cant/liq pero no precio
    } else {
      flushPend(); pend = name; // puro nombre (formato viejo: precio en el renglón siguiente)
    }
  }
  flushPend();
  return out;
}

// Adivina la categoría de Odoo por el nombre; si no hay match claro, usa la de por defecto.
export function guessCategId(name: string, cats: Categoria[], fallback: number): number {
  const n = norm(limpiarNombre(name));
  for (const c of cats) {
    const words = norm(c.name).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    if (words.some((w) => n.includes(w) || n.includes(w.replace(/e?s$/, "")))) return c.id;
  }
  return fallback;
}

/* ---------- Tarifas por volumen (hasta 3: ej. 2×$100, 3×$80, 5×$60) ---------- */
type TarStr = { qty: string; price: string };
const TAR_VACIAS = (): TarStr[] => [{ qty: "", price: "" }, { qty: "", price: "" }, { qty: "", price: "" }];
const tarToPayload = (ts: TarStr[]) =>
  (ts || []).map((t) => ({ qty: Number(t.qty) || 0, price: Number(t.price) || 0 })).filter((t) => t.qty >= 2 && t.price > 0);
const tarFromPayload = (arr: { qty: number; price: number }[] | undefined | null): TarStr[] => {
  const base = TAR_VACIAS();
  (arr || []).slice(0, 3).forEach((t, i) => { base[i] = { qty: String(t.qty), price: String(t.price) }; });
  return base;
};
const tarResumen = (ts: TarStr[]) => tarToPayload(ts).map((t) => `${t.qty}×$${t.price}`).join(" · ");

function TarifasEditor({ value, onChange }: { value: TarStr[]; onChange: (v: TarStr[]) => void }) {
  const set = (i: number, k: "qty" | "price", v: string) =>
    onChange(value.map((t, j) => (j === i ? { ...t, [k]: v.replace(/[^\d]/g, "") } : t)));
  return (
    <div className="space-y-1.5">
      {value.map((t, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-4 text-[12px] font-bold text-slate-400">{i + 1}.</span>
          <span className="text-[12px] text-slate-500">Al llevar</span>
          <input className="pf-input w-16 px-2 py-1.5 text-center" inputMode="numeric" value={t.qty}
            onChange={(e) => set(i, "qty", e.target.value)} placeholder="pzs" />
          <span className="text-[12px] text-slate-500">o más =</span>
          <span className="text-slate-400">$</span>
          <input className="pf-input w-20 px-2 py-1.5" inputMode="numeric" value={t.price}
            onChange={(e) => set(i, "price", e.target.value)} placeholder="c/u" />
        </div>
      ))}
      <p className="text-[11px] text-slate-400">Ej. 2 → $100, 3 → $80, 5 → $60. Deja vacío el que no uses. En caja se toma solo al capturar esa cantidad.</p>
    </div>
  );
}

/* ---------- Login ---------- */
const APROBADORES = ["ana", "luis"];
const esNombreAprob = (n: string) => APROBADORES.includes(norm(n).trim());

export function Login() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [pass, setPass] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const aprob = esNombreAprob(nombre);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    start(async () => {
      const r = await loginAction(pass, nombre, pin);
      if (r.ok) router.refresh();
      else setErr(r.error);
    });
  }
  const chip = "rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition";
  const field = "w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-center font-semibold outline-none focus:border-[#2e6da4] focus:bg-white";
  return (
    <div className="font-display flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0e2650] via-[#164079] to-[#2e6da4] px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bam-blanco.png" alt="BAM!" className="mb-5 h-11 w-auto" />
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] border-4 border-white/20 bg-white p-7 shadow-2xl">
        <h1 className="font-display text-2xl font-bold text-[#0e2650]">Subir productos</h1>
        <p className="mt-0.5 mb-4 text-sm text-gray-500">Entra con tu nombre 👇</p>
        <p className="mb-1.5 text-sm font-bold text-gray-700">¿Quién eres?</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {["Ana", "Luis"].map((n) => (
            <button key={n} type="button" onClick={() => setNombre(n)}
              className={chip + (nombre === n ? " border-[#2e6da4] bg-[#2e6da4] text-white" : " border-gray-200 text-gray-600 hover:border-[#5ba3dc]")}>
              {n}
            </button>
          ))}
        </div>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Tu nombre" className={field} />
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Contraseña" className={field + " mt-3"} />
        {aprob && (
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN de aprobador"
            className="mt-3 w-full rounded-2xl border-2 border-sky-300 bg-sky-50 px-4 py-3 text-center font-semibold outline-none focus:border-[#2e6da4] focus:bg-white" />
        )}
        {err && <p className="mt-2 text-center text-sm font-semibold text-red-600">{err}</p>}
        <button disabled={pending} className="font-display mt-5 w-full rounded-2xl bg-[#2e6da4] px-4 py-3.5 text-lg font-bold text-white shadow-lg transition hover:bg-[#0e2650] disabled:bg-gray-300">
          {pending ? "Entrando…" : "Entrar"}
        </button>
        {aprob && <p className="mt-3 text-center text-[11px] text-gray-400">Como aprobador necesitas tu PIN.</p>}
      </form>
      <p className="mt-5 text-[12px] font-semibold text-white/50">BAM! · a brand made for you</p>
    </div>
  );
}

/* ---------- Admin (contenedor) ---------- */
export function Admin({ categorias, usuario, aprobador }: { categorias: Categoria[]; usuario: string; aprobador: boolean }) {
  const router = useRouter();
  // Solo los aprobadores (Ana/Luis) ven el Historial completo.
  const verHistorial = aprobador;
  // Navegación tipo plataforma: secciones (grupos) con sus pantallas en el sidebar
  const nav: { grupo: string; items: [string, string][] }[] = aprobador
    ? [
        { grupo: "Subir productos", items: [["rapido", "⚡ Carga rápida"], ["crear", "➕ Uno por uno"], ["saldos", "🏷️ Saldos"], ["resurtir", "🔄 Resurtir"], ["bodega", "🆕 Bodega"], ["sinfoto", "📸 Sin foto"], ["ultimos", "🔢 Últimos modelos"]] },
        { grupo: "Descripciones y editar", items: [["descripciones", "📝 Descripciones"], ["buscar", "🔎 Buscar y editar"], ["productos", "📂 Productos"]] },
        { grupo: "Catálogo cliente", items: [["ajustes-cat", "🎨 Catálogo"]] },
        { grupo: "Archivo", items: [["archivados", "🗄️ Archivados"], ["eliminados", "🗑️ Eliminados"]] },
        { grupo: "Inventario", items: [["ajustes", "📋 Conteos y ajustes"], ["notas", "🧾 Notas vs inventario"]] },
        { grupo: "Revisión", items: [["revision", "✅ Aprobaciones"], ["historial", "📜 Historial"]] },
      ]
    : [
        { grupo: "Subir productos", items: [["rapido", "⚡ Carga rápida"], ["crear", "➕ Uno por uno"], ["saldos", "🏷️ Saldos"], ["resurtir", "🔄 Resurtir"], ["bodega", "🆕 Bodega"], ["sinfoto", "📸 Sin foto"], ["ultimos", "🔢 Últimos modelos"]] },
        { grupo: "Descripciones y editar", items: [["descripciones", "📝 Descripciones"], ["buscar", "🔎 Buscar y editar"], ["productos", "📂 Productos"]] },
        { grupo: "Catálogo cliente", items: [["ajustes-cat", "🎨 Catálogo"]] },
        { grupo: "Archivo", items: [["archivados", "🗄️ Archivados"], ["eliminados", "🗑️ Eliminados"]] },
        { grupo: "Mis solicitudes", items: verHistorial ? [["revision", "🕒 Mis solicitudes"], ["historial", "📜 Historial"]] : [["revision", "🕒 Mis solicitudes"]] },
      ];
  const todos = nav.flatMap((g) => g.items);
  const [tab, setTab] = useState<string>(todos[0][0]);
  const [visitados, setVisitados] = useState<Set<string>>(() => new Set([todos[0][0]]));
  const [menu, setMenu] = useState(false);
  const titulo = todos.find(([id]) => id === tab)?.[1] || "";
  // separa el emoji (color normal) del texto (degradado) para que el emoji NO salga azul
  const _sp = titulo.indexOf(" ");
  const tituloEmoji = _sp > 0 ? titulo.slice(0, _sp) : "";
  const tituloTxt = _sp > 0 ? titulo.slice(_sp + 1) : titulo;
  function ir(id: string) { setTab(id); setMenu(false); setVisitados((v) => (v.has(id) ? v : new Set(v).add(id))); try { localStorage.setItem("bam-subir-tab", id); } catch { /* noop */ } }
  // Al recargar la página, regresa a la última pantalla donde estaba (no se pierde el lugar).
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bam-subir-tab");
      if (saved && saved !== tab && todos.some(([id]) => id === saved)) {
        setTab(saved);
        setVisitados((v) => (v.has(saved) ? v : new Set(v).add(saved)));
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Evita que el scroll del mouse o las flechas ↑↓ cambien el precio en los campos numéricos.
  useEffect(() => {
    const isNum = (el: Element | null) => !!el && el.tagName === "INPUT" && (el as HTMLInputElement).type === "number";
    const onWheel = () => { const el = document.activeElement; if (isNum(el)) (el as HTMLElement).blur(); };
    const onKey = (e: KeyboardEvent) => { if (isNum(e.target as Element) && (e.key === "ArrowUp" || e.key === "ArrowDown")) e.preventDefault(); };
    document.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("wheel", onWheel); document.removeEventListener("keydown", onKey); };
  }, []);

  const Sidebar = (
    <div className="flex h-full flex-col text-white">
      <div className="px-5 pb-5 pt-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bam-blanco.png" alt="BAM!" className="h-12 w-auto" />
        <p className="font-display mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Plataforma interna</p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {nav.map((g) => (
          <div key={g.grupo}>
            <p className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-200/60">{g.grupo}</p>
            <div className="space-y-1">
              {g.items.map(([id, lbl]) => (
                <button key={id} onClick={() => ir(id)}
                  className={"flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left text-sm font-semibold transition " + (tab === id ? "bg-gradient-to-r from-[#2e6da4] to-[#5ba3dc] font-bold text-white shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white")}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="m-3 rounded-2xl bg-white/10 px-4 py-3">
        <p className="text-[13px] text-white/85">Hola, <b className="text-white">{usuario}</b></p>
        {aprobador && <span className="mt-1 inline-block rounded-full bg-sky-300 px-2 py-0.5 text-[10px] font-extrabold text-[#0d2a52]">APROBADOR</span>}
        <button onClick={() => logoutAction().then(() => router.refresh())} className="mt-2 block text-[13px] font-bold text-white/70 hover:text-white">Salir →</button>
      </div>
    </div>
  );

  return (
    <div className="pf-page min-h-screen font-display">
      {menu && <div onClick={() => setMenu(false)} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden" />}
      <div className="flex min-h-screen">
        <aside className={"pf-side fixed inset-y-0 left-0 z-40 w-64 shadow-2xl transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:w-60 md:translate-x-0 md:shadow-none " + (menu ? "translate-x-0" : "-translate-x-full")}>
          {Sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-6 py-4 backdrop-blur">
            <button onClick={() => setMenu(true)} aria-label="Menú" className="rounded-xl border border-slate-200 px-2.5 py-1 text-lg leading-none text-slate-600 md:hidden">☰</button>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
              {tituloEmoji && <span>{tituloEmoji}</span>}
              <span className="grad-text">{tituloTxt}</span>
            </h1>
            <Notif usuario={usuario} aprobador={aprobador} />
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
            {/* Pestañas "vivas": una vez visitada, la sección NO se desmonta (solo se oculta),
                así se conserva TODO lo escrito/buscado/subido al cambiar de pestaña. */}
            {visitados.has("rapido") && <div hidden={tab !== "rapido"}><CargaRapida categorias={categorias} /></div>}
            {visitados.has("crear") && <div hidden={tab !== "crear"}><CrearForm categorias={categorias} /></div>}
            {visitados.has("saldos") && <div hidden={tab !== "saldos"}><SaldosForm categorias={categorias} /></div>}
            {visitados.has("resurtir") && <div hidden={tab !== "resurtir"}><ResurtirPanel /></div>}
            {visitados.has("bodega") && <div hidden={tab !== "bodega"}><ResurtirPanel soloBodega /></div>}
            {visitados.has("sinfoto") && <div hidden={tab !== "sinfoto"}><SinFotoBodegaPanel /></div>}
            {visitados.has("ultimos") && <div hidden={tab !== "ultimos"}><UltimosModelosPanel /></div>}
            {visitados.has("descripciones") && <div hidden={tab !== "descripciones"}><DescripcionesPanel /></div>}
            {visitados.has("buscar") && <div hidden={tab !== "buscar"}><BuscarPanel categorias={categorias} aprobador={aprobador} /></div>}
            {visitados.has("productos") && <div hidden={tab !== "productos"}><ProductosPanel categorias={categorias} aprobador={aprobador} /></div>}
            {visitados.has("ajustes-cat") && <div hidden={tab !== "ajustes-cat"}><AjustesPanel /></div>}
            {visitados.has("archivados") && <div hidden={tab !== "archivados"}><ArchivadosPanel /></div>}
            {visitados.has("eliminados") && <div hidden={tab !== "eliminados"}><EliminadosPanel /></div>}
            {visitados.has("revision") && <div hidden={tab !== "revision"}><AprobacionesPanel aprobador={aprobador} /></div>}
            {visitados.has("historial") && <div hidden={tab !== "historial"}><HistorialPanel /></div>}
            {aprobador && visitados.has("ajustes") && <div hidden={tab !== "ajustes"}><ConteosAjustesPanel /></div>}
            {aprobador && visitados.has("notas") && <div hidden={tab !== "notas"}><NotasVsInventarioPanel /></div>}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ---------- Aprobaciones / Mis solicitudes ---------- */
function AprobacionesPanel({ aprobador }: { aprobador: boolean }) {
  const [items, setItems] = useState<Pendiente[]>([]);
  const [rechazados, setRechazados] = useState<Pendiente[]>([]);
  const [aprobados, setAprobados] = useState<Pendiente[]>([]);
  const [estado, setEstado] = useState<Record<number, "ok" | "no">>({});
  const [pending, start] = useTransition();
  const [cargado, setCargado] = useState(false);
  const [nota, setNota] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  function cargar() {
    start(async () => {
      setItems(await pendientesAction()); setEstado({}); setNota(""); setCargado(true);
      if (!aprobador) { setRechazados(await misRechazadosAction()); setAprobados(await misAprobadosAction()); }
    });
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  function aprobar(id: number) {
    if (estado[id]) return; // ya resuelto: no se re-aprueba
    start(async () => { const r = await aprobarAction(id); if (r.ok) { setEstado((e) => ({ ...e, [id]: "ok" })); setNota("✅ Aprobado y aplicado."); } else setNota("❌ " + r.error); });
  }
  function rechazar(id: number) {
    if (estado[id]) return;
    const motivo = prompt("¿Por qué se rechaza? Se le regresa a la persona con este mensaje para que lo corrija:");
    if (motivo === null) return; // canceló
    start(async () => { const r = await rechazarAction(id, motivo); if (r.ok) { setEstado((e) => ({ ...e, [id]: "no" })); setNota("Rechazado y regresado para corregir."); } else setNota("❌ " + r.error); });
  }
  const fmt = (iso: string) => new Date(iso.replace(" ", "T") + "Z").toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const img = (p: Pendiente) => (p.payload && typeof p.payload.imageBase64 === "string" && p.payload.imageBase64) ? String(p.payload.imageBase64) : "";
  const porAprobar = items.filter((i) => !estado[i.id]).length;
  // Aprobador: descripciones y nombres van a secciones con "seleccionar varias + aceptar en lote".
  const TIPOS_LOTE = ["descripcion", "nombre"];
  const otros = aprobador ? items.filter((p) => !TIPOS_LOTE.includes(p.tipo)) : items;
  function toggleSel(id: number) { setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function seleccionarTodas(ids: number[]) {
    const pend = ids.filter((id) => !estado[id]);
    setSel((s) => {
      const todas = pend.length > 0 && pend.every((id) => s.has(id));
      const n = new Set(s);
      pend.forEach((id) => (todas ? n.delete(id) : n.add(id)));
      return n;
    });
  }
  function aceptarSel(ids: number[]) {
    const sub = ids.filter((id) => sel.has(id) && !estado[id]);
    if (!sub.length) return;
    start(async () => {
      const r = await aprobarMultiAction(sub);
      if (r.ok) { setEstado((e) => { const n = { ...e }; sub.forEach((id) => (n[id] = "ok")); return n; }); setSel((s) => { const n = new Set(s); sub.forEach((id) => n.delete(id)); return n; }); setNota(`✅ ${r.hechos} aprobada(s).`); }
      else setNota("❌ " + r.error);
    });
  }
  return (
    <div className="pf-card p-5">
      <PanelHead emoji={aprobador ? "✅" : "🕒"} tono={aprobador ? "bg-green-100" : "bg-amber-100"}
        titulo={aprobador ? "Aprobaciones" : "Mis solicitudes"}
        sub={aprobador ? `${porAprobar} por aprobar · apruébalas una por una` : `Tu historial: 🟡 en revisión · 🟢 aprobadas · 🔴 rechazadas`}
        right={<button onClick={cargar} disabled={pending} className={REFRESH}>{pending ? "…" : "↻ Actualizar"}</button>} />
      {aprobador && items.length > 0 && <p className="mb-2 text-[12px] text-gray-400">Aprueba <b>una por una</b>: cada renglón se marca aquí mismo y la lista <b>no se mueve</b>. Al terminar, pica <b>↻ Actualizar</b>.</p>}
      {nota && <p className="mb-2 text-[13px] font-semibold text-gray-600">{nota}</p>}
      {cargado && items.length === 0 && <p className="py-8 text-center text-sm text-gray-400">{aprobador ? "No hay nada pendiente por aprobar. 🎉" : "No tienes solicitudes en revisión."}</p>}

      {/* Descripciones y Nombres: secciones con "seleccionar varias + aceptar en lote" (solo aprobador) */}
      {aprobador && ([
        { tipo: "descripcion", titulo: "📝 Descripciones", border: "border-violet-200", head: "bg-violet-100 text-violet-800", divide: "divide-violet-100", chk: "accent-violet-600" },
        { tipo: "nombre", titulo: "✏️ Nombres", border: "border-amber-200", head: "bg-amber-100 text-amber-800", divide: "divide-amber-100", chk: "accent-amber-600" },
      ] as const).map((cfg) => {
        const lista = items.filter((p) => p.tipo === cfg.tipo);
        if (lista.length === 0) return null;
        const ids = lista.map((p) => p.id);
        const pend = lista.filter((p) => !estado[p.id]);
        const selN = ids.filter((id) => sel.has(id) && !estado[id]).length;
        const todasSel = pend.length > 0 && pend.every((p) => sel.has(p.id));
        return (
          <div key={cfg.tipo} className={"mb-4 overflow-hidden rounded-2xl border-2 " + cfg.border}>
            <div className={"flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 " + cfg.head}>
              <h3 className="font-bold">{cfg.titulo} <span className="text-sm font-semibold">· {pend.length} por aprobar</span></h3>
              <div className="flex gap-2">
                <button onClick={() => seleccionarTodas(ids)} disabled={pend.length === 0}
                  className="rounded-lg border border-black/10 bg-white px-3 py-1 text-xs font-bold text-slate-700 disabled:opacity-50">
                  {todasSel ? "Quitar selección" : "Seleccionar todas"}
                </button>
                <button onClick={() => aceptarSel(ids)} disabled={pending || selN === 0}
                  className="rounded-lg bg-green-600 px-3 py-1 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">✅ Aceptar ({selN})</button>
              </div>
            </div>
            <ul className={"divide-y " + cfg.divide}>
              {lista.map((p) => {
                const st = estado[p.id];
                return (
                  <li key={p.id} className={"flex items-center gap-3 px-4 py-2.5 " + (st ? "opacity-50" : "")}>
                    {!st && <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} className={"h-5 w-5 shrink-0 " + cfg.chk} />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-700">{p.resumen}</p>
                      <p className="text-[11px] text-slate-400">{p.persona} · {fmt(p.fecha)}</p>
                    </div>
                    {st === "ok" ? <span className="shrink-0 rounded-lg bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">✅</span>
                      : st === "no" ? <span className="shrink-0 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600">❌</span>
                      : <div className="flex shrink-0 gap-1">
                          <button onClick={() => aprobar(p.id)} disabled={pending} className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">Aprobar</button>
                          <button onClick={() => rechazar(p.id)} disabled={pending} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-500 hover:bg-red-50 disabled:opacity-50">Rechazar</button>
                        </div>}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <ul className="divide-y divide-slate-100">
        {(aprobador ? otros : items).map((p) => {
          if (!aprobador) return <MiPendienteRow key={p.id} p={p} onSaved={cargar} />;
          const st = estado[p.id];
          return (
            <li key={p.id} className={"flex items-start gap-3 py-3 " + (st ? "opacity-50" : "")}>
              {img(p)
                ? <img src={`data:image/jpeg;base64,${img(p)}`} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover" />
                : <span className="mt-0.5 shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">{p.persona}</span>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><TipoTag tipo={p.tipo} /><p className="text-[13px] text-slate-700">{p.resumen}</p></div>
                <p className="text-[11px] text-slate-400">{img(p) ? p.persona + " · " : ""}{fmt(p.fecha)}</p>
              </div>
              {st === "ok" ? <span className="shrink-0 self-center rounded-lg bg-green-100 px-3 py-1 text-xs font-bold text-green-700">✅ Aprobado</span>
                : st === "no" ? <span className="shrink-0 self-center rounded-lg bg-red-100 px-3 py-1 text-xs font-bold text-red-600">❌ Rechazado</span>
                  : <div className="flex shrink-0 gap-2">
                      <button onClick={() => aprobar(p.id)} disabled={pending} className="rounded-lg bg-green-600 px-3 py-1 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">Aprobar</button>
                      <button onClick={() => rechazar(p.id)} disabled={pending} className="rounded-lg border border-red-200 px-3 py-1 text-xs font-bold text-red-500 hover:bg-red-50 disabled:opacity-50">Rechazar</button>
                    </div>}
            </li>
          );
        })}
      </ul>
      {aprobador && cargado && items.length > 0 && porAprobar === 0 && (
        <p className="mt-3 text-center text-[13px] font-semibold text-green-600">¡Listo, revisaste todas! Pica “↻ Actualizar” para limpiar la lista.</p>
      )}

      {!aprobador && aprobados.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-bold text-green-600">🟢 Aprobadas ({aprobados.length})</p>
          <ul className="divide-y divide-slate-100">
            {aprobados.map((p) => (
              <li key={p.id} className="flex items-start gap-3 py-2">
                <span className="mt-0.5 shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">🟢</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><TipoTag tipo={p.tipo} /><p className="text-[13px] text-slate-700">{p.resumen}</p></div>
                  <p className="text-[11px] text-slate-400">Aprobó <b>{p.por || "?"}</b> · {fmt(p.resueltoFecha || p.fecha)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!aprobador && rechazados.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-bold text-red-600">🔴 Rechazadas — corrígelas y reenvía ({rechazados.length})</p>
          <div className="space-y-3">
            {rechazados.map((p) => <CorregirRow key={p.id} p={p} onReenviado={cargar} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Corregir una solicitud rechazada y reenviarla ---------- */
const fmtMx = (iso?: string) => iso ? new Date(iso.replace(" ", "T") + "Z").toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const CAMPOS_CORR: Record<string, { key: string; label: string; num?: boolean }[]> = {
  crear: [{ key: "name", label: "Nombre" }, { key: "sku", label: "SKU" }, { key: "publico", label: "Público", num: true }, { key: "miembro", label: "Miembro", num: true }, { key: "cantidad", label: "Cantidad", num: true }, { key: "liquidacion", label: "Liquidación", num: true }],
  precios: [{ key: "publico", label: "Público", num: true }, { key: "miembro", label: "Miembro", num: true }],
  stock: [{ key: "qty", label: "Cantidad", num: true }],
  resurtir: [{ key: "nueva", label: "Nueva cantidad total", num: true }],
  nombre: [{ key: "nombre", label: "Nombre" }],
  sku: [{ key: "sku", label: "SKU" }],
  liquidacion: [{ key: "price", label: "Precio liquidación", num: true }],
};

function CorregirRow({ p, onReenviado, modo = "rechazado" }: { p: Pendiente; onReenviado: () => void; modo?: "rechazado" | "pendiente" }) {
  const esRej = modo === "rechazado";
  const campos = CAMPOS_CORR[p.tipo] || [];
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const c of campos) { const v = p.payload[c.key]; o[c.key] = v == null ? "" : String(v); }
    return o;
  });
  const [pend, start] = useTransition();
  const [nota, setNota] = useState("");
  const [listo, setListo] = useState(false);
  function guardar() {
    const nuevoPayload: Record<string, unknown> = { ...p.payload };
    for (const c of campos) nuevoPayload[c.key] = c.num ? (Number(vals[c.key]) || 0) : vals[c.key];
    start(async () => {
      const r = esRej
        ? await reenviarAction(p.id, nuevoPayload, "✏️ (corregido) " + p.resumen)
        : await editarPendienteAction(p.id, nuevoPayload, "✏️ (editado) " + p.resumen);
      if (r.ok) { setListo(true); setNota(esRej ? "✅ Reenviado a revisión" : "✅ Guardado"); onReenviado(); } else setNota("❌ " + r.error);
    });
  }
  const inp = "pf-input w-full px-3 py-2 text-sm";
  if (listo) return <div className="rounded-xl border border-green-200 bg-green-50 p-2 text-[13px] font-semibold text-green-700">{esRej ? "✅ Reenviado" : "✅ Guardado"} — {p.resumen}</div>;
  return (
    <div className={"rounded-xl border p-3 " + (esRej ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-slate-50/60")}>
      {esRej && (
        <>
          <div className="flex flex-wrap items-center gap-2"><TipoTag tipo={p.tipo} /><p className="text-[13px] font-semibold text-slate-700">{p.resumen}</p></div>
          <p className="mt-0.5 text-[11px] text-slate-400">Rechazó <b className="text-slate-500">{p.por || "?"}</b> · {fmtMx(p.resueltoFecha || p.fecha)}</p>
          {p.motivo && <p className="mt-0.5 text-[12px] font-semibold text-red-600">Motivo: {p.motivo}</p>}
        </>
      )}
      {campos.length > 0 ? (
        <div className={(esRej ? "mt-2 " : "") + "grid gap-2 sm:grid-cols-2"}>
          {campos.map((c) => (
            <label key={c.key} className="text-[11px] font-semibold text-slate-500">{c.label}
              <input className={inp} type={c.num ? "number" : "text"} value={vals[c.key]} onChange={(e) => setVals((s) => ({ ...s, [c.key]: e.target.value }))} />
            </label>
          ))}
        </div>
      ) : <p className="mt-1 text-[12px] text-slate-500">Esta solicitud no tiene campos editables aquí. {esRej ? "Puedes reenviarla o pedir ayuda a Ana." : ""}</p>}
      <div className="mt-2 flex items-center gap-2">
        {nota && <span className="text-[12px] font-semibold text-slate-600">{nota}</span>}
        <button onClick={guardar} disabled={pend} className="ml-auto rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark disabled:bg-gray-300">{pend ? "…" : esRej ? "Reenviar corregido" : "Guardar cambios"}</button>
      </div>
    </div>
  );
}

/* ---------- Mi solicitud pendiente (Sofía la puede editar aunque no la hayan rechazado) ---------- */
function MiPendienteRow({ p, onSaved }: { p: Pendiente; onSaved: () => void }) {
  const [editar, setEditar] = useState(false);
  const [pend, start] = useTransition();
  const editable = (CAMPOS_CORR[p.tipo] || []).length > 0;
  function cancelar() {
    if (!confirm("¿Cancelar esta solicitud? Ya no se enviará a revisión.")) return;
    start(async () => { const r = await cancelarPendienteAction(p.id); if (r.ok) onSaved(); else alert(r.error); });
  }
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">🟡 En revisión</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><TipoTag tipo={p.tipo} /><p className="text-[13px] text-slate-700">{p.resumen}</p></div>
          <p className="text-[11px] text-slate-400">{fmtMx(p.fecha)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-center">
          {editable && (
            <button onClick={() => setEditar((v) => !v)} disabled={pend} className="rounded-lg border border-brand/40 px-3 py-1 text-xs font-bold text-brand transition hover:bg-brand/10 disabled:opacity-50">
              {editar ? "Cerrar" : "✏️ Editar"}
            </button>
          )}
          <button onClick={cancelar} disabled={pend} className="rounded-lg border border-red-200 px-3 py-1 text-xs font-bold text-red-500 transition hover:bg-red-50 disabled:opacity-50">
            {pend ? "…" : "Cancelar"}
          </button>
        </div>
      </div>
      {editar && <div className="mt-2"><CorregirRow p={p} modo="pendiente" onReenviado={() => { setEditar(false); onSaved(); }} /></div>}
    </li>
  );
}

/* ---------- Descripciones (con / sin, por categoría, con "completado") ---------- */
function DescRow({ p, onSaved, onArchived, sel }: { p: ProdDesc; onSaved: (id: number, texto: string) => void; onArchived: (id: number) => void; sel?: { on: boolean; checked: boolean; toggle: () => void } }) {
  const [txt, setTxt] = useState(p.desc);
  const [pend, start] = useTransition();
  const [ok, setOk] = useState(false);
  const [nombre, setNombre] = useState(p.name);
  const [nmsg, setNmsg] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  function guardarNombre() {
    start(async () => {
      const r = await setNombreAction(p.id, nombre.trim() || p.name, p.name);
      setNmsg(r.ok ? (r.pendiente ? "🕒 enviado a revisión" : "✓ guardado") : ("❌ " + r.error));
      setTimeout(() => setNmsg(""), 2500);
    });
  }
  // restaura lo que Sofía dejó a medias (sobrevive cambio de pestaña / recarga)
  useEffect(() => {
    const b = leerBorradores()[p.id];
    if (b != null && b !== p.desc) setTxt(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function cambia(val: string) { setTxt(val); guardarBorrador(p.id, val, p.desc); }
  // pone/quita *asteriscos* al texto seleccionado (negritas)
  function negritas() {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) { // sin selección: inserta ** y deja el cursor en medio
      const nuevo = txt.slice(0, s) + "**" + txt.slice(e);
      cambia(nuevo);
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + 1; });
      return;
    }
    const sel = txt.slice(s, e);
    const yaEsta = sel.startsWith("*") && sel.endsWith("*") && sel.length >= 2;
    const nuevoSel = yaEsta ? sel.replace(/^\*+/, "").replace(/\*+$/, "") : `*${sel}*`;
    const nuevo = txt.slice(0, s) + nuevoSel + txt.slice(e);
    cambia(nuevo);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s; ta.selectionEnd = s + nuevoSel.length; });
  }
  const dirty = txt.trim() !== p.desc.trim();
  function guardar() {
    start(async () => {
      const r = await setDescripcionAction(p.id, txt, `${p.name} (${p.sku})`);
      if (r.ok) { borrarBorrador(p.id); onSaved(p.id, txt.trim()); setOk(true); setTimeout(() => setOk(false), 1500); } else alert(r.error);
    });
  }
  function archivar() {
    if (!confirm(`¿Archivar "${p.name}"? Sale del catálogo y de esta lista. Se puede restaurar en 🗄️ Archivados.`)) return;
    start(async () => {
      const r = await archivarAction(p.id, `${p.name} (${p.sku})`);
      if (r.ok) { borrarBorrador(p.id); onArchived(p.id); } else alert(r.error);
    });
  }
  return (
    <div className={"rounded-xl border p-2 " + (sel?.checked ? "border-brand ring-2 ring-brand/40 " : "") + (dirty ? "border-amber-300 bg-amber-50/40" : p.desc.trim() ? "border-gray-100" : "border-gray-200")}>
      <div className="flex gap-2">
        {sel?.on && <input type="checkbox" checked={sel.checked} onChange={sel.toggle} className="mt-1 h-5 w-5 shrink-0 self-start accent-brand" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.imageUrl} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-lg border border-gray-100 bg-gray-50 object-cover" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <input value={nombre} maxLength={45} onChange={(e) => setNombre(e.target.value.slice(0, 45))}
              className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-[13px] font-semibold text-gray-800 outline-none focus:border-brand" />
            {nombre.trim() !== p.name
              ? <button onClick={guardarNombre} disabled={pend} className="shrink-0 rounded bg-brand px-2 py-1 text-[11px] font-bold text-white disabled:bg-gray-300">Guardar</button>
              : nmsg && <span className="shrink-0 text-[10px] font-semibold text-gray-500">{nmsg}</span>}
            <span className="shrink-0 font-mono text-[10px] text-gray-400">{p.sku}</span>
          </div>
          <div className="mb-1 flex items-center gap-2">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={negritas} title="Negritas: selecciona el texto y pica aquí (o Ctrl+B)"
              className="rounded border border-gray-300 px-2 py-0.5 text-xs font-black text-gray-700 hover:bg-gray-100">N</button>
            <span className="text-[10px] text-gray-400">selecciona palabras y pica <b>N</b> (o Ctrl+B) para ponerlas en negritas</span>
          </div>
          <textarea ref={taRef} value={txt} onChange={(e) => cambia(e.target.value)} rows={2} placeholder="Escribe la descripción…"
            onKeyDown={(ev) => { if ((ev.ctrlKey || ev.metaKey) && (ev.key === "b" || ev.key === "B" || ev.key === "n" || ev.key === "N")) { ev.preventDefault(); negritas(); } }}
            className="w-full rounded-lg border border-gray-200 p-2 text-sm outline-none focus:border-brand" />
          {txt.includes("*") && (
            <p className="mt-1 whitespace-pre-line rounded-lg bg-gray-50 px-2 py-1.5 text-[12px] leading-snug text-gray-600">
              <span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-gray-400">Vista previa:</span>{renderNegritas(txt)}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <button onClick={archivar} disabled={pend} title="Archivar (ocultar) este producto"
              className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-600 hover:bg-amber-50 disabled:opacity-50">🗄️ Archivar</button>
            {dirty && !ok && <span className="text-[11px] font-semibold text-amber-600">● sin guardar</span>}
            {ok && <span className="text-[11px] font-semibold text-green-600">guardado ✓</span>}
            <button onClick={guardar} disabled={pend || !dirty}
              className="ml-auto rounded-lg bg-brand px-3 py-1 text-xs font-bold text-white hover:bg-brand-dark disabled:bg-gray-300">
              {pend ? "…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DescripcionesPanel() {
  const [prods, setProds] = useState<ProdDesc[]>([]);
  const [pending, start] = useTransition();
  const [cargado, setCargado] = useState(false);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [vista, setVista] = useState<"sin" | "con">("sin");
  const [q, setQ] = useState("");
  // selección múltiple para poner la MISMA descripción a varios
  const s = useSeleccion();
  const [bulkTxt, setBulkTxt] = useState("");
  const [pendBulk, startBulk] = useTransition();
  const [notaBulk, setNotaBulk] = useState("");
  const bulkRef = useRef<HTMLTextAreaElement>(null);
  function cargar() {
    start(async () => {
      const d = await descripcionesAction();
      setProds(d);
      setAbiertas(new Set()); // arrancan TODAS cerradas; Sofía abre las que va usando
      s.salir();
      setCargado(true);
    });
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  function onSaved(id: number, texto: string) { setProds((ps) => ps.map((p) => (p.id === id ? { ...p, desc: texto } : p))); }
  function onArchived(id: number) { setProds((ps) => ps.filter((p) => p.id !== id)); }
  const seleccionados = prods.filter((p) => s.sel.has(p.id));
  function aplicarBulk() {
    const ids = seleccionados.map((p) => p.id);
    if (!ids.length) return;
    if (!bulkTxt.trim() && !confirm("La descripción está vacía. ¿Dejar en blanco (borrar) la descripción de los seleccionados?")) return;
    startBulk(async () => {
      const r = await setDescripcionMultiAction(ids, bulkTxt);
      if (r.ok) {
        setProds((ps) => ps.map((p) => (s.sel.has(p.id) ? { ...p, desc: bulkTxt.trim() } : p)));
        ids.forEach((id) => borrarBorrador(id));
        setNotaBulk(`✅ Descripción aplicada a ${r.hechos} producto(s).`);
        s.salir(); setBulkTxt("");
        setTimeout(() => setNotaBulk(""), 4000);
      } else setNotaBulk("❌ " + r.error);
    });
  }
  function toggle(cat: string) { setAbiertas((s) => { const n = new Set(s); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; }); }

  const grupos = useMemo(() => {
    const m = new Map<string, ProdDesc[]>();
    for (const p of prods) { const k = p.categoria || "Otros"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); }
    const arr = [...m.entries()].map(([cat, items]) => {
      const con = items.filter((i) => i.desc.trim()).length;
      const orden = [...items].sort((a, b) => (a.desc.trim() ? 1 : 0) - (b.desc.trim() ? 1 : 0) || a.name.localeCompare(b.name, "es"));
      return { cat, items: orden, total: items.length, con, completa: con === items.length };
    });
    arr.sort((a, b) => (a.completa ? 1 : 0) - (b.completa ? 1 : 0) || a.cat.localeCompare(b.cat, "es"));
    return arr;
  }, [prods]);

  const totalSin = prods.filter((p) => !p.desc.trim()).length;
  const totalCon = prods.filter((p) => p.desc.trim()).length;
  const catsCompletas = grupos.filter((g) => g.completa).length;

  return (
    <div className="space-y-3">
      <div className="pf-card p-5">
        <PanelHead emoji="📝" tono="bg-brand-light" titulo="Descripciones"
          sub="Escríbelas y se ven en el catálogo al momento (no pasan por revisión)."
          right={<button onClick={cargar} disabled={pending} className={REFRESH}>{pending ? "…" : "↻ Actualizar"}</button>} />
        <p className="mt-1 text-[12px] text-gray-500">
          {cargado ? <>{grupos.length} categorías · <b className="text-green-600">{catsCompletas} completas</b> · <b className="text-amber-600">{totalSin} productos sin descripción</b></> : "Cargando…"}
        </p>
        <p className="mt-1 text-[11px] text-gray-400">Las descripciones se guardan al momento (no pasan por revisión) para ver el avance. Aparecen en el catálogo. <b>Tip:</b> lo que pongas entre *asteriscos* sale en <b>negritas</b>. Lo que dejes a medias no se borra aunque cambies de pestaña.</p>
        <div className="relative mt-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Busca un producto por nombre o código…"
            className="pf-input w-full px-4 py-2.5 text-sm" />
          {q && <button onClick={() => setQ("")} aria-label="Limpiar" className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full bg-gray-200 text-xs text-gray-600 hover:bg-gray-300">✕</button>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!s.modo
            ? <button onClick={() => s.setModo(true)} className="pf-chip px-3.5 py-1.5 text-xs">☑️ Seleccionar varios (misma descripción)</button>
            : <button onClick={s.salir} className="pf-chip px-3.5 py-1.5 text-xs">Salir de selección</button>}
          {s.modo && <span className="text-[12px] font-semibold text-brand-dark">{seleccionados.length} seleccionado(s)</span>}
        </div>
        {s.modo && <p className="mt-1 text-[11px] text-gray-400">Marca los productos que llevan la <b>misma</b> descripción (puedes abrir cada categoría y usar “seleccionar todos”), escríbela abajo y pica <b>Aplicar</b>.</p>}
        {!q.trim() && (
          <div className="mt-3 flex gap-2">
            <button onClick={() => setVista("sin")}
              className={"flex-1 rounded-xl px-3 py-2 text-sm font-bold " + (vista === "sin" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100")}>
              🟡 Sin descripción: {totalSin}
            </button>
            <button onClick={() => setVista("con")}
              className={"flex-1 rounded-xl px-3 py-2 text-sm font-bold " + (vista === "con" ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-100")}>
              🟢 Con descripción: {totalCon}
            </button>
          </div>
        )}
      </div>

      {cargado && !q.trim() && (vista === "sin" ? totalSin === 0 : totalCon === 0) && (
        <p className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
          {vista === "sin" ? "🎉 ¡Todos los productos tienen descripción!" : "Todavía no hay productos con descripción."}
        </p>
      )}

      {cargado && q.trim() && !prods.some((i) => matchSearch(`${i.name} ${i.sku} ${i.categoria}`, q)) && (
        <p className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400 shadow-sm">Sin resultados para “{q}”.</p>
      )}

      {grupos.map((g) => {
        const nq = q.trim();
        const items = nq
          ? g.items.filter((i) => matchSearch(`${i.name} ${i.sku} ${i.categoria}`, q))
          : g.items.filter((i) => (vista === "sin" ? !i.desc.trim() : i.desc.trim()));
        if (items.length === 0) return null;
        const open = nq ? true : abiertas.has(g.cat);
        return (
          <div key={g.cat} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <button onClick={() => toggle(g.cat)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50">
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">{g.cat}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">{items.length}</span>
                {g.completa && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">✅ Completado</span>}
              </span>
              <span className="text-gray-400">{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div className="space-y-2 border-t border-gray-100 p-3">
                {s.modo && (
                  <button onClick={() => s.alternarTodos(items.map((i) => i.id))} className="text-[11px] font-bold text-brand underline">
                    Seleccionar todos los de esta categoría ({items.length})
                  </button>
                )}
                {items.map((p) => <DescRow key={p.id} p={p} onSaved={onSaved} onArchived={onArchived}
                  sel={s.modo ? { on: true, checked: s.sel.has(p.id), toggle: () => s.toggle(p.id) } : undefined} />)}
              </div>
            )}
          </div>
        );
      })}

      {s.modo && seleccionados.length > 0 && (
        <div className="sticky bottom-3 z-20 rounded-2xl border border-brand/30 bg-white/95 p-3 shadow-[0_18px_40px_-20px_rgba(14,38,80,.6)] backdrop-blur">
          <p className="mb-1 flex items-center gap-2 font-display text-[13px] font-bold text-brand-dark">
            ✍️ Misma descripción para {seleccionados.length} producto(s)
            <button onClick={s.limpiar} className="ml-auto rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50">Limpiar selección</button>
          </p>
          <div className="mb-1 flex items-center gap-2">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleNegritasEn(bulkRef.current, bulkTxt, setBulkTxt)}
              className="rounded border border-gray-300 px-2 py-0.5 text-xs font-black text-gray-700 hover:bg-gray-100">N</button>
            <span className="text-[10px] text-gray-400">selecciona palabras y pica <b>N</b> (o Ctrl+B) para negritas</span>
          </div>
          <textarea ref={bulkRef} value={bulkTxt} onChange={(e) => setBulkTxt(e.target.value)} rows={3}
            onKeyDown={(ev) => { if ((ev.ctrlKey || ev.metaKey) && "bBnN".includes(ev.key)) { ev.preventDefault(); toggleNegritasEn(bulkRef.current, bulkTxt, setBulkTxt); } }}
            placeholder="Escribe la descripción que se pondrá a TODOS los seleccionados…"
            className="w-full rounded-lg border border-gray-200 p-2 text-sm outline-none focus:border-brand" />
          {bulkTxt.includes("*") && (
            <p className="mt-1 whitespace-pre-line rounded-lg bg-gray-50 px-2 py-1.5 text-[12px] leading-snug text-gray-600">
              <span className="mr-1 text-[9px] font-bold uppercase tracking-wide text-gray-400">Vista previa:</span>{renderNegritas(bulkTxt)}
            </p>
          )}
          {notaBulk && <p className="mt-1 text-[12px] font-semibold text-slate-600">{notaBulk}</p>}
          <button onClick={aplicarBulk} disabled={pendBulk || seleccionados.length === 0}
            className="mt-2 w-full rounded-lg bg-brand px-3 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:bg-gray-300">
            {pendBulk ? "Aplicando…" : `Aplicar a ${seleccionados.length} producto(s)`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Historial de cambios ---------- */
function HistorialPanel() {
  const [items, setItems] = useState<Pendiente[]>([]);
  const [pending, start] = useTransition();
  const [cargado, setCargado] = useState(false);
  const [dia, setDia] = useState("");   // filtro por día (YYYY-MM-DD); vacío = todos
  const [q, setQ] = useState("");       // filtro por persona/producto
  const [estado, setEstado] = useState<"todos" | "pendiente" | "aprobado" | "rechazado">("todos");
  function cargar() { start(async () => { setItems(await historialSolicitudesAction()); setCargado(true); }); }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Odoo entrega UTC; todo se muestra/agrupa en hora de México.
  const diaLocal = (iso: string) => new Date((iso || "").replace(" ", "T") + "Z").toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const hora = (iso: string) => new Date((iso || "").replace(" ", "T") + "Z").toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" });
  const diaLargo = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long" });
  const badge = (e?: string) => e === "aprobado" ? { t: "✅ Aceptado", c: "bg-green-100 text-green-700" }
    : e === "rechazado" ? { t: "❌ Rechazado", c: "bg-red-100 text-red-700" }
    : { t: "⏳ Pendiente", c: "bg-amber-100 text-amber-700" };

  const filtrados = items.filter((p) => {
    if (estado !== "todos" && (p.estado || "pendiente") !== estado) return false;
    if (dia && diaLocal(p.fecha) !== dia) return false;
    if (q.trim()) {
      const pl = (p.payload || {}) as { sku?: string; name?: string };
      const t = `${p.persona} ${p.resumen} ${p.razon || ""} ${pl.sku || ""} ${pl.name || ""}`.toLowerCase();
      if (!t.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });
  const dias = [...new Set(filtrados.map((p) => diaLocal(p.fecha)))].sort().reverse();

  return (
    <div className="pf-card p-5">
      <PanelHead emoji="📜" tono="bg-brand-light" titulo="Historial"
        sub="Qué se solicitó, quién lo pidió, la razón, y quién lo aceptó o rechazó."
        right={<button onClick={cargar} disabled={pending} className={REFRESH}>{pending ? "…" : "↻ Actualizar"}</button>} />
      <div className="mt-3 space-y-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por producto, código, persona o razón…"
            className="pf-input w-full py-2.5 pl-9 pr-9 text-sm" />
          {q && <button onClick={() => setQ("")} title="Limpiar" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-sm text-gray-400 hover:text-gray-700">✕</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="pf-input px-3 py-1.5 text-sm" />
          {dia && <button onClick={() => setDia("")} className="pf-chip px-2.5 py-1 text-xs">Todos los días ✕</button>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {([["todos", "Todos"], ["pendiente", "⏳ Pendientes"], ["aprobado", "✅ Aceptados"], ["rechazado", "❌ Rechazados"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setEstado(k)}
            className={"rounded-full px-3 py-1 text-xs font-bold transition " + (estado === k ? "bg-brand text-white shadow" : "bg-white text-gray-600 ring-1 ring-slate-200 hover:ring-brand")}>{l}</button>
        ))}
      </div>

      {cargado && filtrados.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No hay solicitudes que coincidan.</p>}

      <div className="mt-3 space-y-4">
        {dias.map((d) => (
          <div key={d}>
            <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-brand">{diaLargo(d)}</p>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100">
              {filtrados.filter((p) => diaLocal(p.fecha) === d).map((p) => {
                const b = badge(p.estado);
                return (
                  <li key={p.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-[#0e2650]">{p.persona}</span>
                        <span className="ml-2 text-[11px] text-gray-400">{hora(p.fecha)}</span>
                        <p className="mt-0.5 text-[13px] text-gray-700">{p.resumen}</p>
                        {p.razon && <p className="mt-0.5 text-[12px] text-gray-500">📝 <b>Razón:</b> {p.razon}</p>}
                        {p.estado === "aprobado" && <p className="mt-0.5 text-[12px] text-green-700">Aceptado por <b>{p.por || "—"}</b>{p.resueltoFecha ? ` · ${hora(p.resueltoFecha)}` : ""}</p>}
                        {p.estado === "rechazado" && <p className="mt-0.5 text-[12px] text-red-600">Rechazado por <b>{p.por || "—"}</b>{p.motivo ? ` · Motivo: ${p.motivo}` : ""}</p>}
                      </div>
                      <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " + b.c}>{b.t}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 📋 Conteos y ajustes (solo Ana y Luis) ---------- */
// Merma, hurto, devolución a proveedor, uso interno, conteo cíclico y corrección de captura.
// Se aplica DIRECTO en Odoo (sin aprobación) y cada movimiento queda firmado: quién, día y hora.
const fmtDelta = (d: number) => (d > 0 ? `+${d}` : String(d));
const diaMx = (iso: string) => new Date((iso || "").replace(" ", "T") + "Z").toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
const horaMx = (iso: string) => new Date((iso || "").replace(" ", "T") + "Z").toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" });
const PASO = "mb-1.5 mt-5 font-display text-[13px] font-bold uppercase tracking-wide text-[#0e2650]";

/* ---------- 🧾 Notas vs inventario (solo aprobadores, solo lectura) ---------- */
// Cruza cada nota de compra que captura la tía en Odoo Compras (pedido y lo que llegó) contra lo que
// se subió al inventario (ajustes a Tienda / Bodega). No cambia nada en Odoo.
type EstadoLinea = { tono: "ok" | "warn" | "bad" | "gris"; texto: string };
function estadoLinea(l: NotaLinea): EstadoLinea[] {
  const out: EstadoLinea[] = [];
  if (l.llego === 0) out.push({ tono: "gris", texto: "Falta capturar lo que llegó" });
  else if (l.llego < l.pedido) out.push({ tono: "warn", texto: `Faltaron ${l.pedido - l.llego} vs la nota` });
  else if (l.llego > l.pedido) out.push({ tono: "warn", texto: `Llegaron ${l.llego - l.pedido} de más` });
  const base = l.llego > 0 ? l.llego : l.pedido;
  if (l.subido === 0) out.push({ tono: "bad", texto: "No se ha subido a inventario" });
  else if (l.subido < base) out.push({ tono: "bad", texto: `Subiste ${base - l.subido} de menos` });
  else if (l.subido > base) out.push({ tono: "bad", texto: `Subiste ${l.subido - base} de más` });
  if (!out.length || out.every((e) => e.tono === "ok")) return [{ tono: "ok", texto: "Cuadra" }];
  return out;
}
const TONO: Record<EstadoLinea["tono"], string> = {
  ok: "bg-green-100 text-green-700", warn: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-700", gris: "bg-slate-100 text-slate-600",
};
const notaCuadra = (n: NotaCompra) => n.lineas.every((l) => estadoLinea(l)[0].tono === "ok");

function NotasVsInventarioPanel() {
  const [notas, setNotas] = useState<NotaCompra[] | null>(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "dif" | "sinrec">("dif");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  function cargar() {
    setError("");
    start(async () => {
      const r = await notasVsInventarioAction();
      if (r.ok) setNotas(r.notas); else setError(r.error);
    });
  }
  useEffect(() => { cargar(); }, []);

  const lista = useMemo(() => (notas || []).filter((n) => {
    if (filtro === "dif" && notaCuadra(n)) return false;
    if (filtro === "sinrec" && n.recibida) return false;
    if (!q.trim()) return true;
    return matchSearch([n.folio, n.proveedor, n.refProveedor, ...n.lineas.flatMap((l) => [l.nombre, l.sku])].join(" "), q);
  }), [notas, filtro, q]);

  const total = notas?.length || 0;
  const conDif = (notas || []).filter((n) => !notaCuadra(n)).length;
  const sinRec = (notas || []).filter((n) => !n.recibida).length;
  const chip = (on: boolean) => "rounded-full px-3.5 py-1.5 text-sm font-bold transition " + (on ? "bg-brand text-white shadow" : "bg-white text-gray-600 ring-1 ring-slate-200 hover:ring-brand");

  return (
    <div className="space-y-4">
      <div className="pf-card p-5">
        <PanelHead emoji="🧾" titulo="Notas vs inventario"
          sub="Compara cada nota de compra (lo que se pidió y lo que llegó) contra lo que se subió al inventario en Tienda y Bodega. Solo lectura: aquí no se cambia nada."
          right={<button type="button" onClick={cargar} disabled={pending} className={REFRESH}>{pending ? "…" : "↻ Actualizar"}</button>} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFiltro("dif")} className={chip(filtro === "dif")}>⚠️ Con diferencias · {conDif}</button>
          <button type="button" onClick={() => setFiltro("sinrec")} className={chip(filtro === "sinrec")}>📦 Sin capturar lo que llegó · {sinRec}</button>
          <button type="button" onClick={() => setFiltro("todas")} className={chip(filtro === "todas")}>Todas · {total}</button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por proveedor, folio o producto…" className="pf-input mt-3 w-full px-4 py-2.5 text-sm" />
        <details className="mt-3 text-[12px] text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-600">¿Qué significa cada columna?</summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li><b>Pedido:</b> lo que dice la nota del proveedor.</li>
            <li><b>Llegó:</b> lo que tu tía capturó al recibir (la recepción “Notas de compra”).</li>
            <li><b>Subido:</b> lo que entró al inventario (Tienda + Bodega) desde 15 días antes de la nota, ya restando correcciones.</li>
            <li><b>Hoy:</b> las piezas que hay ahorita en Tienda + Bodega (ya con lo vendido).</li>
          </ul>
        </details>
      </div>

      {error && (
        <div className="pf-card p-5 text-sm text-red-600">❌ {error} <button type="button" onClick={cargar} className="ml-2 underline">Reintentar</button></div>
      )}
      {!error && notas === null && <div className="pf-card p-6 text-center text-sm text-slate-400">Cargando notas…</div>}
      {!error && notas !== null && total === 0 && (
        <div className="pf-card p-6 text-center text-sm text-slate-500">
          Todavía no hay notas de compra confirmadas en Odoo (últimos 4 meses).<br />
          <span className="text-slate-400">En cuanto tu tía capture una nota y le dé “Confirmar pedido”, aparece aquí.</span>
        </div>
      )}
      {!error && notas !== null && total > 0 && !lista.length && (
        <div className="pf-card p-6 text-center text-sm text-slate-500">
          {filtro === "dif" ? "✅ Todas las notas cuadran con el inventario." : filtro === "sinrec" ? "✅ Todas las notas ya tienen capturado lo que llegó." : "Sin resultados."}
        </div>
      )}

      {lista.map((n) => {
        const cuadra = notaCuadra(n);
        return (
          <div key={n.id} className="pf-card overflow-hidden">
            <div className={"flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 " + (cuadra ? "bg-green-50" : "bg-amber-50")}>
              <span className="font-mono text-sm font-bold text-[#0e2650]">{n.folio}</span>
              <span className="text-sm font-semibold text-slate-700">{n.proveedor}</span>
              {n.refProveedor && <span className="text-[12px] text-slate-500">Nota: {n.refProveedor}</span>}
              <span className="text-[12px] text-slate-500">{diaMx(n.fecha)}</span>
              <span className="ml-auto text-[12px] font-semibold text-slate-600">{money(n.total)}</span>
              <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-bold " + (cuadra ? TONO.ok : n.recibida ? TONO.bad : TONO.gris)}>
                {cuadra ? "✅ Cuadra" : n.recibida ? "⚠️ Con diferencias" : "📦 Falta recibir"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-semibold">Producto</th>
                    <th className="px-2 py-2 text-center font-semibold">Pedido</th>
                    <th className="px-2 py-2 text-center font-semibold">Llegó</th>
                    <th className="px-2 py-2 text-center font-semibold">Subido</th>
                    <th className="px-2 py-2 text-center font-semibold">Hoy</th>
                    <th className="px-4 py-2 font-semibold">Revisión</th>
                  </tr>
                </thead>
                <tbody>
                  {n.lineas.map((l, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          {l.imageUrl
                            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border object-cover" />
                            : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs">📦</span>}
                          <span className="min-w-0">
                            <span className="block text-[12.5px] font-bold leading-tight text-slate-700">{l.nombre}</span>
                            <span className="block font-mono text-[10.5px] text-slate-400">{l.sku}{l.precio ? ` · ${money(l.precio)} c/u` : ""}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center font-semibold">{l.pedido}</td>
                      <td className="px-2 py-2 text-center font-semibold">{l.llego || "—"}</td>
                      <td className="px-2 py-2 text-center font-semibold">{l.subido}</td>
                      <td className="px-2 py-2 text-center text-slate-500">{l.stockHoy}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {estadoLinea(l).map((e, j) => <span key={j} className={"rounded-full px-2 py-0.5 text-[11px] font-bold " + TONO[e.tono]}>{e.texto}</span>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConteosAjustesPanel() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ProductoBuscado[]>([]);
  const [buscado, setBuscado] = useState(false);
  const [prod, setProd] = useState<ProductoBuscado | null>(null);
  const [bodega, setBodega] = useState<"tienda" | "bodega" | null>(null);
  const [motivo, setMotivo] = useState<MotivoAjuste | null>(null);
  const [cant, setCant] = useState("");
  const [signo, setSigno] = useState<1 | -1>(1);
  const [nota, setNota] = useState("");
  const [quien, setQuien] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const [hist, setHist] = useState<AjusteRegistro[]>([]);
  const [histPend, startHist] = useTransition();

  function cargarHist() { startHist(async () => { setHist(await historialAjustesAction()); }); }
  useEffect(() => { cargarHist(); }, []);

  // Al cambiar de producto se conservan bodega y motivo (útil para contar varios seguidos); se limpia lo demás.
  function elegir(p: ProductoBuscado) { setProd(p); setCant(""); setSigno(1); setNota(""); setQuien(""); setProveedor(""); setAviso(null); }
  function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setAviso(null);
    start(async () => { const r = await buscarAction(q); setRes(r); setBuscado(true); if (r.length === 1) elegir(r[0]); else setProd(null); });
  }
  function recargar() {
    if (!prod) return;
    const id = prod.id, sku = prod.sku;
    start(async () => {
      const f = (await buscarAction(sku)).find((x) => x.id === id);
      if (f) { setProd(f); setRes((rs) => rs.map((x) => (x.id === id ? f : x))); setAviso({ ok: true, t: "↻ Cantidades actualizadas desde Odoo." }); }
    });
  }

  const m = motivo ? MOTIVO[motivo] : null;
  const nomBodega = bodega === "bodega" ? "Bodega" : "Tienda";
  const actual = prod && bodega ? (bodega === "bodega" ? prod.cantBodega : prod.cantTienda) : 0;
  const n = cant.trim() === "" ? NaN : Number(cant);
  const nValido = Number.isInteger(n) && n >= 0;
  const delta = m && nValido ? (m.id === "conteo" ? n - actual : m.signo === "-" ? -n : signo * n) : null;
  const despues = delta == null ? null : actual + delta;
  const falta = !prod ? "Busca y elige un producto."
    : !bodega ? "Elige la bodega."
    : !m ? "Elige el motivo."
    : !nValido ? (cant.trim() ? "La cantidad debe ser un número entero." : "Escribe la cantidad.")
    : m.id !== "conteo" && n === 0 ? "La cantidad debe ser mayor a 0."
    : despues != null && despues < 0 ? `No alcanza: en ${nomBodega} solo hay ${actual} pzs.`
    : m.extra === "quien" && !quien.trim() ? "Escribe quién lo usó."
    : m.extra === "proveedor" && !proveedor.trim() ? "Escribe el proveedor."
    : m.notaObligatoria && !nota.trim() ? "Escribe la nota (qué pasó)."
    : "";

  function aplicar() {
    if (falta || !prod || !bodega || !m || delta == null || despues == null) return;
    const txt = `${m.emoji} ${m.label}\n${prod.name} (${prod.sku})\n${nomBodega}: ${actual} → ${despues} pzs (${fmtDelta(delta)})\n\n¿Aplicar en Odoo?`;
    if (!confirm(txt)) return;
    const p = prod, b = bodega;
    start(async () => {
      const r = await ajusteAction({ tmplId: p.id, bodega: b, motivo: m.id, antes: actual, cantidad: n, signo, nota, quien, proveedor });
      if (!r.ok) { setAviso({ ok: false, t: "❌ " + r.error }); return; }
      const g = r.registro;
      const nuevo = { ...p, cantTienda: b === "tienda" ? g.despues : p.cantTienda, cantBodega: b === "bodega" ? g.despues : p.cantBodega, cantidad: p.cantidad + g.delta };
      setProd(nuevo);
      setRes((rs) => rs.map((x) => (x.id === p.id ? nuevo : x)));
      setAviso({ ok: true, t: `✅ Aplicado en Odoo: ${g.nombre} · ${g.bodega} ${g.antes} → ${g.despues} pzs (${fmtDelta(g.delta)})${g.delta === 0 ? " · conteo sin diferencia, quedó registrado" : ""}.` });
      setCant(""); setNota(""); setQuien(""); setProveedor("");
      setHist((h) => [g, ...h]);
    });
  }

  const chip = (on: boolean, color = "bg-brand") => "rounded-full px-3.5 py-1.5 text-sm font-bold transition " + (on ? color + " text-white shadow" : "bg-white text-gray-600 ring-1 ring-slate-200 hover:ring-brand");

  return (
    <div className="space-y-4">
      <div className="pf-card p-5">
        <PanelHead emoji="📋" titulo="Conteos y ajustes"
          sub="Solo Ana y Luis. Se aplica directo en Odoo y queda en el historial quién lo hizo, qué día y a qué hora." />

        <p className={PASO + " mt-0"}>1 · Producto</p>
        <form onSubmit={buscar} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, código o escanea la etiqueta…" className="flex-1 pf-input px-4 py-3" />
          <button disabled={pending} className="pf-btn shrink-0 px-6 py-3 disabled:opacity-50">{pending ? "…" : "Buscar"}</button>
        </form>
        {buscado && !res.length && <p className="mt-2 text-sm text-gray-400">Sin resultados.</p>}
        {res.length > 1 && (
          <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-100">
            {res.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => elegir(r)} className={"flex w-full items-center gap-3 px-3 py-2 text-left transition " + (prod?.id === r.id ? "bg-sky-50" : "hover:bg-slate-50")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-slate-700">{r.name}{!r.activo && <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] text-amber-800">archivado</span>}</span>
                    <span className="block font-mono text-[11px] text-slate-400">{r.sku}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-slate-500">🏠 {r.cantTienda}<br />🆕 {r.cantBodega}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {prod && (
          <>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={prod.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0e2650]">{prod.name}</p>
                <p className="font-mono text-[11px] text-slate-500">{prod.sku}</p>
              </div>
              <button type="button" onClick={recargar} disabled={pending} className={REFRESH}>↻ Recargar</button>
            </div>

            <p className={PASO}>2 · Bodega</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setBodega("tienda")} className={chip(bodega === "tienda")}>🏠 Tienda · {prod.cantTienda} pzs</button>
              <button type="button" onClick={() => setBodega("bodega")} className={chip(bodega === "bodega", "bg-amber-500")}>🆕 Bodega · {prod.cantBodega} pzs</button>
            </div>

            <p className={PASO}>3 · Motivo</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MOTIVOS_AJUSTE.map((x) => (
                <button key={x.id} type="button" onClick={() => { setMotivo(x.id); setAviso(null); }}
                  className={"rounded-2xl px-3.5 py-2.5 text-left transition " + (motivo === x.id ? "bg-brand text-white shadow" : "bg-white ring-1 ring-slate-200 hover:ring-brand")}>
                  <span className="flex items-center gap-2 text-sm font-bold">
                    {x.emoji} {x.label}
                    <span className={"rounded-full px-1.5 text-[11px] font-extrabold " + (motivo === x.id ? "bg-white/25" : x.signo === "-" ? "bg-red-100 text-red-600" : "bg-sky-100 text-sky-700")}>{x.signo === "-" ? "−" : "+/−"}</span>
                  </span>
                  <span className={"mt-0.5 block text-[11.5px] " + (motivo === x.id ? "text-white/85" : "text-slate-500")}>{x.ayuda}</span>
                </button>
              ))}
            </div>

            {bodega && m && (
              <>
                <p className={PASO}>4 · {m.id === "conteo" ? `¿Cuántas hay físicamente en ${nomBodega}?` : m.signo === "-" ? "¿Cuántas piezas salen?" : "¿Cuántas piezas?"}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {m.id === "correccion" && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setSigno(1)} className={chip(signo === 1, "bg-green-600")}>＋ Sumar</button>
                      <button type="button" onClick={() => setSigno(-1)} className={chip(signo === -1, "bg-red-500")}>− Restar</button>
                    </div>
                  )}
                  <input type="number" min={0} step={1} inputMode="numeric" value={cant} onChange={(e) => setCant(e.target.value)}
                    className="pf-input w-32 px-4 py-2.5 text-center text-lg font-bold" placeholder="0" />
                  <span className="text-[12px] text-slate-500">Hoy hay <b>{actual}</b> en {nomBodega}</span>
                </div>

                {m.extra === "quien" && (
                  <div className="mt-3">
                    <label className="text-[12px] font-semibold text-slate-600">¿Quién lo usó? <span className="text-red-500">*</span></label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {QUIENES_USO.map((w) => <button key={w} type="button" onClick={() => setQuien(w)} className={"rounded-full px-3 py-1 text-xs font-bold transition " + (quien === w ? "bg-brand text-white" : "bg-white text-gray-600 ring-1 ring-slate-200")}>{w}</button>)}
                    </div>
                    <input value={quien} onChange={(e) => setQuien(e.target.value)} maxLength={60} placeholder="…u otro nombre" className="pf-input mt-1.5 w-full px-3 py-2 text-sm" />
                  </div>
                )}
                {m.extra === "proveedor" && (
                  <div className="mt-3">
                    <label className="text-[12px] font-semibold text-slate-600">Proveedor <span className="text-red-500">*</span></label>
                    <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} maxLength={80} placeholder="Ej. Meliza, Zebra Home…" className="pf-input mt-1 w-full px-3 py-2 text-sm" />
                  </div>
                )}
                <div className="mt-3">
                  <label className="text-[12px] font-semibold text-slate-600">Nota {m.notaObligatoria ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-400">(opcional)</span>}</label>
                  <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300} rows={2} placeholder={m.placeholder} className="pf-input mt-1 w-full px-3 py-2 text-sm" />
                </div>

                {delta != null && despues != null && despues >= 0 && (
                  <div className={"mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 " + (delta < 0 ? "bg-red-50 text-red-700 ring-red-100" : delta > 0 ? "bg-green-50 text-green-700 ring-green-100" : "bg-slate-50 text-slate-600 ring-slate-200")}>
                    {nomBodega}: {actual} → <b className="text-base">{despues}</b> pzs ({fmtDelta(delta)}){delta === 0 && " · sin diferencia (solo se registra el conteo)"}
                  </div>
                )}
                {falta && <p className="mt-2 text-[12.5px] font-semibold text-amber-600">{falta}</p>}
                <button type="button" onClick={aplicar} disabled={!!falta || pending}
                  className="pf-btn mt-3 w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-40">
                  {pending ? "Aplicando en Odoo…" : "Aplicar en Odoo"}
                </button>
              </>
            )}
          </>
        )}
        {aviso && <p className={"mt-3 rounded-xl px-3 py-2 text-[13px] font-semibold " + (aviso.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>{aviso.t}</p>}
      </div>

      <AjustesHistorial hist={hist} cargando={histPend} onRecargar={cargarHist} />
    </div>
  );
}

function AjustesHistorial({ hist, cargando, onRecargar }: { hist: AjusteRegistro[]; cargando: boolean; onRecargar: () => void }) {
  const [mes, setMes] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }).slice(0, 7));
  const [fm, setFm] = useState<"todos" | MotivoAjuste>("todos");
  const [q, setQ] = useState("");
  const delMes = hist.filter((h) => !mes || diaMx(h.fecha).startsWith(mes));
  const filtrados = delMes.filter((h) => (fm === "todos" || h.motivo === fm)
    && (!q.trim() || `${h.persona} ${h.nombre} ${h.sku} ${h.nota} ${h.quien} ${h.proveedor}`.toLowerCase().includes(q.trim().toLowerCase())));
  const dias = [...new Set(filtrados.map((h) => diaMx(h.fecha)))].sort().reverse();
  const diaLargo = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long" });
  const resumen = MOTIVOS_AJUSTE.map((m) => {
    const rs = delMes.filter((h) => h.motivo === m.id);
    return {
      m, n: rs.length,
      sale: rs.reduce((s, h) => s + (h.delta < 0 ? -h.delta : 0), 0),
      entra: rs.reduce((s, h) => s + (h.delta > 0 ? h.delta : 0), 0),
      valor: rs.reduce((s, h) => s + Math.abs(h.delta) * (h.precio || 0), 0),
    };
  });

  return (
    <div className="pf-card p-5">
      <PanelHead emoji="🕒" titulo="Historial de ajustes" sub="Quién hizo cada movimiento, qué día y a qué hora. El valor es aproximado a precio miembro."
        right={<button onClick={onRecargar} disabled={cargando} className={REFRESH}>{cargando ? "…" : "↻ Actualizar"}</button>} />
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="pf-input px-3 py-1.5 text-sm" />
        {mes && <button onClick={() => setMes("")} className="pf-chip px-2.5 py-1 text-xs">Todos los meses ✕</button>}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto, persona o nota…" className="pf-input min-w-0 flex-1 px-3 py-1.5 text-sm" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {resumen.map(({ m, n, sale, entra, valor }) => (
          <button key={m.id} type="button" onClick={() => setFm(fm === m.id ? "todos" : m.id)}
            className={"rounded-2xl p-3 text-left transition " + (fm === m.id ? "bg-brand text-white shadow" : "bg-white ring-1 ring-slate-200 hover:ring-brand")}>
            <p className="text-[12px] font-bold">{m.emoji} {m.label}</p>
            <p className="mt-1 text-lg font-bold leading-none">
              {sale > 0 && <span>−{sale}</span>}{sale > 0 && entra > 0 && <span className="text-sm"> / </span>}{entra > 0 && <span>+{entra}</span>}{!sale && !entra && <span className="opacity-40">0</span>}
              <span className="ml-1 text-[11px] font-semibold opacity-70">pzs</span>
            </p>
            <p className={"mt-0.5 text-[11px] " + (fm === m.id ? "text-white/80" : "text-slate-500")}>{n} mov. · ≈ {money(valor)}</p>
          </button>
        ))}
      </div>

      {!cargando && filtrados.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No hay movimientos{mes ? " en este mes" : ""}.</p>}
      <div className="mt-4 space-y-4">
        {dias.map((d) => (
          <div key={d}>
            <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-brand">{diaLargo(d)}</p>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100">
              {filtrados.filter((h) => diaMx(h.fecha) === d).map((h) => (
                <li key={h.id || h.fecha + h.sku} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-[#0e2650]">{h.persona}</span>
                      <span className="ml-2 text-[11px] text-gray-400">{horaMx(h.fecha)}</span>
                      <p className="mt-0.5 text-[13px] text-gray-700"><b>{h.nombre}</b> <span className="font-mono text-[11px] text-gray-400">{h.sku}</span></p>
                      <p className="text-[12.5px] text-gray-600">
                        {h.bodega}: {h.antes} → <b>{h.despues}</b> pzs{" "}
                        <b className={h.delta < 0 ? "text-red-600" : h.delta > 0 ? "text-green-600" : "text-gray-400"}>({fmtDelta(h.delta)})</b>
                        {h.ref && <span className="text-[11px] text-gray-400"> · {h.ref}</span>}
                      </p>
                      {h.quien && <p className="text-[12px] text-gray-500">🙋 Usó: <b>{h.quien}</b></p>}
                      {h.proveedor && <p className="text-[12px] text-gray-500">🚚 Proveedor: <b>{h.proveedor}</b></p>}
                      {h.nota && <p className="text-[12px] text-gray-500">📝 {h.nota}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-600">{MOTIVO[h.motivo]?.emoji} {MOTIVO[h.motivo]?.label || h.motivo}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Saldos (productos con detalle a precio rebajado) ---------- */
function SaldosForm({ categorias }: { categorias: Categoria[] }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [skuTocado, setSkuTocado] = useState(false);
  const [categId, setCategId] = useState<number>(categorias[0]?.id || 0);
  const [precio, setPrecio] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [detalle, setDetalle] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imgB64, setImgB64] = useState<string | null>(null);
  const [imgPrev, setImgPrev] = useState("");
  const [extras, setExtras] = useState<{ b64: string; prev: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useDraft("bam-saldo-v1",
    () => ({ name, sku, skuTocado, categId, precio, cantidad, detalle, descripcion }),
    (d) => {
      if (typeof d.name === "string") setName(d.name);
      if (typeof d.sku === "string") setSku(d.sku);
      if (typeof d.skuTocado === "boolean") setSkuTocado(d.skuTocado);
      if (typeof d.categId === "number") setCategId(d.categId);
      if (typeof d.precio === "string") setPrecio(d.precio);
      if (typeof d.cantidad === "string") setCantidad(d.cantidad);
      if (typeof d.detalle === "string") setDetalle(d.detalle);
      if (typeof d.descripcion === "string") setDescripcion(d.descripcion);
    },
    [name, sku, skuTocado, categId, precio, cantidad, detalle, descripcion]);

  function onName(v: string) { v = v.slice(0, 45); setName(v); if (!skuTocado) setSku(sugerirSku(v)); }
  async function aplicarFoto(f: File) { setImgPrev(URL.createObjectURL(f)); setImgB64(await fileToBase64(f)); }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) await aplicarFoto(f); }
  useEffect(() => {
    const h = (e: ClipboardEvent) => { if (!fileRef.current || fileRef.current.offsetParent === null) return; const f = imagenDePaste(e); if (f) { e.preventDefault(); aplicarFoto(f); } };
    document.addEventListener("paste", h);
    return () => document.removeEventListener("paste", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function pegarFoto() { const f = await imagenDelPortapapeles(); if (f) await aplicarFoto(f); else alert("No encontré una imagen copiada."); }
  function quitarFoto() { setImgB64(null); setImgPrev(""); if (fileRef.current) fileRef.current.value = ""; }
  async function addExtras(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) { const b64 = await fileToBase64(f); setExtras((xs) => [...xs, { b64, prev: URL.createObjectURL(f) }]); }
  }
  async function pegarExtra() {
    const f = await imagenDelPortapapeles();
    if (f) { const b64 = await fileToBase64(f); setExtras((xs) => [...xs, { b64, prev: URL.createObjectURL(f) }]); }
    else alert("No encontré una imagen copiada. Copia una imagen (Ctrl+C) y vuelve a intentar.");
  }
  function quitarExtra(i: number) { setExtras((xs) => xs.filter((_, j) => j !== i)); }
  function reset() { setName(""); setSku(""); setSkuTocado(false); setPrecio(""); setCantidad(""); setDetalle(""); setDescripcion(""); setImgB64(null); setImgPrev(""); setExtras([]); limpiarDraft("bam-saldo-v1"); }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!name.trim() || !sku.trim()) { setMsg({ ok: false, text: "Falta nombre o código." }); return; }
    if (!Number(precio)) { setMsg({ ok: false, text: "Falta el precio rebajado." }); return; }
    if (!detalle.trim()) { setMsg({ ok: false, text: "Escribe cuál es el detalle del producto." }); return; }
    start(async () => {
      const r = await crearProductoAction({
        name: limpiarNombre(name), sku: sku.trim().toUpperCase(), categId,
        publico: Number(precio), miembro: 0, liquidacion: null,
        cantidad: Number(cantidad) || 0, imageBase64: imgB64, detalle: detalle.trim(),
        descripcion: descripcion.trim() || undefined, imagesExtra: extras.map((x) => x.b64),
        saldo: true,
      });
      if (r.ok) { setMsg({ ok: true, text: r.pendiente ? "🕒 Enviado a revisión" : `✅ Saldo creado: ${r.sku}` }); reset(); }
      else setMsg({ ok: false, text: r.error });
    });
  }
  const inp = "pf-input w-full px-3 py-2";
  const lab = "mb-1 block font-display text-[15px] font-bold text-[#0e2650]";

  return (
    <form onSubmit={submit} className="space-y-4 pf-card p-5">
      <PanelHead emoji="🏷️" titulo="Saldos"
        sub="Productos con detalle a precio rebajado. Van a la categoría interna “Saldos” (para las etiquetas) y NO salen en el catálogo de clientes." />
      <div>
        <label className={lab}>Nombre del producto <span className={"font-normal " + (name.length >= 45 ? "text-red-500" : "text-gray-400")}>({name.length}/45)</span></label>
        <input className={inp} value={name} maxLength={45} onChange={(e) => onName(e.target.value)} onBlur={() => setName((n) => limpiarNombre(n))} placeholder="Ej. Colcha Nena Rosa - King" />
      </div>
      <div>
        <label className={lab}>Código (SKU) <span className="font-normal text-gray-400">— sugerido, puedes editarlo</span></label>
        <input className={inp + " font-mono uppercase"} value={sku} onChange={(e) => { setSku(e.target.value.toUpperCase()); setSkuTocado(true); }} placeholder="COL-NENA-ROSA-K" />
      </div>
      <div>
        <label className={lab}>Descripción <span className="font-normal text-gray-400">— opcional, sale en el catálogo</span></label>
        <textarea className={inp} rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Suave, 100% algodón. Incluye 2 fundas." />
        <p className="mt-1 text-[11px] text-slate-400">Tip: lo que pongas entre *asteriscos* sale en <b>negritas</b>.</p>
      </div>
      <div>
        <label className={lab}>⚠️ Detalle del producto (por qué está rebajado)</label>
        <textarea className={inp} rows={2} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej. Tiene una mancha pequeña / le falta un botón / caja maltratada" />
        <p className="mt-1 text-[11px] text-slate-400">Esto se ve en la ficha del catálogo para que el cliente sepa.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lab}>Precio rebajado</label>
          <input className={inp} type="number" inputMode="numeric" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className={lab}>Cantidad (inventario)</label>
          <input className={inp} type="number" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div>
        <label className={lab}>Foto principal</label>
        <div className="flex items-center gap-2">
          <input ref={fileRef} className="block w-full text-sm text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white" type="file" accept="image/*" onChange={onFile} />
          <button type="button" onClick={pegarFoto} className="shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">📋 Pegar</button>
        </div>
        {imgPrev && (
          <div className="mt-2 flex items-center gap-3">
            <img src={imgPrev} alt="" className="h-24 w-24 rounded-xl border object-cover" />
            <button type="button" onClick={quitarFoto} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-50">✕ Quitar foto</button>
          </div>
        )}
      </div>
      <div>
        <label className={lab}>Más fotos <span className="font-normal text-gray-400">— opcional, salen en la galería del catálogo</span></label>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" multiple onChange={(e) => { addExtras(e.target.files); e.target.value = ""; }}
            className="block w-full text-sm text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white" />
          <button type="button" onClick={pegarExtra} title="Pegar imagen copiada (Ctrl+C y luego aquí)" className="shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">📋 Pegar</button>
        </div>
        {extras.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {extras.map((x, i) => (
              <div key={i} className="relative">
                <img src={x.prev} alt="" className="h-16 w-16 rounded-lg border object-cover" />
                <button type="button" onClick={() => quitarExtra(i)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <button disabled={pending} className="pf-btn w-full px-4 py-3.5 text-base">
        {pending ? "Guardando…" : "Crear saldo"}
      </button>
    </form>
  );
}

/* ---------- Archivados (restaurar) ---------- */
function ArchivadosPanel() {
  const [items, setItems] = useState<ProdSimple[]>([]);
  const [pending, start] = useTransition();
  const [cargado, setCargado] = useState(false);
  const [nota, setNota] = useState<Record<number, string>>({});
  const [imgV, setImgV] = useState<Record<number, number>>({});
  const [q, setQ] = useState("");
  function cargar() { start(async () => { setItems(await archivadosAction()); setCargado(true); }); }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  function restaurar(p: ProdSimple) {
    start(async () => {
      const r = await restaurarAction(p.id, `${p.name} (${p.sku})`);
      if (r.ok && !r.pendiente) { setItems((xs) => xs.filter((x) => x.id !== p.id)); }
      else setNota((n) => ({ ...n, [p.id]: r.ok ? "🕒 Enviado a revisión" : ("❌ " + r.error) }));
    });
  }
  function aplicarFoto(p: ProdSimple, b64: string) {
    start(async () => {
      const r = await cambiarImagenAction(p.id, b64, `${p.name} (${p.sku})`);
      if (r.ok) { setImgV((v) => ({ ...v, [p.id]: (v[p.id] || 0) + 1 })); setNota((n) => ({ ...n, [p.id]: "✅ Foto cambiada" })); }
      else setNota((n) => ({ ...n, [p.id]: "❌ " + r.error }));
    });
  }
  async function pegarFoto(p: ProdSimple) {
    const f = await imagenDelPortapapeles();
    if (!f) { setNota((n) => ({ ...n, [p.id]: "Copia una imagen (Ctrl+C) y vuelve a intentar." })); return; }
    aplicarFoto(p, await fileToBase64(f));
  }
  async function cambiarFoto(p: ProdSimple, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    aplicarFoto(p, await fileToBase64(f));
  }
  return (
    <div className="pf-card p-5">
      <PanelHead emoji="🗄️" titulo="Archivados"
        sub="Productos ocultos del catálogo y PdV. Puedes restaurarlos."
        right={<button onClick={cargar} disabled={pending} className={REFRESH}>{pending ? "…" : "↻ Actualizar"}</button>} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Buscar por nombre o código…" className="pf-input mb-3 mt-3 w-full px-4 py-2.5 text-sm" />
      {cargado && items.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No hay productos archivados. 🎉</p>}
      <ul className="divide-y divide-slate-100">
        {items.filter((p) => !q.trim() || matchSearch(`${p.name} ${p.sku}`, q)).map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl + "?v=" + (imgV[p.id] || 0)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-700">{p.name}</p>
              <p className="font-mono text-[11px] text-slate-400">{p.sku}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer text-[11px] font-semibold text-brand underline">
                  Cambiar foto
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => cambiarFoto(p, e)} />
                </label>
                <button type="button" onClick={() => pegarFoto(p)} disabled={pending} className="text-[11px] font-semibold text-brand underline disabled:opacity-50">📋 Pegar</button>
              </div>
              {nota[p.id] && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{nota[p.id]}</p>}
            </div>
            <button onClick={() => restaurar(p)} disabled={pending} className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50">♻️ Restaurar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Eliminados (auditoría: quién y cuándo) ---------- */
function EliminadosPanel() {
  const [items, setItems] = useState<Evento[]>([]);
  const [pending, start] = useTransition();
  const [cargado, setCargado] = useState(false);
  const [q, setQ] = useState("");
  function cargar() { start(async () => { setItems(await eliminadosAction()); setCargado(true); }); }
  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <div className="pf-card p-5">
      <PanelHead emoji="🗑️" titulo="Eliminados"
        sub="Productos borrados definitivamente: qué, quién y cuándo."
        right={<button onClick={cargar} disabled={pending} className={REFRESH}>{pending ? "…" : "↻ Actualizar"}</button>} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Buscar por producto o persona…" className="pf-input mb-3 mt-3 w-full px-4 py-2.5 text-sm" />
      {cargado && items.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Todavía no se ha eliminado ningún producto.</p>}
      <ul className="divide-y divide-slate-100">
        {items.filter((e) => !q.trim() || matchSearch(`${e.texto} ${e.persona}`, q)).map((e, i) => (
          <li key={i} className="flex items-start gap-3 py-2">
            <span className="mt-0.5 shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-600">{e.persona}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-slate-700">{e.texto}</p>
              <p className="text-[11px] text-slate-400">{fmtMx(e.fecha)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Ajustes del catálogo de clientes (portada + tema de temporada) ---------- */
function AjustesPanel() {
  const [tema, setTema] = useState("ninguno");
  const [portadaUrl, setPortadaUrl] = useState<string | null>(null);
  const [banners, setBanners] = useState<{ id: number; url: string }[]>([]);
  const [pending, start] = useTransition();
  const [nota, setNota] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    start(async () => { const a = await getAjustesCatalogoAction(); setTema(a.tema); setPortadaUrl(a.portadaUrl); setBanners(a.banners); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function subirBanners(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    if (bannerRef.current) bannerRef.current.value = "";
    start(async () => {
      for (const f of files) { const b64 = await fileToBase64(f, 2000); const r = await addBannerAction(b64, "image/jpeg"); if (r.ok) setBanners(r.banners); else { setNota("❌ " + r.error); return; } }
      setNota("✅ Banner(s) agregado(s) — giran solos en el catálogo.");
    });
  }
  function quitarBanner(id: number) {
    start(async () => { const r = await removeBannerAction(id); if (r.ok) { setBanners(r.banners); setNota("✅ Banner quitado."); } else setNota("❌ " + r.error); });
  }
  function elegir(id: string) {
    setTema(id);
    start(async () => { const r = await setTemaAction(id); setNota(r.ok ? "✅ Tema aplicado — se ve en el catálogo en ~1 min." : "❌ " + r.error); });
  }
  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const b64 = await fileToBase64(f, 2000);
    start(async () => { const r = await setPortadaAction(b64, "image/jpeg"); if (r.ok) { setPortadaUrl(r.portadaUrl); setNota("✅ Portada actualizada — se ve en el catálogo en ~1 min."); } else setNota("❌ " + r.error); });
    if (fileRef.current) fileRef.current.value = "";
  }
  function quitar() {
    start(async () => { const r = await quitarPortadaAction(); if (r.ok) { setPortadaUrl(null); setNota("✅ Portada quitada (vuelve la de siempre)."); } else setNota("❌ " + r.error); });
  }
  return (
    <div className="space-y-4">
      <div className="pf-card p-5">
        <PanelHead emoji="🖼️" titulo="Portada del catálogo"
          sub="La imagen grande de arriba del catálogo. Sube la de este mes (ej. “BAM! · Drop de octubre”)." />
        {portadaUrl
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={portadaUrl} alt="" className="mb-3 max-h-60 w-full rounded-2xl border border-slate-200 object-cover" />
          : <p className="mb-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">Ahora se muestra la portada por defecto (degradado + mes actual).</p>}
        <div className="flex flex-wrap items-center gap-2">
          <label className="pf-btn inline-block cursor-pointer px-4 py-2.5 text-sm">
            {portadaUrl ? "Cambiar portada" : "Subir portada"}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={subir} />
          </label>
          {portadaUrl && <button onClick={quitar} disabled={pending} className="pf-btn-ghost px-4 py-2.5 text-sm">Quitar</button>}
        </div>
      </div>

      <div className="pf-card p-5">
        <PanelHead emoji="📣" titulo="Banners promocionales"
          sub="Imágenes de promos que giran solas arriba del catálogo. Sube una o varias; puedes quitarlas cuando quieras." />
        {banners.length > 0 ? (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {banners.map((b) => (
              <div key={b.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt="" className="h-24 w-full rounded-xl border border-slate-200 object-cover" />
                <button onClick={() => quitarBanner(b.id)} disabled={pending} title="Quitar banner"
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-xs font-bold text-white shadow">✕</button>
              </div>
            ))}
          </div>
        ) : <p className="mb-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">Aún no hay banners. Si no subes ninguno, no aparece el carrusel.</p>}
        <label className="pf-btn inline-block cursor-pointer px-4 py-2.5 text-sm">
          + Agregar banner(s)
          <input ref={bannerRef} type="file" accept="image/*" multiple className="hidden" onChange={subirBanners} />
        </label>
      </div>

      <div className="pf-card p-5">
        <PanelHead emoji="🎨" titulo="Tema de temporada"
          sub="Cambia colores, emojis y decoración animada de TODO el catálogo. Pon “Normal” para dejarlo azul de siempre." />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {TEMAS.map((t) => (
            <button key={t.id} onClick={() => elegir(t.id)} disabled={pending}
              className={"flex items-center gap-2 rounded-2xl border-2 p-2.5 text-left transition " + (tema === t.id ? "border-brand bg-brand-light" : "border-slate-200 bg-white hover:border-brand")}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}>{t.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[#0e2650]">{t.label}</span>
                <span className="block truncate text-[12px] leading-none">{t.caen.join(" ") || "Clásico"}</span>
              </span>
              {tema === t.id && <span className="text-brand-dark">✓</span>}
            </button>
          ))}
        </div>
      </div>
      {nota && <p className="text-center text-[13px] font-semibold text-slate-600">{nota}</p>}
    </div>
  );
}

/* ---------- Últimos modelos (para saber qué número sigue al subir) ---------- */
function UltimosModelosPanel() {
  const [rows, setRows] = useState<LineaModelo[] | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const [pend, start] = useTransition();
  const cargar = useCallback(() => {
    setErr(false);
    start(async () => { try { setRows(await ultimosModelosAction()); } catch { setErr(true); } });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const filtro = norm(q.trim());
  const vis = useMemo(() => (rows || []).filter((r) =>
    !filtro || norm(r.nombre).includes(filtro) || r.linea.toLowerCase().includes(filtro) || norm(r.categoria).includes(filtro)
  ), [rows, filtro]);
  return (
    <div className="space-y-4">
      <div className="pf-card p-5">
        <PanelHead emoji="🔢" tono="bg-sky-100" titulo="Últimos modelos"
          sub="El último número (M#) de cada línea de producto, para saber cuál sigue al subir un modelo nuevo — sin repetir ni brincarte números." />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto, código o categoría… (ej. mantel, CSI-CSE)"
          className="pf-input mt-1 w-full px-3 py-2.5 text-sm" />
        {err
          ? <p className="mt-3 text-sm text-red-600">No se pudo cargar (Odoo tardó). <button onClick={cargar} className="font-bold underline">Reintentar</button></p>
          : rows === null || pend
          ? <p className="mt-3 text-sm text-gray-500">Cargando…</p>
          : <p className="mt-2 text-[12px] text-gray-400">{vis.length} línea(s) con modelos numerados. La columna <b>Sigue</b> es el número que va al crear el próximo.</p>}
      </div>
      {rows && vis.length > 0 && (
        <div className="pf-card overflow-x-auto p-2 sm:p-3">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400">
              <tr>
                <th className="px-2 py-2">Producto</th>
                <th className="px-2">Código</th>
                <th className="hidden px-2 sm:table-cell">Categoría</th>
                <th className="px-2 text-center">Último</th>
                <th className="px-2 text-center">Sigue</th>
                <th className="px-2">Faltan</th>
              </tr>
            </thead>
            <tbody>
              {vis.map((r) => (
                <tr key={r.linea} className="border-t border-gray-100 align-top">
                  <td className="px-2 py-2 font-semibold text-[#0e2650]">{r.nombre} <span className="font-normal text-gray-400">({r.cuantos})</span></td>
                  <td className="px-2 font-mono text-[12px] text-gray-500">{r.linea}</td>
                  <td className="hidden px-2 text-gray-500 sm:table-cell">{r.categoria}</td>
                  <td className="px-2 text-center font-bold text-gray-700">M{r.ultimo}</td>
                  <td className="px-2 text-center"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[12px] font-extrabold text-emerald-700">M{r.ultimo + 1}</span></td>
                  <td className="px-2">{r.faltan.length
                    ? <span className="inline-block max-w-[220px] rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{r.faltan.map((n) => "M" + n).join(", ")}</span>
                    : <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- 📸 Sin foto (Bodega): Maru le toma la foto a lo que ya subieron ---------- */
// Lista los productos que ya cayeron en Bodega y aún no tienen foto. Maru abre esto en su cel,
// ve cada producto, toma la foto y se pega SOLA a ese producto (sin nombrar archivos ni Drive).
// Yo (Claude) les quito el fondo en un batch aparte. Pensado para celular y a prueba de caídas.
function SinFotoBodegaPanel() {
  const [items, setItems] = useState<ProductoBuscado[]>([]);
  const [cargado, setCargado] = useState(false);
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [hechas, setHechas] = useState(0);
  const [msg, setMsg] = useState("");

  const cargar = useCallback(() => {
    setErr(false);
    start(async () => {
      try { setItems(await sinFotoBodegaAction()); setCargado(true); }
      catch { setErr(true); setCargado(true); }
    });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function subirFoto(p: ProductoBuscado, file: File | null) {
    if (!file || subiendo != null) return;
    setSubiendo(p.id); setMsg("");
    try {
      const b64 = await fileToBase64(file);
      const r = await cambiarImagenAction(p.id, b64, `${p.name} (${p.sku})`);
      if (r.ok) {
        setItems((xs) => xs.filter((x) => x.id !== p.id));
        setHechas((n) => n + 1);
        setMsg(`✅ Lista la foto de ${p.name}`);
      } else {
        setMsg("❌ No se pudo subir. Revisa tu internet e inténtalo otra vez.");
      }
    } catch {
      setMsg("❌ No se pudo subir. Revisa tu internet e inténtalo otra vez.");
    } finally { setSubiendo(null); }
  }

  return (
    <div className="space-y-4">
      <div className="pf-card p-4 sm:p-5">
        <PanelHead emoji="📸" titulo="Sin foto"
          sub="Lo que ya se subió a Bodega y le falta foto. Tómala y yo le quito el fondo."
          right={<button onClick={cargar} disabled={pending} className={REFRESH}>{pending ? "…" : "↻ Actualizar"}</button>} />
        {hechas > 0 && <p className="mb-2 text-center text-[13px] font-bold text-emerald-600">🎉 {hechas} foto(s) subida(s) — ¡vas muy bien!</p>}
        {msg && <p className="mb-2 text-center text-[13px] font-semibold text-slate-600">{msg}</p>}
        {!cargado && <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>}
        {cargado && err && (
          <p className="py-8 text-center text-sm text-red-600">No se pudo cargar (Odoo tardó). <button onClick={cargar} className="font-bold underline">Reintentar</button></p>
        )}
        {cargado && !err && items.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400">🎉 Todo lo de Bodega ya tiene foto.<br />Nada pendiente por ahora.</p>
        )}
        {items.length > 0 && (
          <>
            <p className="mb-3 text-center text-[13px] font-bold text-amber-600">📷 {items.length} producto(s) sin foto</p>
            <div className="space-y-2.5">
              {items.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl">📦</div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-display text-[15px] font-bold leading-tight text-[#0e2650]">{p.name}</p>
                    <p className="truncate font-mono text-[11px] text-slate-400">{p.sku}</p>
                  </div>
                  <label className={"shrink-0 cursor-pointer select-none rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-sm transition " + (subiendo === p.id ? "bg-slate-300" : "bg-brand hover:bg-brand-dark active:scale-95")}>
                    {subiendo === p.id ? "Subiendo…" : "📸 Foto"}
                    <input type="file" accept="image/*" className="hidden" disabled={subiendo != null}
                      onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                      onChange={(e) => subirFoto(p, e.target.files?.[0] || null)} />
                  </label>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Selector de bodega (Tienda / Bodega) ---------- */
// undefined = Tienda (tienda actual, lo normal). 18 = Bodega (mercancía de la mudanza,
// NO se ve en catálogo ni fichas hasta que se muden).
const BODEGA_TORRES = 18;
function DestinoBodega({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const torres = value === BODEGA_TORRES;
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-[15px] font-bold text-[#0e2650]">¿A qué bodega?</span>
        <button type="button" onClick={() => onChange(undefined)}
          className={"rounded-full px-3 py-1.5 text-sm font-bold transition " + (!torres ? "bg-brand text-white shadow" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-brand")}>🏠 Tienda</button>
        <button type="button" onClick={() => onChange(BODEGA_TORRES)}
          className={"rounded-full px-3 py-1.5 text-sm font-bold transition " + (torres ? "bg-amber-500 text-white shadow" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-amber-400")}>🆕 Bodega</button>
      </div>
      {torres && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-700 ring-1 ring-amber-200">⚠️ Vas a subir a <b>Bodega</b> — esto NO se ve en el catálogo ni en las fichas hasta la mudanza.</p>}
    </div>
  );
}

/* ---------- Resurtir (sumar stock a productos existentes) ---------- */
type FilaResurtir = { sku: string; add: string; id: number | null; name: string; actual: number; estado?: string };
function ResurtirPanel({ soloBodega = false }: { soloBodega?: boolean }) {
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<"sumar" | "poner">("sumar");
  const [rows, setRows] = useState<FilaResurtir[]>([]);
  // soloBodega = apartado dedicado a Bodega (destino fijo, sin switch). Si no, Tienda por defecto.
  const [destino, setDestino] = useState<number | undefined>(soloBodega ? BODEGA_TORRES : undefined);
  const [pending, start] = useTransition();
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const [aviso, setAviso] = useState("");

  useDraft(soloBodega ? "bam-torres-v1" : "bam-resurtir-v1",
    () => ({ texto, modo }),
    (d) => { if (typeof d.texto === "string") setTexto(d.texto); if (d.modo === "sumar" || d.modo === "poner") setModo(d.modo); },
    [texto, modo]);

  function parse(): { sku: string; add: number | null }[] {
    const out: { sku: string; add: number | null }[] = [];
    for (const raw of texto.split(/\r?\n/)) {
      const l = raw.replace(/^\[[^\]]*\]\s*[^:]*:\s*/, "").trim();
      if (!l) continue;
      const parts = l.split(/\s+/);
      const sku = parts[0].toUpperCase();
      const qStr = [...parts].reverse().find((t) => /^x?\d+$/i.test(t));
      out.push({ sku, add: qStr ? parseInt(qStr.replace(/x/i, ""), 10) : null });
    }
    return out;
  }
  function analizar() {
    const items = parse();
    setProg(null);
    if (!items.length) { setRows([]); setAviso("no-entendi"); return; }
    start(async () => {
      const found = await resurtirBuscarAction(items.map((i) => i.sku), destino);
      const map = new Map(found.map((f) => [f.sku, f] as [string, ProdResurtir]));
      setRows(items.map((i) => {
        const f = map.get(i.sku);
        return { sku: i.sku, add: i.add != null ? String(i.add) : "", id: f ? f.id : null, name: f ? f.name : "", actual: f ? f.cantidad : 0 };
      }));
      setAviso("ok");
    });
  }
  const nuevoTotal = (r: FilaResurtir) => modo === "sumar" ? r.actual + (Number(r.add) || 0) : (Number(r.add) || 0);
  function upd(i: number, patch: Partial<FilaResurtir>) { setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))); }
  function aplicar() {
    start(async () => {
      const hecho = (s?: string) => !!s && (s.startsWith("✅") || s.startsWith("🕒"));
      const idxs = rows.map((r, i) => i).filter((i) => rows[i].id != null && !hecho(rows[i].estado));
      setProg({ done: 0, total: idxs.length });
      let done = 0;
      for (const i of idxs) {
        const r = rows[i];
        const nueva = nuevoTotal(r);
        const res = await resurtirAction(r.id!, nueva, `${r.name} (${r.sku})`, nueva - r.actual, destino);
        upd(i, { estado: res.ok ? (res.pendiente ? "🕒 en revisión" : `✅ ${r.actual}→${nueva}`) : "❌ " + res.error });
        done++; setProg({ done, total: idxs.length });
      }
    });
  }
  const inp = "pf-input w-full px-3 py-2 text-sm";
  const noEnc = rows.filter((r) => r.id == null).length;

  return (
    <div className="space-y-4">
      <div className="pf-card p-5">
        {soloBodega ? (
          <>
            <PanelHead emoji="🆕" tono="bg-amber-100" titulo="Bodega"
              sub="Cuenta aquí la mercancía que llega a la bodega nueva (la de la mudanza)." />
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-700 ring-1 ring-amber-200">📦 Todo lo que subas aquí se guarda en <b>Bodega</b> y <b>NO</b> aparece en el catálogo ni en las fichas hasta que se muden. ¿Producto totalmente nuevo? Créalo en <b>➕ Uno por uno</b> y elige “Bodega”.</p>
          </>
        ) : (
          <>
            <PanelHead emoji="🔄" tono="bg-sky-100" titulo="Resurtir inventario"
              sub="Súmale piezas a productos que YA existen." />
            <DestinoBodega value={destino} onChange={setDestino} />
          </>
        )}
        <p className="mb-2 text-[12px] text-gray-500">Pega <b>un renglón por producto</b>: el <b>SKU</b> y la <b>cantidad que llegó</b>. Ej: <span className="font-mono">CSA-CHE-M1-CAF 20</span></p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7}
          placeholder={"CSA-CHE-M1-CAF 20\nCOL-NEN-ROS-K 50\nMAN-RED-BEI x8"}
          className="w-full pf-input p-3 font-mono text-xs" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-display text-[15px] font-bold text-[#0e2650]">La cantidad es para:</span>
          <label className="flex items-center gap-1 text-sm"><input type="radio" checked={modo === "sumar"} onChange={() => setModo("sumar")} className="accent-brand" /> Sumar a lo que hay</label>
          <label className="flex items-center gap-1 text-sm"><input type="radio" checked={modo === "poner"} onChange={() => setModo("poner")} className="accent-brand" /> Poner ese total exacto</label>
        </div>
        <button onClick={analizar} disabled={pending} className="mt-3 w-full pf-btn px-4 py-3 text-base disabled:bg-gray-300">
          {pending && !prog ? "Buscando…" : "Buscar productos →"}
        </button>
        {aviso === "no-entendi" && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-center text-[13px] font-semibold text-red-600">Pega al menos un SKU con su cantidad.</p>}
      </div>

      {rows.length > 0 && (
        <div className="pf-card p-5">
          <p className="mb-1 font-display text-[15px] font-bold text-[#0e2650]">Revisa y aplica ({rows.length})</p>
          {noEnc > 0 && <p className="mb-2 text-[12px] font-semibold text-red-600">⛔ {noEnc} SKU no existe(n) — revisa el código (esos no se tocan).</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-gray-400">
                <tr><th className="px-1 py-1">SKU</th><th className="px-1">Producto</th><th className="px-1">Actual</th><th className="px-1">{modo === "sumar" ? "+ Llegó" : "Poner"}</th><th className="px-1">Nuevo</th><th className="px-1">Estado</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={"border-t border-gray-100 " + (r.id == null ? "bg-red-50" : "")}>
                    <td className="px-1 py-1 font-mono">{r.sku}</td>
                    <td className="px-1 text-gray-700">{r.id != null ? r.name : <span className="font-semibold text-red-500">no existe</span>}</td>
                    <td className="px-1 text-center text-gray-500">{r.id != null ? r.actual : "—"}</td>
                    <td className="px-1"><input className={inp + " w-16"} value={r.add} onChange={(e) => upd(i, { add: e.target.value })} placeholder="0" /></td>
                    <td className="px-1 text-center font-bold text-brand-dark">{r.id != null ? nuevoTotal(r) : "—"}</td>
                    <td className="px-1 text-[11px] font-semibold">{r.estado || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {prog && <p className="mt-2 text-sm text-gray-600">Aplicando… {prog.done}/{prog.total}</p>}
          <button onClick={aplicar} disabled={pending} className="mt-3 w-full pf-btn px-4 py-3.5 text-base">
            {pending && prog ? "Aplicando…" : `Aplicar a ${rows.filter((r) => r.id != null).length} productos`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Crear producto ---------- */
function CrearForm({ categorias }: { categorias: Categoria[] }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [skuTocado, setSkuTocado] = useState(false);
  const [categId, setCategId] = useState<number>(categorias[0]?.id || 0);
  const [publico, setPublico] = useState("");
  const [miembro, setMiembro] = useState("");
  const [enLiq, setEnLiq] = useState(false);
  const [liq, setLiq] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [destino, setDestino] = useState<number | undefined>(undefined); // Tienda por defecto
  const [tarifas, setTarifas] = useState<TarStr[]>(TAR_VACIAS());
  const [descripcion, setDescripcion] = useState("");
  const [imgB64, setImgB64] = useState<string | null>(null);
  const [imgPrev, setImgPrev] = useState<string>("");
  const [extras, setExtras] = useState<{ b64: string; prev: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // OJO: la liquidación (enLiq/liq) NO se guarda en el borrador a propósito. Antes se guardaba y
  // volvía marcada sola en el siguiente producto; siempre debe empezar DESMARCADA y marcarse a mano.
  useDraft("bam-crear-v1",
    () => ({ name, sku, skuTocado, categId, publico, miembro, tarifas, cantidad, descripcion }),
    (d) => {
      if (typeof d.name === "string") setName(d.name);
      if (typeof d.sku === "string") setSku(d.sku);
      if (typeof d.skuTocado === "boolean") setSkuTocado(d.skuTocado);
      if (typeof d.categId === "number") setCategId(d.categId);
      if (typeof d.publico === "string") setPublico(d.publico);
      if (typeof d.miembro === "string") setMiembro(d.miembro);
      if (Array.isArray(d.tarifas)) setTarifas(d.tarifas as TarStr[]);
      if (typeof d.cantidad === "string") setCantidad(d.cantidad);
      if (typeof d.descripcion === "string") setDescripcion(d.descripcion);
    },
    [name, sku, skuTocado, categId, publico, miembro, tarifas, cantidad, descripcion]);

  function onName(v: string) {
    v = v.slice(0, 45); // máximo 45 caracteres (letras, números y espacios)
    setName(v);
    if (!skuTocado) setSku(sugerirSku(v));
  }
  async function addExtras(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) { const b64 = await fileToBase64(f); setExtras((xs) => [...xs, { b64, prev: URL.createObjectURL(f) }]); }
  }
  async function pegarExtra() {
    const f = await imagenDelPortapapeles();
    if (f) { const b64 = await fileToBase64(f); setExtras((xs) => [...xs, { b64, prev: URL.createObjectURL(f) }]); }
    else alert("No encontré una imagen copiada. Copia una imagen (Ctrl+C) y vuelve a intentar.");
  }
  function quitarExtra(i: number) { setExtras((xs) => xs.filter((_, j) => j !== i)); }
  async function aplicarFoto(f: File) {
    setImgPrev(URL.createObjectURL(f));
    setImgB64(await fileToBase64(f));
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) await aplicarFoto(f);
  }
  // pegar imagen con Ctrl+V
  useEffect(() => {
    const h = (e: ClipboardEvent) => { if (!fileRef.current || fileRef.current.offsetParent === null) return; const f = imagenDePaste(e); if (f) { e.preventDefault(); aplicarFoto(f); } };
    document.addEventListener("paste", h);
    return () => document.removeEventListener("paste", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function pegarFoto() {
    const f = await imagenDelPortapapeles();
    if (f) await aplicarFoto(f);
    else alert("No encontré una imagen copiada. Copia una imagen (Ctrl+C) y vuelve a intentar (o usa Ctrl+V).");
  }
  function quitarFoto() {
    setImgB64(null); setImgPrev("");
    if (fileRef.current) fileRef.current.value = "";
  }
  function reset() {
    setName(""); setSku(""); setSkuTocado(false); setPublico(""); setMiembro("");
    setEnLiq(false); setLiq(""); setTarifas(TAR_VACIAS()); setCantidad(""); setDescripcion(""); setImgB64(null); setImgPrev(""); setExtras([]);
    limpiarDraft("bam-crear-v1");
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!name.trim() || !sku.trim()) { setMsg({ ok: false, text: "Falta nombre o código." }); return; }
    if (!Number(publico)) { setMsg({ ok: false, text: "Falta el precio público." }); return; }
    start(async () => {
      const r = await crearProductoAction({
        name: limpiarNombre(name), sku: sku.trim().toUpperCase(), categId,
        publico: Number(publico), miembro: Number(miembro) || 0,
        liquidacion: enLiq ? (Number(liq) || 0) : null,
        cantidad: Number(cantidad) || 0, imageBase64: imgB64,
        imagesExtra: extras.map((x) => x.b64),
        tarifas: tarToPayload(tarifas),
        descripcion: descripcion.trim() || undefined,
        loc: destino,
      });
      if (r.ok) { setMsg({ ok: true, text: `✅ Creado: ${r.sku}` }); reset(); }
      else setMsg({ ok: false, text: r.error });
    });
  }

  const inp = "pf-input w-full px-3 py-2";
  const lab = "mb-1 block font-display text-[15px] font-bold text-[#0e2650]";

  return (
    <form onSubmit={submit} className="space-y-4 pf-card p-5">
      <PanelHead emoji="➕" tono="bg-sky-100" titulo="Crear un producto"
        sub="Uno por uno, con su foto. Queda en inventario y en el catálogo." />
      <div>
        <label className={lab}>Nombre del producto <span className={"font-normal " + (name.length >= 45 ? "text-red-500" : "text-gray-400")}>({name.length}/45)</span></label>
        <input className={inp} value={name} maxLength={45} onChange={(e) => onName(e.target.value)} onBlur={() => setName((n) => limpiarNombre(n))} placeholder="Ej. Colcha Nena Rosa - King" />
      </div>
      <div>
        <label className={lab}>Código (SKU) <span className="font-normal text-gray-400">— sugerido, puedes editarlo</span></label>
        <input className={inp + " font-mono uppercase"} value={sku}
          onChange={(e) => { setSku(e.target.value.toUpperCase()); setSkuTocado(true); }} placeholder="COL-NENA-ROSA-K" />
      </div>
      <div>
        <label className={lab}>Categoría</label>
        <select className={inp} value={categId} onChange={(e) => setCategId(Number(e.target.value))}>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className={lab}>Descripción <span className="font-normal text-gray-400">— opcional, sale en el catálogo</span></label>
        <textarea className={inp} rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Suave, 100% algodón. Incluye 2 fundas." />
        <p className="mt-1 text-[11px] text-gray-400">Tip: lo que pongas entre *asteriscos* sale en <b>negritas</b>.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lab}>Precio público</label>
          <input className={inp} type="number" inputMode="numeric" value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className={lab}>Precio miembros</label>
          <input className={inp} type="number" inputMode="numeric" value={miembro} onChange={(e) => setMiembro(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="rounded-2xl bg-sky-50/60 p-3">
        <label className={lab}>Precios por mayoreo <span className="font-normal text-gray-400">— opcional (hasta 3; aplican en tienda y catálogo)</span></label>
        <TarifasEditor value={tarifas} onChange={setTarifas} />
      </div>
      <div className="rounded-2xl bg-red-50/60 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-red-700">
          <input type="checkbox" checked={enLiq} onChange={(e) => setEnLiq(e.target.checked)} className="h-4 w-4 accent-red-500" />
          🔥 En liquidación
        </label>
        {enLiq && (
          <input className={inp + " mt-2"} type="number" inputMode="numeric" value={liq} onChange={(e) => setLiq(e.target.value)} placeholder="Precio de liquidación" />
        )}
      </div>
      <DestinoBodega value={destino} onChange={setDestino} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lab}>Cantidad (inventario)</label>
          <input className={inp} type="number" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className={lab}>Foto</label>
          <div className="flex items-center gap-2">
            <input ref={fileRef} className="block w-full text-sm text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white" type="file" accept="image/*" onChange={onFile} />
            <button type="button" onClick={pegarFoto} title="Pegar imagen copiada (Ctrl+V también funciona)" className="shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">📋 Pegar</button>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">Elige del archivo, o copia una imagen y pégala con <b>Ctrl+V</b> / el botón 📋.</p>
        </div>
      </div>
      {imgPrev && (
        <div className="flex items-center gap-3">
          <img src={imgPrev} alt="" className="h-28 w-28 rounded-xl border object-cover" />
          <button type="button" onClick={quitarFoto} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-50">✕ Quitar foto principal</button>
        </div>
      )}
      <div>
        <label className={lab}>Más fotos <span className="font-normal text-gray-400">— opcional, salen en la galería del catálogo</span></label>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" multiple onChange={(e) => { addExtras(e.target.files); e.target.value = ""; }}
            className="block w-full text-sm text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white" />
          <button type="button" onClick={pegarExtra} title="Pegar imagen copiada (Ctrl+C y luego aquí)" className="shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">📋 Pegar</button>
        </div>
        {extras.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {extras.map((x, i) => (
              <div key={i} className="relative">
                <img src={x.prev} alt="" className="h-16 w-16 rounded-lg border object-cover" />
                <button type="button" onClick={() => quitarExtra(i)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <button disabled={pending} className="w-full pf-btn px-4 py-3.5 text-base">
        {pending ? "Guardando en Odoo…" : "Crear producto"}
      </button>
      <p className="text-center text-[11px] text-gray-400">Queda en inventario y catálogo. El catálogo tarda ≤5 min en mostrarlo.</p>
    </form>
  );
}

/* ---------- Buscar / editar ---------- */
function BuscarPanel({ categorias, aprobador }: { categorias: Categoria[]; aprobador: boolean }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductoBuscado[]>([]);
  const [pending, start] = useTransition();
  const [buscado, setBuscado] = useState(false);
  function buscar(e: React.FormEvent) {
    e.preventDefault();
    start(async () => { setItems(await buscarAction(q)); setBuscado(true); });
  }
  const activos = items.filter((p) => p.activo);
  const archivados = items.filter((p) => !p.activo);
  return (
    <div className="space-y-3">
      <div className="pf-card p-5">
        <PanelHead emoji="🔎" tono="bg-brand-light" titulo="Buscar y editar"
          sub="Encuentra un producto para cambiar precio, inventario, foto o nombre. La búsqueda incluye archivados y no archivados." />
        <form onSubmit={buscar} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código…"
            className="flex-1 pf-input px-4 py-3" />
          <button disabled={pending} className="font-display shrink-0 rounded-2xl bg-brand px-6 py-3 font-bold text-white shadow-[0_10px_22px_-8px_rgba(46,109,164,.7)] transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:translate-y-0 disabled:bg-gray-300 disabled:shadow-none">
            {pending ? "…" : "Buscar"}
          </button>
        </form>
      </div>
      {buscado && items.length === 0 && <p className="py-8 text-center text-gray-400">Sin resultados.</p>}
      {activos.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 px-1 pt-1 text-sm font-bold text-slate-700">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">✅ No archivados</span>
            <span className="text-xs font-semibold text-slate-400">{activos.length}</span>
          </h3>
          <ListaEditable items={activos} setItems={setItems} categorias={categorias} aprobador={aprobador} />
        </div>
      )}
      {archivados.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 px-1 pt-2 text-sm font-bold text-slate-700">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">🗄️ Archivados</span>
            <span className="text-xs font-semibold text-slate-400">{archivados.length}</span>
          </h3>
          <ListaEditable items={archivados} setItems={setItems} categorias={categorias} aprobador={aprobador} />
        </div>
      )}
    </div>
  );
}

/* ---------- Productos por estado (Normales / Liquidación / Saldos) ---------- */
function ProductosPanel({ categorias, aprobador }: { categorias: Categoria[]; aprobador: boolean }) {
  const [tab, setTab] = useState<"saldos" | "liq" | "normales" | "sinstock">("saldos");
  const [items, setItems] = useState<ProductoBuscado[]>([]);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [cargado, setCargado] = useState(false);

  function cargar(t: "saldos" | "liq" | "normales" | "sinstock", query = "") {
    setCargado(false);
    start(async () => {
      const r = t === "saldos" ? await saldosListaAction()
        : t === "liq" ? await liquidacionListaAction()
        : t === "sinstock" ? await sinStockListaAction()
        : query.trim() ? await buscarAction(query) : [];
      setItems(r); setCargado(true);
    });
  }
  useEffect(() => { cargar("saldos"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  function ir(t: "saldos" | "liq" | "normales" | "sinstock") { setTab(t); setItems([]); setCargado(false); if (t !== "normales") cargar(t); }

  const TABS: [("saldos" | "liq" | "normales" | "sinstock"), string][] = [["saldos", "🏷️ Saldos"], ["liq", "🔥 Liquidación"], ["sinstock", "📭 Sin stock"], ["normales", "📦 Normales"]];
  return (
    <div className="space-y-3">
      <div className="pf-card p-5">
        <PanelHead emoji="📂" titulo="Productos" sub="Míralos por estado: saldos, liquidación o normales. Puedes editarlos o eliminarlos." />
        <div className="flex flex-wrap gap-2">
          {TABS.map(([id, lbl]) => (
            <button key={id} onClick={() => ir(id)}
              className={"rounded-full px-4 py-2 text-sm font-bold transition " + (tab === id ? "bg-brand text-white shadow" : "bg-white text-gray-600 ring-1 ring-slate-200 hover:ring-brand")}>{lbl}</button>
          ))}
        </div>
        {tab === "normales" && (
          <form onSubmit={(e) => { e.preventDefault(); cargar("normales", q); }} className="mt-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca un producto por nombre o código…" className="flex-1 pf-input px-4 py-2.5" />
            <button className="pf-btn px-5 py-2.5 text-sm">Buscar</button>
          </form>
        )}
        {tab === "sinstock" && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
            Productos que se quedaron en <b>0 piezas</b>. Para esconderlos: <b>☑️ Seleccionar varios</b> → escoge → <b>🗄️ Archivar</b>.
            Salen del catálogo y del PdV, y se restauran en <b>🗄️ Archivados</b>. Si les vuelves a meter mercancía con Resurtir, se reactivan solos.
          </p>
        )}
        <p className="mt-2 text-[12px] text-slate-500">
          {pending ? "Cargando…" : cargado ? `${items.length} producto(s)` : tab === "normales" ? "Escribe algo y pica Buscar." : ""}
        </p>
      </div>
      {cargado && items.length === 0 && tab !== "normales" && (
        <p className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400">No hay productos en esta lista.</p>
      )}
      <ListaEditable items={items} setItems={setItems} categorias={categorias} aprobador={aprobador} />
    </div>
  );
}

function EditCard({ p, categorias, sel, aprobador }: { p: ProductoBuscado; categorias: Categoria[]; aprobador: boolean; sel?: { on: boolean; checked: boolean; toggle: () => void } }) {
  const [nombre, setNombre] = useState(p.name);
  const [qty, setQty] = useState(String(p.cantidad));
  const [pub, setPub] = useState(String(p.publico));
  const [mem, setMem] = useState(String(p.miembro ?? ""));
  const [enLiq, setEnLiq] = useState(p.liquidacion != null);
  const [liq, setLiq] = useState(String(p.liquidacion ?? ""));
  const [motivo, setMotivo] = useState(""); // razón del cambio: opcional, se guarda en el historial
  const [pend, start] = useTransition();
  const [okBtn, setOkBtn] = useState<{ k: string; pend: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [imgV, setImgV] = useState(0);
  const [activo, setActivo] = useState(p.activo);
  const [borrado, setBorrado] = useState(false);
  const [desc, setDesc] = useState(p.descripcion || "");
  const [tarifas, setTarifas] = useState<TarStr[]>(tarFromPayload(p.tarifas));
  const [sku, setSku] = useState(p.sku);
  const [catId, setCatId] = useState<number>(p.categId || 0);
  const [tags, setTags] = useState<Set<number>>(new Set(p.tags || [])); // temporadas marcadas
  const etiqueta = `${p.name} (${p.sku})`;

  type Resp = { ok: true; pendiente: boolean } | { ok: false; error: string };
  function toast(t: string) { setNote(t); setTimeout(() => setNote(""), 3000); }
  const fb = (r: Resp, hecho: string) => (r.ok ? (r.pendiente ? "🕒 Enviado a revisión" : hecho) : r.error);
  const aplicado = (r: Resp) => r.ok && !r.pendiente;
  // Marca el botón recién guardado (verde "✓ Guardado" / "✓ Enviado") ~2s, para que se vea que sí quedó.
  function marcarOk(k: string, r: Resp) { if (r.ok) { setOkBtn({ k, pend: r.pendiente }); setTimeout(() => setOkBtn(null), 2200); } }
  const okBg = (k: string, normal: string) => (okBtn?.k === k ? "bg-green-600" : normal);
  const okTxt = (k: string, base: string) => (okBtn && okBtn.k === k ? (okBtn.pend ? "✓ Enviado" : "✓ Guardado") : base);
  const okOK = (k: string) => (okBtn?.k === k ? "✓" : "OK");
  // Motivo del cambio: OPCIONAL para todos. Lo que esté escrito en el campo "📝 Motivo" de la
  // tarjeta se guarda junto al cambio en el historial. Si está vacío, el cambio se guarda igual.
  const razonDe = () => motivo.trim();
  function archivar() {
    if (!confirm(`¿Archivar (ocultar) "${p.name}"? Sale del catálogo y del PdV, pero se puede restaurar.`)) return;
    start(async () => { const r = await archivarAction(p.id, etiqueta); if (aplicado(r)) setActivo(false); toast(fb(r, "✅ Archivado")); });
  }
  function restaurar() {
    start(async () => { const r = await restaurarAction(p.id, etiqueta); if (aplicado(r)) setActivo(true); toast(fb(r, "✅ Restaurado")); });
  }
  function eliminar() {
    if (!confirm(`¿ELIMINAR "${p.name}" de forma definitiva? Esto NO se puede deshacer. Si no deja, mejor usa Archivar.`)) return;
    start(async () => { const r = await eliminarAction(p.id, etiqueta); if (aplicado(r)) setBorrado(true); else toast(fb(r, "")); });
  }
  function guardarNombre() { const razon = razonDe(); start(async () => { const r = await setNombreAction(p.id, nombre.trim() || p.name, p.name, razon); toast(fb(r, "✅ Nombre guardado")); marcarOk("nombre", r); }); }
  function guardarSku() { const razon = razonDe(); start(async () => { const r = await setSkuAction(p.id, sku.trim().toUpperCase(), p.sku, razon); toast(fb(r, "✅ Código (SKU) guardado")); marcarOk("sku", r); }); }
  function guardarStock() { const razon = razonDe(); start(async () => { const r = await setStockAction(p.id, Number(qty) || 0, etiqueta, p.cantidad, razon); toast(fb(r, "✅ Inventario actualizado")); marcarOk("stock", r); }); }
  function guardarPrecios() { const razon = razonDe(); start(async () => { const r = await setPreciosAction(p.id, Number(pub) || 0, Number(mem) || 0, etiqueta, p.publico, p.miembro, razon); toast(fb(r, "✅ Precios actualizados")); marcarOk("precios", r); }); }
  function guardarLiq() { const razon = razonDe(); start(async () => { const r = await setLiqAction(p.id, enLiq, Number(liq) || 0, etiqueta, p.liquidacion, razon); toast(fb(r, "✅ Liquidación actualizada")); marcarOk("liq", r); }); }
  // Marca/desmarca una temporada (Navidad, Halloween…) al instante, sin botón de guardar.
  function toggleTemporada(tagId: number, nombre: string) {
    const on = !tags.has(tagId);
    setTags((s) => { const n = new Set(s); if (on) n.add(tagId); else n.delete(tagId); return n; }); // optimista
    start(async () => {
      const r = await setTagAction(p.id, tagId, on, nombre, etiqueta);
      if (!aplicado(r)) setTags((s) => { const n = new Set(s); if (on) n.delete(tagId); else n.add(tagId); return n; }); // revertir si falló
      toast(fb(r, on ? `✅ Marcado ${nombre}` : `✅ Quitado ${nombre}`));
    });
  }
  async function cambiarImg(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const b64 = await fileToBase64(f);
    start(async () => { const r = await cambiarImagenAction(p.id, b64, etiqueta); if (aplicado(r)) setImgV((v) => v + 1); toast(fb(r, "✅ Imagen cambiada")); });
  }
  async function pegarCambiar() {
    const f = await imagenDelPortapapeles();
    if (!f) { toast("Copia una imagen (Ctrl+C) y vuelve a intentar."); return; }
    const b64 = await fileToBase64(f);
    start(async () => { const r = await cambiarImagenAction(p.id, b64, etiqueta); if (aplicado(r)) setImgV((v) => v + 1); toast(fb(r, "✅ Imagen cambiada")); });
  }
  function guardarDesc() { start(async () => { const r = await setDescripcionAction(p.id, desc, etiqueta); toast(r.ok ? (r.pendiente ? "🕒 Enviado a revisión" : "✅ Descripción guardada") : r.error); marcarOk("desc", r); }); }
  function guardarTarifas() { start(async () => { const r = await setTarifasAction(p.id, tarToPayload(tarifas), etiqueta); toast(fb(r, "✅ Mayoreo actualizado")); marcarOk("tarifas", r); }); }
  function guardarCategoria(v: number) { setCatId(v); start(async () => { const r = await setCategoriaAction(p.id, v, etiqueta); toast(fb(r, "✅ Categoría actualizada")); }); }
  async function agregarMas(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files || !files.length) return;
    const imgs: string[] = [];
    for (const f of Array.from(files)) imgs.push(await fileToBase64(f));
    e.target.value = "";
    start(async () => { const r = await agregarImagenesAction(p.id, imgs, etiqueta); toast(fb(r, `✅ ${imgs.length} foto(s) agregada(s)`)); });
  }
  async function pegarMas() {
    const f = await imagenDelPortapapeles();
    if (!f) { toast("Copia una imagen (Ctrl+C) y vuelve a intentar."); return; }
    const b64 = await fileToBase64(f);
    start(async () => { const r = await agregarImagenesAction(p.id, [b64], etiqueta); toast(fb(r, "✅ Foto agregada")); });
  }
  // Pegar imagen con Ctrl+V estando en la tarjeta (cambia la foto principal). Fiable, sin permisos de portapapeles.
  async function onPasteImg(e: React.ClipboardEvent) {
    const it = Array.from(e.clipboardData?.items || []).find((x) => x.type.startsWith("image/"));
    if (!it) return; // no es imagen: deja el pegado normal (texto en los campos)
    e.preventDefault(); e.stopPropagation();
    const f = it.getAsFile(); if (!f) return;
    const b64 = await fileToBase64(f);
    start(async () => { const r = await cambiarImagenAction(p.id, b64, etiqueta); if (aplicado(r)) setImgV((v) => v + 1); toast(fb(r, "✅ Imagen pegada")); });
  }
  const inp = "pf-input w-full px-3 py-2 text-sm";

  if (borrado) return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-center text-sm text-gray-400 line-through">{p.name} — eliminado 🗑️</div>
  );

  return (
    <div tabIndex={0} onPaste={onPasteImg} title="Tip: haz clic en la tarjeta y pega la foto con Ctrl+V"
      className={"rounded-2xl border p-3 shadow-sm outline-none transition focus-within:ring-2 focus-within:ring-brand/30 " + (sel?.checked ? "border-brand ring-2 ring-brand/40 " : "") + (activo ? "border-gray-100 bg-white" : "border-amber-200 bg-amber-50")}>
      {sel?.on && (
        <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-600">
          <input type="checkbox" checked={sel.checked} onChange={sel.toggle} className="h-5 w-5 accent-brand" />
          {sel.checked ? "Seleccionado ✓" : "Seleccionar este"}
        </label>
      )}
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.imageUrl + "?v=" + imgV} alt="" className="h-16 w-16 shrink-0 rounded-lg border object-cover" />
        <div className="min-w-0 flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Nombre (editable)</label>
          <div className="flex items-center gap-1">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm font-bold text-gray-800 outline-none focus:border-brand" />
            {nombre.trim() !== p.name && (
              <button onClick={guardarNombre} disabled={pend} className={"shrink-0 rounded-lg px-3 py-1 text-xs font-bold text-white transition disabled:bg-gray-300 " + okBg("nombre", "bg-brand hover:bg-brand-dark")}>{pend ? "…" : okTxt("nombre", "Guardar")}</button>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">SKU:</span>
            <input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())}
              className="min-w-0 flex-1 rounded border border-gray-200 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 outline-none focus:border-brand" />
            {sku.trim() !== p.sku && sku.trim() && (
              <button onClick={guardarSku} disabled={pend} className={"shrink-0 rounded px-2 py-0.5 text-[10px] font-bold text-white transition disabled:bg-gray-300 " + okBg("sku", "bg-brand hover:bg-brand-dark")}>{pend ? "…" : okOK("sku")}</button>
            )}
            {!activo && <span className="rounded bg-amber-200 px-1 text-[10px] font-bold text-amber-800">archivado</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <label className="cursor-pointer text-[11px] font-semibold text-brand underline">
            Cambiar foto
            <input type="file" accept="image/*" className="hidden" onChange={cambiarImg} />
          </label>
          <button type="button" onClick={pegarCambiar} disabled={pend} className="text-[11px] font-semibold text-brand underline disabled:opacity-50">📋 Pegar (cambiar)</button>
          <label className="mt-1 cursor-pointer text-[11px] font-semibold text-brand underline">
            ➕ Más fotos
            <input type="file" accept="image/*" multiple className="hidden" onChange={agregarMas} />
          </label>
          <button type="button" onClick={pegarMas} disabled={pend} className="text-[11px] font-semibold text-brand underline disabled:opacity-50">📋 Pegar (agregar)</button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="text-[11px] text-gray-500">Inventario</label>
          <div className="flex gap-1">
            <input className={inp} type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
            <button onClick={guardarStock} disabled={pend} className={"rounded-lg px-2 text-xs font-bold text-white transition disabled:bg-gray-300 " + okBg("stock", "bg-brand hover:bg-brand-dark")}>{pend ? "…" : okOK("stock")}</button>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500">Público</label>
          <input className={inp} type="number" value={pub} onChange={(e) => setPub(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">Miembros</label>
          <div className="flex gap-1">
            <input className={inp} type="number" value={mem} onChange={(e) => setMem(e.target.value)} />
            <button onClick={guardarPrecios} disabled={pend} className={"rounded-lg px-2 text-xs font-bold text-white transition disabled:bg-gray-300 " + okBg("precios", "bg-brand hover:bg-brand-dark")}>{pend ? "…" : okOK("precios")}</button>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-red-600">🔥 Liquidación</label>
          <div className="flex items-center gap-1">
            <input type="checkbox" checked={enLiq} onChange={(e) => setEnLiq(e.target.checked)} className="h-4 w-4 accent-red-500" />
            <input className={inp} type="number" value={liq} onChange={(e) => setLiq(e.target.value)} disabled={!enLiq} placeholder="precio" />
            <button onClick={guardarLiq} disabled={pend} className={"rounded-lg px-2 text-xs font-bold text-white transition disabled:bg-gray-300 " + okBg("liq", "bg-red-500 hover:bg-red-600")}>{pend ? "…" : okOK("liq")}</button>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <label className="text-[11px] text-gray-500">Categoría</label>
        <select value={catId} onChange={(e) => guardarCategoria(Number(e.target.value))} className="pf-input w-full px-3 py-2 text-sm">
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="mt-3">
        <label className="text-[11px] text-gray-500">Temporada <span className="font-normal text-gray-400">(aparece además en su propia sección del catálogo)</span></label>
        <div className="mt-1 flex flex-wrap gap-2">
          {TEMPORADAS.map((t) => {
            const on = tags.has(t.tagId);
            return (
              <button key={t.tagId} type="button" onClick={() => toggleTemporada(t.tagId, t.id)} disabled={pend}
                className={"rounded-full px-3.5 py-1.5 text-sm font-bold transition disabled:opacity-50 " + (on ? "bg-brand text-white shadow" : "bg-white text-gray-600 ring-1 ring-slate-200 hover:ring-brand")}>
                {t.emoji} {t.id}{on ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-sky-50/60 p-2.5">
        <label className="text-[11px] font-semibold text-gray-600">Precios por mayoreo <span className="font-normal text-gray-400">(hasta 3; vacío = quitar)</span></label>
        <div className="mt-1"><TarifasEditor value={tarifas} onChange={setTarifas} /></div>
        <button onClick={guardarTarifas} disabled={pend} className={"mt-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition disabled:bg-gray-300 " + okBg("tarifas", "bg-brand hover:bg-brand-dark")}>{pend ? "…" : okTxt("tarifas", "Guardar mayoreo")}</button>
      </div>
      <div className="mt-3">
        <label className="text-[11px] text-gray-500">Descripción (se ve en el catálogo)</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
          className="pf-input mt-0.5 w-full px-3 py-2 text-sm" placeholder="Escribe la descripción del producto…" />
        {desc.trim() !== (p.descripcion || "").trim() && (
          <button onClick={guardarDesc} disabled={pend} className={"mt-1 rounded-lg px-3 py-1 text-xs font-bold text-white transition disabled:bg-gray-300 " + okBg("desc", "bg-brand hover:bg-brand-dark")}>{pend ? "…" : okTxt("desc", "Guardar descripción")}</button>
        )}
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
        <label className="text-[11px] font-semibold text-slate-500">📝 Motivo del cambio <span className="font-normal text-slate-400">(opcional)</span></label>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={140}
          placeholder="Ej. llegó mercancía, se rompió una pieza, error de conteo…"
          className="pf-input mt-0.5 w-full px-3 py-1.5 text-[13px]" />
        <p className="mt-1 text-[11px] text-slate-400">
          Si escribes algo aquí, se guarda en el historial junto al cambio que hagas (inventario, nombre, código, precios o liquidación).
        </p>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3 border-t border-gray-100 pt-2 text-[11px] font-semibold">
        {activo
          ? <button onClick={archivar} disabled={pend} className="text-amber-600 hover:text-amber-700">Archivar</button>
          : <button onClick={restaurar} disabled={pend} className="text-green-600 hover:text-green-700">Restaurar</button>}
        <button onClick={eliminar} disabled={pend} className="text-red-500 hover:text-red-700">Eliminar</button>
      </div>
      {note && <p className="mt-2 text-xs font-semibold text-gray-600">{note}</p>}
    </div>
  );
}

/* ---------- Carga rápida (pegar lista + foto por renglón) ---------- */
type FilaLote = { name: string; sku: string; desc: string; pub: string; mem: string; liq: string; qty: string; categId: number; files: File[]; urls: string[]; incluir: boolean; estado?: string; tarifas?: TarStr[] };

// Saca un File de imagen de un evento de pegar (Ctrl+V)
function imagenDePaste(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const it of Array.from(items)) {
    if (it.type.startsWith("image/")) { const f = it.getAsFile(); if (f) return f; }
  }
  return null;
}
// Lee una imagen del portapapeles (para el botón 📋)
async function imagenDelPortapapeles(): Promise<File | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const t = item.types.find((x) => x.startsWith("image/"));
      if (t) { const blob = await item.getType(t); return new File([blob], "pegada.png", { type: blob.type }); }
    }
  } catch { /* sin permiso o no soportado */ }
  return null;
}

function CargaRapida({ categorias }: { categorias: Categoria[] }) {
  const [texto, setTexto] = useState("");
  const [defCateg, setDefCateg] = useState<number>(categorias[0]?.id || 0);
  const [defQty, setDefQty] = useState("");
  // Destino del stock. NO se persiste en borrador: siempre arranca en Tienda, por seguridad.
  const [destino, setDestino] = useState<number | undefined>(undefined);
  const [rows, setRows] = useState<FilaLote[]>([]);
  const [tarModal, setTarModal] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const [aviso, setAviso] = useState("");
  const [existentes, setExistentes] = useState<Set<string>>(new Set());
  const [restaurado, setRestaurado] = useState(false);
  const [filaActiva, setFilaActiva] = useState<number | null>(null);
  const filaActivaRef = useRef<number | null>(null);
  function activar(i: number) { setFilaActiva(i); filaActivaRef.current = i; }
  // Pegar imagen con Ctrl+V en la fila resaltada
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const f = imagenDePaste(e);
      if (f && filaActivaRef.current != null) { e.preventDefault(); addRowFiles(filaActivaRef.current, [f]); }
    };
    document.addEventListener("paste", h);
    return () => document.removeEventListener("paste", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Guardar borrador para no perder el trabajo (no guarda las fotos) ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bam-carga-v1");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.texto) setTexto(d.texto);
        if (Array.isArray(d.rows) && d.rows.length) {
          setRows(d.rows.map((r: Partial<FilaLote>) => ({
            name: "", sku: "", desc: "", pub: "", mem: "", liq: "", qty: "", categId: categorias[0]?.id || 0, incluir: true,
            ...r, files: [], urls: [], estado: undefined,
          })));
          setRestaurado(true);
        }
        if (d.defQty) setDefQty(d.defQty);
      }
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    try {
      const slim = rows.map(({ files, urls, ...r }) => { void files; void urls; return r; });
      localStorage.setItem("bam-carga-v1", JSON.stringify({ texto, rows: slim, defQty }));
    } catch { /* noop */ }
  }, [texto, rows, defQty]);
  function limpiarTodo() {
    setTexto(""); setRows([]); setAviso(""); setExistentes(new Set()); setRestaurado(false); setProg(null);
    try { localStorage.removeItem("bam-carga-v1"); } catch { /* noop */ }
  }

  function analizar() {
    const prods = parseLoteQty(texto);
    const base: FilaLote[] = prods.map((p) => ({
      name: p.name.slice(0, 45), sku: sugerirSku(p.name), pub: p.pub ? String(p.pub) : "", mem: p.mem ? String(p.mem) : "",
      liq: p.liq != null ? String(p.liq) : "",
      qty: p.qty != null ? String(p.qty) : (defQty || ""),
      categId: guessCategId(p.name, categorias, defCateg),
      desc: "", files: [], urls: [], incluir: true, tarifas: TAR_VACIAS(),
    }));
    setRows(base);
    setProg(null);
    setRestaurado(false);
    setAviso(prods.length === 0
      ? "no-entendi"
      : prods.length + (prods.length === 1 ? " producto detectado 👇" : " productos detectados 👇"));
    // checa en Odoo cuáles SKU ya existen
    setExistentes(new Set());
    const skus = base.map((r) => r.sku.trim().toUpperCase()).filter(Boolean);
    if (skus.length) start(async () => { const ex = await checkSkusAction(skus); setExistentes(new Set(ex.map((s) => s.toUpperCase()))); });
  }
  function upd(i: number, patch: Partial<FilaLote>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  // Renglón en blanco: arma la lista A MANO (como formulario), sin pegar texto.
  function agregarFila() {
    setRows((rs) => [...rs, { name: "", sku: "", desc: "", pub: "", mem: "", liq: "", qty: defQty || "", categId: defCateg, files: [], urls: [], incluir: true, tarifas: TAR_VACIAS() }]);
    setAviso("");
  }
  // Al escribir el nombre, el SKU se sugiere solo (mientras no lo hayan cambiado a mano).
  function onNombre(i: number, val: string) {
    val = val.slice(0, 45);
    setRows((rs) => rs.map((r, j) => {
      if (j !== i) return r;
      const sigue = !r.sku.trim() || r.sku === sugerirSku(r.name);
      return { ...r, name: val, sku: sigue ? sugerirSku(val) : r.sku };
    }));
  }
  // borra un renglón de la lista antes de crear/enviar a revisión
  function borrarFila(i: number) {
    setRows((rs) => { const r = rs[i]; r?.urls?.forEach((u) => URL.revokeObjectURL(u)); return rs.filter((_, j) => j !== i); });
  }
  // agrega una o varias fotos a un renglón (la 1ª es la principal)
  function addRowFiles(i: number, files: File[]) {
    if (!files.length) return;
    setRows((rs) => rs.map((r, j) => (j === i
      ? { ...r, files: [...r.files, ...files], urls: [...r.urls, ...files.map((f) => URL.createObjectURL(f))] }
      : r)));
  }
  // quita UNA foto de un renglón
  function removeRowFile(i: number, idx: number) {
    setRows((rs) => rs.map((r, j) => {
      if (j !== i) return r;
      const u = r.urls[idx]; if (u) URL.revokeObjectURL(u);
      return { ...r, files: r.files.filter((_, k) => k !== idx), urls: r.urls.filter((_, k) => k !== idx) };
    }));
  }
  // pega la imagen copiada en un renglón (botón 📋)
  async function pegarEnFila(i: number) {
    activar(i);
    const f = await imagenDelPortapapeles();
    if (f) addRowFiles(i, [f]);
    else alert("No encontré una imagen copiada. Copia una imagen (Ctrl+C) y pica 📋 — o pica el renglón (queda resaltado) y usa Ctrl+V.");
  }
  function crearTodos() {
    start(async () => {
      const hecho = (s?: string) => !!s && (s.startsWith("✅") || s.startsWith("🕒"));
      const idxs = rows.map((r, i) => i).filter((i) => rows[i].incluir && !hecho(rows[i].estado));
      setProg({ done: 0, total: idxs.length });
      let done = 0;
      for (const i of idxs) {
        const r = rows[i];
        if (!r.sku.trim() || !Number(r.pub)) { upd(i, { estado: "❌ falta código o precio" }); done++; setProg({ done, total: idxs.length }); continue; }
        const b64 = r.files[0] ? await fileToBase64(r.files[0]) : null;
        const extra: string[] = [];
        for (const f of r.files.slice(1)) extra.push(await fileToBase64(f));
        const res = await crearProductoAction({
          name: limpiarNombre(r.name).slice(0, 45), sku: r.sku.trim().toUpperCase(), categId: r.categId || defCateg,
          publico: Number(r.pub) || 0, miembro: Number(r.mem) || 0,
          liquidacion: Number(r.liq) > 0 ? Number(r.liq) : null,
          cantidad: Number(r.qty) || 0, imageBase64: b64, imagesExtra: extra, descripcion: r.desc.trim() || undefined,
          tarifas: tarToPayload(r.tarifas || []), loc: destino,
        });
        upd(i, { estado: res.ok ? (res.pendiente ? "🕒 en revisión" : "✅ creado") : "❌ " + res.error });
        done++; setProg({ done, total: idxs.length });
      }
    });
  }

  const inp = "pf-input px-2 py-1 text-sm";
  const okCount = rows.filter((r) => r.estado?.startsWith("✅")).length;
  const sinCant = rows.filter((r) => r.incluir && !Number(r.qty)).length;
  const sinFoto = rows.filter((r) => r.incluir && !r.files.length).length;
  // duplicados: contra Odoo (existentes) y dentro del mismo lote (repetidos)
  const skuNorm = (s: string) => s.trim().toUpperCase();
  const skuCount: Record<string, number> = {};
  rows.forEach((r) => { const k = skuNorm(r.sku); if (k) skuCount[k] = (skuCount[k] || 0) + 1; });
  const dupOf = (r: FilaLote): "" | "existe" | "repe" => {
    const k = skuNorm(r.sku); if (!k) return "";
    if (existentes.has(k)) return "existe";
    if (skuCount[k] > 1) return "repe";
    return "";
  };
  const dupCount = rows.filter((r) => r.incluir && dupOf(r)).length;

  return (
    <div className="space-y-5">
      <div className="pf-card p-5">
        <PanelHead emoji="⚡" titulo="Carga rápida"
          sub="Pega la lista de WhatsApp — o arma la lista a mano llenando los campos. La subo de un jalón." />
        <DestinoBodega value={destino} onChange={setDestino} />
        <p className="mb-1 font-display text-[15px] font-bold text-[#0e2650]">1. Pega la lista — <b>un producto por renglón</b></p>
        <p className="mb-2 text-[12px] text-slate-500">
          Cada renglón: <b className="text-slate-700">NOMBRE (con modelo/color/diseño)</b> <b className="text-[#2e6da4]">$público/$miembro</b> <b className="text-[#2e6da4]">x cantidad</b> y si tiene, <b className="text-[#2e6da4]">L:precio liquidación</b>. La foto la subes después en cada renglón.
        </p>
        <details className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-700">📏 Cómo escribir cada producto</summary>
          <p className="mt-2 rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] text-[#2e6da4]">CUBRESALA CHENILLA M1 CAFÉ $530/$430 x30 L:300</p>
          <ul className="mt-2 space-y-1">
            <li><b className="text-slate-700">Precio:</b> <b>$público/$miembro</b> — ej. <b>$530/$430</b>. (obligatorio)</li>
            <li><b className="text-slate-700">Cantidad:</b> <b>x</b> y el número — ej. <b>x30</b>.</li>
            <li><b className="text-slate-700">Liquidación</b> (si tiene): <b>L:</b> y el precio — ej. <b>L:300</b>.</li>
            <li><b className="text-slate-700">Modelo:</b> <b>M1</b>, <b>M2</b>… (también “modelo 1” o “M-1”).</li>
            <li><b className="text-slate-700">Color:</b> por nombre (<b>café</b>, <b>gris oscuro</b>, <b>azul rey</b>) o código (<b>CAF</b>, <b>GRO</b>, <b>AZR</b>).</li>
            <li><b className="text-slate-700">Diseño:</b> el código tal cual: <b>D099</b>, <b>DK094</b>.</li>
            <li><b className="text-slate-700">Tamaño:</b> King/Matrimonial/Queen/Individual. <b>Plazas:</b> 2 plazas / 3 plazas.</li>
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">El orden no importa: puedes poner el precio, la x y la L: donde caigan. Igual revisas todo en la tabla antes de crear.</p>
        </details>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8}
          placeholder={"CUBRESALA CHENILLA M1 CAFÉ $530/$430 x30\nCUBRESALA CHENILLA M1 GRIS $530/$430 x50\nMANTEL REDONDO BEIGE $420/$320 x8 L:250\nMOSAICO 3D D777 $99/$59 x40"}
          className="pf-input w-full p-3 font-mono text-xs" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 font-display text-[15px] font-bold text-[#0e2650]">Categoría por defecto</p>
            <select className="pf-input w-full px-3 py-2.5 text-sm" value={defCateg} onChange={(e) => setDefCateg(Number(e.target.value))}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">Se usa cuando no la adivino sola. Editable por fila.</p>
          </div>
          <div>
            <p className="mb-1 font-display text-[15px] font-bold text-[#0e2650]">Cantidad por defecto</p>
            <input className="pf-input w-full px-3 py-2.5 text-sm" type="number" value={defQty} onChange={(e) => setDefQty(e.target.value)} placeholder="0" />
            <p className="mt-1 text-[11px] text-slate-400">Solo para las líneas sin cantidad.</p>
          </div>
        </div>
        {restaurado && (
          <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-[12px] font-semibold text-blue-700">
            💾 Recuperé tu borrador de la última vez. Las fotos sí hay que volver a subirlas.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={analizar} className="pf-btn flex-1 px-4 py-3 text-base">
            Analizar lista →
          </button>
          {(texto || rows.length > 0) && (
            <button onClick={limpiarTodo} title="Borrar la lista y empezar de cero" className="pf-btn-ghost px-4 py-2.5 text-sm">
              Limpiar
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />o arma la lista a mano<span className="h-px flex-1 bg-slate-200" />
        </div>
        <button type="button" onClick={agregarFila} className="pf-btn-ghost mt-3 w-full px-4 py-2.5 text-sm">
          ＋ Agregar producto en blanco
        </button>
        {aviso === "no-entendi"
          ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[13px] font-semibold text-red-600">No detecté productos. Revisa que cada uno traiga su nombre (y su precio así: <b>$530/$430</b>).</p>
          : aviso && <p className="mt-3 text-center text-[13px] font-bold text-emerald-600">✓ {aviso}</p>}
      </div>

      {rows.length > 0 && (
        <div className="pf-card p-5">
          <p className="mb-1 font-display text-[15px] font-bold text-[#0e2650]">
            2. Revisa ({rows.length} productos), sube la foto de cada uno y crea.
          </p>
          <p className="mb-2 text-[12px] text-slate-500">📌 <b className="text-slate-700">Fotos:</b> puedes poner <b className="text-slate-700">varias por producto</b> — la <b className="text-slate-700">1ª</b> es la principal y las demás salen en la galería del catálogo. Pica <b>＋foto</b> (puedes elegir varias a la vez), o copia una y <b>pégala</b> (📋 o Ctrl+V en el renglón resaltado).</p>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold">
            {sinFoto > 0 && <span className="text-slate-500">📷 {sinFoto} sin foto</span>}
            {sinCant > 0 && <span className="text-amber-600">⚠️ {sinCant} sin cantidad (se suben en 0)</span>}
            {dupCount > 0 && <span className="text-red-600">⛔ {dupCount} código(s) repetido(s) — cámbialos antes de crear</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-400">
                <tr><th className="px-1 py-1"></th><th className="px-1">Foto</th><th className="px-1">Nombre</th><th className="px-1">Descripción</th><th className="px-1">SKU</th><th className="px-1">Categoría</th><th className="px-1">Cant.</th><th className="px-1">Púb</th><th className="px-1">Miem</th><th className="px-1">Liq 🔥</th><th className="px-1">Mayoreo</th><th className="px-1">Estado</th><th className="px-1"></th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-1 py-1"><input type="checkbox" checked={r.incluir} onChange={(e) => upd(i, { incluir: e.target.checked })} className="accent-brand" /></td>
                    <td className="px-1 py-1" onClick={() => activar(i)}>
                      <div className="flex w-[132px] flex-col items-center gap-1">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {r.urls.map((u, k) => (
                            <span key={k} className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={u} alt="" className="h-11 w-11 rounded-lg border border-slate-200 object-cover" />
                              <button type="button" onClick={(e) => { e.stopPropagation(); removeRowFile(i, k); }} title="Quitar esta foto"
                                className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[8px] font-bold text-white">✕</button>
                              {k === 0 && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-brand px-1 text-[7px] font-bold text-white">1ª</span>}
                            </span>
                          ))}
                          <label className={"flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border bg-slate-50 hover:border-brand " + (filaActiva === i ? "border-brand ring-2 ring-brand/40" : "border-slate-200")} title="Agregar foto(s) — o pega con Ctrl+V">
                            <span className="text-center text-[9px] font-semibold leading-tight text-slate-400">＋<br />foto</span>
                            <input type="file" accept="image/*" multiple className="hidden"
                              onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                              onChange={(e) => addRowFiles(i, Array.from(e.target.files || []))} />
                          </label>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); pegarEnFila(i); }} title="Pegar imagen copiada (Ctrl+C y luego aquí)" className="rounded border border-slate-200 px-1.5 text-[10px] hover:bg-slate-100">📋 pegar</button>
                      </div>
                    </td>
                    <td className="px-1"><input className={inp + " w-48"} maxLength={45} value={r.name} placeholder="Nombre del producto" onChange={(e) => onNombre(i, e.target.value)} /></td>
                    <td className="px-1"><input className={inp + " w-56"} value={r.desc} onChange={(e) => upd(i, { desc: e.target.value })} placeholder="opcional" /></td>
                    <td className="px-1">
                      <input className={inp + " w-32 font-mono uppercase" + (dupOf(r) ? " border-red-400 bg-red-50 text-red-700" : "")}
                        title={dupOf(r) === "existe" ? "Este código YA existe en Odoo" : dupOf(r) === "repe" ? "Este código está repetido en la lista" : ""}
                        value={r.sku} onChange={(e) => upd(i, { sku: e.target.value.toUpperCase() })} />
                      {dupOf(r) && <span className="block text-[9px] font-semibold text-red-500">{dupOf(r) === "existe" ? "ya existe" : "repetido"}</span>}
                    </td>
                    <td className="px-1">
                      <select className={inp + " w-28"} value={r.categId} onChange={(e) => upd(i, { categId: Number(e.target.value) })}>
                        {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="px-1"><input className={inp + " w-14" + (Number(r.qty) ? "" : " bg-amber-100")} value={r.qty} onChange={(e) => upd(i, { qty: e.target.value })} placeholder="0" /></td>
                    <td className="px-1"><input className={inp + " w-16"} value={r.pub} onChange={(e) => upd(i, { pub: e.target.value })} /></td>
                    <td className="px-1"><input className={inp + " w-16"} value={r.mem} onChange={(e) => upd(i, { mem: e.target.value })} /></td>
                    <td className="px-1"><input className={inp + " w-16" + (Number(r.liq) ? " bg-orange-100" : "")} value={r.liq} onChange={(e) => upd(i, { liq: e.target.value })} placeholder="—" /></td>
                    <td className="px-1 text-center">
                      <button type="button" onClick={() => setTarModal(i)}
                        className={"rounded-lg border px-2 py-1 text-[11px] font-bold " + (tarToPayload(r.tarifas || []).length ? "border-brand bg-brand/10 text-brand-dark" : "border-slate-200 text-slate-500 hover:bg-slate-50")}>
                        🖐️ {tarToPayload(r.tarifas || []).length || ""}
                      </button>
                    </td>
                    <td className="px-1 text-[11px] font-semibold text-slate-600">{r.estado || ""}</td>
                    <td className="px-1 text-center">
                      <button type="button" onClick={() => borrarFila(i)} title="Quitar este producto de la lista"
                        className="grid h-6 w-6 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={agregarFila} className="pf-btn-ghost mt-3 w-full px-4 py-2.5 text-sm">
            ＋ Agregar otro producto
          </button>
          {tarModal !== null && rows[tarModal] && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setTarModal(null)}>
              <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-display text-base font-bold text-[#0e2650]">🖐️ Precios por mayoreo</h3>
                <p className="mb-3 mt-0.5 truncate text-[12px] text-slate-500">{rows[tarModal].name || "Producto"}</p>
                <TarifasEditor value={rows[tarModal].tarifas || TAR_VACIAS()} onChange={(v) => upd(tarModal, { tarifas: v })} />
                <button type="button" onClick={() => setTarModal(null)} className="pf-btn mt-4 w-full px-4 py-2.5">Listo</button>
              </div>
            </div>
          )}
          {prog && <p className="mt-2 text-sm text-slate-600">Creando… {prog.done}/{prog.total} {okCount > 0 && `· ${okCount} listos`}</p>}
          <button onClick={crearTodos} disabled={pending || dupCount > 0}
            className="pf-btn mt-4 w-full px-4 py-3.5 text-base">
            {pending ? "Creando en Odoo…" : dupCount > 0 ? `Corrige ${dupCount} código(s) repetido(s) para continuar` : `Crear ${rows.filter((r) => r.incluir).length} productos`}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">Los que ya digan ✅ no se vuelven a crear. Si una foto quedó mal, créalos y cámbiala en “Buscar / editar”.</p>
        </div>
      )}
    </div>
  );
}
