import 'server-only'
import { prisma } from '@/lib/prisma'
import type { CommittedAction } from '@/lib/weekly/sprint'

// Community/give-action signal ("helpfulness in the community") must never
// display as a raw number on any candidate-facing or external-facing
// surface — it converts to a labeled tier instead, same pattern as the
// Search Execution badge ("Actively running a serious search" — a label,
// not a score). The underlying count (encouragement notes sent + completed
// ENGAGE_PEER_SUPPORT actions) is fine to store and to show in
// internal/admin views — just never here. Shared by the Certified
// Executive Dossier (recruiter-report.ts) and its "Impact on People"
// section so the tier logic and copy live in exactly one place.
//
// Thresholds are starting points, not calibrated against real usage data —
// revisit once there's enough Support Network activity to know what
// "actively helpful" looks like at real volume.
const TIER_THRESHOLDS = {
  connector: 15,
  engaged: 8,
  first: 3,
} as const

export type CommunityTier = 'go_to' | 'connector' | 'engaged' | null

export function communityTier(giveActionCount: number): CommunityTier {
  if (giveActionCount >= TIER_THRESHOLDS.connector) return 'go_to'
  if (giveActionCount >= TIER_THRESHOLDS.engaged) return 'connector'
  if (giveActionCount >= TIER_THRESHOLDS.first) return 'engaged'
  return null
}

const TIER_NARRATIVE: Record<Exclude<CommunityTier, null>, string> = {
  engaged: 'An engaged member of the NextChapter community — shows up for other job seekers with encouragement and support.',
  connector:
    'Known within the NextChapter community as a Connector — regularly shares job leads, offers advice, and makes introductions for other members.',
  go_to:
    'Widely regarded within the NextChapter community as a go-to resource — consistently offers advice, makes introductions, and supports other members through their search.',
}

// Returns null below the first threshold — no badge shown, not flagged as
// a gap either. Never returns or embeds the raw count.
export function communityTierNarrative(giveActionCount: number): string | null {
  const tier = communityTier(giveActionCount)
  return tier ? TIER_NARRATIVE[tier] : null
}

const TIER_LABEL: Record<Exclude<CommunityTier, null>, string> = {
  engaged: 'Engaged Community Member',
  connector: 'Connector — Shares Opportunities & Advice',
  go_to: 'Go-To for Advice, Intros, and Support',
}

export function communityTierLabel(giveActionCount: number): string | null {
  const tier = communityTier(giveActionCount)
  return tier ? TIER_LABEL[tier] : null
}

// Helpfulness from sharing what members learned at work — rating an employer,
// recommending (or not) a place, describing its culture, publishing a company tip.
// Same rule as above: a labeled tier, never the count. Lower thresholds than the
// give-action tiers because each contribution is a real, specific piece of
// information about a named employer, and a member has only so many past jobs.
export type InsightTier = 'contributor' | 'trusted' | 'go_to' | null

export function insightTier(contributionCount: number): InsightTier {
  if (contributionCount >= 8) return 'go_to'
  if (contributionCount >= 3) return 'trusted'
  if (contributionCount >= 1) return 'contributor'
  return null
}

const INSIGHT_NARRATIVE: Record<Exclude<InsightTier, null>, string> = {
  contributor: 'Shares what they have learned about past employers so other NextChapter members can decide where to apply.',
  trusted:
    'A trusted voice on employers within the NextChapter community — rates and reviews the places they have worked and says whether they would recommend them.',
  go_to:
    'A go-to source on employers within the NextChapter community — has rated, reviewed and recommended many of the places they have worked, helping other members choose well.',
}

export function insightNarrative(contributionCount: number): string | null {
  const tier = insightTier(contributionCount)
  return tier ? INSIGHT_NARRATIVE[tier] : null
}

// The one place this count is computed — shared by recruiter-report.ts and
// dossier-sections.ts so both read the exact same underlying number, never
// a duplicate/divergent calculation.
export async function computeCandidatePeerSupportCount(candidateId: string): Promise<number> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      weeklySprints: { select: { committedActions: true } },
      _count: { select: { encouragementNotesSent: true } },
    },
  })
  const peerSupportActionCount = candidate.weeklySprints.reduce((sum, sprint) => {
    const actions = sprint.committedActions as unknown as CommittedAction[]
    return sum + actions.filter((a) => a.completed && a.actionType === 'ENGAGE_PEER_SUPPORT').length
  }, 0)
  return candidate._count.encouragementNotesSent + peerSupportActionCount
}
