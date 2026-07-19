/**
 * Travel priority tier philosophy (updated 2026-07-19)
 *
 * Tier A — pursue actively
 *   Travel support exists (full, partial, or grant application) AND
 *   estimated chance of receiving it is ≥ ~15% for a strong, eligible applicant
 *   who applies on time (not lottery-of-thousands finalist-only).
 *
 *   Includes:
 *   - All accepted get travel (HackMIT, TreeHacks, …)
 *   - Accepted can claim / apply with high hit rate (YHack East Coast, ConUHacks pool)
 *   - Explicit selection programs where competitive builders routinely clear ~15%+
 *     (W3Node travel grants, UbuntuNet selected teams, Photosynthesis selected support,
 *      Junction limited grants, EasyA/Encode event stipends when offered)
 *
 * Tier B — monitor / opportunistic
 *   Travel is rare, year-off, winner-only, finalist-only with <<15% odds,
 *   or FAQ currently says no. Still matched for badge/FAQ crawl when they appear.
 *
 * Always re-check FAQ yearly — policies move.
 */
export const TRAVEL_TIER_PHILOSOPHY = {
  tierAMinSuccessEstimate: 0.15,
  updated: '2026-07-19',
} as const
