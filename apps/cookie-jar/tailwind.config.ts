import type { Config } from 'tailwindcss'

// Canonical portfolio palette (root CLAUDE.md): mauve neutral base + coral accent.
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#161618', // mauve-1
        surface: '#232326', // mauve-3
        'surface-elevated': '#28282c', // mauve-4
        border: '#3a3a3f', // mauve-6
        'border-focus': '#504f57', // mauve-8
        'text-low': '#7e7d86', // mauve-9
        'text-muted': '#a09fa6', // mauve-11
        text: '#ededef', // mauve-12
        coral: '#e5484d', // red-9
        'coral-bright': '#ec5d5e', // red-10
        'coral-deep': '#aa2429', // red-7-ish, for gradients
      },
    },
  },
  plugins: [],
}

export default config
