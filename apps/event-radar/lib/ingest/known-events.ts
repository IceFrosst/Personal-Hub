import type { IngestRow } from './devpost'

// Hand-curated high-value events that don't reliably appear in any public API
// feed (or appear too late). Keep this list small and high-signal only.
// Rules for adding:
//   1. Confirmed dates + registration URL
//   2. Prefer events with travel sponsorship when known
//   3. Remove once the event ends or a proper source starts covering it
//
// Cerebral Valley (cerebralvalley.ai) is a major AI events hub. Their site is a
// JS SPA with no documented public API; this sandbox cannot reach the host
// (connection refused). Events below were pulled via the browse tool from
// https://cerebralvalley.ai/events?type=HACKATHON on 2026-07-19.

export function fetchKnownEvents(): IngestRow[] {
  const now = Date.now()
  const rows: IngestRow[] = [
    {
      // Junction 2026 Main Event — Europe's leading hackathon.
      // Limited travel grants up to €300 (confirmed via official channels).
      source: 'known',
      source_id: 'junction-2026-main',
      title: 'Junction 2026',
      url: 'https://www.hackjunction.com/',
      starts_at: '2026-11-13T08:00:00.000Z',
      ends_at: '2026-11-15T18:00:00.000Z',
      location_raw: 'Espoo, Finland',
      format: 'in_person',
      prize_pool: '100000+ EUR',
      registration_deadline: '2026-10-15T23:59:59.000Z',
      themes: ['general', 'hardware', 'ai'],
    },

    // ---- Cerebral Valley AI hackathons (from live listing 2026-07-19) ----
    {
      source: 'known',
      source_id: 'cv-last-mile-agent',
      title: 'Last Mile Agent Hackathon',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-21T17:30:00.000Z',
      ends_at: '2026-07-22T05:00:00.000Z',
      location_raw: 'San Francisco, CA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-07-21T17:00:00.000Z',
      themes: ['ai', 'agents'],
    },
    {
      source: 'known',
      source_id: 'cv-openai-start2-zendesk',
      title: 'OpenAI × Start2 × Zendesk Hackathon',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-23T16:00:00.000Z',
      ends_at: '2026-07-24T04:00:00.000Z',
      location_raw: 'San Francisco, CA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-07-23T15:00:00.000Z',
      themes: ['ai', 'openai'],
    },
    {
      source: 'known',
      source_id: 'cv-hello-robot-viam',
      title: 'Hello, Robot! 1-Day Hackathon with Viam and SPC',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-24T13:30:00.000Z',
      ends_at: '2026-07-24T23:00:00.000Z',
      location_raw: 'New York City, NY',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-07-24T13:00:00.000Z',
      themes: ['robotics', 'hardware'],
    },
    {
      source: 'known',
      source_id: 'cv-daytona-braintrust',
      title: 'Daytona HackSprint with Braintrust',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-24T16:00:00.000Z',
      ends_at: '2026-07-25T04:00:00.000Z',
      location_raw: 'San Francisco, CA',
      format: 'in_person',
      prize_pool: '35000+ USD',
      registration_deadline: '2026-07-24T15:00:00.000Z',
      themes: ['ai', 'agents'],
    },
    {
      source: 'known',
      source_id: 'cv-agent-swarms',
      title: 'Agent Swarms Hackathon',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-24T16:30:00.000Z',
      ends_at: '2026-07-25T04:00:00.000Z',
      location_raw: 'San Francisco, CA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-07-24T16:00:00.000Z',
      themes: ['ai', 'agents'],
    },
    {
      source: 'known',
      source_id: 'cv-youcom-agentic',
      title: 'You.com Agentic Hackathon',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-24T17:00:00.000Z',
      ends_at: '2026-07-25T04:00:00.000Z',
      location_raw: 'AWS Builder Loft, San Francisco, CA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-07-24T16:00:00.000Z',
      themes: ['ai', 'agents'],
    },
    {
      source: 'known',
      source_id: 'cv-paris-gemma-4',
      title: 'Paris Gemma 4 Hackathon',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-25T07:30:00.000Z',
      ends_at: '2026-07-25T20:00:00.000Z',
      location_raw: 'Ecole 42, Paris, France',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-07-25T07:00:00.000Z',
      themes: ['ai', 'google', 'gemma'],
    },
    {
      source: 'known',
      source_id: 'cv-dmv-hackathon',
      title: 'DMV Hackathon',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-25T12:00:00.000Z',
      ends_at: '2026-07-26T00:00:00.000Z',
      location_raw: 'Fuse at Mason Square',
      format: 'in_person',
      prize_pool: '10000 USD',
      registration_deadline: '2026-07-25T11:00:00.000Z',
      themes: ['ai'],
    },
    {
      source: 'known',
      source_id: 'cv-prompt-driven',
      title: 'Build Fast. Launch Loud. Prompt Driven Hackathon',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-25T16:00:00.000Z',
      ends_at: '2026-07-26T04:00:00.000Z',
      location_raw: 'Venture Dock',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-07-25T15:00:00.000Z',
      themes: ['ai', 'prompt'],
    },
    {
      source: 'known',
      source_id: 'cv-scalekit-agents-sf',
      title: 'Scalekit Agents in Production Build Day SF',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-25T17:00:00.000Z',
      ends_at: '2026-07-26T04:00:00.000Z',
      location_raw: 'San Francisco, CA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-07-25T16:00:00.000Z',
      themes: ['ai', 'agents'],
    },
    {
      source: 'known',
      source_id: 'cv-mind-games-xtrace',
      title: 'Mind Games AI Hackathon + Exclusive Napa Retreat',
      url: 'https://cerebralvalley.ai/events?type=HACKATHON',
      starts_at: '2026-07-25T17:00:00.000Z',
      ends_at: '2026-08-08T17:00:00.000Z',
      location_raw: 'Berkeley, CA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-07-25T16:00:00.000Z',
      themes: ['ai', 'memory'],
    },
  ]

  // Drop anything already past
  return rows.filter((r) => {
    if (!r.starts_at) return true
    return Date.parse(r.starts_at) > now
  })
}
