// "Five guided bullets" step (§13.1) — no existing precedent for this
// mechanic (see WorkHistoryForm/addWorkHistoryEntry), so this is built from
// scratch. WorkHistoryEntry stores exactly one bullet-shaped field per role
// — keyAchievement: String? — not an array of bullets (checked
// prisma/schema.prisma WorkHistoryEntry before deciding). So "five guided
// bullets" means: up to 5 WorkHistoryEntry rows across the candidate's
// whole work history, picked for having the weakest (missing/short/
// number-less) keyAchievement, each getting its own guided Q&A screen that
// composes a replacement for that same field.

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { WorkHistoryEntry } from '@prisma/client'

const MAX_BULLET_CANDIDATES = 5
const SHORT_ACHIEVEMENT_LENGTH = 40

// Lower = weaker = higher priority for the guided walkthrough. 4 means
// "already has a number and reasonable length" — not a candidate at all.
function weaknessScore(entry: WorkHistoryEntry): number {
  const text = entry.keyAchievement?.trim() ?? ''
  if (!text) return 0
  const hasNumber = /\d/.test(text)
  const isShort = text.length < SHORT_ACHIEVEMENT_LENGTH
  if (!hasNumber && isShort) return 1
  if (!hasNumber) return 2
  if (isShort) return 3
  return 4
}

export async function getGuidedBulletCandidates(candidateId: string): Promise<WorkHistoryEntry[]> {
  const entries = await prisma.workHistoryEntry.findMany({
    where: { candidateId },
    orderBy: { startDate: 'desc' },
  })

  return entries
    .map((entry) => ({ entry, weakness: weaknessScore(entry) }))
    .filter(({ weakness }) => weakness < 4)
    .sort((a, b) => a.weakness - b.weakness)
    .slice(0, MAX_BULLET_CANDIDATES)
    .map(({ entry }) => entry)
}
