import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}",
    "./types/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        coral: "#ff5e4d",
        mint: "#5de2a5",
        saffron: "#f7b234",
        cream: "#fff7ea"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem"
      },
      boxShadow: {
        glow: "0 0 50px rgba(255, 94, 77, 0.35)",
        card: "0 14px 36px rgba(17, 24, 39, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
