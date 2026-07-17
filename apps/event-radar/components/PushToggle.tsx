'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type PushState = 'loading' | 'unsupported' | 'denied' | 'off' | 'on'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export default function PushToggle({ userId }: { userId: string }) {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const check = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setState('denied')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    }
    check().catch(() => setState('unsupported'))
  }, [])

  const enable = async () => {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as BufferSource,
      })
      const supabase = createClient()
      await supabase
        .schema('hackathon')
        .from('push_subscriptions')
        .upsert(
          { user_id: userId, endpoint: sub.endpoint, subscription: sub.toJSON() },
          { onConflict: 'endpoint' }
        )
      setState('on')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const supabase = createClient()
        await supabase
          .schema('hackathon')
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return null
  if (state === 'unsupported')
    return (
      <p className="text-sm text-text-low">
        Push isn&apos;t supported here. Install the app to your home screen first.
      </p>
    )
  if (state === 'denied')
    return (
      <p className="text-sm text-text-low">
        Notifications are blocked for this app in your system settings.
      </p>
    )

  return (
    <button
      onClick={state === 'on' ? disable : enable}
      disabled={busy}
      className={`min-h-11 w-full rounded-md border px-4 text-sm font-medium transition-colors duration-150 ease-out disabled:opacity-50 ${
        state === 'on'
          ? 'border-purple/50 bg-purple/15 text-purple'
          : 'border-border text-text-muted hover:border-border-focus'
      }`}
    >
      {state === 'on' ? 'Push notifications on — tap to turn off' : 'Enable push notifications'}
    </button>
  )
}
