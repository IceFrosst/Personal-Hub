// Format an optional date-only string (YYYY-MM-DD) as "Earned · 12 May 2026".
// Parsed component-wise so a date-only value never shifts across time zones.
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function formatEarned(earnedOn: string | null): string | null {
  if (!earnedOn) return null
  const [y, m, d] = earnedOn.split('-').map(Number)
  if (!y || !m || !d) return null
  return `Earned · ${d} ${MONTHS[m - 1]} ${y}`
}
