"use client";

import { useState, useTransition, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { loginVentasAction, logoutVentasAction, refrescarCatalogoAction } from "./actions";
import { renderNegritas } from "@/lib/richtext";
import { matchSearch } from "@/lib/search";
import { CatalogoView } from "./catalogo";

export type FichaVar = { sku: string; label: string; size: string; color: string; imageUrl: string | null; pub: number; mem: number | null; liq: number | null; stock: number; tienda: number; bodega: number; apartado: number; descripcion?: string };
export type Ficha = {
  key: string; base: string; categoria: string; catalogo: string;
  minPublico: number; maxPublico: number; minMiembro: number | null;
  hasLiq: boolean; minLiq: number | null; colorCount: number; image: string | null;
  blob: string; descripcion: string; variants: FichaVar[];
  tarifas: { qty: number; price: number }[];
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const rango = (a: number, b: number) => (a === b ? money(a) : `Desde ${money(a)}`);
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP || "";
const fmtTel = (t: string) => { const d = (t || "").replace(/\D/g, "").slice(-10); return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : t; };

/* ---------- Login ---------- */
export function VentasLogin() {
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    start(async () => { const r = await loginVentasAction(pass); if (r.ok) router.refresh(); else setErr(r.error); });
  }
  return (
    <div className="font-display flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#1c1717] via-[#8a0707] to-[#b50808] px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bam-blanco.png" alt="BAM!" className="mb-5 h-12 w-auto" />
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] border-4 border-white/20 bg-white p-7 shadow-2xl">
        <h1 className="font-display text-2xl font-bold text-[#1c1717]">Fichas para ventas</h1>
        <p className="mt-0.5 mb-4 text-sm text-stone-500">Manda los colores de un producto en una sola imagen 👇</p>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus placeholder="Contraseña"
          className="pf-input w-full px-4 py-3 text-center" />
        {err && <p className="mt-2 text-center text-sm text-red-600">{err}</p>}
        <button disabled={pending} className="pf-btn mt-4 w-full px-4 py-3">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="mt-5 text-[12px] font-semibold text-white/50">☁️ BAM! · a brand made for you</p>
    </div>
  );
}

