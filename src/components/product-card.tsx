"use client";
import type { ProductGroup } from "@/lib/group";
import { SITE } from "@/lib/config";
import { useCart } from "./cart-context";

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");

// Tarjeta editorial: foto grande vertical sin marco, nombre en mayúsculas y precio limpio.
// Con mouse, al pasar encima se ve la foto plana de la prenda; en celular se ve la foto con modelo.
export default function ProductCard({ g, onOpen }: { g: ProductGroup; onOpen?: () => void }) {
  const thumb = g.thumb || g.image || "";
  const plana = g.variants[0]?.imagenes?.[0] || "";
  const { add } = useCart();
  const multi = g.variants.length > 1;
  const agotado = !SITE.ignoreStock && g.stock <= 0;
  const pocas = !SITE.ignoreStock && !agotado && g.stock <= SITE.lowStock;
  const rango = g.minPublico !== g.maxPublico;
  const precio = g.hasLiq && g.minLiq != null ? g.minLiq : g.minPublico;
  const tallas = g.sizeTags.length > 1 ? `${g.sizeTags[0]} – ${g.sizeTags[g.sizeTags.length - 1]}` : g.sizeTags[0] || "";

  return (
    <div onClick={onOpen} className={`group relative flex cursor-pointer flex-col ${agotado ? "opacity-60" : ""}`}>
      <div className="relative w-full overflow-hidden bg-stone-100" style={{ aspectRatio: "4 / 5" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" alt={g.base} loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 [@media(hover:hover)]:group-hover:opacity-0" />
        {plana && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={plana} alt="" aria-hidden loading="lazy"
            className="absolute inset-0 hidden h-full w-full bg-white object-contain p-3 opacity-0 transition duration-500 [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100" />
        )}
        {g.hasLiq && !agotado && (
          <span className="absolute left-0 top-3 bg-brand px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-widest text-white">Liquidación</span>
        )}
        {!g.hasLiq && g.novedad && !agotado && (
          <span className="absolute left-0 top-3 bg-black px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-widest text-white">Nuevo</span>
        )}
        {agotado && <span className="absolute bottom-0 right-0 bg-black px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-widest text-white">Agotado</span>}
        {!agotado && pocas && <span className="absolute bottom-0 right-0 bg-white/95 px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-widest text-brand">Últimas {g.stock}</span>}
      </div>

      <div className="pt-3">
        <h3 className="line-clamp-2 min-h-[2.4rem] font-display text-[13px] font-extrabold uppercase leading-tight tracking-wide text-neutral-900 sm:text-[14px]" title={g.base}>{g.base}</h3>
        <p className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-neutral-400">{tallas || g.categoria}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 leading-none">
          <span className="text-[17px] font-extrabold text-neutral-900">{rango ? "desde " : ""}{money(precio)}</span>
          {g.minMiembro != null && !g.hasLiq && (
            <span className="text-[11.5px] font-bold uppercase tracking-wide text-brand">socios {money(g.minMiembro)}</span>
          )}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); if (multi) onOpen?.(); else add(g.variants[0]); }}
          disabled={agotado && !multi}
          className="mt-3 w-full border border-neutral-900 py-2.5 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:bg-neutral-900 hover:text-white active:scale-[.98] disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-300 disabled:hover:bg-transparent"
        >
          {multi ? "Elegir talla" : agotado ? "Agotado" : "Agregar"}
        </button>
      </div>
    </div>
  );
}
