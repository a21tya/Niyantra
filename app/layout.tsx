import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEGIS — AI Agent Security Guard",
  description: "Deterministic security enforcement layer for AI agents. JU Techfest 2026 CY-03.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-obsidian-950 text-slate-100 antialiased selection:bg-cyan/20 selection:text-cyan-glow">
        {children}
      </body>
    </html>
  );
}
