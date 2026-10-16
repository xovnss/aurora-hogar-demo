"use client";
import { useEffect, useState } from "react";
import type { ProductGroup, Variant } from "@/lib/group";
import { SITE } from "@/lib/config";
import { useCart } from "./cart-context";
import { renderNegritas } from "@/lib/richtext";

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
// Ordena como la gente espera: Modelo 2 antes que Modelo 10, no alfabético ("10" < "2").
const natCmp = (a: string, b: string) =>
  (a || "").localeCompare(b || "", "es", { numeric: true, sensitivity: "base" });

const SEL = "w-full rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-aurora";

export default function ProductDetail({ g, skuInicial, onClose }: { g: ProductGroup; skuInicial?: string | null; onClose: () => void }) {
  const { add } = useCart();
  const multi = g.variants.length > 1;
  // Si llegó por link (?p=SKU), abre justo en ese color/medida, no en el primero.
  const [sel, setSel] = useState<Variant>(
    (skuInicial && g.variants.find((v) => v.sku === skuInicial)) || g.variants[0]);
  // en el detalle, imagen completa (1024); al hacer zoom se pide la de máxima calidad
  const big = sel.imageUrl || "";
  const [zoom, setZoom] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Link directo a este producto: en celular abre el "Compartir" del sistema (WhatsApp),
  // en computadora lo copia al portapapeles.
  async function compartir() {
    const sku = sel.sku || g.variants[0]?.sku || "";
    const url = `${window.location.origin}/?p=${encodeURIComponent(sku)}`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    const esMovil = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent || "");
    if (esMovil && nav.share) {
      try { await nav.share({ title: g.base, text: g.base, url }); return; } catch { /* canceló */ }
    }
    try { await navigator.clipboard.writeText(url); } catch { /* sin permiso */ }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  const agotado = !SITE.ignoreStock && sel.stock <= 0;
  const [added, setAdded] = useState(false);
  const esSaldo = /⚠️\s*con\s*detalle/i.test(sel.descripcion || "");
  // galería: imagen principal + fotos adicionales de la variante elegida
  const gallery = [big, ...(sel.imagenes || [])].filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);
  useEffect(() => { setImgIdx(0); }, [sel.sku]);
  const shownImg = gallery[imgIdx] || big;

  // Medidas disponibles (ordenadas de chica a grande) y colores/diseños de la medida elegida
  const ORDEN = ["Individual", "Matrimonial", "Matri Queen", "Queen", "King", "King Jumbo", "California King"];
  const sizeList = ORDEN.filter((nm) => g.variants.some((v) => v.size === nm));
  const hasSizeStep = sizeList.length > 1;

  const colorOpts: Variant[] = [];
  const vistos = new Set<string>();
  for (const v of g.variants) {
    if (v.size === sel.size && v.color && !vistos.has(v.color)) {
      vistos.add(v.color);
      colorOpts.push(v);
    }
  }
  colorOpts.sort((a, b) => natCmp(a.color || "", b.color || ""));
  const hasColorStep = colorOpts.length > 0;
  // Lista por la que navegan las flechitas de la foto: los diseños de esta medida, o
  // todas las variantes cuando el producto no se separa por medida ni color.
  const pasos: Variant[] = hasColorStep
    ? colorOpts
    : [...g.variants].sort((a, b) => natCmp(a.label || "", b.label || ""));
  const pasoIdx = Math.max(0, pasos.findIndex((v) => v.sku === sel.sku));
  const hayPasos = pasos.length > 1;
  function mover(d: number) {
    if (!hayPasos) return;
    const n = (pasoIdx + d + pasos.length) % pasos.length;  // da la vuelta al llegar al final
    setSel(pasos[n]);
  }

  function pickSize(s: string) {
    const cand = g.variants.filter((v) => v.size === s);
    setSel(cand.find((v) => v.color === sel.color) || cand[0]);
  }
  function pickColor(c: string) {
    const v = g.variants.find((x) => x.size === sel.size && x.color === c);
    if (v) setSel(v);
  }
  const selDesc = [sel.size, sel.color].filter(Boolean).join(" · ") || sel.label;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  function agregar() {
    add(sel);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:flex-row">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg text-gray-600 shadow hover:bg-white"
        >
          ✕
        </button>

        {/* Compartir: manda el link que abre ESTE producto (10-oct-2026, para WhatsApp) */}
        <button
          onClick={compartir}
          aria-label="Compartir este producto"
          title="Copiar el link de este producto"
          className="absolute right-14 top-3 z-20 flex h-9 items-center gap-1 rounded-full bg-white/90 px-3 text-[13px] font-bold text-aurora-dark shadow hover:bg-white"
        >
          {copiado ? "✓ Link copiado" : "🔗 Compartir"}
        </button>

        {/* Imagen grande + galería (izquierda) */}
        <div className="flex flex-col items-center justify-center gap-2 bg-aurora-light/40 p-2 sm:w-1/2 sm:gap-3 sm:p-5">
          {/* Foto + flechitas para pasar de un modelo a otro sin abrir el desplegable */}
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {/* Clic en la foto = verla en grande: en blancos la textura es lo que vende. */}
            {shownImg ? (
              <img src={shownImg} alt={g.base} onClick={() => setZoom(shownImg)}
                   className="max-h-[26vh] w-full cursor-zoom-in object-contain sm:max-h-[72vh]" />
            ) : (
              /* Sin foto: antes salía el ícono de imagen rota. Mejor decirlo con todas sus letras. */
              <div className="grid aspect-square max-h-[26vh] w-full place-items-center rounded-xl bg-white/70 text-[12px] font-semibold text-slate-400 sm:max-h-[72vh]">
                Este modelo aún no tiene foto
              </div>
            )}
            {hayPasos && (
              <>
                <button onClick={() => mover(-1)} aria-label="Modelo anterior"
                  className="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-aurora-deep shadow-md transition hover:bg-white active:scale-95 sm:left-2 sm:h-12 sm:w-12">
                  ‹
                </button>
                <button onClick={() => mover(1)} aria-label="Modelo siguiente"
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-aurora-deep shadow-md transition hover:bg-white active:scale-95 sm:right-2 sm:h-12 sm:w-12">
                  ›
                </button>
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-aurora-deep/80 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {pasoIdx + 1} / {pasos.length}
                </span>
              </>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {gallery.map((src, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={"h-14 w-14 overflow-hidden rounded-full border-2 transition " + (i === imgIdx ? "border-aurora" : "border-transparent opacity-60 hover:opacity-100")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info (derecha) */}
        <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:w-1/2 sm:p-6">
          {sel.precioLiquidacion != null && (
            <span className="mb-2 w-fit rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">🔥 LIQUIDACIÓN</span>
          )}
          <h2 className="font-display pr-28 text-xl font-bold leading-tight text-aurora-deep sm:pr-32 sm:text-2xl">{g.base}</h2>
          <p className="mt-0.5 text-[11px] text-gray-400">{sel.sku}</p>

          {/* Selector: MEDIDA y COLOR / DISEÑO como menús desplegables */}
          {multi && (
            <div className={"order-2 mt-3 gap-2.5 " + (hasSizeStep && hasColorStep ? "grid grid-cols-1 sm:grid-cols-2" : "space-y-2.5")}>
              {hasSizeStep && (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700">Elige la medida</span>
                  <select value={sel.size} onChange={(e) => pickSize(e.target.value)} className={SEL}>
                    {sizeList.map((s) => {
                      const ps = g.variants.filter((v) => v.size === s).map((v) => v.precioPublico);
                      const min = Math.min(...ps), max = Math.max(...ps);
                      return <option key={s} value={s}>{s} — {min === max ? money(min) : `desde ${money(min)}`}</option>;
                    })}
                  </select>
                </label>
              )}

              {hasColorStep && (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700">Elige el color / diseño ({colorOpts.length})</span>
                  <select value={sel.color} onChange={(e) => pickColor(e.target.value)} className={SEL}>
                    {colorOpts.map((v) => <option key={v.color} value={v.color}>{v.color} — {money(v.precioPublico)}</option>)}
                  </select>
                </label>
              )}

              {!hasSizeStep && !hasColorStep && (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700">Elige una opción</span>
                  <select value={sel.sku} onChange={(e) => { const v = g.variants.find((x) => x.sku === e.target.value); if (v) setSel(v); }} className={SEL}>
                    {pasos.map((v) => <option key={v.sku} value={v.sku}>{v.label} — {money(v.precioPublico)}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* Descripción — va ARRIBA, junto al precio */}
          {sel.descripcion ? (
            <p className="order-1 mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">{renderNegritas(sel.descripcion)}</p>
          ) : null}

          {/* Precios de la opción elegida — Público y Socios lado a lado, mismo tamaño (van abajo) */}
          <div className="order-3 mt-3 space-y-2 rounded-2xl bg-gray-50 p-3">
            {esSaldo ? (
              <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">🏷️ Precio de saldo</p>
                <p className="mt-1 text-3xl font-extrabold text-aurora-dark">{money(sel.precioLiquidacion ?? sel.precioPublico)}</p>
                <p className="mt-1 text-[11px] text-gray-400">Producto con detalle · precio final</p>
              </div>
            ) : (<>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Público</p>
                <p className="mt-0.5 text-2xl font-extrabold text-aurora-dark">{money(sel.precioPublico)}</p>
              </div>
              {sel.precioMiembro != null ? (
                <div className="rounded-xl bg-aurora-light/70 p-3 text-center shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-aurora">Socios</p>
                  <p className="mt-0.5 text-2xl font-extrabold text-aurora">{money(sel.precioMiembro)}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 p-3 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">Socios</p>
                  <p className="mt-0.5 text-sm italic text-gray-300">—</p>
                </div>
              )}
            </div>

            {sel.precioLiquidacion != null && (
              <div className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2">
                <span className="text-sm font-bold text-red-600">🔥 Liquidación</span>
                <span className="text-xl font-extrabold text-red-600">{money(sel.precioLiquidacion)}</span>
              </div>
            )}

            {sel.tarifas.length > 0 && (
              <div className="rounded-xl bg-aurora-light/70 px-3 py-2">
                <p className="text-sm font-bold text-aurora-dark">🖐️ Precios por mayoreo</p>
                <div className="mt-1 space-y-0.5">
                  {sel.tarifas.map((t) => (
                    <div key={t.qty} className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-aurora-dark">Llévate {t.qty} o más</span>
                      <span className="text-base font-extrabold text-aurora-dark">{money(t.price)} <span className="text-[11px] font-semibold">c/u</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sel.precioMiembro != null && (
              <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-2">
                <p className="text-[11px] leading-snug text-gray-500">🧡 {SITE.memberNote}</p>
                {SITE.communityUrl && (
                  <a href={SITE.communityUrl} target="_blank" rel="noopener"
                     className="shrink-0 rounded-full bg-aurora-dark px-3 py-1 text-[11px] font-bold text-white hover:opacity-90">
                    Unirme →
                  </a>
                )}
              </div>
            )}
            </>)}
          </div>

          {!SITE.ignoreStock && sel.stock > 0 && (
            <p className="order-4 mt-3 text-center text-[13px] font-semibold text-aurora-dark">
              📦 Quedan {sel.stock} {sel.stock === 1 ? "pieza" : "piezas"}
            </p>
          )}
          <button
            disabled={agotado}
            onClick={agregar}
            className={`order-4 mt-3 rounded-full px-6 py-3 text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-gray-300 disabled:shadow-none sm:py-3.5 ${
              // Sigue el tema de temporada (naranja en Halloween, etc.), igual que el botón
              // "Agregar" de las tarjetas. Antes estaba fijo en azul marino. (Ximena, 10-oct-2026)
              added ? "bg-green-500" : "bg-gradient-to-r from-aurora-deep to-aurora-dark"
            }`}
          >
            {agotado ? "No disponible" : added ? "✓ Agregado a tu lista" : multi ? `Agregar ${selDesc} a mi lista` : "Agregar a mi lista"}
          </button>
        </div>
      </div>

      {/* Zoom de la foto (clic en cualquier lado para cerrar) */}
      {zoom && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-4"
             onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.replace("s=1024", "s=1920")} alt={g.base}
               className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl" />
          <button onClick={() => setZoom(null)}
                  className="mt-3 rounded-full bg-white/20 px-5 py-1.5 text-sm font-bold text-white backdrop-blur hover:bg-white/30">
            Cerrar ✕
          </button>
        </div>
      )}
    </div>
  );
}
