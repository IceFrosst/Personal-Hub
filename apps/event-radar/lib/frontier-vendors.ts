/**
 * Frontier-vendor hackathons — Luma queries by company name.
 *
 * Probed 2026-09-15 (see SOURCES.md, "Frontier-company hackathons"): no frontier
 * lab publishes a hackathon feed of its own. Anthropic's events page lists
 * founder houses, OpenAI's is behind Cloudflare, NVIDIA's is the investor
 * calendar, Meta's and Microsoft's are JS shells, SpaceX runs none. Their
 * hackathons happen *through* Luma — "Madrid | 48-hour Claude Code Hackathon",
 * "Sea x OpenAI Regional Codex Hackathon", "Dell x NVIDIA Hackathon".
 *
 * The generic `hackathon` query already catches many of those, but a company
 * name pulls in the ones that rank low for the bare word. Measured against the
 * live catalog: 25 name queries → 28 future, name-matched hackathons not yet in
 * it (Anthropic Seattle, OpenAI Thailand, Lovable Stockholm, AWS Loft SF,
 * DeepMind Toronto…). Mostly US/online — the Regions toggle handles that — with
 * the odd EU hit. Kept to the queries that actually returned something new.
 *
 * These join the rotation (lib/ingest/luma-rotation.ts), so adding them costs
 * nothing per sweep; the whole list still cycles about twice a day.
 */
export const LUMA_FRONTIER_VENDOR_QUERIES = [
  'hackathon Anthropic',
  'Claude hackathon',
  'hackathon OpenAI',
  'GPT hackathon',
  'hackathon NVIDIA',
  'hackathon Google',
  'Gemini hackathon',
  'Lovable hackathon',
  'Cursor hackathon',
  'hackathon AWS',
  'xAI hackathon',
  'ElevenLabs hackathon',
  'Hugging Face hackathon',
  'Cohere hackathon',
  'Vercel hackathon',
  'Solana hackathon',
  // Round two (2026-09-15): 145 more names measured the same way — deep-tech,
  // chips, dev tools, crypto, quantum, Baltic unicorns, EU champions. Only the
  // 14 below had a *branded* future hackathon on Luma (company name in the
  // event title) that the queries above did not already reach. Notable zeros:
  // every Baltic/Nordic company tried (Vinted, Nord Security, Revolut, Wise,
  // Bolt, Pipedrive, Spotify, Klarna, Wolt, Supercell), every EU industrial
  // (SAP, Siemens, Bosch, BMW, Airbus, Helsing), every quantum lab, and all of
  // Mistral / Aleph Alpha / Black Forest Labs / DeepSeek. They do not run
  // public hackathons on Luma; re-measure before adding any of them.
  'AMD hackathon',
  'Monad hackathon',
  'Replit hackathon',
  'Figma hackathon',
  'DeepMind hackathon',
  'Qwen hackathon',
  'SambaNova hackathon',
  'Ethereum hackathon',
  'LangChain hackathon',
  'Qiskit hackathon',
  'Apple hackathon',
  'Cisco hackathon',
  'Devin hackathon',
  'Tencent hackathon',
] as const
