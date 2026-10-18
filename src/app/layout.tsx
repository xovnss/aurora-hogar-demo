import type { Metadata } from "next";
import { Poppins, Fraunces } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart-context";
import DemoNav from "@/components/demo-nav";
import ChatWidget from "@/components/chat-widget";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-display" });
// Serif elegante para títulos del catálogo (estilo editorial tipo Casper)
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "BAM! — a brand made for you",
  description: "BAM! · Playeras, sudaderas, pantalones, bolsas y lentes. Demo de tienda con chatbot de tallas, existencias por sucursal y envíos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`h-full antialiased ${poppins.variable} ${fraunces.variable}`}>
      <body className="min-h-full pb-16">
        <CartProvider>{children}</CartProvider>
        <ChatWidget />
        <DemoNav />
      </body>
    </html>
  );
}
