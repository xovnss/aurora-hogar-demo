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
const EMOJI: Record<string, string> = {
  "Recámara": "🛏️", "Baño": "🛁", "Cortinas": "🪟", "Cocina y Mesa": "🍽️", "Sala": "🛋️", "Decoración": "🎀", "Novedades": "🆕",
};
// Pestañas del menú de arriba. sec = sección a la que llevan (si no, "Blancos" baja a categorías).
const TABS: { label: string; sec?: string }[] = [
  { label: "Blancos" },
  { label: "Decoración", sec: "Decoración" },
  { label: "Liquidaciones", sec: "Liquidación" },
  { label: "Novedades", sec: "Novedades" },
];
// Fotos curadas (cuadradas) para los círculos de categoría — en /public/categorias/
const CAT_IMG: Record<string, string> = {
  "Recámara": "/categorias/recamara.jpg",
  "Baño": "/categorias/bano.jpg",
  "Cortinas": "/categorias/cortinas.jpg",
  "Cocina y Mesa": "/categorias/cocina-mesa.jpg",
  "Sala": "/categorias/sala.jpg",
  "Decoración": "/categorias/decoracion.jpg",
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
  const tabsShow = useMemo<{ label: string; sec?: string }[]>(() => {
    const temp = secciones
      .filter((s) => s.special === "navidad" || s.special === "halloween")
      .map((s) => ({ label: `${s.emoji} ${s.id}`, sec: s.id }));
    return [...TABS, ...temp];
  }, [secciones]);


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
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 pt-2 pb-2.5">
          {/* Menú ☰ (celular): adentro van todas las pestañas */}
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menú" aria-expanded={menuOpen}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-aurora-deep transition hover:bg-aurora-light xl:hidden">
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
          <span className="shrink-0 -mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.logo} alt="Aurora" className="h-12 w-auto sm:h-16" />
          </span>

          {/* Pestañas (compu) — al centro */}
          <nav className="hidden flex-1 items-center justify-center gap-2 xl:flex">
            {tabsShow.map((t) => (
              <button key={t.label} onClick={() => tabClick(t.sec)}
                className="rounded-full px-4 py-2 text-[1.05rem] font-bold text-aurora-deep transition hover:bg-aurora-light">{t.label}</button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Buscador: lupita que se abre al dar clic */}
            {searchOpen ? (
              <div className="relative">
                <input ref={searchRef} value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
                  onKeyDown={(e) => { if (e.key === "Enter") verProductos(); }}
                  onBlur={() => { if (!q.trim()) setSearchOpen(false); }}
                  placeholder="Buscar…" className="w-40 rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-9 text-sm outline-none focus:border-aurora focus:bg-white sm:w-64" />
                <button onClick={() => { setQ(""); setSearchOpen(false); }} aria-label="Cerrar"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600 hover:bg-gray-300">✕</button>
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} aria-label="Buscar"
                className="grid h-11 w-11 place-items-center rounded-full text-[1.35rem] text-aurora-deep transition hover:bg-aurora-light">🔍</button>
            )}
            {/* Mi lista (moderno) */}
            <button onClick={() => setCartOpen(true)}
              className="relative inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-aurora-deep to-aurora-dark px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg sm:px-5">
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
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[1.15rem] font-bold text-aurora-deep transition active:bg-aurora-light">
                {t.label}<span className="text-aurora">›</span>
              </button>
            ))}
            <button onClick={() => { setMenuOpen(false); setCartOpen(true); }}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[1.15rem] font-bold text-aurora-deep transition active:bg-aurora-light">
              🛒 Mi lista{count > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{count}</span>}
            </button>
            {SITE.communityUrl && (
              <a href={SITE.communityUrl} target="_blank" rel="noopener" onClick={() => setMenuOpen(false)}
                className="mt-1 flex items-center justify-between rounded-2xl bg-gradient-to-r from-aurora-deep to-aurora-dark px-4 py-3.5 text-[1.05rem] font-bold text-white">
                💙 Únete a la comunidad<span>→</span>
              </a>
            )}
          </nav>
        )}
      </header>

      {menuOpen && <div onClick={() => setMenuOpen(false)} className="fixed inset-0 z-20 bg-black/20 xl:hidden" aria-hidden />}

      {/* Hero a todo lo ancho, pegado a la barra (full-bleed). La imagen del tema
          (o la portada manual, si Rosy subió una) ya trae el texto incluido. */}
      <section>
        <div className="relative overflow-hidden aspect-[4/3] sm:aspect-[16/9] md:aspect-[2/1] xl:aspect-[21/9]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portadaUrl || t.hero} alt={`Catálogo Aurora ${mes} — Duerme bien, vive bien`}
            className="absolute inset-0 h-full w-full object-cover object-left sm:object-center md:object-top" />
          {/* Botones: en celular centrados hasta abajo; en compu a la izquierda a media altura */}
          <div className="absolute left-[6%] top-[58%] flex flex-wrap justify-start gap-3 sm:left-[3%] sm:top-[62%] md:top-[66%] xl:left-[4.5%] xl:top-[70%] sm:gap-4">
            <button onClick={irAComprar} className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-aurora-deep to-aurora-dark px-7 py-3 text-base font-bold text-white shadow-[0_10px_26px_-8px_rgba(14,38,80,0.6)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-8px_rgba(14,38,80,0.82)] sm:gap-2 sm:px-12 sm:py-5 sm:text-xl xl:px-10 xl:py-4 xl:text-lg">
              Comprar ahora <span className="transition group-hover:translate-x-1 sm:text-xl">→</span>
            </button>
            {hayLiq && (
              <button onClick={() => irASeccion("Liquidación")} className="hidden items-center gap-2 rounded-full bg-white/85 px-6 py-3 text-sm font-bold text-aurora-dark shadow ring-1 ring-white/70 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white sm:px-10 sm:py-4 sm:text-lg xl:inline-flex">
                Ver ofertas 🔥
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
          <h2 className="mb-5 text-center font-display text-2xl font-bold text-aurora-deep sm:mb-11 sm:text-3xl">Compra por categoría</h2>
          <div className="no-scrollbar mx-auto flex max-w-7xl snap-x gap-x-6 overflow-x-auto px-1 py-3 sm:gap-x-10 xl:gap-x-12">
            {secciones.map((s) => {
              const on = sec?.id === s.id;
              const usaFoto = !s.special || s.special === "navidad" || s.special === "halloween";
              const img = secImgTema(t, s.id) || CAT_IMG[s.id] || (usaFoto ? secImg[s.id] : "");
              return (
                <button key={s.id} onClick={() => irASeccion(s.id)} className="group flex shrink-0 snap-start flex-col items-center gap-2.5">
                  <span className={"relative flex aspect-square w-[72px] items-center justify-center overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-white transition sm:w-[124px] " + (on ? "ring-aurora" : "ring-transparent group-hover:ring-aurora/40")}>
                    {img ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img} alt={s.id} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-aurora-light text-3xl">{s.emoji}</span>
                    )}
                  </span>
                  <span className={"text-center text-[13px] font-bold leading-tight sm:text-sm " + (on ? "text-aurora" : "text-gray-700")}>{s.id}</span>
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
            className="block bg-gradient-to-r from-aurora-deep to-aurora-dark text-white shadow-lg transition hover:brightness-110">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 sm:text-[11px]">Comunidad Aurora</p>
                <p className="mt-0.5 text-base font-extrabold sm:mt-1 sm:text-3xl">💙 Únete a nuestra comunidad</p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/80 sm:mt-1 sm:text-sm">Obtén precios especiales en <b>TODOS</b> los productos.</p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-aurora-dark sm:px-5 sm:py-2.5 sm:text-sm">Unirme →</span>
            </div>
          </a>
        </section>
      )}

      {/* Categorías de la sección (se ocultan al buscar) */}
      {!buscando && sec && (
        <section className="sticky top-[64px] z-20 mt-8 w-full bg-white/85 px-4 backdrop-blur">
          <div className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto py-3 sm:flex-wrap sm:justify-center sm:overflow-visible">
            <Chip label="Todas" active={cat === "Todas"} onClick={() => pick("Todas")} />
            {categorias.map(([c]) => (
              <Chip key={c} label={c} active={cat === c} onClick={() => pick(c)} />
            ))}
          </div>
        </section>
      )}

      {/* Filtros: medida y precio (10-oct-2026). Solo salen si hay de dónde escoger. */}
      {(medidas.length > 1 || base.length > 6) && (
        <section className="mx-auto mt-1 flex max-w-7xl flex-wrap items-center gap-2 px-4">
          {medidas.length > 1 && (
            <>
              <span className="text-[12px] font-bold uppercase tracking-wide text-gray-400">Medida</span>
              <Chip label="Todas" active={medida === "Todas"} onClick={() => { setMedida("Todas"); setShown(PAGE); }} />
              {medidas.map(([mName, n]) => (
                <Chip key={mName} label={`${mName} (${n})`} active={medida === mName}
                      onClick={() => { setMedida(mName); setShown(PAGE); }} />
              ))}
            </>
          )}
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wide text-gray-400">Precio</span>
            <select value={precio} onChange={(e) => { setPrecio(e.target.value); setShown(PAGE); }}
              className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-semibold text-gray-600 outline-none focus:border-aurora">
              {RANGOS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </span>
          {hayFiltro && (
            <button onClick={limpiarFiltros} className="rounded-full px-3 py-1.5 text-sm font-bold text-aurora underline">
              Quitar filtros
            </button>
          )}
        </section>
      )}

      {/* Grid */}
      <main id="productos" className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {buscando ? (
              <><b className="text-aurora-dark">{filtrados.length}</b> resultado{filtrados.length === 1 ? "" : "s"} para “{nq}”</>
            ) : (
              <><b className="text-aurora-dark">{sec?.id}</b> · {filtrados.length} productos{cat !== "Todas" ? ` en ${cat}` : ""}</>
            )}
          </p>
        </div>

        {visibles.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p>No se encontraron productos{buscando ? ` para “${nq}”` : ""}{hayFiltro ? " con esos filtros" : ""}.</p>
            {hayFiltro && <button onClick={limpiarFiltros} className="mt-2 font-semibold text-aurora underline">Quitar filtros</button>}
            {buscando && <button onClick={() => setQ("")} className="mt-2 block w-full font-semibold text-aurora underline">Limpiar búsqueda</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {visibles.map((g) => <ProductCard key={g.key} g={g} onOpen={() => abrir(g)} />)}
          </div>
        )}

        {shown < filtrados.length && (
          <div className="mt-6 text-center">
            <button onClick={() => setShown((s) => s + PAGE)}
                    className="rounded-full border-2 border-aurora px-6 py-2 font-bold text-aurora hover:bg-aurora hover:text-white">
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
              <img src={t.logo} alt="Aurora" className="h-10 w-auto" />
            </span>
            <p className="mt-3 max-w-xs text-sm text-gray-500">Tienda de blancos en Pachuca, Hgo. Sábanas, colchas, cortinas, toallas y todo para renovar tu hogar con comodidad y estilo.</p>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wide text-[#16305b]">Categorías</p>
            <ul className="mt-3 space-y-1.5">
              {secciones.filter((s) => !s.special).slice(0, 6).map((s) => (
                <li key={s.id}>
                  <button onClick={() => { elegirSeccion(s.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-sm text-gray-500 hover:text-aurora">{s.emoji} {s.id}</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wide text-[#16305b]">Comunidad</p>
            <p className="mt-3 text-sm text-gray-500">Únete para el <b className="text-aurora-dark">precio de miembros</b> y enterarte de las ofertas.</p>
            {SITE.communityUrl && (
              <a href={SITE.communityUrl} target="_blank" rel="noopener" className="mt-3 inline-block rounded-full bg-aurora px-4 py-2 text-sm font-bold text-white hover:bg-aurora-dark">Unirme →</a>
            )}
          </div>
        </div>
        <p className="border-t border-black/5 py-5 text-center text-xs text-gray-400">© {now.getFullYear()} Aurora · Tienda de blancos · Pachuca, Hgo.</p>
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
        active ? "bg-aurora text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:border-aurora"
      }`}
    >
      {label}
    </button>
  );
}
