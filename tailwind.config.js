/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        paper: "#F7F5F0",
        ink: "#1C1917",
        muted: "#78716C",
        accent: "#E8613A",
        "accent-light": "#FDF0EB",
        "column-bg": "#EFEDE8",
        "card-bg": "#FDFCFA",
        border: "#E2DED8",
        "todo-dot": "#94A3B8",
        "doing-dot": "#F59E0B",
        "done-dot": "#4ADE80",
      },
      boxShadow: {
        card: "0 2px 8px rgba(26,24,20,0.06), 0 1px 3px rgba(26,24,20,0.04)",
        "card-hover": "0 8px 24px rgba(26,24,20,0.10), 0 3px 8px rgba(26,24,20,0.06)",
        modal: "0 24px 64px rgba(26,24,20,0.18), 0 8px 24px rgba(26,24,20,0.10)",
      },
      transitionTimingFunction: {
        "smooth-out": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      },
      animation: {
        "modal-in": "modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-up": "slideUp 0.2s cubic-bezier(0.34,1.3,0.64,1)",
      },
      keyframes: {
        modalIn: {
          "0%": { opacity: 0, transform: "scale(0.94) translateY(8px)" },
          "100%": { opacity: 1, transform: "scale(1) translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        slideUp: {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
