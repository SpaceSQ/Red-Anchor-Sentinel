import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        anchor: "#ef4444",
        safe: "#22c55e",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        sans: [
          "PingFang SC",
          "Noto Sans SC",
          "Source Han Sans SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      boxShadow: {
        lamp: "0 0 18px rgba(239, 68, 68, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
