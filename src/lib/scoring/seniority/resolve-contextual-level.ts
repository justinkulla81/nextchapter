// Industry-aware title -> level resolution for finance, law, and
// investment-firm titles the generic keyword-based inference (infer-job-
// function.ts's inferLevelFromTitle, seniority-band.ts's title patterns)
// gets wrong: it treats every industry's ladder like a normal corporate
// one, so a finance VP (genuinely mid-level, below Director) reads as
// near-top, and "Associate"/"Analyst" aren't recognized as level words at
// all. This is the single shared core both level-rank-service.ts
// (self-reported WorkHistoryEntry) and seniority-band.ts (LLM-extracted
// ResumeAnalysisFacts.roles) call as an additional override step — same
// "call site owns the override" pattern already established by
// isAmbiguousPartnerTitle/resolveAmbiguousPartnerLevel in
// level-rank-service.ts.
//
// Always resolves DOWN to one of the five existing HIGHEST_LEVEL_OPTIONS
// values (or declines to answer) — never introduces a new vocabulary
// value, since compute-match-score.ts/work-history-facts.ts/
// pedigree-bonus.ts all do raw indexOf() ordinal math on that exact array
// and would silently break if a value were inserted mid-array.

import { neutralizeStaffPartnerPhrase, PRINCIPAL_IC_QUALIFIER } from '@/lib/jobs/infer-job-function'
import { detectFirmContext } from './firm-context'

const LAW_SENIOR_ASSOCIATE_MONTHS = 60 // 5 years — conventional senior-associate/counsel-track cutoff
const HEDGE_FUND_SENIOR_ANALYST_YEARS = 15 // hedge funds famously keep "Analyst" as a title for very senior PM-equivalent people
const FINANCE_SENIOR_ASSOCIATE_MONTHS = 36 // 3 years
const ADVISORY_FILLER_MONTHS = 6
const OWNER_SHORT_TENURE_MONTHS = 12

const BARE_PARTNER_PATTERN = /\bpartner\b/
const ASSOCIATE_PATTERN = /\bassociate\b/i
const OPERATING_PARTNER_PATTERN = /\boperating partner\b/i
const ANALYST_PATTERN = /\banalyst\b/i
const ADVISOR_PATTERN = /\b(advisor|adviser|consultant|investor[\s-]?consulting partner)\b/i
const FINANCE_VP_PATTERN = /\b(vice president|vp)\b/i
const FINANCE_DIRECTOR_PRINCIPAL_PATTERN = /\b(director|principal)\b/i
const MANAGING_DIRECTOR_PATTERN = /\bmanaging director\b/i
const OWNER_EXEC_PATTERN = /\b(chairman|chairperson|chairwoman|owner\/operator|owner-operator|owner)\b/i

export interface ConcurrentRoleCandidate {
  title: string
  startDateMs: number
  endDateMs: number | null // null = open-ended/current
  // True only when the caller has an explicit engagementType==='FULL_TIME'
  // (WorkHistoryEntry) — always false for the resume-facts path, which has
  // no such field. An honest, explicit gap, not silently papered over.
  isDeclaredFullTime: boolean
  tenureMonths: number | null
}

export interface LevelResolutionContext {
  title: string
  companyName: string
  freeformIndustry: string | null
  tenureMonthsInRole: number | null
  yearsIntoCareerAtStart: number | null
  // Only ever populated from level-rank-service.ts (the WorkHistoryEntry
  // path, which already resolves it via resolveCompanySizeBand); always
  // null from seniority-band.ts (the resume-facts path — making it async
  // there would ripple into that file's synchronous test harness).
  companySizeBand: 'MICRO' | 'SMALL' | 'SMALL_MID' | 'MID' | 'MID_LARGE' | 'LARGE' | 'ENTERPRISE' | 'MEGA' | null
  // Optional weaker proxy for "tiny company" on the resume-facts path,
  // where no company-size lookup is available at all — see the Owner/Exec
  // branch below.
  hasNoStatedScope?: boolean
  concurrentRoles: ConcurrentRoleCandidate[]
}

