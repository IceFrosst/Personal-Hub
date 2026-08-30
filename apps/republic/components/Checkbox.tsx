'use client'

// Fully custom checkbox visual — the real <input type="checkbox"> stays in
// the DOM (fully functional: focusable, keyboard-toggleable, announced to
// screen readers) but is made invisible via opacity, not `display:none` or
// `appearance:none` with nothing to replace it. The box + check mark are
// drawn by a sibling element instead, so this never depends on a browser's
// native checkbox rendering (or accent-color support) at all — the exact bug
// class that made the sworn-statement checkbox on /visa/special invisible.
//
// The input and the visual box are siblings (not parent/child) specifically
// so `peer-focus-visible:` can target the box from the input's real focus
// state — keyboard-only (not mouse-click) focus gets a visible ring, since
// the native input itself is invisible and would otherwise show no focus
// indicator at all.

export function Checkbox({
  id,
  checked,
  onChange,
  label,
  required,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  required?: boolean
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-[11px] uppercase text-navy">
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={required}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-navy bg-paper peer-focus-visible:ring-2 peer-focus-visible:ring-stamp peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-paper"
        >
          {checked && (
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-stamp" aria-hidden>
              <path
                d="M4 10.5 L8 14.5 L16 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </span>
      <span>{label}</span>
    </label>
  )
}
