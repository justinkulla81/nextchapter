import 'server-only'
import { prisma } from '@/lib/prisma'
import type { LikelyOpeningSignalType } from '@prisma/client'
import { companyKey, isOfficerRole, ROLE_FUNCTIONS, type OfficerRole } from './roles'

// The candidate fields ranking reads. Any CandidateProfile row satisfies it.
export interface LikelyOpeningCandidate {
  id: string
  primaryFunction?: string | null
  secondaryFunction?: string | null
  targetFunction?: string | null
  highestLevelReached?: string | null // "IC" | "Manager" | "Director" | "VP" | "C-Suite"
}

export interface LikelyOpeningForCandidate {
  id: string
  companyName: string
  signalType: LikelyOpeningSignalType
  roles: string[]
  summary: string
  filingDate: Date
  filingUrl: string
  amountRaised: number | null
  industry: string | null
  location: string | null
  /** Why it was surfaced for this candidate, in plain language ("You're watching Acme", "Fits your finance background"). */
  reason: string | null
  /** The candidate already tracks or applied to this company. */
  companyRelation: 'watched' | 'applied' | null
  score: number
}

// How many active signals to rank in memory beyond the candidate's own
// companies. Active rows are bounded (~120 days of filings, a few thousand
// at most); the newest slice is enough for "what's fresh for you".
const RECENT_POOL = 1500

type Level = 'IC' | 'Manager' | 'Director' | 'VP' | 'C-Suite'

function levelOf(raw: string | null | undefined): Level | null {
  return raw === 'IC' || raw === 'Manager' || raw === 'Director' || raw === 'VP' || raw === 'C-Suite' ? raw : null
}

// How close a candidate's level is to the kind of hiring each signal causes.
// Departures open the named chief seat (C-Suite/VP fit) and its backfills
// (Director). A new chief rebuilds the team under them (VP/Director). A
// funding round hires across senior levels.
const LEVEL_FIT: Record<LikelyOpeningSignalType, Record<Level, number>> = {
  EXEC_DEPARTURE: { 'C-Suite': 30, VP: 25, Director: 12, Manager: 0, IC: 0 },
  EXEC_APPOINTMENT: { 'C-Suite': 12, VP: 25, Director: 20, Manager: 5, IC: 0 },
  FUNDING_RAISE: { 'C-Suite': 15, VP: 20, Director: 20, Manager: 12, IC: 5 },
}

export interface ScoreInput {
  signalType: LikelyOpeningSignalType
  roles: string[]
  filingDate: Date
  amountRaised: number | null
  companyRelation: 'watched' | 'applied' | null
}

/** Pure scorer — exported for tests. Returns the score and the reason shown to the candidate. */
export function scoreLikelyOpening(
  signal: ScoreInput,
  candidate: LikelyOpeningCandidate,
  now = new Date()
): { score: number; reason: string | null; functionFit: boolean } {
  let score = 0
  let reason: string | null = null

  if (signal.companyRelation === 'watched') {
    score += 100
    reason = 'On your Company Tracker'
  } else if (signal.companyRelation === 'applied') {
    score += 60
    reason = 'You applied here'
  }

  const roleFunctions = new Set(
    signal.roles.filter(isOfficerRole).flatMap((r: OfficerRole) => ROLE_FUNCTIONS[r])
  )
  let functionFit = false
  const fits: [string | null | undefined, number][] = [
    [candidate.targetFunction, 40],
    [candidate.primaryFunction, 30],
    [candidate.secondaryFunction, 15],
  ]
  for (const [fn, points] of fits) {
    if (fn && roleFunctions.has(fn)) {
      score += points
      functionFit = true
      reason ??= `Fits your ${fn.toLowerCase()} background`
      break
    }
  }
  // A new CEO's rebuild and a funding round hire across functions.
  if (!functionFit && (signal.signalType === 'FUNDING_RAISE' || signal.roles.includes('CEO'))) score += 8

  const level = levelOf(candidate.highestLevelReached)
  score += level ? LEVEL_FIT[signal.signalType][level] : 8

  if (signal.amountRaised && signal.amountRaised >= 10_000_000) {
    score += Math.min(15, Math.round(Math.log10(signal.amountRaised / 10_000_000) * 10))
  }

  const ageDays = (now.getTime() - signal.filingDate.getTime()) / 86_400_000
  score += Math.max(0, Math.round(20 - ageDays / 6))

  return { score, reason, functionFit }
}

/**
 * Active SEC "likely opening" signals ranked for one candidate: companies
 * they watch or applied to first, then function fit (the implied role vs.
 * their target/primary/secondary function), level fit, deal size and
 * freshness. Signals with no company tie and no function fit are dropped
 * unless nothing better fills the list — a stranger's CFO search is noise to
 * a marketing director.
 */
export async function getLikelyOpeningsForCandidate(
  candidate: LikelyOpeningCandidate,
  { limit = 10 }: { limit?: number } = {}
): Promise<LikelyOpeningForCandidate[]> {
  const now = new Date()
  const [watched, applied] = await Promise.all([
    prisma.companyWatchlistEntry.findMany({ where: { candidateId: candidate.id }, select: { companyName: true } }),
    prisma.jobPosting.findMany({
      where: { candidateId: candidate.id, companyName: { not: null } },
      select: { companyName: true },
      distinct: ['companyName'],
    }),
  ])
  const watchedKeys = new Set(watched.map((w) => companyKey(w.companyName)).filter(Boolean))
  const appliedKeys = new Set(applied.map((a) => companyKey(a.companyName!)).filter(Boolean))
  const ownKeys = [...new Set([...watchedKeys, ...appliedKeys])]

  const select = {
    id: true, companyName: true, companyNameNormalized: true, signalType: true, roles: true, summary: true,
    filingDate: true, filingUrl: true, amountRaised: true, industry: true, location: true,
  } as const
  const [own, recent] = await Promise.all([
    ownKeys.length
      ? prisma.likelyOpening.findMany({ where: { companyNameNormalized: { in: ownKeys }, expiresAt: { gt: now } }, select })
      : Promise.resolve([]),
    prisma.likelyOpening.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { filingDate: 'desc' },
      take: RECENT_POOL,
      select,
    }),
  ])

  const byId = new Map([...recent, ...own].map((r) => [r.id, r]))
  const ranked = [...byId.values()].map((row) => {
    const companyRelation = watchedKeys.has(row.companyNameNormalized)
      ? ('watched' as const)
      : appliedKeys.has(row.companyNameNormalized)
        ? ('applied' as const)
        : null
    const { score, reason, functionFit } = scoreLikelyOpening({ ...row, companyRelation }, candidate, now)
    const { companyNameNormalized: _key, ...view } = row
    void _key
    return { ...view, companyRelation, reason, score, relevant: companyRelation !== null || functionFit }
  })
  ranked.sort((a, b) => Number(b.relevant) - Number(a.relevant) || b.score - a.score)

  // One signal per company — the strongest — so a company that filed twice
  // doesn't take two slots.
  const seen = new Set<string>()
  const out: LikelyOpeningForCandidate[] = []
  for (const { relevant: _r, ...row } of ranked) {
    void _r
    const key = row.companyName.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
    if (out.length >= limit) break
  }
  return out
}
