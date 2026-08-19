import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { getMarketConditions } from '@/lib/market'
import { computeCompBandForTarget } from '@/lib/market-intelligence/comp-bands'
import { getWarmPathCandidateContacts, matchWarmPathContacts } from '@/lib/market-intelligence/warm-paths'

// Partners Master Build Script §A3.4 — Premium weekly personalized market
// brief. "Generated, not curated by hand," but every line must trace to a
// real fact this candidate actually has — the spec's own sample line
// ("Verity filed WARN, 90 positions") is exactly the kind of thing this
// function must NEVER produce, since no WARN data exists anywhere in this
// codebase. factsForBrief() below assembles only real, already-computed
// facts as plain-language bullets; a fact category with nothing real to
// report is simply left out of the list rather than backfilled with a
// placeholder. generateBriefProse() then asks the model to compose those
// bullets into the spec's tone/format WITHOUT adding anything not already
// in the list — same "compose from a closed fact set" discipline as
// src/lib/coach/session-impact.ts's generateImpactSummary.
const MAX_WATCHLIST_COMPANIES = 8

interface BriefFact {
  bullet: string
}

async function factsForBrief(candidateId: string): Promise<{ facts: BriefFact[]; hasAnyRealSignal: boolean }> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { targetFunction: true, primaryFunction: true, targetRoleType: true, currentCity: true, currentState: true },
  })
  const targetFunction = candidate.targetFunction ?? candidate.primaryFunction

  const watchlist = await prisma.companyWatchlistEntry.findMany({
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
    take: MAX_WATCHLIST_COMPANIES,
  })

  const facts: BriefFact[] = []

  // ── Openings at your level (real Adzuna volume, same call market-check.ts
  // already makes for the exact same "your target role" concept) ──
  const marketConditions = await getMarketConditions({
    roleType: candidate.targetRoleType,
    primaryFunction: targetFunction,
    city: candidate.currentCity,
    state: candidate.currentState,
  })
  if (marketConditions.dataAvailable && marketConditions.adzunaCount !== null) {
    const location = candidate.currentCity && candidate.currentState ? `${candidate.currentCity}, ${candidate.currentState}` : 'your area'
    facts.push({
      bullet: `${marketConditions.adzunaCount} open roles currently posted matching your target${targetFunction ? ` (${targetFunction})` : ''} in ${location}.`,
    })
  }
  if (marketConditions.blsYoyChangePct !== null) {
    const direction = marketConditions.blsYoyChangePct >= 0 ? 'up' : 'down'
    facts.push({
      bullet: `BLS employment trend for this occupation is ${direction} ${Math.abs(marketConditions.blsYoyChangePct)}% year-over-year.`,
    })
  }

  // ── Comp band for target (only if the real sample is thick enough) ──
  const compBand = await computeCompBandForTarget(targetFunction)
  if (compBand.sufficientData && compBand.low !== null && compBand.high !== null) {
    facts.push({
      bullet: `The comp band for${compBand.matchedOnFunction ? ' your target function' : ' comparable director+ roles'} is $${compBand.low.toLocaleString()}–$${compBand.high.toLocaleString()} base, based on ${compBand.sampleSize} real posted salary ranges.`,
    })
  }

  // ── Per watchlist company: real trajectory + warm paths ──
  if (watchlist.length > 0) {
    const companies = await prisma.company.findMany({
      where: { canonicalNameNormalized: { in: watchlist.map((w) => w.companyNameNormalized) } },
      select: {
        id: true,
        name: true,
        canonicalNameNormalized: true,
        signals: { orderBy: { weekStartDate: 'desc' }, take: 1, select: { trajectory: true, rolesDelta4wk: true, openRolesTotal: true } },
      },
    })
    const companyByNorm = new Map(companies.map((c) => [c.canonicalNameNormalized, c]))
    // Fetched once here rather than once per watchlist entry — see
    // getWarmPathCandidateContacts's own comment for why.
    const warmPathContacts = await getWarmPathCandidateContacts(candidateId)

    for (const entry of watchlist) {
      const company = companyByNorm.get(entry.companyNameNormalized)
      const signal = company?.signals[0]
      if (signal && signal.openRolesTotal > 0) {
        facts.push({
          bullet: `${entry.companyName} (on your target list): ${signal.openRolesTotal} open roles, trajectory ${signal.trajectory}${signal.rolesDelta4wk !== 0 ? ` (${signal.rolesDelta4wk > 0 ? '+' : ''}${signal.rolesDelta4wk} in 4 weeks)` : ''}.`,
        })
      }

      const warmPaths = matchWarmPathContacts(warmPathContacts, entry.companyName)
      if (warmPaths.length > 0) {
        const strongest = warmPaths.find((w) => w.warmth === 'HOT') ?? warmPaths.find((w) => w.warmth === 'WARM') ?? warmPaths[0]
        facts.push({
          bullet: `You already have a ${strongest.warmth.toLowerCase()} contact at ${entry.companyName} in your network (${strongest.name}${strongest.title ? `, ${strongest.title}` : ''}) — worth reaching out through them.`,
        })
      }
    }
  }

  // ── Insider network — new current-employee insiders at watchlist
  // companies added in the last 7 days ──
  if (watchlist.length > 0) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const newInsiders = await prisma.memberEmployment.count({
      where: {
        candidateId: { not: candidateId },
        visibleAsInsider: true,
        createdAt: { gte: sevenDaysAgo },
        company: { canonicalNameNormalized: { in: watchlist.map((w) => w.companyNameNormalized) } },
      },
    })
    if (newInsiders > 0) {
      facts.push({
        bullet: `${newInsiders} new insider${newInsiders === 1 ? '' : 's'} became available to ask questions of at companies on your target list this week.`,
      })
    }
  }

  // Note: no "Contracting" (WARN) line and no board/advisory line are ever
  // added here — see this file's header comment and the Premium page's own
  // note on why board/advisory listings are read through Membership, not
  // this brief, for now.

  return { facts, hasAnyRealSignal: facts.length > 0 }
}

