"use client";
import type { ProductGroup } from "@/lib/group";
import { SITE } from "@/lib/config";
import { useCart } from "./cart-context";

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");

export default function ProductCard({ g, onOpen }: { g: ProductGroup; onOpen?: () => void }) {
  // La tarjeta pide la foto del tamaño que de verdad ocupa: el celular baja ~30 KB y la
  // computadora ~100 KB, en vez de los ~330 KB de la foto grande. (10-oct-2026)
  const thumb = g.thumb || g.image || "";
  const srcSet = undefined;
  const { add } = useCart();
  const multi = g.variants.length > 1;
  const agotado = !SITE.ignoreStock && g.stock <= 0;
  const pocas = !SITE.ignoreStock && !agotado && g.stock <= SITE.lowStock;
  const rango = g.minPublico !== g.maxPublico;
  // descriptor breve (medidas · colores) — estilo limpio, sin racimo de etiquetas
  const desc = [
    g.sizeTags.length > 1 ? `${g.sizeTags[0]} a ${g.sizeTags[g.sizeTags.length - 1]}` : g.sizeTags[0] || "",
    g.colorCount > 1 ? `${g.colorCount} colores` : "",
  ].filter(Boolean).join("  ·  ") || g.categoria;

  return (
    <div
      onClick={onOpen}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.06] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_-22px_rgba(91,25,20,.4)] hover:ring-black/10 ${
        agotado ? "opacity-60" : ""
      }`}
    >
      <div className="relative w-full overflow-hidden bg-stone-100" style={{ aspectRatio: "1 / 1" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} srcSet={srcSet} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
          alt={g.base} loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-center transition duration-500 group-hover:scale-105" />
        {/* La liquidación va en la foto CON su precio: así el bloque de precios de abajo
            siempre tiene las mismas dos líneas y todas las tarjetas quedan parejas. */}
        {g.hasLiq && g.minLiq != null && !agotado && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
            🔥 {rango ? "desde " : ""}{money(g.minLiq)}
          </span>
        )}
        {g.hasLiq && g.minLiq == null && !agotado && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">🔥 Liquidación</span>
        )}
        {agotado && <span className="absolute bottom-2.5 right-2.5 rounded-full bg-stone-800 px-2.5 py-1 text-[11px] font-bold text-white">Agotado</span>}
        {!agotado && pocas && <span className="absolute bottom-2.5 right-2.5 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">¡Solo {g.stock}!</span>}
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[14.5px] font-semibold leading-snug text-[#2b1111] sm:text-[15px]" title={g.base}>
          {g.base}
        </h3>
        <p className="mt-0.5 truncate text-[11.5px] text-stone-400">{desc}</p>

        {/* Precios: SIEMPRE dos renglones (público arriba chico, socios abajo grande).
            El de socios es el que más se vende, por eso es el número que domina. */}
        <div className="mt-2.5">
          <p className="text-[12px] leading-none text-stone-400">
            <span className="uppercase tracking-wide">{rango ? "Desde" : "Público"}</span>{" "}
            <span className="font-semibold text-stone-500">{money(g.minPublico)}</span>
          </p>
          {g.minMiembro != null ? (
            <p className="mt-1 flex items-baseline gap-1.5 leading-none">
              <span className="text-[21px] font-extrabold text-brand-dark">{money(g.minMiembro)}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-brand">socios</span>
            </p>
          ) : (
            <p className="mt-1 text-[21px] font-extrabold leading-none text-brand-dark">{money(g.minPublico)}</p>
          )}
        </div>

        <div className="mt-3" />
        {/* Botón abajo del todo: todas las tarjetas lo alinean y en celular es más fácil de picar */}
        <button
          onClick={(e) => { e.stopPropagation(); if (multi) onOpen?.(); else add(g.variants[0]); }}
          disabled={agotado && !multi}
          className="mt-auto w-full rounded-full bg-brand py-2.5 text-[13.5px] font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-[.98] disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {multi ? "Elegir talla" : agotado ? "Agotado" : "Agregar"}
        </button>
      </div>
    </div>
  );
}
