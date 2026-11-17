import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F9FC",
        primary: { DEFAULT: "#246B8E", dark: "#1B546F", soft: "#E8F1F6" },
        navy: "#18354A",
        muted: "#5F7587",
        line: "#E3E9EF",
        ok: { DEFAULT: "#1F8A5B", soft: "#E6F4EC" },
        warn: { DEFAULT: "#B7791F", soft: "#FBF1DC" },
        crit: { DEFAULT: "#C0392B", soft: "#FBE9E7" },
        info: { DEFAULT: "#246B8E", soft: "#E8F1F6" },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: { card: "12px" },
      boxShadow: {
        card: "0 1px 2px rgba(24,53,74,0.04), 0 1px 3px rgba(24,53,74,0.04)",
        pop: "0 8px 24px rgba(24,53,74,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
