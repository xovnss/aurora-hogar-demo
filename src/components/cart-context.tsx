"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Product } from "@/lib/types";

export type CartItem = { sku: string; name: string; price: number; qty: number; liq: number | null; mem: number | null };
type Cart = Record<string, CartItem>;

type Ctx = {
  items: CartItem[];
  count: number;
  add: (p: Product) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "aurora-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(cart));
  }, [cart, loaded]);

  const add = useCallback((p: Product) => {
    setCart((c) => {
      const ex = c[p.sku];
      return { ...c, [p.sku]: { sku: p.sku, name: p.name, price: p.precioPublico, qty: (ex?.qty || 0) + 1, liq: p.precioLiquidacion ?? null, mem: p.precioMiembro ?? null } };
    });
  }, []);
  const setQty = useCallback((sku: string, qty: number) => {
    setCart((c) => {
      if (qty <= 0) { const n = { ...c }; delete n[sku]; return n; }
      return c[sku] ? { ...c, [sku]: { ...c[sku], qty } } : c;
    });
  }, []);
  const remove = useCallback((sku: string) => setCart((c) => { const n = { ...c }; delete n[sku]; return n; }), []);
  const clear = useCallback(() => setCart({}), []);

  const items = Object.values(cart);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, count, add, setQty, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart fuera de CartProvider");
  return c;
}
