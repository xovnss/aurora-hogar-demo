"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  loginCajaAction, logoutCajaAction, cargarCajaAction, guardarSalidasAction, guardarEntradasAction, guardarConteoAction,
  enviosCajaAction, cobrarEnvioAction,
  type CajaData,
} from "./actions";
import type { SalidaCaja, CajaConteo, TerminalMov, CorteLinea } from "@/lib/odoo-write";

const money = (n: number) => "$" + (Math.round((n || 0) * 100) / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 });
const hoyMx = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
const horaMx = () => new Date().toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" });
const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.2, 0.1, 0.05];
const totalDenom = (m: Record<string, number>) => DENOMS.reduce((s, d) => s + d * (m?.[String(d)] || 0), 0);
const dLabel = (d: number) => "$" + (d < 1 ? d.toFixed(2) : d.toLocaleString("es-MX"));

/* ---------- Login ---------- */
export function CajaLogin() {
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    start(async () => { const r = await loginCajaAction(pass); if (r.ok) router.refresh(); else setErr(r.error); });
  }
  return (
    <div className="font-display flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#7c2d12] via-[#9a3412] to-[#c2410c] px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/aurora-blanco.png" alt="Aurora" className="mb-5 h-12 w-auto" />
      <form onSubmit={submit} className="w-full max-w-sm rounded-[28px] border-4 border-white/20 bg-white p-7 shadow-2xl">
        <h1 className="font-display text-2xl font-bold text-[#7c2d12]">Corte de caja</h1>
        <p className="mt-0.5 mb-4 text-sm text-stone-500">Arqueo, salidas y cuadre 🧮</p>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus placeholder="Contraseña"
          className="pf-input w-full px-4 py-3 text-center" />
        {err && <p className="mt-2 text-center text-sm text-red-600">{err}</p>}
        <button disabled={pending} className="pf-btn mt-4 w-full px-4 py-3">{pending ? "Entrando…" : "Entrar"}</button>
      </form>
      <p className="mt-5 text-[12px] font-semibold text-white/50">☁️ Aurora · Caja</p>
    </div>
  );
}

