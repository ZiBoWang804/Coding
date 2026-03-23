import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6f1",
          100: "#d8eadf",
          200: "#b6d7c1",
          300: "#89bc9d",
          400: "#5f9f7b",
          500: "#3f8462",
          600: "#2f6b50",
          700: "#285540",
          800: "#234436",
          900: "#1f382d"
        },
        sand: "#f6f1e7",
        ink: "#1e2930",
        amberleaf: "#d6a03a"
      },
      fontFamily: {
        sans: ["\"Noto Sans SC\"", "\"Microsoft YaHei UI\"", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        "hero-glow": "radial-gradient(circle at top right, rgba(214,160,58,0.22), transparent 36%), radial-gradient(circle at bottom left, rgba(63,132,98,0.18), transparent 40%)"
      },
      boxShadow: {
        card: "0 18px 40px rgba(31, 56, 45, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
