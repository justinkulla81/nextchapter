import type { BuildGroup } from '@/lib/rankings/types'

// The version of the method behind each group of lists. Bump a group's version in the change that alters how its lists are
// built, and the hourly rankings-refresh job rebuilds that group within the hour, without waiting for the monthly run or a
// click on "Run now". A group with no stored version counts as 'v0'.
export const RANKING_METHOD: Record<BuildGroup, string> = {
  // 2026-11-17: pay after cost of living deducts a year of owning the median home (living-cost.ts).
  places: '2026-11-17',
  functions: '2026-11-17',
  industry: '2026-11-17',
  // 2026-11-17b: complete metros only, no homicide criterion, AI pay premium and local job support added.
  // 2026-11-17c: AI pay premium optional and weighted 2%; unranked large metros named with what they lack.
  // 2026-11-17d: a several-part criterion is scored on the parts published for a metro (60%+ of its weight).
  // 2026-11-17e: white-collar pay from BLS OEWS wages for every metro; Connecticut growth and county-health figures filled.
  // 2026-11-17f: metros from 350,000 residents and 300 openings; the openings criterion counts market depth as well as per worker.
  // 2026-11-17g: metros from 250,000 residents and 250 openings, so 100 qualify.
  // 2026-11-17h: 200,000 residents and 200 openings (250,000 and 250 gave 95).
  // 2026-11-17i: openings 15% (70% market depth); growth 8, family 4, community 3, diversity 4. Waco led at 200,000.
  // 2026-11-17j: titles in searchers' words ("best places to live and work for professionals", "best cities for ...").
  metro: '2026-11-17j',
  skills: 'v0',
  workforce: 'v0',
  college: 'v0',
  // 2026-11-17: degree lists add majors, open jobs per graduate and career stage (built 2026-11-18 02:55 with #1678).
  // 2026-11-18: fields our board barely covers (nursing, education, health professions, social work) leave the count, pay,
  // jobs-per-graduate and career-stage lists (fieldCovered).
  // 2026-11-18b: open jobs and pay by state and field, and a monthly copy of the field figures (Academic Affairs).
  profile: '2026-11-18b',
  support: 'v0',
}

/** The order stale groups are rebuilt in: the groups people look at most first. */
const ORDER: BuildGroup[] = ['metro', 'places', 'functions', 'industry', 'workforce', 'support', 'skills', 'college', 'profile']

export function staleGroups(stored: Partial<Record<BuildGroup, string>>): BuildGroup[] {
  return ORDER.filter((g) => (stored[g] ?? 'v0') !== RANKING_METHOD[g])
}
