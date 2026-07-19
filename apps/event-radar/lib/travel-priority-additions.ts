/**
 * Research batch 2026-07-19 (web + X):
 * New Tier A with explicit/recent travel language.
 * Imported into travel-priority.ts list order via merge in registry.
 */
import type { TravelPriorityCircuit } from './travel-priority'

export const TIER_A_RESEARCH_BATCH: TravelPriorityCircuit[] = [
  {
    id: 'yhack',
    label: 'YHack',
    tier: 'A',
    region: 'na',
    titlePattern: /\by\s*hack\b|\byhack\b/i,
    hostPatterns: [/yhack\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://yhack.org/',
    evidence:
      'yhack.org 2026: accepted participants can apply for travel reimbursement; East Coast priority',
  },
  {
    id: 'conuhacks',
    label: 'ConUHacks',
    tier: 'A',
    region: 'na',
    titlePattern: /\bconu\s*hacks\b/i,
    hostPatterns: [/conuhacks\.io$/i, /hackconcordia/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.conuhacks.io/',
    evidence: 'Site: up to $150 CAD / $100 USD travel reimbursement per person',
  },
  {
    id: 'technica',
    label: 'Technica',
    tier: 'A',
    region: 'na',
    titlePattern: /\btechnica\b/i,
    hostPatterns: [/gotechnica\.org$/i, /technica\.umd\.edu$/i],
    faqPaths: ['/faq', '/travel', '/Travel'],
    siteUrl: 'https://gotechnica.org/',
    evidence: 'UMD all-women/non-binary hack; documented travel reimbursement pages',
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
    evidence: 'Cornell; historical up to ~$150 case-by-case + buses',
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
    evidence: 'USC flagship; repeatedly listed with travel support in community guides',
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
    evidence: 'X/official: travel reimbursement for in-person finalists (not all applicants)',
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
    evidence: 'UNC women/non-binary; limited support some years',
  },
  {
    id: 'mchacks',
    label: 'McHacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\bmc\s*hacks\b/i,
    hostPatterns: [/mchacks\.ca$/i, /mchacks\.io$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://mchacks.ca/',
    evidence: 'McGill; has offered up to $100 selected years; 2026 site said none — monitor',
  },
]
