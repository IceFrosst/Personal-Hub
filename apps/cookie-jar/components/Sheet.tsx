'use client'

import { useEffect } from 'react'

/** Bottom sheet — dim blurred backdrop, grab handle, rounded top, safe-area padded. */
export default function Sheet({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="cookie-fade-in w-full max-w-[420px] rounded-t-3xl border-t border-border bg-surface-elevated px-4 pt-2.5"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-border" aria-hidden />
        {children}
      </div>
    </div>
  )
}
