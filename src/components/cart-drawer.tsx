"use client";
import { useCart, type CartItem } from "./cart-context";
import { SITE, waLink } from "@/lib/config";

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");

export default function CartDrawer({ open, onClose, stock }: { open: boolean; onClose: () => void; stock?: Map<string, number> }) {
  const { items, count, setQty, remove, clear } = useCart();
  // Disponible por SKU; si no hay mapa, se asume disponible.
  const disp = (sku: string) => (stock ? (stock.get(sku) ?? 0) : Infinity);
  const efPub = (i: CartItem) => i.liq ?? i.price;                 // lo que paga el público
  const efMem = (i: CartItem) => i.liq ?? i.mem ?? i.price;        // lo que pagaría un miembro
  const totalPublico = items.reduce((s, i) => s + efPub(i) * i.qty, 0);
  const totalMiembro = items.reduce((s, i) => s + efMem(i) * i.qty, 0);
  const hayMiembro = items.some((i) => i.mem != null && i.liq == null);
  const ahorro = totalPublico - totalMiembro;

  function pedirWhatsApp() {
    const dispo = items.filter((i) => disp(i.sku) > 0);
    if (!dispo.length) { alert("Los productos de tu lista ya no están disponibles."); return; }
    const tp = dispo.reduce((s, i) => s + efPub(i) * i.qty, 0);
    const tm = dispo.reduce((s, i) => s + efMem(i) * i.qty, 0);
    const hm = dispo.some((i) => i.mem != null && i.liq == null);
    const lineas = dispo
      .map((i) =>
        i.liq != null
          ? `• ${i.qty}x ${i.name} (${i.sku}) — 🔥 Liquidación ${money(i.liq)} c/u`
          : `• ${i.qty}x ${i.name} (${i.sku}) — ${money(i.price)}${i.mem != null ? ` (miembros ${money(i.mem)})` : ""} c/u`
      )
      .join("\n");
    const msg = `¡Hola Aurora! 🛏️ Quiero hacer este pedido:\n\n${lineas}\n\nTotal público: ${money(tp)}${hm ? `\n💙 Total miembros: ${money(tm)}` : ""}\n\n(Si soy miembro, aplícame mi precio de miembro.)`;
    if (!SITE.whatsapp) {
      alert("Falta configurar el número de WhatsApp de la tienda.");
      return;
    }
    window.open(waLink(msg), "_blank");
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold text-aurora-dark">Mi lista ({count})</h2>
          <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="mt-10 text-center text-gray-400">Tu lista está vacía.<br />Agrega productos y pídelos por WhatsApp.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={i.sku} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{i.name}</p>
                    {i.liq != null ? (
                      <p className="text-[11px] text-gray-400">
                        {i.sku} · <span className="line-through">{money(i.price)}</span>{" "}
                        <span className="font-bold text-red-600">🔥 {money(i.liq)}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400">
                        {i.sku} · {money(i.price)}
                        {i.mem != null && <> · <span className="font-bold text-aurora">💙 {money(i.mem)}</span></>}
                      </p>
                    )}
                    {disp(i.sku) <= 0 ? (
                      <span className="mt-0.5 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">🚫 Ya no disponible</span>
                    ) : disp(i.sku) < i.qty ? (
                      <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Solo quedan {disp(i.sku)}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(i.sku, i.qty - 1)} className="h-7 w-7 rounded-lg bg-gray-100 font-bold">−</button>
                    <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                    <button onClick={() => setQty(i.sku, i.qty + 1)} className="h-7 w-7 rounded-lg bg-gray-100 font-bold">+</button>
                  </div>
                  <button onClick={() => remove(i.sku)} className="text-gray-300 hover:text-red-500" aria-label="Quitar">🗑</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-4">
            <div className={"flex items-center justify-between text-sm " + (hayMiembro ? "mb-0.5" : "mb-2")}>
              <span className="text-gray-500">Total público</span>
              <span className={hayMiembro ? "font-bold text-gray-500" : "text-xl font-extrabold text-aurora-dark"}>{money(totalPublico)}</span>
            </div>
            {hayMiembro && (
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold text-aurora">💙 Total miembros</span>
                <span className="text-2xl font-extrabold text-aurora">{money(totalMiembro)}</span>
              </div>
            )}
            {hayMiembro && ahorro > 0 && (
              <p className="mb-2 rounded-lg bg-green-50 px-3 py-1.5 text-center text-[12px] font-bold text-green-600">
                🎉 Como miembro ahorras {money(ahorro)}
              </p>
            )}
            <p className="mb-3 rounded-lg bg-aurora-light px-3 py-2 text-[11px] leading-snug text-aurora-dark">
              💙 {SITE.memberNote}
            </p>
            <button
              onClick={pedirWhatsApp}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 font-bold text-white transition hover:bg-green-600"
            >
              <span>Pedir por WhatsApp</span>
            </button>
            <button onClick={clear} className="mt-2 w-full text-center text-xs text-gray-400 hover:text-red-500">
              Vaciar lista
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
