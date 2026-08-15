import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────
// Partners Master Build Script §A1.2.2 — "No org-side query joins to
// candidate data. Enforced at the query layer. Employer aggregates compute
// from views that structurally cannot resolve to a person." Plus §A1.2.3/
// §A1.2.4 (an org user can never determine whether anyone has a candidate
// account, and never sees their own record from the org side) and §A1.3/
// §E3.5's minimum-cell-size + differencing rules.
//
// No employer portal exists yet — that's Phase 5. This is the reusable
// primitive Phase 5 is meant to build its queries on, written and
// documented now so that portal can't accidentally ship a
// findMany/findUnique against CandidateProfile from an employer-scoped
// code path. Nothing in this codebase calls this yet.
//
// The invariant this file enforces: an employer-scoped query context may
// only ever read CandidateProfile through count/aggregate/groupBy — the
// three Prisma operations that return numbers, never row data containing a
// name, email, userId, or any other single-candidate-resolvable field.
// Employer-scoped modules should route ALL CandidateProfile reads through
// `employerCandidateAggregates` below instead of importing `prisma`
// directly and calling findMany/findUnique/findFirst on CandidateProfile —
// that bypass is exactly what code review should flag as a §A1.2.2
// violation on any employer-portal PR.
// ─────────────────────────────────────────────────────────────────────────

// §A1.3 / §E3.5 — "Minimum cell size 10 holds on every employer aggregate."
export const EMPLOYER_MIN_CELL_SIZE = 10

// Suppresses (returns null instead of) any aggregate value whose underlying
// population is below the minimum cell size — this is the mechanism, not
// just the policy, behind "9 of 11 seats activated" never rendering for a
// cohort small enough to isolate one person. Every employer-facing number
// derived from employerCandidateAggregates should be passed through this
// before it reaches a page or API response.
export function suppressSmallCell<T>(value: T, populationSize: number): T | null {
  return populationSize < EMPLOYER_MIN_CELL_SIZE ? null : value
}

// Fields that would let an employer-scoped result resolve to one real
// person — never allowed in an employer-scoped groupBy's `by` list. Kept
// as a runtime check (not just a type), because the actual failure mode
// this guards against — someone adding `by: ['firstName']` to make a chart
// "just work" — is a plain string, not something the type system alone
// reliably stops once someone reaches for `as any`.
const IDENTITY_RESOLVABLE_FIELDS = [
  'id',
  'userId',
  'firstName',
  'lastName',
  'email',
  'profilePictureUrl',
  'signupIp',
  'phone',
] as const

export function assertNoIdentityFields(fields: readonly string[]): void {
  const leaked = fields.filter((f) => (IDENTITY_RESOLVABLE_FIELDS as readonly string[]).includes(f))
  if (leaked.length > 0) {
    throw new Error(
      `Employer-scoped query requested identity-resolvable field(s): ${leaked.join(', ')}. ` +
        'Employer-side queries must never resolve to a single candidate — see src/lib/employer/candidate-identity-guard.ts.'
    )
  }
}

// §A1.3 — "Employer aggregates round to the nearest 5 below 50 seats."
// `populationSize` is the size of whatever specific population the value
// was computed over (a cohort, a contract, an org) — not some other,
// larger number — since the whole point of this mitigation is that a
// small population's aggregate can't be used to back out one person's
// month-over-month change (see the file-level comment's "9 of 11" example).
export const EMPLOYER_ROUNDING_THRESHOLD = 50
export function roundEmployerAggregate(value: number, populationSize: number): number {
  return populationSize < EMPLOYER_ROUNDING_THRESHOLD ? Math.round(value / 5) * 5 : value
}

// §A7 — "Cohorts under 20 seats report quarterly, not monthly." A cohort
// here is one OutplacementContract's own seatCount, not an org's total
// across contracts — see outplacement-reporting.ts, the only caller.
export const QUARTERLY_REPORTING_SEAT_THRESHOLD = 20
export type ReportingGranularity = 'monthly' | 'quarterly'
export function getReportingGranularity(seatCount: number): ReportingGranularity {
  return seatCount < QUARTERLY_REPORTING_SEAT_THRESHOLD ? 'quarterly' : 'monthly'
}

// The most recent COMPLETE calendar quarter's [start, end) boundary, as of
// `now` — used to snap a quarterly-gated cohort's reporting window so it
// never includes a partial, still-changing quarter (which would leak the
// same kind of month-over-month differencing signal the quarterly gate
// exists to prevent).
export function lastCompleteQuarterRange(now: Date = new Date()): { start: Date; end: Date } {
  const currentQuarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3
  const end = new Date(Date.UTC(now.getUTCFullYear(), currentQuarterStartMonth, 1))
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 3, 1))
  return { start, end }
}

type GroupByArgs = Parameters<typeof prisma.candidateProfile.groupBy>[0]

// The only three read operations an employer-scoped module may run against
// CandidateProfile. Deliberately does NOT expose findMany/findUnique/
// findFirst/create/update/delete — there is no aggregate-only equivalent to
// wrap them into, so the correct fix for "I need a candidate's name" from
// an employer-scoped module is "you don't get one," not a bigger wrapper.
export const employerCandidateAggregates = {
  count: (args: Prisma.CandidateProfileCountArgs) => prisma.candidateProfile.count(args),
  aggregate: (args: Prisma.CandidateProfileAggregateArgs) => prisma.candidateProfile.aggregate(args),
  groupBy: (args: GroupByArgs) => {
    const by = args && typeof args === 'object' && 'by' in args ? args.by : undefined
    const byFields = Array.isArray(by) ? by : by ? [by] : []
    assertNoIdentityFields(byFields as string[])
    return prisma.candidateProfile.groupBy(args)
  },
}
