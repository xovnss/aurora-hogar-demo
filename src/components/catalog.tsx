"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { SITE } from "@/lib/config";
import { matchSearch } from "@/lib/search";
import type { ProductGroup, Variant } from "@/lib/group";
import { getTema, secImgTema } from "@/lib/temas";
import { useCart } from "./cart-context";
import ProductCard from "./product-card";
import ProductDetail from "./product-detail";
import CartDrawer from "./cart-drawer";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const PAGE = 48;

// Filtros de precio del catálogo (sobre el precio público del producto).
const RANGOS: { id: string; label: string; min: number; max: number }[] = [
  { id: "Todos", label: "Cualquier precio", min: 0, max: Infinity },
  { id: "a300", label: "Hasta $300", min: 0, max: 300 },
  { id: "300a600", label: "$300 a $600", min: 300, max: 600 },
  { id: "600a1000", label: "$600 a $1,000", min: 600, max: 1000 },
  { id: "1000mas", label: "Más de $1,000", min: 1000, max: Infinity },
];

// Una "sección" es una categoría padre del archivo (Recámara, Baño…) o una especial
// (Ofertas / Liquidación / Navidad / Halloween).
type SeccionMeta = { id: string; emoji: string; special?: "oferta" | "liq" | "navidad" | "halloween" | "novedad" };
const EMOJI: Record<string, string> = { "Playeras": "👕", "Sudaderas": "🧥", "Pantalones": "👖", "Accesorios": "👜", "Novedades": "🆕" };
// Pestañas del menú de arriba. sec = sección a la que llevan (si no, baja a las categorías).
const TABS: { label: string; sec?: string }[] = [
  { label: "Playeras", sec: "Playeras" },
  { label: "Sudaderas", sec: "Sudaderas" },
  { label: "Pantalones", sec: "Pantalones" },
  { label: "Accesorios", sec: "Accesorios" },
];
// Fotos (cuadradas) para los círculos de categoría — en /public/categorias/
const CAT_IMG: Record<string, string> = {
  "Playeras": "/categorias/frente.jpg",
  "Sudaderas": "/categorias/sudaderas.jpg",
  "Pantalones": "/categorias/pantalones.jpg",
  "Accesorios": "/categorias/accesorios.jpg",
  "Novedades": "/categorias/novedades.jpg",
  "Liquidación": "/categorias/liquidacion.jpg",
};

function enSeccion(g: ProductGroup, s: SeccionMeta) {
  if (s.special === "liq") return !!g.hasLiq;         // liquidación aparece ADEMÁS en su sección 🔥
  if (s.special === "oferta") return !!g.oferta;      // ofertas aparece ADEMÁS al frente 🎁
  if (s.special === "navidad") return !!g.esNavidad;  // temporada: además de su categoría 🎄
  if (s.special === "halloween") return !!g.esHalloween; // 🎃
  if (s.special === "novedad") return !!g.novedad;    // lo recién subido: ADEMÁS de su categoría 🆕
  return g.catalogo === s.id;                          // categoría padre (sin sacar los de liquidación)
}

