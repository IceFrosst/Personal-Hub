/**
 * Travel priority tier philosophy (updated 2026-07-19)
 *
 * Tier A — pursue actively
 *   1) Travel support exists (full, partial, or grant), AND
 *   2) Estimated chance ≥ ~15% for a strong applicant who is *eligible*
 *      (citizenship / region / gender gates count — if you cannot apply, odds = 0).
 *
 *   Examples of A for a Lithuania-based applicant:
 *   - HackMIT / TreeHacks / PennApps / HtN (open international students)
 *   - Junction limited grants, YHack, ConUHacks, AdventureX student 差旅
 *   - EasyA / Encode when the event offers builder travel
 *
 *   Not A for LT even if “selected get travel”:
 *   - W3Node (African builders)
 *   - UbuntuNet Women (ESA Africa women only)
 *
 * Tier B — monitor / opportunistic
 *   Region-gated, winner-only, FAQ-no, or unclear policy.
 */
export const TRAVEL_TIER_PHILOSOPHY = {
  tierAMinSuccessEstimate: 0.15,
  /** Eligibility is required for the 15% bar to apply */
  eligibilityRequired: true,
  updated: '2026-07-19',
  noteForUser: 'Primary user region: Lithuania / EU — Africa-only grants are Tier B',
} as const
