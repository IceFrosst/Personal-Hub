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
          // Rests at a hair off-axis instead of exactly 0deg — real stacked
          // paperwork is never perfectly aligned; imperceptible individually,
          // adds up to a subtly less "digital" feel across every screen.
          '100%': { opacity: '1', transform: 'translateY(0) rotate(-0.35deg)' },
        },
        blink: {
          '0%, 45%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        // The peeking cash pile's quiet bob (components/HiddenBribe.tsx) —
        // deliberately subtle: the pile is meant to be SPOTTED, not advertised
        // (the old golden glow + shimmer sweep were removed for that reason).
        'bribe-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'field-fill': {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'stamp-slam': 'stamp-slam 0.5s cubic-bezier(.2,1.4,.4,1) forwards',
        'screen-shake': 'screen-shake 0.45s cubic-bezier(.36,.07,.19,.97) both',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'paper-slide-in': 'paper-slide-in 0.35s ease-out forwards',
        blink: 'blink 1s step-start infinite',
        'bribe-peek': 'bribe-bob 3.4s ease-in-out infinite',
        'field-fill': 'field-fill 0.45s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