export interface ContextualLevelResult {
  // One of HIGHEST_LEVEL_OPTIONS, or null = "recognized this title family,
  // but the confident answer is to defer to the caller's other signals" —
  // callers must NOT re-run their generic fallback in that case; the
  // deferral IS the answer.
  level: string | null
  // Additive nudge to the numeric level-rank SCORE only (level-rank.ts's
  // calibratedLevelRank) — never changes the label itself. Exists because
  // the fixed 5-value vocabulary has no slot between Manager(40) and
  // Director(55) for finance's real Associate -> Senior Associate -> VP ->
  // Director order; see the finance-ladder branch below.
  scoreNudge?: number
  // Shrinks this role's influence in level-rank-service.ts's weighted
  // blend across a candidate's whole work history. Default 1 (no-op).
  weightMultiplier?: number
  // Debug tag, printed by the verification script — never shown to users.
  reason?: string
}

export function selectLikelyFullTimeRole(candidates: ConcurrentRoleCandidate[]): ConcurrentRoleCandidate | null {
  if (candidates.length === 0) return null
  return (
    candidates.find((c) => c.isDeclaredFullTime) ??
    [...candidates].sort((a, b) => (b.tenureMonths ?? 0) - (a.tenureMonths ?? 0))[0]
  )
}

// Bare "partner" surviving staff-qualifier neutralization — same signal
// isAmbiguousPartnerTitle uses, exposed here directly since a LAW FIRM
// Partner isn't actually ambiguous (branch A resolves it outright, rather
// than deferring to that function's generic "could be junior or senior"
// handling).
function hasBarePartnerWord(title: string): boolean {
  return BARE_PARTNER_PATTERN.test(neutralizeStaffPartnerPhrase(title.toLowerCase()))
}

