import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primär-Akzent: Türkis (Neon)
        brand: {
          DEFAULT: "#22e0ff",
          dark: "#0eb8d6",
          light: "#8bf3ff",
        },
        // Neutraler, fast schwarzer Untergrund – lässt die Neon-Akzente leuchten
        surface: {
          DEFAULT: "#05070a",
          card: "#0e141b",
          border: "#1c2833",
        },
        // Erlaubte Neon-Palette als semantische Tokens
        neon: {
          teal: "#22e0ff",
          red: "#ff2d55",
          green: "#39ff88",
          yellow: "#f2ff1a",
          blue: "#4f8bff",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
