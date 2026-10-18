import Link from "next/link";

// Barra de la demo: el catálogo es público y las fichas de ventas piden contraseña.
export default function DemoNav() {
  const item = "rounded-full px-3 py-1 transition hover:bg-white/15";
  return (
    <nav
      aria-label="Pantallas de la demo"
      className="fixed bottom-3 left-1/2 z-[60] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full bg-[#1c1717]/95 px-2 py-1.5 text-xs text-white shadow-lg backdrop-blur print:hidden"
    >
      <span className="px-2 text-white/60">Demo</span>
      <Link href="/" className={item}>Catálogo</Link>
      <Link href="/ventas" className={item}>Fichas de ventas</Link>
      <span className="hidden px-2 text-white/60 sm:inline">fichas: contraseña demo</span>
    </nav>
  );
}