export function resolveContextualLevel(ctx: LevelResolutionContext): ContextualLevelResult | undefined {
  const firm = detectFirmContext({ companyName: ctx.companyName, freeformIndustry: ctx.freeformIndustry })
  const title = ctx.title

  // A. Law firm — Associate (junior/senior by tenure) and Partner
  // (unambiguous here, unlike the generic bare-Partner case elsewhere).
  if (firm.isLawFirm) {
    if (hasBarePartnerWord(title)) {
      return { level: 'C-Suite', reason: 'law_firm_partner' }
    }
    if (ASSOCIATE_PATTERN.test(title)) {
      const isSenior = (ctx.tenureMonthsInRole ?? 0) >= LAW_SENIOR_ASSOCIATE_MONTHS
      return isSenior
        ? { level: 'Manager', reason: 'law_firm_senior_associate' }
        : { level: 'IC', reason: 'law_firm_junior_associate' }
    }
  }

  // B. Operating Partner — genuinely senior, and a 3-5 year stint is this
  // role's normal shape, not a red flag — ignore tenure entirely.
  if (firm.isInvestmentFirm && OPERATING_PARTNER_PATTERN.test(title)) {
    return { level: 'Director', reason: 'operating_partner' }
  }

  // C. Investment-firm Analyst — junior everywhere except a long-tenured
  // hedge-fund Analyst, who can be the most senior person in the room.
  if (firm.isInvestmentFirm && ANALYST_PATTERN.test(title)) {
    if (firm.isHedgeFund && (ctx.yearsIntoCareerAtStart ?? 0) >= HEDGE_FUND_SENIOR_ANALYST_YEARS) {
      return { level: 'Director', reason: 'hedge_fund_senior_analyst_by_tenure' }
    }
    return { level: 'IC', reason: 'investment_firm_junior_analyst' }
  }

  // D. Advisor / Senior Advisor / Consultant / Investor Consulting Partner —
  // checked BEFORE the finance ladder below so "Investor Consulting
  // Partner" (a bare, unqualified "partner" that neutralizeStaffPartnerPhrase
  // would not neutralize — "investor"/"consulting" aren't staff qualifiers)
  // is claimed by its own tenure/concurrency calibration instead of being
  // swallowed by the finance ladder's broad bare-"partner" match.
  if (ADVISOR_PATTERN.test(title)) {
    const otherConcurrent = ctx.concurrentRoles.filter((r) => !ADVISOR_PATTERN.test(r.title))
    const anchor = selectLikelyFullTimeRole(otherConcurrent)
    if (anchor) {
      return { level: null, weightMultiplier: 0.3, reason: 'advisory_secondary_role' }
    }
    const concurrentAdvisoryCount = 1 + ctx.concurrentRoles.filter((r) => ADVISOR_PATTERN.test(r.title)).length
    if ((ctx.tenureMonthsInRole ?? Infinity) < ADVISORY_FILLER_MONTHS && concurrentAdvisoryCount <= 1) {
      return { level: null, weightMultiplier: 1, reason: 'advisory_short_tenure_filler' }
    }
    return {
      level: 'Director',
      weightMultiplier: concurrentAdvisoryCount > 1 ? 0.6 : 1,
      reason: 'advisory_substantive',
    }
  }

  // E. Finance ladder — Associate -> Senior Associate -> VP -> Director/
  // Principal -> Managing Director/Partner/Managing Partner. VP is
  // deliberately mapped to 'Manager' (with a scoreNudge), not 'VP' — see
  // this function's own file header and level-rank.ts's calibratedLevelRank
  // for why the fixed 5-value vocabulary can't represent VP sitting below
  // Director any other way.
  if (firm.isFinance) {
    if (ASSOCIATE_PATTERN.test(title)) {
      const isSenior = (ctx.tenureMonthsInRole ?? 0) >= FINANCE_SENIOR_ASSOCIATE_MONTHS
      return isSenior
        ? { level: 'Manager', scoreNudge: -8, reason: 'finance_senior_associate' }
        : { level: 'IC', reason: 'finance_associate' }
    }
    if (FINANCE_VP_PATTERN.test(title)) {
      return { level: 'Manager', scoreNudge: 10, reason: 'finance_vp' }
    }
    // Checked BEFORE the plain Director/Principal pattern below — "Managing
    // Director" contains the bare word "director" and would otherwise be
    // wrongly caught by that broader, lower-tier check first.
    // hasBarePartnerWord (not a raw regex against `title`) is required here:
    // without running neutralizeStaffPartnerPhrase first, a staff-function
    // title like "Talent Partner" or "HR Partner" — real, common titles at
    // funds' portfolio-services teams, not equity partners — would match
    // the bare word "partner" and wrongly resolve to C-Suite.
    if (MANAGING_DIRECTOR_PATTERN.test(title) || hasBarePartnerWord(title)) {
      return { level: 'C-Suite', reason: 'finance_md_partner' }
    }
    if (FINANCE_DIRECTOR_PRINCIPAL_PATTERN.test(title) && !PRINCIPAL_IC_QUALIFIER.test(title.toLowerCase())) {
      return { level: 'Director', reason: 'finance_director_principal' }
    }
  }

  // F. President/CEO/Chairman/Chairperson/Owner/Owner-Operator — senior
  // almost everywhere. "President"/"CEO" are already handled by the
  // existing generic patterns elsewhere; this only adds the words that
  // aren't recognized anywhere today.
  if (OWNER_EXEC_PATTERN.test(title)) {
    const isShortTenure = (ctx.tenureMonthsInRole ?? Infinity) < OWNER_SHORT_TENURE_MONTHS
    const isTinyCompany = ctx.companySizeBand === 'MICRO' || ctx.companySizeBand === 'SMALL' || !!ctx.hasNoStatedScope
    if (isShortTenure && isTinyCompany) {
      // Deliberately "don't know," not a wrong guess in either direction —
      // defer to the candidate's other roles rather than asserting C-Suite
      // for what might just be a 1-5 person startup, or IC for what might
      // be a real, substantial company we simply have no size signal for.
      return { level: null, weightMultiplier: 0.3, reason: 'owner_short_tenure_tiny_company_deferred' }
    }
    return { level: 'C-Suite', reason: 'owner_exec_title' }
  }

  return undefined
}
