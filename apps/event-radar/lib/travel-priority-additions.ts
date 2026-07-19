/**
 * Research batches for Tier A/B.
 * 2026-07-19 deep pass: X + CN sites + Reddit + official FAQs.
 * Focus: SF / China / HK / international-facing only.
 */
import type { TravelPriorityCircuit } from './travel-priority'

export const TIER_A_RESEARCH_BATCH: TravelPriorityCircuit[] = [
  // --- prior US/Canada batch ---
  {
    id: 'yhack',
    label: 'YHack',
    tier: 'A',
    region: 'na',
    titlePattern: /\by\s*hack\b|\byhack\b/i,
    hostPatterns: [/yhack\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://yhack.org/',
    evidence: 'yhack.org: accepted can apply for travel reimbursement; East Coast priority',
  },
  {
    id: 'conuhacks',
    label: 'ConUHacks',
    tier: 'A',
    region: 'na',
    titlePattern: /\bconu\s*hacks\b/i,
    hostPatterns: [/conuhacks\.io$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.conuhacks.io/',
    evidence: 'Official: up to $150 CAD / $100 USD per person',
  },
  {
    id: 'technica',
    label: 'Technica',
    tier: 'A',
    region: 'na',
    titlePattern: /\btechnica\b/i,
    hostPatterns: [/gotechnica\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://gotechnica.org/',
    evidence: 'UMD; documented travel reimbursement program',
  },
  {
    id: 'bigredhacks',
    label: 'BigRed//Hacks',
    tier: 'A',
    region: 'na',
    titlePattern: /\bbig\s*red\s*hacks\b|\bbigred\/\/hacks\b/i,
    hostPatterns: [/bigredhacks\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.bigredhacks.com/',
    evidence: 'Cornell; historical ~$150 + buses',
  },
  {
    id: 'hacksc',
    label: 'HackSC',
    tier: 'A',
    region: 'na',
    titlePattern: /\bhack\s*sc\b/i,
    hostPatterns: [/hacksc\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hacksc.com/',
    evidence: 'USC; community guides list travel support',
  },

  // --- 2026-07-19 China / SF / international Tier A ---
  {
    id: 'adventurex',
    label: 'AdventureX',
    tier: 'A',
    region: 'asia',
    titlePattern: /\badventure\s*x\b/i,
    hostPatterns: [/adventure-x\.org$/i],
    faqPaths: ['/zh', '/en', '/faq'],
    siteUrl: 'https://adventure-x.org/',
    evidence:
      'Official CN site: 旅费补助 for distant participants; 食宿全包; international applicants from 10+ countries; under-26/student extra 差旅报销',
  },
  {
    id: 'duke-nus-ghi',
    label: 'APAC Global Health Innovation Hackathon',
    tier: 'A',
    region: 'asia',
    titlePattern: /global health innovation hackathon|duke-?nus.*hack/i,
    hostPatterns: [/duke-nus\.edu\.sg$/i],
    faqPaths: [],
    siteUrl: 'https://www.duke-nus.edu.sg/sdghi/news-events/events/innovation-hackathon',
    evidence:
      'Duke-NUS: for qualifying LMIC teams in region, travel expenses fully covered; international-facing',
  },
]

export const TIER_B_RESEARCH_BATCH: TravelPriorityCircuit[] = [
  {
    id: 'isro-bah',
    label: 'ISRO Antariksh Hackathon',
    tier: 'B',
    region: 'asia',
    titlePattern: /\bantariksh\b|\bisro\b.*hack|\bbharatiya\s+antariksh\b/i,
    hostPatterns: [/hack2skill\.com$/i],
    faqPaths: [],
    siteUrl: 'https://hack2skill.com/event/bah2026/',
    evidence: 'Travel reimbursement for finalists only (X + official)',
  },
  {
    id: 'pearlhacks',
    label: 'Pearl Hacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\bpearl\s*hacks\b/i,
    hostPatterns: [/pearlhacks\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://pearlhacks.com/',
    evidence: 'Limited some years',
  },
  {
    id: 'mchacks',
    label: 'McHacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\bmc\s*hacks\b/i,
    hostPatterns: [/mchacks\.ca$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://mchacks.ca/',
    evidence: '2026 FAQ: not offering; prior years had limited $100',
  },
  {
    id: 'sfhacks',
    label: 'SF Hacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\bsf\s*hacks\b/i,
    hostPatterns: [/sfhacks\.io$/i],
    faqPaths: ['/faqs', '/faq'],
    siteUrl: 'https://www.sfhacks.io/',
    evidence: 'SF major; no published travel policy found — monitor FAQ',
  },
  {
    id: 'cathay-hackathon',
    label: 'Cathay Hackathon',
    tier: 'B',
    region: 'asia',
    titlePattern: /\bcathay\s*hack/i,
    hostPatterns: [/cathaypacific\.com$/i],
    faqPaths: [],
    siteUrl: 'https://news.cathaypacific.com/',
    evidence: 'HK; winner prizes sometimes include flights — not all attendees',
  },
]
