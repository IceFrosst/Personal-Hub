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
        bg: 'var(--mauve-1)',
        surface: 'var(--mauve-3)',
        'surface-elevated': 'var(--mauve-4)',
        border: 'var(--mauve-6)',
        'border-focus': 'var(--mauve-8)',
        'text-low': 'var(--mauve-9)',
        'text-muted': 'var(--mauve-11)',
        text: 'var(--mauve-12)',
        coral: 'var(--red-9)',
        teal: 'var(--teal-9)',
        purple: 'var(--purple-9)',
        amber: 'var(--amber-9)',
        blue: 'var(--blue-9)',
        pink: 'var(--pink-9)',
        green: 'var(--green-9)',
        gray: 'var(--mauve-7)',
      },
    },
  },
  plugins: [],
}

export default config