// posiciones fijas de la decoración que cae (sin random → sin problemas de hidratación)
const CAEN_POS = [
  { l: "3%", dur: "9s", d: "0s", s: "22px" }, { l: "12%", dur: "12s", d: "1.5s", s: "16px" },
  { l: "21%", dur: "8s", d: "0.6s", s: "26px" }, { l: "31%", dur: "13s", d: "2.2s", s: "18px" },
  { l: "41%", dur: "10s", d: "0.3s", s: "22px" }, { l: "50%", dur: "11s", d: "1.1s", s: "16px" },
  { l: "60%", dur: "9.5s", d: "2.6s", s: "24px" }, { l: "69%", dur: "12.5s", d: "0.9s", s: "18px" },
  { l: "78%", dur: "8.5s", d: "1.8s", s: "22px" }, { l: "87%", dur: "11.5s", d: "0.2s", s: "16px" },
  { l: "94%", dur: "10.5s", d: "2.9s", s: "26px" }, { l: "56%", dur: "14s", d: "3.4s", s: "14px" },
];
function Caen({ items }: { items: string[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[15] overflow-hidden" aria-hidden>
      {CAEN_POS.map((p, i) => (
        <span key={i} className="pf-caer opacity-25" style={{ left: p.l, fontSize: p.s, animationDuration: p.dur, animationDelay: p.d }}>{items[i % items.length]}</span>
      ))}
    </div>
  );
}

// Carrusel de banners promocionales (giran solos cada 5s)
function Banners({ imgs }: { imgs: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (imgs.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % imgs.length), 5000);
    return () => clearInterval(t);
  }, [imgs.length]);
  if (!imgs.length) return null;
  const cur = Math.min(i, imgs.length - 1);
  return (
    <section className="mx-auto max-w-7xl px-4 pt-4">
      <div className="relative h-40 overflow-hidden rounded-3xl shadow-md ring-1 ring-black/5 sm:h-56 md:h-64">
        {imgs.map((src, k) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={k} src={src} alt="Promoción" className={"absolute inset-0 h-full w-full object-cover transition-opacity duration-700 " + (k === cur ? "opacity-100" : "opacity-0")} />
        ))}
        {imgs.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
            {imgs.map((_, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={`Banner ${k + 1}`}
                className={"h-2 rounded-full shadow transition-all " + (k === cur ? "w-5 bg-white" : "w-2 bg-white/60 hover:bg-white/90")} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Catalog({ grupos, tema, portadaUrl, banners }: { grupos: ProductGroup[]; tema: string; portadaUrl: string | null; banners: string[] }) {
  const t = getTema(tema);
  const { count } = useCart();
  const [q, setQ] = useState("");
  const [secId, setSecId] = useState("");
  const [cat, setCat] = useState("Todas");
  const [shown, setShown] = useState(PAGE);
  const [cartOpen, setCartOpen] = useState(false);
  const [selected, setSelected] = useState<ProductGroup | null>(null);
  const [selSku, setSelSku] = useState<string | null>(null);
  const [medida, setMedida] = useState("Todas");
  const [precio, setPrecio] = useState("Todos");

  // --- Link directo a cada producto (10-oct-2026) ---
  // Al abrir una ficha la dirección pasa a ?p=<SKU>, así la asesora puede copiar el link y
  // mandarlo por WhatsApp; quien lo abra cae directo en esa ficha. El botón "atrás" la cierra.
  function abrir(g: ProductGroup) {
    setSelected(g);
    setSelSku(null);
    const sku = g.variants[0]?.sku;
    if (sku && typeof window !== "undefined") {
      window.history.pushState({ p: sku }, "", `?p=${encodeURIComponent(sku)}`);
    }
  }
  function cerrarFicha() {
    setSelected(null);
    if (typeof window !== "undefined" && window.location.search.includes("p=")) {
      window.history.pushState({}, "", window.location.pathname);
    }
  }
  useEffect(() => {
    const porSku = (sku: string | null) =>
      sku ? grupos.find((g) => g.variants.some((v) => v.sku === sku)) || null : null;
    const skuUrl = new URLSearchParams(window.location.search).get("p");
    const inicial = porSku(skuUrl);
    if (inicial) { setSelected(inicial); setSelSku(skuUrl); }
    const onPop = () => {
      const sk = new URLSearchParams(window.location.search).get("p");
      setSelected(porSku(sk)); setSelSku(sk);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [grupos]);
  function irAComprar() { document.getElementById("comprar")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  // Baja a la reja de productos (tras un pequeño delay para que el filtro ya haya pintado).
  function verProductos() { setTimeout(() => document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }
  // Elegir una sección Y bajar a los productos (círculos de "Compra por categoría").
  function irASeccion(id: string) { elegirSeccion(id); verProductos(); }
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // menú ☰ (solo celular/tablet chica)
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  function tabClick(secId?: string) {
    if (secId && secciones.some((s) => s.id === secId)) {
      elegirSeccion(secId);
      setTimeout(() => document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } else {
      setQ(""); document.getElementById("comprar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // variantes sueltas (para el aviso de stock del carrito y los pop-ups de pedidos falsos)
  const variantes = useMemo<Variant[]>(() => grupos.flatMap((g) => g.variants), [grupos]);
  const stockBySku = useMemo(() => new Map(variantes.map((p) => [p.sku, p.stock])), [variantes]);

  const now = new Date();
  const mes = MESES[now.getMonth()];
  const nq = q.trim();
  const buscando = nq.length > 0;
  // Al empezar a buscar, baja solito a los productos (una vez, no en cada tecla).
  useEffect(() => { if (buscando) verProductos(); }, [buscando]);

  // Secciones: Ofertas + temporada (Navidad/Halloween, si hay) al frente + categorías padre
  // en el orden del archivo + Liquidación (si hay).
  const secciones = useMemo<SeccionMeta[]>(() => {
    const cats: string[] = [];
    const seen = new Set<string>();
    let hayOferta = false, hayLiq = false, hayNuevo = false;
    const hayTemp: Record<string, boolean> = {};
    for (const g of grupos) {
      if (g.novedad) hayNuevo = true;
      // "Novedades" ya no es una categoría: es una sección aparte (los productos nuevos viven
      // en su categoría real y ADEMÁS salen aquí).
      if (g.catalogo !== "Novedades" && !seen.has(g.catalogo)) { seen.add(g.catalogo); cats.push(g.catalogo); }
      if (g.oferta) hayOferta = true;
      if (g.hasLiq) hayLiq = true;
      if (g.esNavidad) hayTemp["Navidad"] = true;
      if (g.esHalloween) hayTemp["Halloween"] = true;
    }
    const oculta = new Set(t.ocultaTemp);
    const out: SeccionMeta[] = [];
    if (hayOferta) out.push({ id: "Ofertas", emoji: "🎁", special: "oferta" });
    for (const c of cats) out.push({ id: c, emoji: EMOJI[c] || "🏷️" });
    if (hayNuevo) out.push({ id: "Novedades", emoji: "🆕", special: "novedad" });
    if (hayLiq) out.push({ id: "Liquidación", emoji: "🔥", special: "liq" });
    // Temporadas AL FINAL (después de Liquidación): primero Halloween, luego Navidad.
    // Cada tema puede ocultarlas: en Navidad no sale Halloween, en Halloween no sale
    // Navidad, en Día de las Madres no sale ninguna.
    if (hayTemp["Halloween"] && !oculta.has("halloween")) out.push({ id: "Halloween", emoji: "🎃", special: "halloween" });
    if (hayTemp["Navidad"] && !oculta.has("navidad")) out.push({ id: "Navidad", emoji: "🎄", special: "navidad" });
    return out;
  }, [grupos, t]);

  const sec = secciones.find((s) => s.id === secId) || secciones[0];

  // Pestañas del menú = las fijas + temporadas presentes (al final, en el orden del catálogo)
  const tabsShow = TABS; // solo las cuatro categorías de ropa y accesorios


  const hayLiq = secciones.some((s) => s.special === "liq");
  // Imagen representativa de cada sección (primera foto real de un producto), para los círculos.
  const secImg = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of secciones) {
      const g = grupos.find((gg) => enSeccion(gg, s) && gg.variants.some((v) => v.imageUrl));
      const vi = g?.variants.find((v) => v.imageUrl);
      const url = vi?.thumbUrl || vi?.imageUrl;
      if (url) m[s.id] = url;
    }
    return m;
  }, [grupos, secciones]);

  // Subcategorías de la sección actual, en el orden del archivo (no alfabético).
  const categorias = useMemo(() => {
    const m = new Map<string, { n: number; ord: number }>();
    for (const g of grupos) if (sec && enSeccion(g, sec)) {
      const e = m.get(g.categoria);
      if (e) e.n++;
      else m.set(g.categoria, { n: 1, ord: g.categoriaOrden ?? 0 });
    }
    return [...m.entries()].sort((a, b) => a[1].ord - b[1].ord).map(([c, v]) => [c, v.n] as [string, number]);
  }, [grupos, sec]);

  // Paso 1: sección + subcategoría (o búsqueda). De aquí salen las opciones de los filtros.
  const base = useMemo(() => {
    if (buscando) {
      return grupos.filter((g) => {
        if (!SITE.mostrarAgotados && g.stock <= 0) return false;   // agotados: se muestran marcados
        return matchSearch(g.blob, nq);
      });
    }
    return grupos.filter((g) => {
      if (!sec || !enSeccion(g, sec)) return false;
      if (cat !== "Todas" && g.categoria !== cat) return false;
      if (!SITE.mostrarAgotados && g.stock <= 0) return false;   // agotados: se muestran marcados
      return true;
    });
  }, [grupos, buscando, nq, sec, cat]);

  // Medidas que de verdad existen en lo que se está viendo (si no hay ninguna, no sale el filtro).
  const medidas = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of base) for (const tg of g.sizeTags || []) m.set(tg, (m.get(tg) || 0) + 1);
    return [...m.entries()];
  }, [base]);

  // Paso 2: filtros de medida y precio.
  const rango = RANGOS.find((r) => r.id === precio) || RANGOS[0];
  const filtrados = useMemo(() => base.filter((g) => {
    if (medida !== "Todas" && !(g.sizeTags || []).includes(medida)) return false;
    // el producto entra si ALGUNO de sus precios cae en el rango
    if (rango.id !== "Todos" && !(g.minPublico <= rango.max && g.maxPublico >= rango.min)) return false;
    return true;
  }), [base, medida, rango]);

  const hayFiltro = medida !== "Todas" || precio !== "Todos";
  function limpiarFiltros() { setMedida("Todas"); setPrecio("Todos"); setShown(PAGE); }

  const visibles = filtrados.slice(0, shown);
  function elegirSeccion(id: string) { setSecId(id); setCat("Todas"); setShown(PAGE); setQ(""); limpiarFiltros(); }
  function pick(c: string) { setCat(c); setShown(PAGE); limpiarFiltros(); }

  return (
    <div className="min-h-screen pf-clouds font-display" style={t.vars as React.CSSProperties}>
      {t.caen.length > 0 && <Caen items={t.caen} />}

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="relative mx-auto flex max-w-7xl items-center gap-4 px-4 pt-2 pb-2.5">
          {/* Menú ☰ (celular): adentro van todas las pestañas */}
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menú" aria-expanded={menuOpen}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-brand-deep transition hover:bg-stone-100 xl:hidden">
            {menuOpen ? (
              <span className="text-2xl leading-none">✕</span>
            ) : (
              <span className="flex flex-col gap-[5px]">
                <span className="block h-[3px] w-6 rounded-full bg-current" />
                <span className="block h-[3px] w-6 rounded-full bg-current" />
                <span className="block h-[3px] w-6 rounded-full bg-current" />
              </span>
            )}
          </button>
          <span className={"shrink-0 -mt-2 max-xl:absolute max-xl:left-1/2 max-xl:-translate-x-1/2 " + (searchOpen ? "max-sm:hidden" : "")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.logo} alt="BAM!" className="h-12 w-auto sm:h-16" />
          </span>

          {/* Pestañas (compu) — al centro */}
          <nav className="hidden flex-1 items-center justify-center gap-2 xl:flex">
            {tabsShow.map((t) => (
              <button key={t.label} onClick={() => tabClick(t.sec)}
                className="rounded-full px-4 py-2 text-[1.05rem] font-bold text-brand-deep transition hover:bg-stone-100">{t.label}</button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Buscador: lupita que se abre al dar clic */}
            {searchOpen ? (
              <div className="relative">
                <input ref={searchRef} value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
                  onKeyDown={(e) => { if (e.key === "Enter") verProductos(); }}
                  onBlur={() => { if (!q.trim()) setSearchOpen(false); }}
                  placeholder="Buscar…" className="w-40 rounded-full border border-stone-200 bg-stone-50 py-2.5 pl-4 pr-9 text-sm outline-none focus:border-brand focus:bg-white sm:w-64" />
                <button onClick={() => { setQ(""); setSearchOpen(false); }} aria-label="Cerrar"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-stone-200 text-xs text-stone-600 hover:bg-stone-300">✕</button>
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} aria-label="Buscar"
                className="grid h-11 w-11 place-items-center rounded-full text-[1.35rem] text-brand-deep transition hover:bg-stone-100">🔍</button>
            )}
            {/* Mi lista (moderno) */}
            <button onClick={() => setCartOpen(true)}
              className="relative inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-brand-deep to-brand-dark px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg sm:px-5">
              <span>🛒</span><span className="hidden sm:inline">Mi lista</span>
              {count > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">{count}</span>}
            </button>
          </div>
        </div>

        {/* Menú desplegable (celular): aquí van todas las pestañas */}
        {menuOpen && (
          <nav className="border-t border-black/5 bg-white px-3 pb-3 pt-2 xl:hidden">
            {tabsShow.map((t) => (
              <button key={t.label} onClick={() => { setMenuOpen(false); tabClick(t.sec); }}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[1.15rem] font-bold text-brand-deep transition active:bg-stone-100">
                {t.label}<span className="text-brand">›</span>
              </button>
            ))}
            <button onClick={() => { setMenuOpen(false); setCartOpen(true); }}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[1.15rem] font-bold text-brand-deep transition active:bg-stone-100">
              🛒 Mi lista{count > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{count}</span>}
            </button>
            {SITE.communityUrl && (
              <a href={SITE.communityUrl} target="_blank" rel="noopener" onClick={() => setMenuOpen(false)}
                className="mt-1 flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand-deep to-brand-dark px-4 py-3.5 text-[1.05rem] font-bold text-white">
                🧡 Únete a la comunidad<span>→</span>
              </a>
            )}
          </nav>
        )}
      </header>

      {menuOpen && <div onClick={() => setMenuOpen(false)} className="fixed inset-0 z-20 bg-black/20 xl:hidden" aria-hidden />}

      {/* Portada: banner horizontal: en compu completo; en celular se recorta a los tres modelos.
          Abajo, un bloque negro con el mensaje y los botones, centrados. */}
      <section>
        <div className="relative overflow-hidden bg-stone-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portadaUrl || "/portada.jpg"} alt="BAM! — catálogo" className="block h-72 w-full object-cover object-[62%_40%] sm:h-80 md:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portadaUrl || "/portada-ancha.jpg"} alt="" aria-hidden className="hidden h-auto w-full md:block" />
        </div>
        <div className="bg-brand-deep px-4 py-9 text-center text-white sm:py-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/60">a brand made for you</p>
          <h1 className="mx-auto mt-3 max-w-3xl font-display text-[2rem] font-black uppercase leading-[1.02] tracking-tight sm:text-5xl">Ropa con mensaje.<br />Hecha para ti.</h1>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button onClick={irAComprar} className="group inline-flex items-center gap-2 rounded-full bg-black px-8 py-3.5 text-base font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-neutral-700">
              Comprar ahora <span className="transition group-hover:translate-x-1">→</span>
            </button>
            {hayLiq && (
              <button onClick={() => irASeccion("Liquidación")} className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 px-7 py-3 text-base font-bold text-white transition hover:border-white hover:bg-white/10">
                Ver liquidación 🔥
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Banners promocionales (carrusel) */}
      <Banners imgs={banners} />


      {/* Comprar por categoría — círculos centrados, a todo lo ancho, con aire */}
      {!buscando && (
        <section id="comprar" className="w-full px-4 pt-6 pb-6 sm:px-8 sm:pt-16 sm:pb-16">
          <h2 className="mb-5 text-center font-display text-2xl font-bold text-brand-deep sm:mb-11 sm:text-3xl">Compra por categoría</h2>
          <div className="mx-auto grid max-w-sm grid-cols-3 justify-items-center gap-x-3 gap-y-5 px-1 py-3 sm:flex sm:max-w-7xl sm:snap-x sm:justify-start sm:gap-x-10 sm:overflow-x-auto sm:no-scrollbar xl:gap-x-12 sm:[&>*:first-child]:ml-auto sm:[&>*:last-child]:mr-auto">
            {secciones.map((s) => {
              const on = sec?.id === s.id;
              const usaFoto = !s.special || s.special === "navidad" || s.special === "halloween";
              const img = secImgTema(t, s.id) || CAT_IMG[s.id] || (usaFoto ? secImg[s.id] : "");
              return (
                <button key={s.id} onClick={() => irASeccion(s.id)} className="group flex shrink-0 snap-start flex-col items-center gap-2.5">
                  <span className={"relative flex aspect-square w-[84px] items-center justify-center overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-white transition sm:w-[124px] " + (on ? "ring-brand" : "ring-transparent group-hover:ring-brand/40")}>
                    {img ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img} alt={s.id} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-stone-100 text-3xl">{s.emoji}</span>
                    )}
                  </span>
                  <span className={"text-center text-[13px] font-bold leading-tight sm:text-sm " + (on ? "text-brand" : "text-stone-700")}>{s.id}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Banner de comunidad a todo lo ancho (se oculta al buscar) */}
      {!buscando && (
        <section className="w-full pt-8">
          <a href={SITE.communityUrl || undefined} target={SITE.communityUrl ? "_blank" : undefined} rel="noopener"
            className="block bg-gradient-to-r from-brand-deep to-brand-dark text-white shadow-lg transition hover:brightness-110">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 sm:text-[11px]">Club BAM!</p>
                <p className="mt-0.5 text-base font-extrabold sm:mt-1 sm:text-3xl">🧡 Únete a nuestra comunidad</p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/80 sm:mt-1 sm:text-sm">Obtén precios especiales en <b>TODOS</b> los productos.</p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-brand-dark sm:px-5 sm:py-2.5 sm:text-sm">Unirme →</span>
            </div>
          </a>
        </section>
      )}

      {/* Categorías de la sección (se ocultan al buscar) */}
      {!buscando && sec && (
        <section className="sticky top-[64px] z-20 mt-8 w-full bg-white/85 px-4 backdrop-blur">
          <div className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto py-3 sm:flex-wrap sm:justify-center sm:overflow-visible [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto">
            <Chip label="Todas" active={cat === "Todas"} onClick={() => pick("Todas")} />
            {categorias.map(([c]) => (
              <Chip key={c} label={c} active={cat === c} onClick={() => pick(c)} />
            ))}
          </div>
        </section>
      )}

      {/* Filtros: medida y precio (10-oct-2026). Solo salen si hay de dónde escoger. */}
      {(medidas.length > 1 || base.length > 6) && (
        <section className="mx-auto mt-1 flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 sm:justify-start">
          {medidas.length > 1 && (
            <>
              <span className="text-[12px] font-bold uppercase tracking-wide text-stone-400">Talla</span>
              <Chip label="Todas" active={medida === "Todas"} onClick={() => { setMedida("Todas"); setShown(PAGE); }} />
              {medidas.map(([mName, n]) => (
                <Chip key={mName} label={`${mName} (${n})`} active={medida === mName}
                      onClick={() => { setMedida(mName); setShown(PAGE); }} />
              ))}
            </>
          )}
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wide text-stone-400">Precio</span>
            <select value={precio} onChange={(e) => { setPrecio(e.target.value); setShown(PAGE); }}
              className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm font-semibold text-stone-600 outline-none focus:border-brand">
              {RANGOS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </span>
          {hayFiltro && (
            <button onClick={limpiarFiltros} className="rounded-full px-3 py-1.5 text-sm font-bold text-brand underline">
              Quitar filtros
            </button>
          )}
        </section>
      )}

      {/* Grid */}
      <main id="productos" className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-stone-500">
            {buscando ? (
              <><b className="text-brand-dark">{filtrados.length}</b> resultado{filtrados.length === 1 ? "" : "s"} para “{nq}”</>
            ) : (
              <><b className="text-brand-dark">{sec?.id}</b> · {filtrados.length} productos{cat !== "Todas" ? ` en ${cat}` : ""}</>
            )}
          </p>
        </div>

        {visibles.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <p>No se encontraron productos{buscando ? ` para “${nq}”` : ""}{hayFiltro ? " con esos filtros" : ""}.</p>
            {hayFiltro && <button onClick={limpiarFiltros} className="mt-2 font-semibold text-brand underline">Quitar filtros</button>}
            {buscando && <button onClick={() => setQ("")} className="mt-2 block w-full font-semibold text-brand underline">Limpiar búsqueda</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
            {visibles.map((g) => <ProductCard key={g.key} g={g} onOpen={() => abrir(g)} />)}
          </div>
        )}

        {shown < filtrados.length && (
          <div className="mt-6 text-center">
            <button onClick={() => setShown((s) => s + PAGE)}
                    className="rounded-full border-2 border-brand px-6 py-2 font-bold text-brand hover:bg-black hover:text-white">
              Ver más ({filtrados.length - shown})
            </button>
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-black/5 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <span className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.logo} alt="BAM!" className="h-10 w-auto" />
            </span>
            <p className="mt-3 max-w-xs text-sm text-stone-500">Playeras, sudaderas, pantalones, bolsas y lentes. a brand made for you.</p>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wide text-[#2b1111]">Categorías</p>
            <ul className="mt-3 space-y-1.5">
              {secciones.filter((s) => !s.special).slice(0, 6).map((s) => (
                <li key={s.id}>
                  <button onClick={() => { elegirSeccion(s.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-sm text-stone-500 hover:text-brand">{s.emoji} {s.id}</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wide text-[#2b1111]">Comunidad</p>
            <p className="mt-3 text-sm text-stone-500">Únete para el <b className="text-brand-dark">precio de socios</b> y enterarte de las ofertas.</p>
            {SITE.communityUrl && (
              <a href={SITE.communityUrl} target="_blank" rel="noopener" className="mt-3 inline-block rounded-full bg-black px-4 py-2 text-sm font-bold text-white hover:bg-neutral-700">Unirme →</a>
            )}
          </div>
        </div>
        <p className="border-t border-black/5 py-5 text-center text-xs text-stone-400">© {now.getFullYear()} BAM! · Demo de tienda con chatbot</p>
      </footer>

      {selected && <ProductDetail g={selected} skuInicial={selSku} onClose={cerrarFicha} />}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} stock={stockBySku} />
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        active ? "bg-black text-white shadow" : "bg-white text-stone-600 border border-stone-200 hover:border-brand"
      }`}
    >
      {label}
    </button>
  );
}
