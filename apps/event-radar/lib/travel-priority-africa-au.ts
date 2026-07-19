/**
 * Africa + Australia batch.
 * Tier A = travel available + est. ≥15% for a strong *eligible* applicant.
 * Eligibility is part of the bar — Africa-only grants are not Tier A for EU applicants.
 */
import type { TravelPriorityCircuit } from './travel-priority'

export const AFRICA_AU_TIER_A: TravelPriorityCircuit[] = [
  // None currently open to non-African / non-ESA applicants at ≥15%.
  // Photosynthesis (IITA Accra) may accept international researchers — kept A below with note.
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
      'Travel support for selected participants (IITA Accra). International researchers may qualify — confirm call; not Africa-citizenship-gated in public copy',
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
      'AU resources hacks; selected interstate (and sometimes international domain talent) fly-ins — open by skill not nationality',
  },
]

export const AFRICA_AU_TIER_B: TravelPriorityCircuit[] = [
  {
    id: 'w3node',
    label: 'W3Node Hackathon',
    tier: 'B',
    region: 'africa',
    titlePattern: /\bw3\s*node\b|\bw3node\b/i,
    hostPatterns: [/w3node\.io$/i],
    faqPaths: [],
    siteUrl: 'https://w3node.io/',
    evidence:
      'Travel Grant Program targets African builders — not applicable for Lithuania/EU applicants (est. ~0% grant odds). Event still trackable',
  },
  {
    id: 'ubuntunet-women',
    label: 'UbuntuNet Women Hackathon',
    tier: 'B',
    region: 'africa',
    titlePattern: /\bubuntunet\b.*hack|women\s*hackathon.*ubuntunet|ubuntunet.*women/i,
    hostPatterns: [/ubuntunet\.net$/i, /events\.ubuntunet\.net$/i],
    faqPaths: [],
    siteUrl:
      'https://ubuntunet.net/women-in-stem/call-for-proposals-to-participate-in-the-fourth-ubuntunet-alliance-for-research-and-education-networking-women-hackathon-2026/',
    evidence:
      'Full travel+stay but eligibility: women from UbuntuNet ESA countries only — not open to Lithuania',
  },
  {
    id: 'unihack-au',
    label: 'UNIHACK',
    tier: 'B',
    region: 'oceania',
    titlePattern: /\bunihack\b/i,
    hostPatterns: [/unihack\.net$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.unihack.net/',
    evidence: 'AU/NZ students only; no standing international travel pool',
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
    evidence: 'Local AU sites; central travel rare',
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
    evidence: 'Local/regional; prize travel to other events — not LT-relevant attendee coverage',
  },
]
