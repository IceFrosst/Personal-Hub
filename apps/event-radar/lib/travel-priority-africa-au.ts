/**
 * Africa + Australia batch.
 * Philosophy: Tier A if travel exists and est. ≥15% success for strong applicants.
 */
import type { TravelPriorityCircuit } from './travel-priority'

export const AFRICA_AU_TIER_A: TravelPriorityCircuit[] = [
  {
    id: 'ubuntunet-women',
    label: 'UbuntuNet Women Hackathon',
    tier: 'A',
    region: 'africa',
    titlePattern: /\bubuntunet\b.*hack|women\s*hackathon.*ubuntunet|ubuntunet.*women/i,
    hostPatterns: [/ubuntunet\.net$/i, /events\.ubuntunet\.net$/i],
    faqPaths: [],
    siteUrl:
      'https://ubuntunet.net/women-in-stem/call-for-proposals-to-participate-in-the-fourth-ubuntunet-alliance-for-research-and-education-networking-women-hackathon-2026/',
    evidence:
      'Tier A (≥15%): travel+stay fully covered for selected ESA women teams — structured selection, not pure lottery',
  },
  {
    id: 'w3node',
    label: 'W3Node Hackathon',
    tier: 'A',
    region: 'africa',
    titlePattern: /\bw3\s*node\b|\bw3node\b/i,
    hostPatterns: [/w3node\.io$/i],
    faqPaths: [],
    siteUrl: 'https://w3node.io/',
    evidence:
      'Tier A (≥15%): explicit Travel Grant Program for African builders — selected, but real program with recurring awards',
  },
  {
    id: 'photosynthesis-iita',
    label: 'Photosynthesis Hackathon (IITA)',
    tier: 'A',
    region: 'africa',
    titlePattern: /\bphotosynthesis\s*hack/i,
    hostPatterns: [],
    faqPaths: [],
    siteUrl: 'https://computational-biology-aachen.github.io/2026-photosynthesis-hackathon/',
    evidence:
      'Tier A (≥15%): travel support available for selected participants at IITA Accra — apply as qualified researcher/student',
  },
  {
    id: 'unearthed',
    label: 'Unearthed',
    tier: 'A',
    region: 'oceania',
    titlePattern: /\bunearthed\b/i,
    hostPatterns: [/unearthed\.solutions$/i],
    faqPaths: [],
    siteUrl: 'https://unearthed.solutions/',
    evidence:
      'Tier A (≥15%): resources hacks historically fly selected interstate talent — strong domain applicants clear bar',
  },
]

export const AFRICA_AU_TIER_B: TravelPriorityCircuit[] = [
  {
    id: 'unihack-au',
    label: 'UNIHACK',
    tier: 'B',
    region: 'oceania',
    titlePattern: /\bunihack\b/i,
    hostPatterns: [/unihack\.net$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.unihack.net/',
    evidence: 'Hybrid AU/NZ; no standing travel pool — below 15% policy clarity',
  },
  {
    id: 'govhack',
    label: 'GovHack',
    tier: 'B',
    region: 'oceania',
    titlePattern: /\bgov\s*hack\b/i,
    hostPatterns: [/govhack\.org$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://govhack.org/',
    evidence: 'Local sites; central travel rare — <<15%',
  },
  {
    id: 'eth-nigeria',
    label: 'Ethereum Nigeria / Africa hacks',
    tier: 'B',
    region: 'africa',
    titlePattern: /eth(ereum)?\s*nigeria|\beth\s*lagos\b|\beth\s*nairobi\b|\beth\s*accra\b/i,
    hostPatterns: [],
    faqPaths: [],
    siteUrl: 'https://ethereumnigeria.org/',
    evidence: 'Prize travel to *other* global events — not attendee coverage for this hack',
  },
]