/* ---------- Contador de denominaciones ---------- */
function DenomCounter({ value, onChange }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const set = (d: number, n: string) => onChange({ ...value, [String(d)]: parseInt(n.replace(/[^\d]/g, "")) || 0 });
  return (
    <div className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2 sm:gap-x-5">
      {DENOMS.map((d) => {
        const c = value?.[String(d)] || 0;
        return (
          <div key={d} className="flex items-center gap-2">
            <span className="w-16 text-right text-[13px] font-semibold text-[#7c2d12]">{dLabel(d)}</span>
            <span className="text-stone-300">×</span>
            <input inputMode="numeric" value={c || ""} onChange={(e) => set(d, e.target.value)} placeholder="0"
              className="pf-input w-16 px-2 py-1.5 text-center" />
            <span className="flex-1 text-right text-[12px] tabular-nums text-stone-500">{c > 0 ? money(d * c) : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- App ---------- */
export function CajaApp() {
  const router = useRouter();
  const [fecha, setFecha] = useState(hoyMx());
  // Cada cajera trabaja UNA caja. Se recuerda en su navegador para que no la elija cada vez.
  const [caja, setCaja] = useState<number>(0);
  const [data, setData] = useState<CajaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [salidas, setSalidas] = useState<SalidaCaja[]>([]);
  const [entradas, setEntradas] = useState<SalidaCaja[]>([]);
  const [vale, setVale] = useState<string | null>(null);
  // Envíos que cobra la caja: recolección en tienda y contra entrega (15-oct-2026)
  const [envios, setEnvios] = useState<CorteLinea[]>([]);
  const [envErr, setEnvErr] = useState("");
  const [cobrando, setCobrando] = useState<number | null>(null);
  const [verViejos, setVerViejos] = useState(false);
  const [conteo, setConteo] = useState<CajaConteo>({ apertura: {}, cierre: {}, terminal: 0, fondoFijo: 0, efectivoRecibido: 0, transferenciaRecibida: 0, terminales: [], notas: "" });

  function load(f: string, c?: number) {
    setLoading(true); setErr("");
    cargarCajaAction(f, c ?? caja ?? undefined)
      .then((r) => {
        if (r.ok) {
          setData(r.data); setSalidas(r.data.salidas); setEntradas(r.data.entradas || []); setConteo(r.data.conteo);
          setCaja(r.data.caja);
          try { localStorage.setItem("caja-aurora-id", String(r.data.caja)); } catch { /* sin memoria del navegador */ }
        } else setErr(r.error);
      })
      .catch(() => setErr("No se pudo cargar. Recarga la página con Cmd+Shift+R (versión nueva) y vuelve a intentar."))
      .finally(() => setLoading(false));
    cargarEnvios(f);
  }

  // Los envíos NO son por caja: el pedido es de la tienda, lo cobre quien lo cobre.
  function cargarEnvios(f: string) {
    setEnvErr("");
    enviosCajaAction(f)
      .then((r) => { if (r.ok) setEnvios(r.lineas); else setEnvErr(r.error); })
      .catch(() => setEnvErr("No se pudieron leer los envíos."));
  }

  function marcarEnvio(l: CorteLinea, cobrado: boolean) {
    setCobrando(l.id);
    cobrarEnvioAction(l.id, fecha, cobrado)
      .then((r) => { if (!r.ok) setEnvErr(r.error); cargarEnvios(fecha); })
      .catch(() => setEnvErr("No se pudo marcar. Intenta de nuevo."))
      .finally(() => setCobrando(null));
  }
  useEffect(() => {
    let guardada = 0;
    try { guardada = parseInt(localStorage.getItem("caja-aurora-id") || "0") || 0; } catch { /* sin memoria */ }
    setCaja(guardada);
    load(fecha, guardada);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Guardar en Odoo (con retraso, para no saturar)
  useEffect(() => {
    if (loading || !data) return;
    const t = setTimeout(() => guardarConteoAction(fecha, conteo, caja), 700);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [conteo]);
  useEffect(() => {
    if (loading || !data) return;
    const t = setTimeout(() => guardarSalidasAction(fecha, salidas, caja), 700);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [salidas]);
  useEffect(() => {
    if (loading || !data) return;
    const t = setTimeout(() => guardarEntradasAction(fecha, entradas, caja), 700);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [entradas]);
  // Al terminar de imprimir, vuelve a mostrar el ticket del corte (no el vale)
  useEffect(() => {
    const h = () => setVale(null);
    window.addEventListener("afterprint", h);
    return () => window.removeEventListener("afterprint", h);
  }, []);

  const efeOdoo = data?.efectivo ?? 0;
  const tarOdoo = data?.tarjeta ?? 0;
  const trfOdoo = data?.transferencia ?? 0;
  const fondo = conteo.fondoFijo > 0 ? conteo.fondoFijo : totalDenom(conteo.apertura);
  const totalSalidas = salidas.reduce((s, x) => s + (x.monto || 0), 0);
  // Gasto = el dinero se fue. Traspaso = se lo llevaron del cajón pero sigue siendo de la tienda.
  // Los dos bajan el efectivo del cajón; sólo el gasto es gasto del negocio.
  const totalGastos = salidas.filter((x) => x.tipo !== "traspaso").reduce((s, x) => s + (x.monto || 0), 0);
  const totalTraspasos = salidas.filter((x) => x.tipo === "traspaso").reduce((s, x) => s + (x.monto || 0), 0);
  const totalEntradas = entradas.reduce((s, x) => s + (x.monto || 0), 0);
  const efeRecibido = conteo.efectivoRecibido || 0;
  const efeFinal = efeRecibido - totalSalidas;
  const efeContado = totalDenom(conteo.cierre);
  const terminales: TerminalMov[] = conteo.terminales && conteo.terminales.length ? conteo.terminales : [{ nombre: "", monto: 0 }];
  const terminal = terminales.reduce((s, t) => s + (t.monto || 0), 0);
  const trfRecibido = conteo.transferenciaRecibida || 0;
  const difEfe = efeRecibido - efeOdoo;   // lo que recibieron vs lo que Odoo registró en efectivo
  const difTar = terminal - tarOdoo;      // terminal real vs lo que Odoo registró en tarjeta
  const difTrf = trfRecibido - trfOdoo;   // transferencias confirmadas vs lo que Odoo registró

  function updTerminal(i: number, patch: Partial<TerminalMov>) { setConteo({ ...conteo, terminales: terminales.map((t, j) => (j === i ? { ...t, ...patch } : t)) }); }
  function addTerminal() { setConteo({ ...conteo, terminales: [...terminales, { nombre: "", monto: 0 }] }); }
  function delTerminal(i: number) { setConteo({ ...conteo, terminales: terminales.filter((_, j) => j !== i) }); }
  function addSalida() { setSalidas((s) => [...s, { concepto: "", monto: 0, hora: horaMx(), tipo: "gasto" as const }]); }
  function updSalida(i: number, patch: Partial<SalidaCaja>) { setSalidas((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x))); }
  function delSalida(i: number) { setSalidas((s) => s.filter((_, j) => j !== i)); }
  function addEntrada() { setEntradas((s) => [...s, { concepto: "", monto: 0, hora: horaMx() }]); }
  function updEntrada(i: number, patch: Partial<SalidaCaja>) { setEntradas((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x))); }
  function delEntrada(i: number) { setEntradas((s) => s.filter((_, j) => j !== i)); }

  // Envíos que cobra la caja (recolección en tienda / contra entrega)
  // Los más nuevos arriba: lo de hoy es lo que la cajera tiene enfrente.
  const envPend = envios.filter((e) => !e.formaPago).sort((a, b) => b.fecha.localeCompare(a.fecha));
  // Hay pendientes de hace meses que nadie recogió. Se siguen mostrando, pero guardados
  // detrás de un botón para que no tapen los del día. (15-oct-2026)
  const corte15 = (() => { const d = new Date(fecha + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 15); return d.toISOString().slice(0, 10); })();
  const envRecientes = envPend.filter((e) => e.fecha >= corte15);
  const envViejos = envPend.filter((e) => e.fecha < corte15);
  const envVisibles = verViejos ? envPend : envRecientes;
  const envCobrados = envios.filter((e) => e.formaPago === "caja");
  const envOtros = envios.filter((e) => e.formaPago && e.formaPago !== "caja");
  const totalEnvPend = envPend.reduce((a, e) => a + (e.total || 0), 0);
  const totalEnvCobrado = envCobrados.reduce((a, e) => a + (e.total || 0), 0);
  const tipoEnv = (t: string) => (t === "contra" ? "CONTRA ENTREGA" : "RECOLECCIÓN EN TIENDA");

  const hizoConteo = efeRecibido > 0 || terminal > 0 || trfRecibido > 0;
  let estado: null | { tipo: "ok" | "cambio" | "real"; msg: string; detalle?: string } = null;
  if (hizoConteo) {
    const cuadraEfe = Math.abs(difEfe) < 1, cuadraTar = Math.abs(difTar) < 1, cuadraTrf = Math.abs(difTrf) < 1;
    if (cuadraEfe && cuadraTar && cuadraTrf) estado = { tipo: "ok", msg: "✅ ¡Todo cuadra!" };
    else if (cuadraTrf && Math.abs(difEfe + difTar) < 1 && Math.abs(difTar) >= 1) {
      const z = money(Math.abs(difTar));
      const dir = difTar < 0 ? `Se marcaron ${z} como TARJETA que fueron EFECTIVO.` : `Se marcaron ${z} como EFECTIVO que fueron TARJETA.`;
      estado = { tipo: "cambio", msg: `🔄 Se confundieron ${z} entre efectivo y tarjeta`, detalle: `${dir} El total cuadra, solo está mal clasificado.` };
    } else estado = { tipo: "real", msg: "⚠️ No cuadra: falta o sobra dinero", detalle: `Efectivo: ${difEfe >= 0 ? "sobran " : "faltan "}${money(Math.abs(difEfe))} · Tarjeta: ${difTar >= 0 ? "sobran " : "faltan "}${money(Math.abs(difTar))}${cuadraTrf ? "" : ` · Transf.: ${difTrf >= 0 ? "sobran " : "faltan "}${money(Math.abs(difTrf))}`}` };
  }
  const colEstado = estado?.tipo === "ok" ? "bg-emerald-50 border-emerald-300 text-emerald-700"
    : estado?.tipo === "cambio" ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-red-50 border-red-300 text-red-700";

  // ---- Ticket en texto (blanco y negro, monoespaciado) ----
  const W = 32;
  const fila = (l: string, v: string) => l + " ".repeat(Math.max(1, W - l.length - v.length)) + v;
  const linea = "-".repeat(W);
  // OJO: se usa data.caja (la caja de las cifras que están en pantalla) y NO el selector,
  // que cambia de inmediato mientras los montos de la caja nueva todavía se están cargando.
  // Si se usara el selector, el ticket podía salir con el nombre de una caja y los números de otra.
  const nombreCaja = data?.cajas?.find((c) => c.id === data?.caja)?.nombre || "";
  const centra = (t: string) => " ".repeat(Math.max(0, Math.floor((W - t.length) / 2))) + t;
  const ticket = [
    "            AURORA",
    "        CORTE DE CAJA",
    ...(nombreCaja ? [centra(nombreCaja.toUpperCase())] : []),
    "          " + fecha,
    "=".repeat(W),
    "ARQUEO (fondo/cambio)",
    fila("  Inicio", money(fondo)),
    fila("  Cierre", money(efeContado)),
    fila("  Diferencia", money(efeContado - fondo)),
    linea,
    "EFECTIVO (vs Odoo)",
    fila("  Odoo", money(efeOdoo)),
    fila("  Recibido", money(efeRecibido)),
    fila("  Diferencia", money(difEfe)),
    linea,
    "TARJETA (vs Odoo)",
    fila("  Odoo", money(tarOdoo)),
    ...terminales.filter((t) => t.monto > 0).map((t, i) => fila("  " + (t.nombre || `Terminal ${i + 1}`).slice(0, 18), money(t.monto))),
    fila("  Total terminal", money(terminal)),
    fila("  Diferencia", money(difTar)),
    ...(trfOdoo > 0 || trfRecibido > 0 ? [
      linea,
      "TRANSFERENCIA (vs Odoo)",
      fila("  Odoo", money(trfOdoo)),
      fila("  Recibido", money(trfRecibido)),
      fila("  Diferencia", money(difTrf)),
    ] : []),
    linea,
    "SALIDAS / GASTOS",
    ...(salidas.length ? salidas.map((s) => fila("  " + (s.tipo === "traspaso" ? "[T] " : "") + (s.concepto || "-").slice(0, 16), money(s.monto))) : ["  (ninguna)"]),
    fila("  Gastos", money(totalGastos)),
      fila("  Traspasos", money(totalTraspasos)),
      fila("  Total salidas", money(totalSalidas)),
    ...(entradas.length ? [linea, "ENTRADAS DE EFECTIVO", ...entradas.map((s) => fila("  " + (s.concepto || "-").slice(0, 18), money(s.monto))), fila("  Total entradas", money(totalEntradas))] : []),
    linea,
    fila("EFECTIVO FINAL", money(efeFinal)),
    "  (recibido - gastos)",
    "=".repeat(W),
    estado ? estado.msg.replace(/[✅🔄⚠️]/g, "").trim() : "(falta contar para cuadrar)",
    estado?.detalle ? estado.detalle : "",
    ...(conteo.notas && conteo.notas.trim() ? [linea, "NOTAS:", conteo.notas.trim()] : []),
    "",
    "        ¡Gracias!",
  ].join("\n");

  // ---- Vale individual de entrada/salida (ticket SEPARADO del corte) ----
  function valeText(tipo: "Entrada" | "Salida", m: SalidaCaja) {
    return [
      "            AURORA",
      tipo === "Entrada" ? "     ENTRADA DE EFECTIVO" : "      SALIDA DE EFECTIVO",
      "       " + fecha + (m.hora ? "   " + m.hora : ""),
      "=".repeat(W),
      "CONCEPTO:",
      "  " + (m.concepto || "(sin concepto)"),
      linea,
      fila("MONTO", money(m.monto || 0)),
      "=".repeat(W),
      "",
      tipo === "Entrada" ? "Entrega: ____________________" : "Autoriza: ___________________",
      "",
      "Recibe:  ____________________",
      "",
      "   Aurora · Movimiento de caja",
      ...(nombreCaja ? [centra(nombreCaja.toUpperCase())] : []),
    ].join("\n");
  }
  function printVale(tipo: "Entrada" | "Salida", m: SalidaCaja) {
    setVale(valeText(tipo, m));
    setTimeout(() => window.print(), 80);
  }
  // ---- Ticket SOLO de movimientos: todas las entradas y salidas del día ----
  function movsText() {
    return [
      "            AURORA",
      "   MOVIMIENTOS DE EFECTIVO",
      "          " + fecha,
      "=".repeat(W),
      "SALIDAS (efectivo que salió)",
      ...(salidas.length ? salidas.map((s) => fila("  " + (s.tipo === "traspaso" ? "[T] " : "") + (s.concepto || "-").slice(0, 16), money(s.monto))) : ["  (ninguna)"]),
      fila("  Gastos", money(totalGastos)),
      fila("  Traspasos", money(totalTraspasos)),
      fila("  Total salidas", money(totalSalidas)),
      linea,
      "ENTRADAS (efectivo que entró)",
      ...(entradas.length ? entradas.map((s) => fila("  " + (s.concepto || "-").slice(0, 18), money(s.monto))) : ["  (ninguna)"]),
      fila("  Total entradas", money(totalEntradas)),
      "=".repeat(W),
      fila("NETO", money(totalEntradas - totalSalidas)),
      "  (entradas - salidas)",
      "",
      "  Aurora · Movimientos de caja",
      ...(nombreCaja ? [centra(nombreCaja.toUpperCase())] : []),
    ].join("\n");
  }
  function printMovs() {
    setVale(movsText());
    setTimeout(() => window.print(), 80);
  }

  const card = "rounded-2xl bg-white p-4 shadow-sm";
  const inpNum = "pf-input w-full px-3 py-2.5 text-right text-base font-bold tabular-nums";

  return (
    <div className="font-display min-h-screen bg-[#fff8f2] pb-16">
      <style>{`@media print { body { background:#fff !important; } .no-print { display:none !important; } .ticket { display:block !important; } }`}</style>

      <div className="no-print">
        {/* Encabezado */}
        <div className="bg-gradient-to-br from-[#7c2d12] to-[#c2410c] px-4 pt-6 pb-5 text-white">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/aurora.png" alt="Aurora" className="h-9 w-auto" />
              <div>
                <h1 className="text-xl font-bold leading-tight">Corte de caja</h1>
                <p className="text-[12px] text-white/70">Arqueo · salidas · cuadre</p>
              </div>
            </div>
            <button onClick={() => logoutCajaAction().then(() => router.refresh())} className="text-[13px] font-bold text-white/70 hover:text-white">Salir →</button>
          </div>
        </div>

        <div className="mx-auto max-w-lg space-y-4 px-4">
          <div className="mt-4 flex items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <label className="text-sm font-semibold text-[#7c2d12]">Día<br />
              <input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); load(e.target.value); }} className="pf-input mt-1 px-3 py-2 font-normal" />
            </label>
            {(data?.cajas?.length ?? 0) > 1 && (
              <label className="text-sm font-semibold text-[#7c2d12]">Caja<br />
                <select value={caja || ""} onChange={(e) => { const c = parseInt(e.target.value); setCaja(c); load(fecha, c); }}
                  className="pf-input mt-1 px-3 py-2 font-normal">
                  {data!.cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            )}
            {loading && <span className="pb-2 text-sm text-[#c2410c]">Cargando…</span>}
            <button disabled={loading} onClick={() => { setVale(null); setTimeout(() => window.print(), 60); }} className="ml-auto rounded-xl bg-[#7c2d12] px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-[#9a3412] disabled:opacity-40">🖨️ Ticket corte</button>
          </div>

          {err && <p className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-600">{err}</p>}

          {!loading && data && (
            <>
              {/* ARQUEO DE CAJA — fondo/cambio, SIN las ventas */}
              <div className={card}>
                <h2 className="text-[15px] font-bold text-[#7c2d12]">💼 Arqueo de caja</h2>
                <p className="mb-3 text-[12px] text-stone-400">El efectivo de cambio (fondo) con que abrió y cerró la caja. Esto <b>NO</b> incluye las ventas.</p>

                <p className="text-[13px] font-bold text-[#7c2d12]">🔓 ¿Con cuánto INICIÓ?</p>
                <div className="my-2 flex items-center gap-2 rounded-xl bg-orange-50/70 p-2.5">
                  <span className="text-[13px] font-semibold text-[#7c2d12]">Cantidad fija:</span>
                  <input inputMode="decimal" value={conteo.fondoFijo || ""} onChange={(e) => setConteo({ ...conteo, fondoFijo: parseFloat(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                    placeholder="0" className="pf-input w-24 px-2 py-1.5 text-right" />
                </div>
                {conteo.fondoFijo > 0 ? (
                  <p className="text-[12px] text-stone-400">Usando cantidad fija. Borra el campo para contar por denominación.</p>
                ) : (
                  <DenomCounter value={conteo.apertura} onChange={(v) => setConteo({ ...conteo, apertura: v })} />
                )}
                <div className="mt-2 flex justify-between border-t border-stone-100 pt-2 text-[#7c2d12]">
                  <span className="font-bold">Inició con</span><span className="text-lg font-bold tabular-nums">{money(fondo)}</span>
                </div>

                <p className="mt-5 text-[13px] font-bold text-[#7c2d12]">🔒 ¿Con cuánto TERMINÓ? (solo el fondo, sin las ventas)</p>
                <p className="mb-2 text-[12px] text-stone-400">Cuenta los billetes y monedas de cambio que quedaron:</p>
                <DenomCounter value={conteo.cierre} onChange={(v) => setConteo({ ...conteo, cierre: v })} />
                <div className="mt-2 flex justify-between border-t border-stone-100 pt-2 text-[#7c2d12]">
                  <span className="font-bold">Terminó con</span><span className="text-lg font-bold tabular-nums">{money(efeContado)}</span>
                </div>

                {(fondo > 0 || efeContado > 0) && (
                  <div className={`mt-3 rounded-xl px-3 py-2 text-center text-[13px] font-semibold ${Math.abs(efeContado - fondo) < 1 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                    {Math.abs(efeContado - fondo) < 1
                      ? "✅ El fondo cuadra (inició y terminó igual)."
                      : `⚠️ El fondo cambió ${money(Math.abs(efeContado - fondo))} (${efeContado > fondo ? "de más" : "de menos"}).`}
                  </div>
                )}
              </div>

              {/* VENTAS DEL DÍA — esto debe cuadrar con Odoo */}
              <div className={card}>
                <h2 className="text-[15px] font-bold text-[#7c2d12]">🧾 Ventas del día</h2>
                <p className="mb-3 text-[12px] text-stone-400">Lo que cobraron de ventas. Debe coincidir con lo que registró Odoo.</p>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[#fff8f2] p-3 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">💵 Efectivo (Odoo)</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-[#7c2d12]">{money(efeOdoo)}</p>
                  </div>
                  <div className="rounded-xl bg-[#fff8f2] p-3 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">💳 Tarjeta (Odoo)</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-[#7c2d12]">{money(tarOdoo)}</p>
                  </div>
                  <div className="rounded-xl bg-[#fff8f2] p-3 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">🏦 Transf. (Odoo)</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-[#7c2d12]">{money(trfOdoo)}</p>
                  </div>
                </div>

                <label className="mt-4 block text-[13px] font-semibold text-[#7c2d12]">💵 Efectivo de ventas recibido</label>
                <p className="mb-1 text-[12px] text-stone-400">El efectivo que entró por ventas (sin el fondo).</p>
                <input inputMode="decimal" value={conteo.efectivoRecibido || ""} onChange={(e) => setConteo({ ...conteo, efectivoRecibido: parseFloat(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                  placeholder="0" className={inpNum} />

                <label className="mt-4 block text-[13px] font-semibold text-[#7c2d12]">💳 Terminales (tarjeta real)</label>
                <p className="mb-2 text-[12px] text-stone-400">Pon cada terminal que usaron (1 a 3) con su total.</p>
                <div className="space-y-2">
                  {terminales.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={t.nombre} onChange={(e) => updTerminal(i, { nombre: e.target.value })} placeholder={`Terminal ${i + 1} (nombre/banco)`}
                        className="pf-input flex-1 px-3 py-2 text-sm" />
                      <input inputMode="decimal" value={t.monto || ""} onChange={(e) => updTerminal(i, { monto: parseFloat(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                        placeholder="$" className="pf-input w-28 px-2 py-2 text-right text-sm tabular-nums" />
                      {terminales.length > 1 && <button onClick={() => delTerminal(i)} className="px-1 text-red-400 hover:text-red-600">✕</button>}
                    </div>
                  ))}
                </div>
                {terminales.length < 3 && (
                  <button onClick={addTerminal} className="mt-2 rounded-lg border border-aurora/40 px-3 py-1.5 text-[13px] font-bold text-aurora hover:bg-aurora/5">+ Agregar terminal</button>
                )}
                <div className="mt-2 flex justify-between border-t border-stone-100 pt-2 text-[#7c2d12]">
                  <span className="font-bold">Total terminal</span><span className="text-lg font-bold tabular-nums">{money(terminal)}</span>
                </div>

                <label className="mt-4 block text-[13px] font-semibold text-[#7c2d12]">🏦 Transferencias recibidas</label>
                <p className="mb-1 text-[12px] text-stone-400">Suma de las transferencias que cobraron (Odoo registró <b>{money(trfOdoo)}</b>).</p>
                <input inputMode="decimal" value={conteo.transferenciaRecibida || ""} onChange={(e) => setConteo({ ...conteo, transferenciaRecibida: parseFloat(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                  placeholder="0" className={inpNum} />
                {(trfOdoo > 0 || trfRecibido > 0) && (
                  <p className={"mt-1 text-[12px] font-semibold " + (Math.abs(difTrf) < 1 ? "text-emerald-600" : "text-red-500")}>
                    {Math.abs(difTrf) < 1 ? "✅ Cuadra con Odoo" : `${difTrf >= 0 ? "Sobran " : "Faltan "}${money(Math.abs(difTrf))} vs Odoo`}
                  </p>
                )}
              </div>

              {/* Entradas y salidas de efectivo — movimientos de caja, cada uno con su vale */}
              <div className={card}>
                <h2 className="text-[15px] font-bold text-[#7c2d12]">💵 Entradas y salidas de efectivo</h2>
                <p className="mb-3 text-[12px] text-stone-400">Dinero que <b>salió</b> o <b>entró</b> de la caja aparte de las ventas. El botón 🖨️ imprime el <b>vale de ese movimiento</b> (ticket aparte del corte).</p>

                {/* SALIDAS */}
                <p className="text-[13px] font-bold text-[#7c2d12]">Salidas (efectivo que salió del cajón)</p>
                <p className="mb-1 text-[11px] text-stone-500">🔴 <b>Gasto</b>: el dinero se fue (agua, envío, almuerzo). 🔵 <b>Traspaso</b>: se lo llevaron pero sigue siendo de la tienda (entregado a Iván). Los dos bajan el efectivo del cajón, pero el traspaso <b>no</b> cuenta como gasto en el corte.</p>
                <div className="mt-2 space-y-2">
                  {salidas.map((s, i) => {
                    const tras = s.tipo === "traspaso";
                    return (
                    <div key={i} className={"rounded-xl border-2 p-2 " + (tras ? "border-orange-300 bg-orange-50" : "border-orange-200 bg-orange-50/60")}>
                      <div className="mb-2 flex gap-1">
                        <button onClick={() => updSalida(i, { tipo: "gasto" })}
                          className={"flex-1 rounded-lg px-2 py-1.5 text-[12px] font-bold transition " + (!tras ? "bg-[#c2410c] text-white shadow" : "bg-white text-stone-500 hover:bg-orange-100")}>
                          🔴 Gasto
                        </button>
                        <button onClick={() => updSalida(i, { tipo: "traspaso" })}
                          className={"flex-1 rounded-lg px-2 py-1.5 text-[12px] font-bold transition " + (tras ? "bg-orange-600 text-white shadow" : "bg-white text-stone-500 hover:bg-orange-100")}>
                          🔵 Traspaso
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input value={s.concepto} onChange={(e) => updSalida(i, { concepto: e.target.value })}
                          placeholder={tras ? "¿A quién se entregó? (ej. Iván)" : "Concepto (ej. pago proveedor, agua…)"}
                          className="pf-input flex-1 px-3 py-2 text-sm" />
                        <input inputMode="decimal" value={s.monto || ""} onChange={(e) => updSalida(i, { monto: parseFloat(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                          placeholder="$" className={"pf-input w-24 px-2 py-2 text-right text-sm font-bold tabular-nums " + (tras ? "text-orange-700" : "text-[#c2410c]")} />
                        <button onClick={() => printVale("Salida", s)} title="Imprimir vale de este movimiento" className="rounded-lg bg-[#7c2d12] px-2 py-2 text-sm text-white hover:bg-[#9a3412]">🖨️</button>
                        <button onClick={() => delSalida(i)} className="px-1 text-red-400 hover:text-red-600">✕</button>
                      </div>
                    </div>
                    );
                  })}
                  {salidas.length === 0 && <p className="text-[12px] text-stone-400">Sin salidas registradas.</p>}
                </div>
                <button onClick={addSalida} className="mt-2 rounded-lg border border-aurora/40 px-3 py-1.5 text-[13px] font-bold text-aurora hover:bg-aurora/5">+ Agregar salida</button>
                <div className="mt-2 space-y-1 border-t border-stone-100 pt-2 text-[#7c2d12]">
                  <div className="flex justify-between text-[13px]"><span>🔴 Gastos</span><span className="font-bold tabular-nums text-[#c2410c]">{money(totalGastos)}</span></div>
                  <div className="flex justify-between text-[13px]"><span>🔵 Traspasos</span><span className="font-bold tabular-nums text-orange-700">{money(totalTraspasos)}</span></div>
                  <div className="flex justify-between border-t border-stone-100 pt-1"><span className="font-bold">Total salidas</span><span className="text-lg font-bold tabular-nums">{money(totalSalidas)}</span></div>
                </div>

                {/* ENTRADAS */}
                <p className="mt-5 text-[13px] font-bold text-emerald-700">🟢 Entradas (efectivo que entró)</p>
                <div className="mt-2 space-y-2">
                  {entradas.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={s.concepto} onChange={(e) => updEntrada(i, { concepto: e.target.value })} placeholder="Concepto (ej. cambio, depósito del dueño…)"
                        className="pf-input flex-1 px-3 py-2 text-sm" />
                      <input inputMode="decimal" value={s.monto || ""} onChange={(e) => updEntrada(i, { monto: parseFloat(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                        placeholder="$" className="pf-input w-24 px-2 py-2 text-right text-sm tabular-nums" />
                      <button onClick={() => printVale("Entrada", s)} title="Imprimir vale de esta entrada" className="rounded-lg bg-emerald-600 px-2 py-2 text-sm text-white hover:bg-emerald-700">🖨️</button>
                      <button onClick={() => delEntrada(i)} className="px-1 text-red-400 hover:text-red-600">✕</button>
                    </div>
                  ))}
                  {entradas.length === 0 && <p className="text-[12px] text-stone-400">Sin entradas registradas.</p>}
                </div>
                <button onClick={addEntrada} className="mt-2 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-[13px] font-bold text-emerald-700 hover:bg-emerald-50">+ Agregar entrada</button>
                <div className="mt-2 flex justify-between border-t border-stone-100 pt-2 text-[#7c2d12]">
                  <span className="font-bold">Total entradas</span><span className="text-lg font-bold tabular-nums text-emerald-700">{money(totalEntradas)}</span>
                </div>

                <button onClick={printMovs} className="mt-4 w-full rounded-xl bg-[#7c2d12] px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-[#9a3412]">🖨️ Imprimir movimientos</button>
                <p className="mt-1 text-center text-[11px] text-stone-400">Imprime solo entradas y salidas (aparte del corte).</p>
              </div>

              {/* Envíos que cobra la caja: recolección en tienda y contra entrega (15-oct-2026) */}
              <div className={card}>
                <h2 className="text-[15px] font-bold text-[#7c2d12]">📦 Envíos por cobrar en caja</h2>
                <p className="mb-3 text-[12px] text-stone-400">
                  Pedidos de <b>recolección en tienda</b> y <b>contra entrega</b>: el cliente paga aquí, en el mostrador.
                  Márcalo en cuanto recibas el dinero. Se arrastran los de días anteriores hasta que se cobren.
                </p>
                {envErr && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600">{envErr}</p>}

                <div className="space-y-2">
                  {envVisibles.map((l) => (
                    <div key={l.id} className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-[#7c2d12]">{l.name} · {l.cliente}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-amber-700">
                            {tipoEnv(l.tipo)}{l.viejo ? ` · del ${l.fecha}` : ""}
                          </p>
                          {l.pagadoOdoo && (
                            <p className="mt-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold leading-snug text-orange-700 ring-1 ring-orange-200">
                              ⚠️ La vendedora ya le puso <b>PAGADO</b> en Odoo. Pregunta antes de cobrarlo: puede que ya lo hayan pagado.
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-base font-bold tabular-nums text-[#7c2d12]">{money(l.total)}</span>
                      </div>
                      <button onClick={() => marcarEnvio(l, true)} disabled={cobrando === l.id}
                        className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-emerald-700 disabled:bg-stone-300">
                        {cobrando === l.id ? "Marcando…" : "💵 Ya me pagaron este"}
                      </button>
                    </div>
                  ))}
                  {envVisibles.length === 0 && <p className="text-[12px] text-stone-400">No hay envíos pendientes de cobro. 🎉</p>}
                </div>
                {envViejos.length > 0 && (
                  <button onClick={() => setVerViejos(!verViejos)}
                    className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] font-bold text-stone-500 hover:bg-stone-50">
                    {verViejos ? "Ocultar los de hace más de 15 días" : `+ Ver ${envViejos.length} pendientes de hace más de 15 días (${money(envViejos.reduce((a, e) => a + (e.total || 0), 0))})`}
                  </button>
                )}

                {envCobrados.length > 0 && (
                  <>
                    <p className="mt-4 text-[13px] font-bold text-emerald-700">✅ Cobrados hoy</p>
                    <div className="mt-1.5 space-y-1.5">
                      {envCobrados.map((l) => (
                        <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-bold text-[#7c2d12]">{l.name} · {l.cliente}</p>
                            <p className="text-[11px] text-emerald-700">{tipoEnv(l.tipo)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-[13px] font-bold tabular-nums text-emerald-700">{money(l.total)}</span>
                            <button onClick={() => marcarEnvio(l, false)} disabled={cobrando === l.id}
                              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-bold text-stone-500 hover:bg-stone-50 disabled:text-stone-300">
                              deshacer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {envOtros.length > 0 && (
                  <p className="mt-3 text-[11px] text-stone-400">
                    {envOtros.length} {envOtros.length === 1 ? "pedido ya se cobró" : "pedidos ya se cobraron"} por transferencia o depósito (los marcó Envíos).
                  </p>
                )}

                <div className="mt-3 space-y-1 border-t border-stone-100 pt-2 text-[#7c2d12]">
                  <div className="flex justify-between text-[13px]"><span>Pendientes ({envPend.length})</span><span className="font-bold tabular-nums text-amber-700">{money(totalEnvPend)}</span></div>
                  <div className="flex justify-between border-t border-stone-100 pt-1"><span className="font-bold">Cobrado hoy en caja</span><span className="text-lg font-bold tabular-nums text-emerald-700">{money(totalEnvCobrado)}</span></div>
                </div>
                <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-[11px] leading-snug text-orange-800 ring-1 ring-orange-100">
                  💡 Este dinero <b>no pasa por el punto de venta</b>, así que el cajón va a traer {money(totalEnvCobrado)} de más contra lo que dice Odoo. Es normal: cuéntalo aparte.
                </p>
              </div>

              {/* 3b. Efectivo final del día (recibido − gastos) */}
              <div className="rounded-2xl border-2 border-[#7c2d12] bg-[#7c2d12] p-4 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-bold">💰 Efectivo final</p>
                    <p className="text-[11px] text-white/60">Recibido {money(efeRecibido)} − gastos {money(totalGastos)} − traspasos {money(totalTraspasos)}</p>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{money(efeFinal)}</span>
                </div>
              </div>

              {/* 5. Resultado */}
              {estado ? (
                <div className={`rounded-2xl border-2 p-5 text-center ${colEstado}`}>
                  <p className="text-lg font-bold">{estado.msg}</p>
                  {estado.detalle && <p className="mt-1 text-sm">{estado.detalle}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-left text-[13px]">
                    <p>Efectivo Odoo: <b className="tabular-nums">{money(efeOdoo)}</b></p>
                    <p>Efectivo recibido: <b className="tabular-nums">{money(efeRecibido)}</b></p>
                    <p>Tarjeta Odoo: <b className="tabular-nums">{money(tarOdoo)}</b></p>
                    <p>Terminal: <b className="tabular-nums">{money(terminal)}</b></p>
                    {(trfOdoo > 0 || trfRecibido > 0) && <>
                      <p>Transf. Odoo: <b className="tabular-nums">{money(trfOdoo)}</b></p>
                      <p>Transf. recibida: <b className="tabular-nums">{money(trfRecibido)}</b></p>
                    </>}
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-stone-400">Pon el efectivo recibido y la terminal para ver si cuadra.</p>
              )}

              {/* Notas del corte */}
              <div className={card}>
                <h2 className="mb-1 text-[15px] font-bold text-[#7c2d12]">📝 Notas del corte</h2>
                <p className="mb-2 text-[12px] text-stone-400">Si algo no cuadra, explica por qué (ej. “se cobró un pago con tarjeta pero se marcó como efectivo”).</p>
                <textarea value={conteo.notas || ""} onChange={(e) => setConteo({ ...conteo, notas: e.target.value })}
                  placeholder="Escribe aquí cualquier aclaración del corte…" rows={3}
                  className="pf-input w-full px-3 py-2 text-sm" />
              </div>

              <p className="text-center text-[12px] text-stone-400">Todo se guarda solo. Usa 🖨️ Ticket para imprimir el corte en la térmica. ☁️ Aurora</p>
            </>
          )}
        </div>
      </div>

      {/* Ticket para imprimir (blanco y negro) */}
      <div className="ticket" style={{ display: "none" }}>
        <pre style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "12px", color: "#000", whiteSpace: "pre-wrap", width: "300px", margin: "0 auto", lineHeight: 1.35 }}>{vale !== null ? vale : ticket}</pre>
      </div>
    </div>
  );
}
