/**
 * Africa + Australia research batch (2026-07-19).
 * Sources: UbuntuNet official call, W3Node, X, AU student FAQ patterns.
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
      'Official 2026 call: travel and accommodation fully covered for selected teams (45 women, ESA countries) for Lilongwe face-to-face phase Oct 26–28 2026',
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
      'Cape Town Web3 conf+hack; explicit Travel Grant Program for African builders (selected, not all)',
  },
  {
    id: 'photosynthesis-iita',
    label: 'Photosynthesis Hackathon (IITA)',
    tier: 'B',
    region: 'africa',
    titlePattern: /\bphotosynthesis\s*hack/i,
    hostPatterns: [],
    faqPaths: [],
    siteUrl: 'https://computational-biology-aachen.github.io/2026-photosynthesis-hackathon/',
    evidence: 'IITA Accra: travel support may be available for selected participants',
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
    evidence:
      'AU/NZ student premier; hybrid multi-city — no standing all-attendee travel reimbursement found; monitor',
  },
  {
    id: 'unearthed',
    label: 'Unearthed',
    tier: 'B',
    region: 'oceania',
    titlePattern: /\bunearthed\b/i,
    hostPatterns: [/unearthed\.solutions$/i],
    faqPaths: [],
    siteUrl: 'https://unearthed.solutions/',
    evidence: 'Resources sector AU; occasional interstate fly-in for selected',
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
    evidence: 'National AU open data hack — local sites; travel rarely covered centrally',
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
    evidence:
      'X: prizes sometimes include travel grant to a global ETH event — not general attendee coverage',
  },
]
