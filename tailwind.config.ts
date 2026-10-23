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
      colors: {
        obsidian: {
          950: "#06090f",
          900: "#0b101b",
          850: "#0f1624",
          800: "#151f33",
          700: "#1e2c47",
          600: "#2d3f63",
        },
        cyan: {
          glow: "#00f0ff",
          DEFAULT: "#00d2eb",
          dim: "#0284c7",
        },
        violet: {
          glow: "#a855f7",
          DEFAULT: "#8b5cf6",
          dark: "#6d28d9",
        },
        status: {
          allow: "#10b981",
          block: "#ef4444",
          approval: "#f59e0b",
          info: "#38bdf8",
        },
      },
      boxShadow: {
        "cyan-glow": "0 0 20px -5px rgba(0, 240, 255, 0.25)",
        "violet-glow": "0 0 20px -5px rgba(168, 85, 247, 0.25)",
        "card-glow": "0 0 0 1px rgba(255, 255, 255, 0.05), 0 4px 20px -2px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
