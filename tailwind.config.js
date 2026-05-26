/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // surfaces (Radix mauve dark scale)
        bg: "var(--mauve-1)",
        surface: "var(--mauve-3)",
        "surface-elevated": "var(--mauve-4)",
        border: "var(--mauve-6)",
        "border-focus": "var(--mauve-8)",
        "text-low": "var(--mauve-9)",
        "text-muted": "var(--mauve-11)",
        text: "var(--mauve-12)",
        // accents — each maps to a Radix scale at step 9
        coral: "var(--red-9)",
        teal: "var(--teal-9)",
        purple: "var(--purple-9)",
        amber: "var(--amber-9)",
        blue: "var(--blue-9)",
        pink: "var(--pink-9)",
        green: "var(--green-9)",
        gray: "var(--mauve-7)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Inter",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
