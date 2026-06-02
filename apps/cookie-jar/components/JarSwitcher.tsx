'use client'

import { IconPlus } from '@tabler/icons-react'
import type { Jar } from '@/lib/types'

export default function JarSwitcher({
  jars,
  activeJarId,
  onSelect,
  onNewJar,
}: {
  jars: Jar[]
  activeJarId: string | null
  onSelect: (id: string) => void
  onNewJar: () => void
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {jars.map((jar) => {
        const active = jar.id === activeJarId
        return (
          <button
            key={jar.id}
            type="button"
            onClick={() => onSelect(jar.id)}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
              active
                ? 'bg-coral text-white'
                : 'bg-surface text-text-muted active:bg-surface-elevated'
            }`}
          >
            {jar.name}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onNewJar}
        aria-label="New jar"
        className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted transition-colors active:bg-surface-elevated"
      >
        <IconPlus size={18} stroke={2} />
      </button>
    </div>
  )
}
