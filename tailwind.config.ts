import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Geist",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        display: [
          "Geist",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "ui-monospace",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        obsidian: {
          950: "#060709",
          900: "#0b0d11",
          850: "#101217",
          800: "#15181f",
          750: "#1b1f28",
          700: "#222733",
          600: "#2e3545",
          500: "#414a5f",
        },
        graphite: {
          950: "#08090b",
          900: "#0d0f13",
          850: "#12151b",
          800: "#181c24",
          700: "#242a36",
          600: "#363e4f",
        },
        niyantra: {
          emerald: "#10b981",
          green: "#059669",
          forest: "#0e382b",
          dark: "#082119",
          mint: "#34d399",
          glow: "rgba(16, 185, 129, 0.25)",
        },
        canvas: {
          DEFAULT: "#0b0d11",
          subtle: "#101217",
          light: "#f7f8f5",
        },
        surface: {
          DEFAULT: "#12151b",
          subtle: "#181c24",
          light: "#ffffff",
        },
        status: {
          allow: "#10b981",
          allowBg: "rgba(16, 185, 129, 0.12)",
          allowBorder: "rgba(16, 185, 129, 0.35)",
          block: "#f43f5e",
          blockBg: "rgba(244, 63, 94, 0.12)",
          blockBorder: "rgba(244, 63, 94, 0.35)",
          approval: "#f59e0b",
          approvalBg: "rgba(245, 158, 11, 0.12)",
          approvalBorder: "rgba(245, 158, 11, 0.35)",
        },
      },
      boxShadow: {
        soft: "0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px -1px rgba(0, 0, 0, 0.15)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.4)",
        elevated: "0 8px 30px -4px rgba(0, 0, 0, 0.6)",
        "emerald-glow": "0 0 25px -4px rgba(16, 185, 129, 0.35)",
        "emerald-touch": "0 0 45px 5px rgba(16, 185, 129, 0.45)",
      },
      backgroundImage: {
        "cinematic-gradient":
          "radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.08), transparent 70%)",
        "grid-subtle":
          "linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