async function generateBriefProse(facts: BriefFact[], weekLabel: string): Promise<string> {
  const factsText = facts.map((f) => `- ${f.bullet}`).join('\n')
  try {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: `Write a short weekly market brief for a job-searching executive, week of ${weekLabel}. Use ONLY the facts listed below — never invent a company name, number, or claim that isn't explicitly given. If a fact category (openings, comp, target-company activity, warm paths, insider network) has no corresponding fact below, skip that category entirely rather than writing a placeholder sentence for it. Format as short labeled lines (bold-ish label, then one sentence), plain text, no markdown headers, 4-6 lines total, direct and specific tone.\n\nFacts:\n${factsText}`,
        },
      ],
    })
    const message = await stream.finalMessage()
    return message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
  } catch {
    // Real fallback: render the facts directly rather than losing them to a
    // failed LLM call — never silently drop real data.
    return factsText || 'No new market signal to report this week.'
  }
}

export interface WeeklyBrief {
  weekStartDate: Date
  content: string
  generatedAt: Date
  hasAnyRealSignal: boolean
}

export async function generateWeeklyBrief(candidateId: string): Promise<WeeklyBrief> {
  const weekStartDate = getMondayOfWeek(new Date())
  const { facts, hasAnyRealSignal } = await factsForBrief(candidateId)
  const weekLabel = weekStartDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  const content = hasAnyRealSignal
    ? await generateBriefProse(facts, weekLabel)
    : "No new market signal this week — nothing new on your target companies, comp data, or network for this week's window. Check back after adding companies to your watchlist or tagging more of your work history."

  const saved = await prisma.marketIntelWeeklyBrief.upsert({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate } },
    create: { candidateId, weekStartDate, factsJson: facts as unknown as Prisma.InputJsonValue, content },
    update: { factsJson: facts as unknown as Prisma.InputJsonValue, content, generatedAt: new Date() },
  })

  return { weekStartDate: saved.weekStartDate, content: saved.content, generatedAt: saved.generatedAt, hasAnyRealSignal }
}

export async function getLatestWeeklyBrief(candidateId: string): Promise<WeeklyBrief | null> {
  const row = await prisma.marketIntelWeeklyBrief.findFirst({
    where: { candidateId },
    orderBy: { weekStartDate: 'desc' },
  })
  if (!row) return null
  return {
    weekStartDate: row.weekStartDate,
    content: row.content,
    generatedAt: row.generatedAt,
    hasAnyRealSignal: (row.factsJson as unknown as BriefFact[]).length > 0,
  }
}