/* ---------- Buscador + lista ---------- */
export function Fichas({ fichas }: { fichas: Ficha[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [seccion, setSeccion] = useState<string>("Todos");
  const [sel, setSel] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [modo, setModo] = useState<"fichas" | "cotiz" | "catalogo">("fichas");
  const [refrescando, setRefrescando] = useState(false);
  function refrescar() {
    setRefrescando(true);
    refrescarCatalogoAction().then(() => router.refresh()).finally(() => setTimeout(() => setRefrescando(false), 900));
  }
  const seleccion = fichas.find((f) => f.key === sel) || null;

  if (seleccion) return <FichaView key={seleccion.key} f={seleccion} onBack={() => setSel(null)} />;

  const secOf = (f: Ficha) => (f.hasLiq ? "Liquidaciones" : f.catalogo);
  const cuenta = (s: string) => (s === "Todos" ? fichas.length : fichas.filter((f) => secOf(f) === s).length);
  const nq = norm(q).trim();
  const lista = fichas.filter((f) => {
    if (nq) return matchSearch(f.blob + " " + norm(f.base), q); // buscando: en TODO el catálogo
    return seccion === "Todos" || secOf(f) === seccion;          // navegando: por sección
  });
  // Las secciones salen de las categorías que de verdad tiene el catálogo, no de una lista
  // fija: así ninguna queda en cero ni se queda fuera una sección nueva.
  const secciones = ["Todos", ...[...new Set(fichas.map(secOf))].filter((s) => s && s !== "Liquidaciones"), "Liquidaciones"];

  const Sidebar = (
    <div className="flex h-full flex-col text-white">
      <div className="px-5 pb-5 pt-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bam-blanco.png" alt="BAM!" className="h-12 w-auto" />
        <p className="font-display mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Fichas · Ventas</p>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-red-200/60">Secciones</p>
        {secciones.map((s) => {
          const activa = seccion === s && modo === "fichas";
          return (
            <button key={s} onClick={() => { setSeccion(s); setModo("fichas"); setMenu(false); }}
              className={"flex w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left text-sm transition " + (activa ? "bg-gradient-to-r from-[#b50808] to-[#e10b0b] font-bold text-white shadow-sm" : "font-semibold text-white/65 hover:bg-white/10 hover:text-white")}>
              <span>{s === "Liquidaciones" ? "🔥 " : ""}{s}</span>
              <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + (activa ? "bg-white/25" : "bg-white/10")}>{cuenta(s)}</span>
            </button>
          );
        })}
        <p className="px-3 pb-1.5 pt-4 text-[10px] font-extrabold uppercase tracking-[0.16em] text-red-200/60">Herramientas</p>
        <button onClick={() => { setModo("cotiz"); setMenu(false); }}
          className={"flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left text-sm transition " + (modo === "cotiz" ? "bg-gradient-to-r from-[#b50808] to-[#e10b0b] font-bold text-white shadow-sm" : "font-semibold text-white/65 hover:bg-white/10 hover:text-white")}>
          🧾 Cotización
        </button>
        <button onClick={() => { setModo("catalogo"); setMenu(false); }}
          className={"flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left text-sm transition " + (modo === "catalogo" ? "bg-gradient-to-r from-[#b50808] to-[#e10b0b] font-bold text-white shadow-sm" : "font-semibold text-white/65 hover:bg-white/10 hover:text-white")}>
          📒 Catálogo para compartir
        </button>
      </div>
      <div className="m-3 rounded-2xl bg-white/10 px-4 py-3">
        <p className="text-[12px] leading-snug text-white/70">Manda los colores de un producto en una sola imagen.</p>
        <a href="/" className="mt-2 block text-[13px] font-bold text-white/70 hover:text-white">Ir al catálogo →</a>
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
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200/70 bg-white/80 px-4 py-3.5 backdrop-blur md:px-6">
            <button onClick={() => setMenu(true)} aria-label="Menú" className="rounded-xl border border-stone-200 px-2.5 py-1 text-lg leading-none text-stone-600 md:hidden">☰</button>
            {modo === "fichas"
              ? <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Busca el producto por nombre o código…"
                  className="pf-input w-full px-4 py-2.5 text-[15px]" />
              : <h1 className="grad-text font-display text-lg font-bold">{modo === "catalogo" ? "📒 Catálogo para compartir" : "🧾 Armar cotización"}</h1>}
          </header>
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 md:px-6">
            {modo === "cotiz" ? <CotizacionView fichas={fichas} /> : modo === "catalogo" ? <CatalogoView fichas={fichas} /> : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h1 className="grad-text font-display text-xl font-bold">{seccion === "Todos" ? "Todos los productos" : seccion}</h1>
                  <span className="text-[13px] text-stone-400">· {lista.length} productos · toca uno para ver su ficha</span>
                  <button onClick={refrescar} disabled={refrescando} title="Trae el stock actualizado de Odoo y quita los que quedaron en 0"
                    className="ml-auto rounded-full bg-black px-4 py-1.5 text-[13px] font-bold text-white shadow-sm hover:bg-neutral-700 disabled:bg-stone-300">
                    {refrescando ? "Actualizando…" : "🔄 Actualizar stock"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {lista.map((f) => (
                    <button key={f.key} onClick={() => setSel(f.key)}
                      className="pf-card overflow-hidden text-left transition hover:-translate-y-0.5">
                      <div className="aspect-square w-full bg-stone-50">
                        {f.image
                          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                          : <div className="grid h-full w-full place-items-center text-[11px] text-stone-400">sin foto</div>}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-[13px] font-bold text-[#1c1717]">{f.base}</p>
                        <p className="mt-0.5 text-[11px] text-stone-400">{f.categoria} · {f.colorCount} {f.colorCount === 1 ? "opción" : "colores"}</p>
                        <p className="mt-1 text-sm font-extrabold text-brand-dark">{rango(f.minPublico, f.maxPublico)}</p>
                      </div>
                    </button>
                  ))}
                  {lista.length === 0 && <p className="col-span-full py-12 text-center text-sm text-stone-400">{q ? `Sin resultados para “${q}”.` : "Aún no hay productos en esta sección."}</p>}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ---------- Cotización armada desde cero (NO crea pedido en Odoo, no aparta el producto) ---------- */
function CotizacionView({ fichas }: { fichas: Ficha[] }) {
  const [q, setQ] = useState("");
  const [cliente, setCliente] = useState("");
  const [asesor, setAsesor] = useState("");
  const [items, setItems] = useState<{ key: string; fichaKey: string; nombre: string; pub: number; mem: number; liq?: number | null; image: string | null; qty: number; envio?: boolean }[]>([]);
  const [envioTmp, setEnvioTmp] = useState("");
  const [bajando, setBajando] = useState(false);
  const [bajandoPdf, setBajandoPdf] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const productos = useMemo(() => {
    const out: { key: string; fichaKey: string; nombre: string; pub: number; mem: number; liq: number | null; image: string | null; blob: string }[] = [];
    for (const f of fichas) for (const v of f.variants) {
      const extra = (v.color || (v.label && v.label !== f.base ? v.label : "") || v.size || "").trim();
      const nombre = extra && !norm(f.base).includes(norm(extra)) ? f.base + " " + extra : f.base;
      out.push({ key: v.sku, fichaKey: f.key, nombre, pub: v.pub, mem: v.mem ?? v.pub, liq: v.liq, image: v.imageUrl, blob: norm(nombre + " " + v.sku) });
    }
    return out;
  }, [fichas]);
  const fichaByKey = useMemo(() => { const mp = new Map<string, Ficha>(); for (const f of fichas) mp.set(f.key, f); return mp; }, [fichas]);
  const varLabel = (f: Ficha, v: FichaVar) => {
    const parts = [v.size, (v.color || (v.label && v.label !== f.base ? v.label : ""))].map((s) => (s || "").trim()).filter(Boolean);
    return parts.join(" · ") || v.label || "Único";
  };

  const nq = norm(q).trim();
  const resultados = nq ? productos.filter((pr) => matchSearch(pr.blob, q)).slice(0, 25) : [];

  function agregar(pr: { key: string; fichaKey: string; nombre: string; pub: number; mem: number; liq?: number | null; image: string | null }) {
    setItems((xs) => {
      const i = xs.findIndex((x) => x.key === pr.key);
      if (i >= 0) { const c = [...xs]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c; }
      return [...xs, { key: pr.key, fichaKey: pr.fichaKey, nombre: pr.nombre, pub: pr.pub, mem: pr.mem, liq: pr.liq, image: pr.image, qty: 1 }];
    });
    setQ("");
  }
  const setQty = (key: string, qty: number) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, qty: Math.max(1, qty) } : x)));
  const quitar = (key: string) => setItems((xs) => xs.filter((x) => x.key !== key));
  // Cambiar la medida/modelo de un producto ya agregado (elige otra variante de su familia)
  function cambiarVariante(itemKey: string, newSku: string) {
    setItems((xs) => xs.map((x) => {
      if (x.key !== itemKey) return x;
      const f = fichaByKey.get(x.fichaKey); if (!f) return x;
      const v = f.variants.find((vv) => vv.sku === newSku); if (!v) return x;
      const extra = (v.color || (v.label && v.label !== f.base ? v.label : "") || v.size || "").trim();
      const nombre = extra && !norm(f.base).includes(norm(extra)) ? f.base + " " + extra : f.base;
      return { ...x, key: v.sku, nombre, pub: v.pub, mem: v.mem ?? v.pub, liq: v.liq, image: v.imageUrl };
    }));
  }
  // Agrega (o reemplaza) una línea de ENVÍO con su costo
  function agregarEnvio() {
    const precio = Number(envioTmp) || 0;
    if (precio <= 0) return;
    setItems((xs) => [...xs.filter((x) => !x.envio), { key: "__envio__", fichaKey: "", nombre: "Envío", pub: precio, mem: precio, image: null, qty: 1, envio: true }]);
    setEnvioTmp("");
  }

  // Precio que se cobra en la cotización: si el producto está en liquidación, el remate; si no, el de socios.
  const precioDe = (x: { mem: number; liq?: number | null }) => (x.liq != null ? x.liq : x.mem);
  const totalPub = items.reduce((sm, x) => sm + x.pub * x.qty, 0);
  const totalVenta = items.reduce((sm, x) => sm + precioDe(x) * x.qty, 0);
  const ahorro = Math.max(0, totalPub - totalVenta);
  const hayLiq = items.some((x) => x.liq != null);
  const hoy = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

  async function compartir() {
    const node = cardRef.current; if (!node || !items.length) return;
    setBajando(true);
    const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
    const originales = imgs.map((i) => i.src);
    try {
      await Promise.all(imgs.map(async (img) => {
        try {
          if (img.src.includes("/bam-")) return;
          img.loading = "eager";
          if (!img.complete || !img.naturalWidth) {
            await Promise.race([
              img.decode().catch(() => new Promise((r) => { img.onload = img.onerror = () => r(null); })),
              new Promise((r) => setTimeout(r, 6000)),
            ]);
          }
          if (!img.naturalWidth) return;
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext("2d"); if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          img.src = c.toDataURL("image/jpeg", 0.92);
        } catch { /* deja la original */ }
      }));
      const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const nombre = ("Cotizacion BAM!" + (cliente ? " - " + cliente.replace(/[^a-zA-Z0-9 ]/g, "") : "")).slice(0, 80) + ".png";
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], nombre, { type: "image/png" });
      // Celular: compartir (WhatsApp). Compu: descargar directo (la hoja de compartir de Windows no descarga).
      const esMovil = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent || "");
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (esMovil && nav.canShare && nav.canShare({ files: [file] })) {
        try { await nav.share({ files: [file], title: "Cotización BAM!" } as ShareData); return; }
        catch { /* pasa a descarga */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { alert("No se pudo generar la imagen. Intenta de nuevo."); }
    finally { imgs.forEach((img, i) => { img.src = originales[i]; }); setBajando(false); }
  }

  // Cotización FORMAL en PDF (para el cliente que la pide en PDF)
  async function descargarFormal() {
    if (!items.length) return;
    setBajandoPdf(true);
    try {
      const { pdfCotizacion } = await import("./pdf");
      await pdfCotizacion({
        cliente: cliente.trim() || undefined,
        asesor: asesor || undefined,
        items: items.map((x) => ({ nombre: x.nombre, qty: x.qty, precio: precioDe(x), liq: x.liq != null })),
        total: totalVenta,
        whatsapp: WHATSAPP,
      });
    } catch { alert("No se pudo generar el PDF. Intenta de nuevo."); }
    finally { setBajandoPdf(false); }
  }

  const inp = "pf-input w-full px-4 py-2.5 text-sm";
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
      <div>
        <div className="pf-card p-4">
          <label className="mb-1 block text-[13px] font-bold text-[#1c1717]">Cliente (opcional)</label>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" className={inp + " mb-3"} />
          <label className="mb-1 block text-[13px] font-bold text-[#1c1717]">Asesor</label>
          <select value={asesor} onChange={(e) => setAsesor(e.target.value)} className={inp + " mb-3"}>
            <option value="">Selecciona…</option>
            <option>Ximena</option>
            <option>Ana Laura</option>
            <option>Marian</option>
            <option>Lorena</option>
            <option>Carlos</option>
          </select>
          <label className="mb-1 block text-[13px] font-bold text-[#1c1717]">Agregar productos</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre o código…" className={inp} />
          {resultados.length > 0 && (
            <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-stone-100">
              {resultados.map((pr) => (
                <button key={pr.key} onClick={() => agregar(pr)} className="flex w-full items-center gap-2 border-b border-stone-50 p-2 text-left hover:bg-stone-50">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {pr.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={pr.image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1c1717]">{pr.nombre}</span>
                  <span className={"shrink-0 text-[13px] font-bold " + (pr.liq != null ? "text-red-600" : "text-brand-dark")}>{pr.liq != null ? "🔥 " : ""}{money(pr.liq != null ? pr.liq : pr.mem)}</span>
                  <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-[13px] font-bold text-white">+</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 border-t border-stone-100 pt-3">
            <label className="mb-1 block text-[13px] font-bold text-[#1c1717]">Agregar envío</label>
            <div className="flex gap-2">
              <input value={envioTmp} onChange={(e) => setEnvioTmp(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Costo del envío ($)" className={inp} />
              <button onClick={agregarEnvio} className="shrink-0 rounded-xl bg-black px-4 text-sm font-bold text-white hover:bg-neutral-700">Agregar</button>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="pf-card mt-3 p-3">
            <p className="mb-2 text-[12px] font-bold text-stone-500">{items.length} producto(s) en la cotización</p>
            <div className="space-y-2">
              {items.map((x) => (
                <div key={x.key} className="flex items-center gap-2">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {x.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={x.image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-[#1c1717]">{x.nombre}</span>
                    {(() => {
                      const f = fichaByKey.get(x.fichaKey);
                      return !x.envio && f && f.variants.length > 1 ? (
                        <select value={x.key} onChange={(e) => cambiarVariante(x.key, e.target.value)}
                          className="mt-0.5 w-full rounded border border-stone-200 py-0.5 text-[11px] text-stone-600">
                          {f.variants.map((v) => <option key={v.sku} value={v.sku}>{varLabel(f, v)}</option>)}
                        </select>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => setQty(x.key, x.qty - 1)} className="grid h-6 w-6 place-items-center rounded-full bg-stone-100 text-sm font-bold">-</button>
                    <input value={x.qty} onChange={(e) => setQty(x.key, parseInt(e.target.value) || 1)} className="w-9 rounded border border-stone-200 py-0.5 text-center text-[12px]" />
                    <button onClick={() => setQty(x.key, x.qty + 1)} className="grid h-6 w-6 place-items-center rounded-full bg-stone-100 text-sm font-bold">+</button>
                  </div>
                  <button onClick={() => quitar(x.key)} className="shrink-0 px-1 text-[13px] font-bold text-red-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        {items.length === 0 ? (
          <div className="pf-card grid place-items-center p-10 text-center text-sm text-stone-400">
            Agrega productos para armar la cotización.<br />No se crea pedido en Odoo — no aparta el producto.
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <button onClick={descargarFormal} disabled={bajandoPdf} className="rounded-full border-2 border-[#c4972a] bg-[#fdf7e6] px-5 py-2 text-[13px] font-bold text-[#8a6a15] shadow-sm hover:bg-[#faedc9] disabled:opacity-50">
                {bajandoPdf ? "Generando PDF…" : "📄 Cotización formal (PDF)"}
              </button>
              <button onClick={compartir} disabled={bajando} className="rounded-full bg-black px-5 py-2 text-[13px] font-bold text-white shadow hover:bg-neutral-700 disabled:bg-stone-300">
                {bajando ? "Generando…" : "📥 Descargar / Compartir"}
              </button>
            </div>
            <div ref={cardRef} className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-lg">
              <div className="flex items-start justify-between gap-3 px-5 py-4 text-white" style={{ background: "#db636c" }}>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">Cotización</p>
                  {cliente ? <h1 className="text-lg font-black leading-tight">{cliente}</h1> : null}
                  <p className="text-[11px] text-white/80">{hoy}</p>
                  {asesor ? <p className="text-[11px] font-semibold text-white/90">Te atendió: {asesor}</p> : null}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bam-blanco.png" alt="BAM!" className="h-9 w-auto shrink-0 object-contain" />
              </div>

              <div className="divide-y divide-stone-100 px-4 py-1">
                {items.map((x) => (
                  <div key={x.key} className="flex items-center gap-3 py-2.5">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                      {x.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={x.image} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold leading-snug text-[#1c1717]">{x.nombre}</p>
                      <p className="mt-0.5 text-[11px] text-stone-500">{x.envio ? "Costo de envío" : <>{x.qty} pza(s){x.pub > precioDe(x) ? <> · <span className="line-through">{money(x.pub)}</span></> : null} · <b className={x.liq != null ? "text-red-600" : "text-[#1c1717]"}>{x.liq != null ? "🔥 " : ""}{money(precioDe(x))}</b></>}</p>
                    </div>
                    <p className="shrink-0 text-[14px] font-extrabold text-[#1c1717]">{money(precioDe(x) * x.qty)}</p>
                  </div>
                ))}
              </div>

              {ahorro > 0 && (
                <div className="mx-4 my-2 rounded-xl px-4 py-3 text-center text-[13px] text-[#1c1717]" style={{ background: "#ffa6ad" }}>
                  <b>{hayLiq ? "¡Aprovecha los precios de liquidación 🔥!" : "¡Gracias por ser socio de la club BAM!!"}</b><br />En esta compra ahorras <b>{money(ahorro)}</b>
                </div>
              )}

              <div className="px-5 py-2 text-right">
                <span className="text-[20px] font-black text-[#1c1717]">TOTAL: </span>
                <span className="text-[20px] font-semibold text-black">{money(totalVenta)}</span>
              </div>

              <div className="flex items-center justify-between gap-2 px-5 py-3 text-white" style={{ background: "#1c1717" }}>
                <div className="min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/bam-blanco.png" alt="BAM!" className="h-9 w-auto object-contain" />
                  <p className="mt-0.5 text-[9px] font-semibold text-white/70">Cotización — no aparta el producto. Precios sujetos a disponibilidad.</p>
                </div>
                {WHATSAPP ? (
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-white/70">Pídelo por WhatsApp</p>
                    <p className="whitespace-nowrap text-[14px] font-black leading-tight">📲 {fmtTel(WHATSAPP)}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Ficha (lo que se manda en un pantallazo) ---------- */
// Mismo orden que el catálogo (chica → grande): la ficha arranca en la medida más chica
// (normalmente Matrimonial), que es la que coincide con la descripción/medidas del producto.
const SIZE_ORDER = ["XS", "S", "M", "L", "XL"];

function FichaView({ f, onBack }: { f: Ficha; onBack: () => void }) {
  // agrupa las variantes por MEDIDA (las sin medida caen en "Otras")
  const bySize = new Map<string, FichaVar[]>();
  for (const v of f.variants) {
    const k = v.size || "Otras";
    const a = bySize.get(k);
    if (a) a.push(v); else bySize.set(k, [v]);
  }
  const sizes = [...bySize.keys()].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a), ib = SIZE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "es");
  });
  const [size, setSize] = useState(sizes[0]);
  const [zoom, setZoom] = useState<FichaVar | null>(null);
  const [bajando, setBajando] = useState<false | "cliente" | "revendedor">(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [refrescando, setRefrescando] = useState(false);
  function refrescar() { setRefrescando(true); refrescarCatalogoAction().then(() => router.refresh()).finally(() => setTimeout(() => setRefrescando(false), 900)); }
  const vs = bySize.get(size) || f.variants;
  const conMedida = size !== "Otras" && sizes.length > 1;
  // La descripción sigue a la medida elegida (igual que el catálogo): así no queda "Talla: King"
  // con medidas de Matrimonial. Si la variante no trae descripción, usa la del producto.
  const descSel = (vs.find((v) => (v.descripcion || "").trim())?.descripcion || f.descripcion || "").trim();

  async function descargar(modo: "cliente" | "revendedor") {
    const node = cardRef.current;
    if (!node) return;
    setBajando(modo);
    const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
    const originales = imgs.map((i) => i.src);
    try {
      // 1) Asegura que TODAS las fotos estén cargadas y "aplana" cada una a su
      //    propio canvas (sin depender de la red). Con timeout para no colgarse en celular.
      await Promise.all(imgs.map(async (img) => {
        try {
          if (img.src.includes("/bam-")) return; // el logo se deja tal cual (transparencia)
          img.loading = "eager";
          if (!img.complete || !img.naturalWidth) {
            await Promise.race([
              img.decode().catch(() => new Promise((r) => { img.onload = img.onerror = () => r(null); })),
              new Promise((r) => setTimeout(r, 6000)),
            ]);
          }
          if (!img.naturalWidth) return;
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext("2d"); if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          img.src = c.toDataURL("image/jpeg", 0.92);
        } catch { /* deja la original */ }
      }));

      const opts: Parameters<typeof toPng>[1] = { pixelRatio: 2, backgroundColor: "#ffffff" };
      // La disponibilidad SÍ sale en la imagen del cliente. Solo en modo revendedor se ocultan precio/marca.
      opts.filter = (n: HTMLElement) => {
        if (!n.classList) return true;
        if (modo === "revendedor" && (n.classList.contains("x-precio") || n.classList.contains("x-marca"))) return false;
        return true;
      };
      const dataUrl = await toPng(node, opts);
      const sufijo = modo === "revendedor" ? " (sin precio)" : "";
      const nombre = `${f.base}${conMedida ? " - " + size : ""}${sufijo}`.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 90) + ".png";

      // 2) En celular: compartir el archivo (para mandarlo por WhatsApp o guardarlo).
      //    En compu: descarga normal.
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], nombre, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try { await nav.share({ files: [file], title: f.base } as ShareData); return; }
        catch { /* canceló o falló: pasa al fallback de descarga */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      alert("No se pudo generar la imagen. Intenta de nuevo (o toma captura de pantalla).");
    } finally {
      imgs.forEach((img, i) => { img.src = originales[i]; }); // restaura las originales
      setBajando(false);
    }
  }

  const pubs = vs.map((v) => v.pub);
  const min = Math.min(...pubs), max = Math.max(...pubs);
  const mems = vs.map((v) => v.mem).filter((x): x is number => x != null);
  const liqs = vs.map((v) => v.liq).filter((x): x is number => x != null);
  const varia = min !== max;

  return (
    <div className="pf-page min-h-screen font-display">
      <div className="mx-auto max-w-3xl px-3 py-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-sm font-semibold text-stone-500 hover:text-brand">← Volver</button>
            <button onClick={refrescar} disabled={refrescando} title="Actualizar la cantidad disponible desde Odoo"
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-bold text-brand shadow-sm hover:bg-stone-50 disabled:opacity-50">
              {refrescando ? "Actualizando…" : "🔄 Actualizar"}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => descargar("cliente")} disabled={!!bajando}
              className="rounded-full bg-black px-4 py-1.5 text-[13px] font-bold text-white shadow hover:bg-neutral-700 disabled:bg-stone-300"
              title="PNG con logo y precio (para clientes)">
              {bajando === "cliente" ? "Generando…" : "📥 Cliente"}
            </button>
            <button onClick={() => descargar("revendedor")} disabled={!!bajando}
              className="rounded-full border border-brand bg-white px-4 py-1.5 text-[13px] font-bold text-brand shadow-sm hover:bg-brand/5 disabled:opacity-50"
              title="PNG SIN logo ni precio (para revendedores)">
              {bajando === "revendedor" ? "Generando…" : "📥 Revendedor"}
            </button>
          </div>
        </div>

        {sizes.length > 1 && (
          <div className="mb-3 rounded-2xl border border-stone-100 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-stone-400">Elige tu talla</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button key={s} onClick={() => setSize(s)}
                  className={"rounded-xl px-4 py-2 text-sm font-bold transition " + (size === s ? "bg-black text-white shadow ring-2 ring-brand/30" : "bg-stone-50 text-stone-600 ring-1 ring-stone-200 hover:ring-brand")}>
                  {s} <span className={"ml-1 text-[11px] " + (size === s ? "text-white/80" : "text-stone-400")}>{bySize.get(s)!.length}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* === LA FICHA (esto es lo que se manda / se descarga) === */}
        <div ref={cardRef} className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="bg-gradient-to-r from-[#2b1111] via-brand-dark to-brand px-5 py-4 text-white">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">{f.categoria}</p>
                <h1 className="text-xl font-black leading-tight">{f.base}</h1>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bam-blanco.png" alt="BAM!" className="x-marca h-9 w-auto shrink-0 object-contain" />
            </div>
            {conMedida && <span className="mt-1.5 inline-block rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-bold backdrop-blur">Talla: {size}</span>}
          </div>

          <div className="px-5 py-4">
            {/* PRECIOS — Socios protagonista (azul marino), Público chico en gris */}
            <div className="x-precio flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-gradient-to-br from-stone-50 to-white p-4 ring-1 ring-red-100">
              <div>
                {mems.length > 0 ? (
                  <>
                    <p className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-wide text-[#2b1111]/60">🧡 Precio Socios</p>
                    <p className="mt-1.5 text-[30px] font-black leading-tight text-[#2b1111]">{rango(Math.min(...mems), Math.max(...mems))}</p>
                    <p className="mt-1 text-[13px] font-semibold text-stone-400">Público: {rango(min, max)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-stone-400">Precio</p>
                    <p className="mt-1.5 text-[34px] font-black leading-tight text-[#2b1111]">{rango(min, max)}</p>
                  </>
                )}
              </div>
              {liqs.length > 0 && (
                <div className="rounded-xl bg-red-500 px-3 py-2 text-center text-white shadow-md">
                  <p className="text-[9px] font-bold uppercase leading-none opacity-90">🔥 Liquidación</p>
                  <p className="text-2xl font-black leading-tight">{money(Math.min(...liqs))}</p>
                </div>
              )}
            </div>

            {f.tarifas.length > 0 && (
              <div className="mt-3 rounded-2xl bg-stone-50 p-3 ring-1 ring-red-100">
                <p className="text-[12px] font-extrabold text-brand-dark">🖐️ Precios por mayoreo</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {f.tarifas.map((t) => (
                    <span key={t.qty} className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-bold text-[#2b1111] ring-1 ring-red-200">
                      {t.qty}+ pzs · {money(t.price)} c/u
                    </span>
                  ))}
                </div>
              </div>
            )}

            {descSel && <p className="mt-3 whitespace-pre-line text-[13px] leading-snug text-stone-600">{renderNegritas(descSel)}</p>}

            <div className="mb-2 mt-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-black" />
              <p className="text-[13px] font-extrabold text-stone-700">{vs.length === 1 ? "Producto" : "Colores / modelos disponibles"}</p>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-black text-brand-dark">{vs.length}</span>
            </div>
            <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 md:grid-cols-6">
              {vs.map((v) => (
                <div key={v.sku} className="text-center">
                  <button type="button" onClick={() => v.imageUrl && setZoom(v)}
                    className="block w-full overflow-hidden rounded-xl ring-1 ring-stone-200/70 shadow-sm transition hover:ring-2 hover:ring-brand">
                    {v.imageUrl
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.imageUrl} alt="" className="aspect-square w-full object-cover" />
                      : <div className="grid aspect-square w-full place-items-center bg-stone-100 text-[9px] text-stone-400">sin foto</div>}
                  </button>
                  <p className="mt-1 text-[10px] font-bold leading-tight text-stone-700">{conMedida ? (v.color || v.label) : v.label}</p>
                  {varia && <p className="text-[10px] font-semibold text-brand-dark">{money(v.pub)}</p>}
                  {/* Este número YA es lo vendible: no incluye lo apartado en pedidos ni en cotizaciones.
                      El desglose 🏪 Tienda / 📦 Bodega se quitó el 6-oct-2026 a petición de Ximena: toda la
                      mercancía vive en Bodega Torres, así que "Tienda: 0" salía en TODO y las asesoras
                      creían que el producto ya se había acabado en piso. */}
                  <p className={`x-stock mt-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${v.stock > 0 ? "bg-brand/10 text-brand-dark" : "bg-stone-100 text-red-600"}`}>
                    {v.stock > 0 ? `Disponibles: ${v.stock} piezas` : "Sin disponibles"}
                  </p>
                  {/* Es el número de piezas APARTADAS (comprometidas en pedidos y cotizaciones), pero
                      la etiqueta dice "Vendidos hoy" a propósito: la ficha se le manda a la clienta. */}
                  {v.apartado > 0 && (
                    <p className="x-apart mt-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                      Vendidos hoy: {v.apartado}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="x-marca flex items-center justify-between gap-2 bg-gradient-to-r from-[#2b1111] to-brand px-5 py-3 text-white">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bam-blanco.png" alt="BAM!" className="h-11 w-auto object-contain" />
              <p className="mt-0.5 text-[10px] font-semibold text-white/70">a brand made for you</p>
            </div>
            {WHATSAPP && (
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-wide text-white/70">Pídelo por WhatsApp</p>
                <p className="whitespace-nowrap text-[15px] font-black leading-tight">📲 {fmtTel(WHATSAPP)}</p>
              </div>
            )}
          </div>
        </div>
        {/* === fin ficha === */}

        <button onClick={onBack} className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-500 hover:bg-stone-50">
          ← Buscar otro producto
        </button>
      </div>

      {zoom && zoom.imageUrl && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.imageUrl} alt="" className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <p className="mt-3 text-center text-lg font-black text-white">
            {conMedida ? (zoom.color || zoom.label) : zoom.label}
            <span className="ml-2 font-bold text-white/70">{money(zoom.pub)}</span>
          </p>
          <button onClick={() => setZoom(null)} className="mt-2 rounded-full bg-white/20 px-5 py-1.5 text-sm font-bold text-white backdrop-blur hover:bg-white/30">Cerrar ✕</button>
        </div>
      )}
    </div>
  );
}
