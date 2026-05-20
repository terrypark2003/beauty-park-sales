import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f7f3ec",
          100: "#ece3d2",
          200: "#dccab0",
          300: "#c4ad8c",
          400: "#a99173",
          500: "#8a7e69",
          600: "#6f6555",
          700: "#524a3d",
          800: "#3a342a",
          900: "#2b261f",
        },
        gold: {
          DEFAULT: "#c9a96e",
          light: "#d8bd87",
          dark: "#a8884f",
        },
        cream: {
          DEFAULT: "#faf6f0",
          dark: "#f0e8d6",
        },
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Cormorant Garamond", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
