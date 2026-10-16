"use client";

// Catálogo para compartir (etiqueta blanca) — herramienta de la app de fichas.
// La asesora elige productos, le pone el nombre de la revendedora y baja un PDF
// SIN precios y SIN la marca Aurora, para que la clienta lo reparta a sus clientas.
// (9-oct-2026, a petición de Ximena.)
import { useMemo, useState } from "react";
import { matchSearch } from "@/lib/search";
import type { Ficha } from "./ui";

// mismo orden chica → grande del catálogo y de las fichas
const SIZE_ORDER = ["Individual", "Matrimonial", "Matri Queen", "Queen", "King", "King Jumbo", "California King"];
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Precios = "no" | "publico" | "socio";
type Layout = "compacto" | "revista" | "detallado";

export function CatalogoView({ fichas }: { fichas: Ficha[] }) {
  const [q, setQ] = useState("");
  const [seccion, setSeccion] = useState("Todos");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tienda, setTienda] = useState("");
  const [contacto, setContacto] = useState("");
  const [precios, setPrecios] = useState<Precios>("no");
  const [marca, setMarca] = useState(false);
  const [layout, setLayout] = useState<Layout>("revista");
  const [portada, setPortada] = useState(true);
  const [indice, setIndice] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);

  const secOf = (f: Ficha) => (f.hasLiq ? "Liquidaciones" : f.catalogo);
  // Las secciones salen de las categorías reales del catálogo (Recámara, Baño, Cortinas…),
  // no de una lista fija: así no queda ninguna en cero.
  const secciones = useMemo(() => {
    const vistas: string[] = [];
    for (const f of fichas) { const s = secOf(f); if (s && s !== "Liquidaciones" && !vistas.includes(s)) vistas.push(s); }
    return ["Todos", ...vistas, "Liquidaciones"];
  }, [fichas]);
  const nq = norm(q).trim();
  const lista = useMemo(() => fichas.filter((f) => {
    if (nq) return matchSearch(f.blob + " " + norm(f.base), q);
    return seccion === "Todos" || secOf(f) === seccion;
  }), [fichas, nq, q, seccion]);

  function toggle(key: string) {
    setSel((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  function todosVisibles() { setSel((s) => { const n = new Set(s); lista.forEach((f) => n.add(f.key)); return n; }); }
  function quitarVisibles() { setSel((s) => { const n = new Set(s); lista.forEach((f) => n.delete(f.key)); return n; }); }

  const elegidos = useMemo(() => fichas.filter((f) => sel.has(f.key)), [fichas, sel]);
  // estimado de hojas: revista = media hoja por producto (los de muchos colores se llevan una entera)
  const hojas = layout === "detallado"
    ? elegidos.length
    : layout === "revista"
      ? Math.max(1, Math.ceil(elegidos.reduce((s, f) => s + (f.colorCount > 20 ? 2 : 1), 0) / 2))
      : Math.ceil(elegidos.length / 4);

  async function generar() {
    if (!elegidos.length) return;
    setGenerando(true);
    setAvance({ hechos: 0, total: 1 });
    try {
      const { pdfCatalogo } = await import("./catalogo-pdf");
      await pdfCatalogo({
        productos: elegidos.map((f) => {
          const medidas = [...new Set(f.variants.map((v) => v.size).filter(Boolean))]
            .sort((a, b) => {
              const ia = SIZE_ORDER.indexOf(a), ib = SIZE_ORDER.indexOf(b);
              return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "es");
            });
          const mems = f.variants.map((v) => v.mem).filter((x): x is number => x != null);
          // Un color/modelo UNA sola vez: si el producto viene en 3 medidas, antes salía
          // la misma foto 3 veces en la tira de colores.
          const porColor = new Map<string, { nombre: string; image: string | null }>();
          for (const v of f.variants) {
            const nombre = ((v.color || v.label || "").trim()) || "Único";
            const k = norm(nombre);
            const ya = porColor.get(k);
            if (!ya) porColor.set(k, { nombre, image: v.imageUrl });
            else if (!ya.image && v.imageUrl) ya.image = v.imageUrl;
          }
          return {
            nombre: f.base,
            seccion: secOf(f),
            categoria: f.categoria,
            descripcion: f.descripcion || "",
            medidas,
            image: f.image,
            colores: [...porColor.values()],
            pub: [f.minPublico, f.maxPublico] as [number, number],
            mem: mems.length ? ([Math.min(...mems), Math.max(...mems)] as [number, number]) : null,
            liq: f.minLiq,
          };
        }),
        tienda: tienda.trim() || undefined,
        contacto: contacto.trim() || undefined,
        precios, marca, layout, portada, indice,
        onProgress: (hechos, total) => setAvance({ hechos, total }),
      });
    } catch {
      alert("No se pudo armar el catálogo. Intenta con menos productos o vuelve a intentarlo.");
    } finally {
      setGenerando(false);
      setAvance(null);
    }
  }

  const inp = "pf-input w-full px-4 py-2.5 text-sm";
  const pill = (activo: boolean) =>
    "rounded-xl px-3.5 py-2 text-[13px] font-bold transition " +
    (activo ? "bg-aurora text-white shadow ring-2 ring-aurora/30" : "bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:ring-aurora");

  return (
    <div className="mx-auto max-w-6xl pb-28">
      <div className="mb-3 rounded-2xl bg-orange-50 px-4 py-3 ring-1 ring-orange-100">
        <p className="text-[13px] font-bold text-aurora-dark">📒 Catálogo para compartir</p>
        <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
          Elige los productos y baja un PDF. Como viene <b>sin precios y sin la marca</b>, la revendedora
          lo puede mandar a sus clientas y poner su propio precio.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ----- opciones ----- */}
        <div className="space-y-3">
          <div className="pf-card p-4">
            <label className="mb-1 block text-[13px] font-bold text-[#7c2d12]">Nombre de la tienda (opcional)</label>
            <input value={tienda} onChange={(e) => setTienda(e.target.value)} placeholder="Ej. Blancos Ivonne" className={inp} />
            <p className="mt-1 text-[11px] text-slate-400">Va en la portada y en cada hoja. Déjalo vacío si no quieres ningún nombre.</p>
            <label className="mb-1 mt-3 block text-[13px] font-bold text-[#7c2d12]">Contacto (opcional)</label>
            <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="WhatsApp o @usuario" className={inp} />
          </div>

          <div className="pf-card p-4">
            <p className="mb-2 text-[13px] font-bold text-[#7c2d12]">Precios</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setPrecios("no")} className={pill(precios === "no")}>Sin precios</button>
              <button onClick={() => setPrecios("publico")} className={pill(precios === "publico")}>Público</button>
              <button onClick={() => setPrecios("socio")} className={pill(precios === "socio")}>Socios</button>
            </div>
            {precios !== "no" && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-200">
                ⚠️ Ojo: con precios ya NO es etiqueta blanca — la clienta va a ver cuánto cobramos nosotros.
              </p>
            )}

            <p className="mb-2 mt-4 text-[13px] font-bold text-[#7c2d12]">Marca</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMarca(false)} className={pill(!marca)}>Sin marca (blanca)</button>
              <button onClick={() => setMarca(true)} className={pill(marca)}>Con logo Aurora</button>
            </div>

            <p className="mb-2 mt-4 text-[13px] font-bold text-[#7c2d12]">Cómo se ve</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setLayout("revista")} className={pill(layout === "revista")}>Catálogo (media hoja)</button>
              <button onClick={() => setLayout("compacto")} className={pill(layout === "compacto")}>Lista (4 por hoja)</button>
              <button onClick={() => setLayout("detallado")} className={pill(layout === "detallado")}>1 por hoja</button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {layout === "revista"
                ? "Media hoja por producto: foto grande, medidas, descripción y la fotito de cada color. Los que traen muchos colores se llevan la hoja completa."
                : layout === "compacto"
                  ? "Foto principal, nombre y medidas. Ligero, bueno para mandar muchos productos."
                  : "Una hoja por producto con la foto de cada color y la descripción. Pesa más."}
            </p>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-slate-600">
              <input type="checkbox" checked={portada} onChange={(e) => setPortada(e.target.checked)} className="h-4 w-4 accent-[#c2410c]" />
              Incluir portada
            </label>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-slate-600">
              <input type="checkbox" checked={indice} onChange={(e) => setIndice(e.target.checked)} className="h-4 w-4 accent-[#c2410c]" />
              Incluir índice (por sección, con número de hoja)
            </label>
          </div>
        </div>

        {/* ----- productos ----- */}
        <div className="pf-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca el producto por nombre o código…" className="pf-input min-w-[220px] flex-1 px-4 py-2.5 text-sm" />
            <button onClick={todosVisibles} className="rounded-full bg-aurora px-3.5 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-aurora-dark">
              Agregar los {lista.length}
            </button>
            <button onClick={quitarVisibles} className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-bold text-gray-500 hover:bg-gray-50">
              Quitar
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {secciones.map((s) => (
              <button key={s} onClick={() => { setSeccion(s); setQ(""); }}
                className={"rounded-full px-3 py-1.5 text-[12px] font-bold transition " + (seccion === s && !nq ? "bg-[#7c2d12] text-white" : "bg-gray-50 text-gray-500 ring-1 ring-gray-200 hover:ring-aurora")}>
                {s === "Liquidaciones" ? "🔥 " : ""}{s}
                <span className="ml-1.5 opacity-60">{s === "Todos" ? fichas.length : fichas.filter((f) => secOf(f) === s).length}</span>
              </button>
            ))}
            {sel.size > 0 && (
              <button onClick={() => setSel(new Set())} className="ml-auto rounded-full bg-red-50 px-3 py-1.5 text-[12px] font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-100">
                Vaciar selección ({sel.size})
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {lista.map((f) => {
              const on = sel.has(f.key);
              return (
                <button key={f.key} onClick={() => toggle(f.key)}
                  className={"overflow-hidden rounded-2xl text-left transition " + (on ? "ring-2 ring-aurora" : "ring-1 ring-gray-200 hover:ring-aurora/60")}>
                  <div className="relative aspect-square w-full bg-slate-50">
                    {f.image
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                      : <div className="grid h-full w-full place-items-center text-[10px] text-slate-400">sin foto</div>}
                    <span className={"absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-[13px] font-black shadow " + (on ? "bg-aurora text-white" : "bg-white/90 text-gray-300")}>
                      {on ? "✓" : "+"}
                    </span>
                  </div>
                  <p className="truncate px-2 py-1.5 text-[11px] font-bold text-[#7c2d12]">{f.base}</p>
                </button>
              );
            })}
            {lista.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-400">{q ? `Sin resultados para “${q}”.` : "Nada en esta sección."}</p>}
          </div>
        </div>
      </div>

      {/* ----- barra de abajo ----- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <p className="text-[13px] font-bold text-[#7c2d12]">
            {elegidos.length === 0 ? "Aún no eliges productos" : `${elegidos.length} ${elegidos.length === 1 ? "producto" : "productos"} · ${hojas} ${hojas === 1 ? "hoja" : "hojas"}${portada ? " + portada" : ""}${indice ? " + índice" : ""}`}
          </p>
          {avance && avance.total > 1 && (
            <p className="text-[12px] font-semibold text-slate-400">Preparando fotos {avance.hechos}/{avance.total}…</p>
          )}
          <button onClick={generar} disabled={generando || !elegidos.length}
            className="ml-auto rounded-full bg-aurora px-5 py-2.5 text-[14px] font-bold text-white shadow hover:bg-aurora-dark disabled:bg-gray-300">
            {generando ? "Armando el PDF…" : "📥 Bajar catálogo PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
