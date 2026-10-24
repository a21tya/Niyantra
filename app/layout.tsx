import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NIYANTRA — AI Agent Security Platform",
  description:
    "Agent security, enforced at execution. Every proposed tool call is intercepted, validated, and checked against your policies before it can run.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f7f8f5] text-[#111613] antialiased selection:bg-[#e0f6ec] selection:text-[#0e291c]">
        {children}
      </body>
    </html>
  );
}
