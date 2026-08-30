import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#f4f0e8',
        'paper-dark': '#e8e2d4',
        navy: '#1a2a4a',
        'navy-light': '#2c4370',
        stamp: '#c0392b',
        approve: '#2e7d32',
      },
      fontFamily: {
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
        stamp: ['var(--font-special-elite)', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'stamp-slam': {
          '0%': { transform: 'scale(3.2) rotate(-14deg)', opacity: '0' },
          '55%': { transform: 'scale(0.92) rotate(-8deg)', opacity: '1' },
          '75%': { transform: 'scale(1.06) rotate(-9deg)' },
          '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' },
        },
        'screen-shake': {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(-6px, 3px)' },
          '40%': { transform: 'translate(5px, -4px)' },
          '60%': { transform: 'translate(-4px, -2px)' },
          '80%': { transform: 'translate(6px, 2px)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'paper-slide-in': {
          '0%': { opacity: '0', transform: 'translateY(18px) rotate(-0.6deg)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(0deg)' },
        },
        blink: {
          '0%, 45%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'bribe-bob': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-6px) rotate(-4deg)' },
        },
        'bribe-glow': {
          '0%, 100%': { boxShadow: '0 0 6px 1px rgba(255, 200, 0, 0.35)' },
          '50%': { boxShadow: '0 0 14px 4px rgba(255, 200, 0, 0.7)' },
        },
        'field-fill': {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'bribe-shimmer': {
          '0%': { backgroundPosition: '160% 50%' },
          '100%': { backgroundPosition: '-60% 50%' },
        },
      },
      animation: {
        'stamp-slam': 'stamp-slam 0.5s cubic-bezier(.2,1.4,.4,1) forwards',
        'screen-shake': 'screen-shake 0.45s cubic-bezier(.36,.07,.19,.97) both',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'paper-slide-in': 'paper-slide-in 0.35s ease-out forwards',
        blink: 'blink 1s step-start infinite',
        'bribe-peek': 'bribe-bob 3.4s ease-in-out infinite, bribe-glow 2.1s ease-in-out infinite',
        'field-fill': 'field-fill 0.45s ease-out',
        'bribe-shimmer': 'bribe-shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
