/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        neon: {
          bg: "#0B0B0C",
          panel: "#111113",
          crimson: "#DC2626",
          ruby: "#991B1B",
          glow: "#E60000",
        },
      },
      boxShadow: {
        crimson: "0 0 20px rgba(220, 38, 38, 0.4)",
        "crimson-lg": "0 0 40px rgba(220, 38, 38, 0.5)",
        "crimson-sm": "0 0 12px rgba(220, 38, 38, 0.3)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        ticker: "ticker 40s linear infinite",
        ripple: "ripple 0.6s ease-out forwards",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(220, 38, 38, 0.4)" },
          "50%": { boxShadow: "0 0 35px rgba(220, 38, 38, 0.7)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        ripple: {
          "0%": { transform: "translate(-50%, -50%) scale(1)", opacity: "0.6" },
          "100%": { transform: "translate(-50%, -50%) scale(20)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
