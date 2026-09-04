// Empirical spot-check for the context-aware seniority-leveling work
// (finance/law/investment-firm title ladders) — prints the OLD
// (inferLevelFromTitle-only) vs NEW (resolveContextualLevel-aware) level
// and calibratedLevelRank score for every real WorkHistoryEntry whose
// title looks like it belongs to one of the affected ladders. Read-only —
// never writes anything. companySizeBand is intentionally left null here
// (resolveCompanySizeBand is 'server-only'/LLM-backed and not importable
// from a plain script — same constraint grade-recalibration-check.ts hit
// for composite.ts), so scores below are anchor-band-only; still enough to
// spot-check level and scoreNudge correctness by hand.
//
// Run: npx tsx --env-file=.env.local scripts/scratch/seniority-context-check.ts

import { PrismaClient, type WorkHistoryEntry } from '@prisma/client'
import { inferLevelFromTitle, isAmbiguousPartnerTitle } from '../../src/lib/jobs/infer-job-function'
import { resolveContextualLevel, type ConcurrentRoleCandidate } from '../../src/lib/scoring/seniority/resolve-contextual-level'
import { calibratedLevelRank } from '../../src/lib/scoring/level-rank'

const prisma = new PrismaClient()

const KEYWORD_PATTERN = /\b(vice president|vp|managing director|analyst|operating partner|associate|advisor|adviser|consultant|partner|director|principal|chairman|chairperson|owner)\b/i

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

function effectiveEnd(entry: WorkHistoryEntry, now: Date): Date {
  if (entry.isCurrent) return now
  return entry.endDate ?? entry.startDate
}

function buildConcurrentRoles(entry: WorkHistoryEntry, all: WorkHistoryEntry[], now: Date): ConcurrentRoleCandidate[] {
  const entryEnd = effectiveEnd(entry, now).getTime()
  const entryStart = entry.startDate.getTime()
  return all
    .filter((other) => other.id !== entry.id)
    .filter((other) => {
      const otherEnd = effectiveEnd(other, now).getTime()
      return other.startDate.getTime() < entryEnd && otherEnd > entryStart
    })
    .map((other) => ({
      title: other.roleTitle,
      startDateMs: other.startDate.getTime(),
      endDateMs: other.isCurrent ? null : (other.endDate?.getTime() ?? null),
      isDeclaredFullTime: other.engagementType === 'FULL_TIME',
      tenureMonths: (effectiveEnd(other, now).getTime() - other.startDate.getTime()) / (MS_PER_YEAR / 12),
    }))
}

async function main() {
  const matching = await prisma.workHistoryEntry.findMany({
    select: {
      id: true,
      candidateId: true,
      roleTitle: true,
      companyName: true,
      companyIndustry: true,
      startDate: true,
      endDate: true,
      isCurrent: true,
      engagementType: true,
    },
  })
  const affected = matching.filter((e) => KEYWORD_PATTERN.test(e.roleTitle))

  if (affected.length === 0) {
    console.log('No WorkHistoryEntry rows match the finance/law/investment-firm keyword set — nothing to check.')
    return
  }

  const candidateIds = [...new Set(affected.map((e) => e.candidateId))]
  const allByCandidateId = await prisma.workHistoryEntry.findMany({ where: { candidateId: { in: candidateIds } } })
  const byCandidateId = new Map<string, WorkHistoryEntry[]>()
  for (const e of allByCandidateId) {
    const list = byCandidateId.get(e.candidateId) ?? []
    list.push(e)
    byCandidateId.set(e.candidateId, list)
  }

  const now = new Date()
  let changedCount = 0

  for (const entry of affected) {
    const full = byCandidateId.get(entry.candidateId) ?? []
    const fullEntry = full.find((e) => e.id === entry.id)
    if (!fullEntry) continue

    const sortedAsc = [...full].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    const yearsIntoCareerAtStart = (entry.startDate.getTime() - sortedAsc[0].startDate.getTime()) / MS_PER_YEAR
    const tenureMonthsInRole = (effectiveEnd(fullEntry, now).getTime() - entry.startDate.getTime()) / (MS_PER_YEAR / 12)

    const oldInferred = inferLevelFromTitle(entry.roleTitle)
    const oldLevel = oldInferred === 'C-Suite' && isAmbiguousPartnerTitle(entry.roleTitle) ? 'C-Suite (ambiguous)' : oldInferred
    const oldScore = calibratedLevelRank(oldInferred, null)

    const contextual = resolveContextualLevel({
      title: entry.roleTitle,
      companyName: entry.companyName,
      freeformIndustry: entry.companyIndustry,
      tenureMonthsInRole,
      yearsIntoCareerAtStart,
      companySizeBand: null,
      concurrentRoles: buildConcurrentRoles(fullEntry, full, now),
    })
    const newLevel = contextual?.level ?? oldInferred
    const newScore = contextual ? calibratedLevelRank(newLevel, null, contextual.scoreNudge ?? 0) : oldScore

    const changed = contextual !== undefined && (contextual.level !== null || (contextual.weightMultiplier ?? 1) !== 1)
    if (changed) changedCount++

    console.log(
      `${changed ? '* ' : '  '}"${entry.roleTitle}" @ ${entry.companyName}` +
        `  old=${oldLevel}(${oldScore})  new=${newLevel}(${newScore})` +
        (contextual?.reason ? `  reason=${contextual.reason}` : '  reason=<no contextual match>') +
        (contextual?.weightMultiplier !== undefined && contextual.weightMultiplier !== 1
          ? `  weightMultiplier=${contextual.weightMultiplier}`
          : '')
    )
  }

  console.log(`\n${affected.length} keyword-matching entries checked, ${changedCount} changed by the new contextual logic.`)
}

main().finally(() => prisma.$disconnect())
