import webpush from 'web-push'

// Server-only Web Push (VAPID) sender. Returns false when the subscription is
// dead (404/410) so the caller can delete the row.
let configured = false

function ensureConfigured(): boolean {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails('mailto:ign3107s@gmail.com', pub, priv)
  configured = true
  return true
}

export type PushPayload = { title: string; body: string; url: string }

export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<'sent' | 'gone' | 'failed' | 'unconfigured'> {
  if (!ensureConfigured()) return 'unconfigured'
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 86400 })
    return 'sent'
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'
    return 'failed'
  }
}
