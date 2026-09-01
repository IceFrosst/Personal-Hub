'use client'

import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { DUTY_FREE_HEADING, DUTY_FREE_SUBHEADING, DUTY_FREE_ITEMS, RETURN_TO_BORDER_CONTROL } from '@/lib/content'
import { playBeep } from '@/lib/sound'

export default function DutyFreePage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()

  function addItem(name: string) {
    if (state.dutyFreeItems.includes(name)) return
    playBeep()
    update({ dutyFreeItems: [...state.dutyFreeItems, name] })
  }

  function returnToPreviousPage() {
    // Returning to `/` would reset the whole application (including the item
    // just added). Resume the page the applicant came from instead; direct
    // visits with no usable history fall back to border control.
    if (window.history.length > 1) router.back()
    else router.push('/')
  }

  if (!hydrated) return null

  return (
    <PageShell>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{DUTY_FREE_HEADING}</h1>
        <p className="mt-1 text-center text-[10px] uppercase text-navy/50">{DUTY_FREE_SUBHEADING}</p>

        <ul className="mt-4 flex flex-col gap-2">
          {DUTY_FREE_ITEMS.map((item) => {
            const selected = state.dutyFreeItems.includes(item.name)
            return (
              <li key={item.name}>
                {item.available ? (
                  <button
                    type="button"
                    onClick={() => addItem(item.name)}
                    disabled={selected}
                    className="flex min-h-11 w-full items-center justify-between border-2 border-approve/60 bg-paper px-3 py-2 text-left text-[11px] uppercase text-navy transition-colors hover:bg-approve hover:text-paper disabled:pointer-events-none disabled:bg-approve disabled:text-paper"
                  >
                    <span>{item.name}</span>
                    <span className={`ml-3 shrink-0 font-bold ${selected ? 'text-paper' : 'text-approve'}`}>
                      {selected ? 'ADDED TO PASSPORT' : item.status}
                    </span>
                  </button>
                ) : (
                  <div className="flex min-h-11 items-center justify-between border-2 border-navy/30 bg-paper px-3 py-2 text-[11px] uppercase text-navy">
                    <span>{item.name}</span>
                    <span className="ml-3 shrink-0 font-bold text-stamp">{item.status}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={returnToPreviousPage}
          className="mt-6 block min-h-11 w-full border-2 border-navy bg-paper py-3 text-center font-stamp text-sm uppercase tracking-widest text-navy transition-colors hover:bg-navy hover:text-paper"
        >
          {RETURN_TO_BORDER_CONTROL}
        </button>
      </div>
      <Footer />
    </PageShell>
  )
}
