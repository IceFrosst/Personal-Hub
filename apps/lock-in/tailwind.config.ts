import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        surface: '#101013',
        'surface-elevated': '#16161b',
        border: '#26262c',
        'border-focus': '#3a3a42',
        'text-low': '#5e5e68',
        'text-muted': '#9b9ba6',
        text: '#ffffff',
        gold: '#ffd700',
        'gold-deep': '#c9a000',
        'priority-low': '#5e5e68',
        'priority-medium': '#ffb224',
        'priority-high': '#e5484d',
        'prio-low': '#ffd23f',
        'prio-medium': '#ff8c42',
        'prio-high': '#ff4d6d',
      },
    },
  },
  plugins: [],
}

export default config
