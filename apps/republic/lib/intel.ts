// Client-side visitor intel collector — officer-eyes-only material that is
// stored in the application record's `intel` JSON and shown exclusively on
// the ministry desk (/ministry). Nothing here is ever rendered to the
// applicant. Every probe is best-effort: unsupported APIs simply omit their
// field, and the collector never throws or blocks the funnel.
//
// Collected once, on the landing page (document.referrer is only meaningful
// on the entry page), and stored in ApplicationState.intel.
//
// NOT collectible, for the record: the Wi-Fi network name (SSID). Browsers
// deliberately wall that off. `connection` below is the closest legal
// signal (wifi/cellular class + approximate downlink).

export interface VisitorIntel {
  ip?: string
  country?: string
  region?: string
  city?: string
  ipTimezone?: string
  deviceTimezone?: string
  referrer?: string
  /** 'yes (app)' — Instagram in-app browser UA; 'yes (referrer)' — came via an instagram.com link; otherwise 'no'. */
  fromInstagram?: string
  battery?: string
  connection?: string
}

interface BatteryManager {
  level: number
  charging: boolean
}

interface NetworkInformation {
  type?: string
  effectiveType?: string
  downlink?: number
}

const PROBE_TIMEOUT_MS = 2500

type ServerIntel = Pick<VisitorIntel, 'ip' | 'country' | 'region' | 'city' | 'ipTimezone'>

/** Resolve a best-effort probe without allowing a browser API to hang the collector. */
function withTimeout<T>(task: () => Promise<T>, timeoutMs: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    let finished = false
    const timer = setTimeout(() => {
      finished = true
      resolve(undefined)
    }, timeoutMs)
    const finish = (value: T | undefined) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve(value)
    }
    Promise.resolve().then(task).then(finish, () => finish(undefined))
  })
}

async function readBattery(): Promise<string | undefined> {
  try {
    const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }).getBattery
    if (!getBattery) return undefined
    const battery = await getBattery.call(navigator)
    return `${Math.round(battery.level * 100)}%${battery.charging ? ' (charging)' : ''}`
  } catch {
    return undefined
  }
}

async function readServerIntel(): Promise<ServerIntel> {
  // Abort fetch as well as racing it, where supported, so a timed-out request
  // does not continue consuming a browser connection in the background.
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await fetch('/api/intel', {
      cache: 'no-store',
      ...(controller ? { signal: controller.signal } : {}),
    })
    if (!response.ok) return {}
    const body = (await response.json()) as Record<string, unknown>
    const result: ServerIntel = {}
    for (const key of ['ip', 'country', 'region', 'city'] as const) {
      const value = body[key]
      if (typeof value === 'string' && value) result[key] = value
    }
    if (typeof body.timezone === 'string' && body.timezone) result.ipTimezone = body.timezone
    return result
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

export async function collectIntel(): Promise<VisitorIntel> {
  const intel: VisitorIntel = {}

  try {
    // Referrer + Instagram detection — the in-app browser announces itself in
    // the UA, which is a stronger signal than the (often stripped) referrer.
    try {
      const referrer = document.referrer
      if (referrer) intel.referrer = referrer
      const uaInstagram = /instagram/i.test(navigator.userAgent)
      const refInstagram = /instagram\.com|ig\.me/i.test(referrer)
      intel.fromInstagram = uaInstagram ? 'yes (app)' : refInstagram ? 'yes (referrer)' : 'no'
    } catch {
      // ignore
    }

    try {
      intel.deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      // ignore
    }

    // Connection class — wifi vs cellular where the browser knows it, plus the
    // effective speed class. (SSID is not obtainable; see file header.)
    try {
      const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
      if (connection) {
        const parts = [connection.type, connection.effectiveType].filter(Boolean)
        if (typeof connection.downlink === 'number' && connection.downlink > 0) {
          parts.push(`~${connection.downlink}Mbps`)
        }
        if (parts.length) intel.connection = parts.join(' ')
      }
    } catch {
      // ignore
    }

    // Battery and server-side IP/geo are independent probes. Start both before
    // awaiting either: each has its own short deadline, so neither can block
    // the other or delay the synchronous fields above indefinitely.
    const [battery, server] = await Promise.all([
      withTimeout(readBattery, PROBE_TIMEOUT_MS),
      withTimeout(readServerIntel, PROBE_TIMEOUT_MS),
    ])
    if (battery) intel.battery = battery
    if (server) Object.assign(intel, server)
  } catch {
    // Collector is deliberately best-effort and must never break the funnel.
  }

  return intel
}
