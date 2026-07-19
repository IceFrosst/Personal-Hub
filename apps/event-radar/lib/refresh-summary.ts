export type RefreshResult = {
  tone: 'success' | 'warning'
  message: string
  details?: string
}

const SOURCE_LABELS: Record<string, string> = {
  devpost: 'Devpost',
  mlh: 'MLH',
  ethglobal: 'ETHGlobal',
  hackerearth: 'HackerEarth',
  hackclub: 'Hack Club',
  luma: 'Luma',
  hackquest: 'HackQuest',
  devfolio: 'Devfolio',
  taikai: 'Taikai',
  dorahacks: 'DoraHacks',
  unstop: 'Unstop',
  known: 'Known events',
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function formatRefreshSummary(value: unknown): RefreshResult {
  const summary = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const hasSources =
    summary.sources && typeof summary.sources === 'object' && !Array.isArray(summary.sources)
  const sources =
    hasSources
      ? (summary.sources as Record<string, unknown>)
      : {}
  const failures = Object.entries(sources)
    .filter(([, result]) => typeof result !== 'number' || !Number.isFinite(result))
    .map(([source]) => SOURCE_LABELS[source] ?? source)
  const details = Object.entries(sources)
    .map(([source, result]) => {
      const label = SOURCE_LABELS[source] ?? source
      return `${label} ${typeof result === 'number' && Number.isFinite(result) ? result : 'error'}`
    })
    .join(' · ')

  if (!hasSources || Object.keys(sources).length === 0) {
    return {
      tone: 'warning',
      message: 'Refresh response was incomplete — try again.',
    }
  }
  if (typeof summary.gather_error === 'string' || typeof summary.insert_error === 'string') {
    failures.push('database update')
  }

  const inserted = count(summary.inserted)
  const enriched = count(summary.enriched)
  if (failures.length > 0) {
    return {
      tone: 'warning',
      message: `Refresh finished with errors: ${failures.join(', ')}. ${inserted} new, ${enriched} enriched.`,
      details,
    }
  }

  return {
    tone: 'success',
    message: `Refresh complete — ${Object.keys(sources).length} sources checked, ${inserted} new, ${enriched} enriched.`,
    details,
  }
}
