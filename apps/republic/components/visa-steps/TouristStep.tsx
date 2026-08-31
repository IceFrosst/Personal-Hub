'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApplication } from '@/lib/applicationContext'
import { addStamp } from '@/lib/passport'

// The sidequest visa has no sub-step form — per the owner's flow change,
// selecting it goes straight to /appointment with no visible intermediate
// screen at all (not even a brief notice), matching every other visa's
// sub-step now skipping its old "CONTINUE TO APPOINTMENT" confirmation too.
// `router.replace` (not `push`) so this route never lingers in history.
export function TouristStep() {
  const router = useRouter()
  const { selectVisa } = useApplication()

  useEffect(() => {
    // `selectVisa` (not a bare `update`) so a direct/deep link straight into
    // this sub-step still establishes SERIAL № together with visaType — see
    // lib/applicationContext.tsx#selectVisa.
    selectVisa('tourist')
    addStamp('TOURIST VISA SELECTED')
    router.replace('/appointment')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
