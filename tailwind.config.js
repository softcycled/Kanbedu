/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
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
        // All tokens use CSS variables so light/dark flip happens in one place (globals.css).
        // Space-separated RGB values enable Tailwind alpha modifiers: bg-ink/80, border/50, etc.
        paper:        "rgb(var(--c-paper)      / <alpha-value>)",
        ink:          "rgb(var(--c-ink)        / <alpha-value>)",
        muted:        "rgb(var(--c-muted)      / <alpha-value>)",
        accent:       "rgb(var(--c-accent)     / <alpha-value>)",
        "accent-light":"rgb(var(--c-accent-lt) / <alpha-value>)",
        "column-bg":  "rgb(var(--c-column-bg) / <alpha-value>)",
        "card-bg":    "rgb(var(--c-card-bg)   / <alpha-value>)",
        border:       "rgb(var(--c-border)    / <alpha-value>)",
        "todo-dot":   "rgb(var(--c-todo-dot)  / <alpha-value>)",
        "doing-dot":  "rgb(var(--c-doing-dot) / <alpha-value>)",
        "done-dot":   "rgb(var(--c-done-dot)  / <alpha-value>)",
      },
      boxShadow: {
        card:       "var(--shadow-card)",
        "card-hover":"var(--shadow-card-hover)",
        modal:      "var(--shadow-modal)",
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
  plugins: [
    require("@tailwindcss/typography"),
  ],
};
