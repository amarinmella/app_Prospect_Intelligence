import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Prospect Intelligence", description: "Inteligencia comercial para Innova IA Studio" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
