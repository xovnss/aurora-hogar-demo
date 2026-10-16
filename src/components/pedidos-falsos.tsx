"use client";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";

// Aviso de "prueba social" en la esquina: muestra pedidos recientes (nombres ficticios) para dar movimiento.
const NOMBRES = [
  "Arantza Villanueva", "María González", "Sofía Hernández", "Valentina Torres", "Regina Ramírez",
  "Fernanda Cruz", "Camila Flores", "Renata Morales", "Isabella Reyes", "Daniela Ortiz",
  "Andrea Jiménez", "Paola Vázquez", "Alejandra Ruiz", "Mariana Castro", "Lucía Domínguez",
  "Natalia Guzmán", "Gabriela Mendoza", "Carmen Aguilar", "Rosa Márquez", "Adriana Salazar",
  "Karla Núñez", "Brenda Ríos", "Diana Cabrera", "Ana Sofía León", "Jimena Ponce",
  "Luis Ramírez", "Carlos Sánchez", "José Martínez", "Miguel Ángel Rojas", "Fernando Lara",
];
const CIUDADES = [
  // México (todo el país)
  "CDMX", "Guadalajara", "Monterrey", "Puebla", "Querétaro", "Toluca", "León",
  "Mérida", "Cancún", "Tijuana", "Veracruz", "Oaxaca", "Chihuahua", "Culiacán",
  "San Luis Potosí", "Aguascalientes", "Morelia", "Saltillo", "Villahermosa", "Durango",
];
const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-MX");
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

export default function PedidosFalsos({ products }: { products: Product[] }) {
  const pool = products.filter((p) => p.imageUrl && p.precioPublico > 0);
  const [t, setT] = useState<null | { nombre: string; ciudad: string; prod: Product; min: number }>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!pool.length) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const ciclo = () => {
      if (!alive) return;
      setT({ nombre: pick(NOMBRES), ciudad: pick(CIUDADES), prod: pick(pool), min: 1 + Math.floor(Math.random() * 40) });
      setShow(true);
      timer = setTimeout(() => {
        setShow(false);
        timer = setTimeout(ciclo, 1500 + Math.random() * 2000); // pausa 1.5–3.5 s
      }, 3500); // visible 3.5 s
    };
    timer = setTimeout(ciclo, 3000);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length]);

  if (!t) return null;
  return (
    <div className={`fixed bottom-5 left-5 z-40 w-[430px] max-w-[calc(100vw-2rem)] transition-all duration-500 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-5 opacity-0"}`}>
      <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-gradient-to-br from-[#7c2d12] to-[#c2410c] p-3 text-white shadow-[0_24px_55px_-18px_rgba(80, 45, 14,.8)]">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/15 ring-2 ring-white/25">
          {t.prod.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.prod.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold leading-tight">{t.nombre} <span className="text-[13px] font-normal text-white/70">· {t.ciudad}</span></p>
          <p className="truncate text-[14px] leading-tight text-white/90">pidió <b>{t.prod.name}</b></p>
          <p className="text-[15px] font-extrabold leading-tight">{money(t.prod.precioMiembro ?? t.prod.precioPublico)} <span className="text-[12px] font-normal text-white/70">· hace {t.min} min ✅</span></p>
        </div>
      </div>
    </div>
  );
}
