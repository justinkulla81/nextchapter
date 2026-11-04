import { createHash } from 'node:crypto'
import { openRolesLabel } from '@/lib/seo/templates'

// A/B tests of page-template titles. Search Console only reports click rate per page, so the test splits the pages of one type in two by
// a hash of the path: arm A keeps the current title, arm B shows the alternate. The nightly job (title-test-run.ts) compares the two arms'
// click rate and, once the gap is real, writes the winner to SeoTitleTest; titles then follow the winner for every page of the type.
// A page's arm never changes, so a page's own click history stays comparable.

export type TitleArm = 'A' | 'B'

export interface TitleTestDef {
  key: string
  /** Pages of this type, as a path prefix on launchyournextchapter.com. */
  pathPrefix: string
  /**
   * Only paths this matches are counted. A prefix alone takes in pages that never show the alternate title (/jobs/ also holds the
   * title, industry and type hubs), and their clicks would be split between the arms and dilute the result.
   */
  pathPattern?: RegExp
}

export const TITLE_TESTS: TitleTestDef[] = [
  // /jobs/[id]: a job's id is 10 to 40 letters and digits (src/lib/jobs/public-job-page-server.ts); every hub under /jobs/ has a hyphen or is shorter.
  { key: 'jobs', pathPrefix: '/jobs/', pathPattern: /^\/jobs\/[a-z0-9]{10,40}$/i },
  { key: 'employers', pathPrefix: '/employers/', pathPattern: /^\/employers\/[^/]+$/ },
]

/** Whether a page counts toward a test. */
export const countsFor = (def: TitleTestDef, path: string): boolean => path.startsWith(def.pathPrefix) && (!def.pathPattern || def.pathPattern.test(path))

export function armFor(path: string): TitleArm {
  return createHash('sha1').update(path).digest()[0] % 2 === 0 ? 'A' : 'B'
}

/** Arm B for /jobs/[id]: the word "job" for the searcher, and the pay when the posting states it, the strongest click draw in a result. */
export function jobTitleB(title: string, company: string, place: string | null, pay: string | null): string {
  return `${title} Job at ${company}${pay ? `, ${pay}` : ''}${place ? ` · ${place}` : ''}`
}

/** Arm B for /employers/[slug]: leads with "Jobs at", the shape of the search, and names what the page lists. */
export function employerTitleB(company: string, openRoles: number | null): string {
  return openRoles && openRoles > 0 ? `Jobs at ${company}: ${openRolesLabel(openRoles)}, Pay and Hiring` : `Jobs at ${company}`
}

export interface ArmStats {
  impressions: number
  clicks: number
  /** Sum of position x impressions, so the average is impression-weighted. */
  positionSum: number
}

export const EMPTY_ARM: ArmStats = { impressions: 0, clicks: 0, positionSum: 0 }

export const MIN_IMPRESSIONS_PER_ARM = 2000
/** Days after the test starts before its data counts: Google needs time to re-crawl and show the new titles. */
export const WARMUP_DAYS = 7
/** An undecided test is closed after this many days with the current title kept. */
export const MAX_TEST_DAYS = 42
const Z_NEEDED = 1.96

export interface Verdict {
  verdict: 'continue' | 'A' | 'B'
  reason: string
  z: number
  ctrA: number
  ctrB: number
  positionA: number
  positionB: number
}

const ctr = (s: ArmStats) => (s.impressions ? s.clicks / s.impressions : 0)
const avgPosition = (s: ArmStats) => (s.impressions ? s.positionSum / s.impressions : 0)

/** Two-proportion z-test on click rate. B wins only on a real lift; A is kept on a real loss, a tie after MAX_TEST_DAYS, or too little data after MAX_TEST_DAYS. */
export function decide(a: ArmStats, b: ArmStats, ageDays: number): Verdict {
  const base = { ctrA: ctr(a), ctrB: ctr(b), positionA: avgPosition(a), positionB: avgPosition(b) }
  const enough = a.impressions >= MIN_IMPRESSIONS_PER_ARM && b.impressions >= MIN_IMPRESSIONS_PER_ARM
  let z = 0
  if (a.impressions > 0 && b.impressions > 0) {
    const pooled = (a.clicks + b.clicks) / (a.impressions + b.impressions)
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.impressions + 1 / b.impressions))
    z = se > 0 ? (base.ctrB - base.ctrA) / se : 0
  }
  const out = (verdict: Verdict['verdict'], reason: string): Verdict => ({ verdict, reason, z, ...base })
  if (enough && z >= Z_NEEDED) return out('B', `B's click rate is higher (z ${z.toFixed(2)})`)
  if (enough && z <= -Z_NEEDED) return out('A', `A's click rate is higher (z ${z.toFixed(2)})`)
  if (ageDays >= MAX_TEST_DAYS) return out('A', enough ? 'No clear difference after the full test; keeping the current title' : 'Too few impressions after the full test; keeping the current title')
  return out('continue', enough ? 'Not a clear difference yet' : 'Not enough impressions yet')
}

/** Which title a page shows, given the test's stored state. No state, or a read that failed, means the current title. */
export function pickTitle<T>(state: { status: string; winner: string | null } | null, path: string, current: T, alternate: T): T {
  if (!state) return current
  if (state.status === 'decided') return state.winner === 'B' ? alternate : current
  return armFor(path) === 'B' ? alternate : current
}
