import type { Config } from 'tailwindcss'

// Portfolio palette (root CLAUDE.md): mauve dark neutrals, purple accent for
// this app with blue highlights.
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#161618',
        surface: '#232326',
        'surface-elevated': '#28282c',
        border: '#3a3a3f',
        'border-focus': '#504f57',
        'text-low': '#7e7d86',
        'text-muted': '#a09fa6',
        text: '#ededef',
        coral: '#e5484d',
        teal: '#12a594',
        purple: '#8e4ec6',
        amber: '#ffb224',
        blue: '#0090ff',
        pink: '#d6409f',
        green: '#30a46c',
        gray: '#46464d',
      },
    },
  },
  plugins: [],
}

export default config
