import { CREST_ARIA_LABEL } from '@/lib/content'

export function Crest({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={CREST_ARIA_LABEL}>
      <path
        d="M50 4 L92 16 V46 C92 74 74 92 50 98 C26 92 8 74 8 46 V16 Z"
        fill="#f4f0e8"
        stroke="#1a2a4a"
        strokeWidth="3"
      />
      <path
        d="M50 10 L86 20 V46 C86 70 70 86 50 92 C30 86 14 70 14 46 V20 Z"
        fill="none"
        stroke="#1a2a4a"
        strokeWidth="1.5"
      />
      {/* phone */}
      <rect x="30" y="24" width="12" height="20" rx="2" fill="none" stroke="#1a2a4a" strokeWidth="2.5" />
      <circle cx="36" cy="40" r="1.4" fill="#1a2a4a" />
      {/* fork */}
      <g stroke="#1a2a4a" strokeWidth="2.2" strokeLinecap="round">
        <line x1="58" y1="24" x2="58" y2="52" />
        <line x1="54" y1="24" x2="54" y2="34" />
        <line x1="62" y1="24" x2="62" y2="34" />
        <path d="M54 34 Q58 40 62 34" fill="none" />
      </g>
      {/* heart */}
      <path
        d="M50 74 C44 66 34 66 34 58 C34 52 40 50 50 60 C60 50 66 52 66 58 C66 66 56 66 50 74 Z"
        fill="#c0392b"
        opacity="0.85"
      />
    </svg>
  )
}
