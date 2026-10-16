import type { Metadata } from "next";
import { Poppins, Fraunces } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart-context";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display" });
// Serif elegante para títulos del catálogo (estilo editorial tipo Casper)
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Aurora — Catálogo",
  description: "Catálogo de Aurora · Tienda de blancos en Pachuca. Sábanas, colchas, cobertores, cortinas, toallas y más.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`h-full antialiased ${poppins.variable} ${fraunces.variable}`}>
      <body className="min-h-full">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
