// Real events that should move a category's baseline directly, because
// they make the candidate objectively more market-ready — not just
// generate weekly effort points. See the Scoring Model 2.0 design doc §7.
//
// These call updateCategoryBaseline (hireability-grade.ts) rather than
// waiting for the bounded weekly nudge, since a landed interview or a
// closed skills gap is a real, discrete change in standing, not a
// gradual behavioral trend.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { updateCategoryBaseline } from '@/lib/scoring/hireability-grade'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

async function currentBaseline(candidateId: string, category: 'targetFit'): Promise<number> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const stored = candidate.categoryBaselineScores as Record<string, number> | null
  return stored?.[category] ?? 60
}

// A real interview is external validation the market said yes — the
// single highest-signal event available, and one Target Fit currently has
// no way to reflect on its own.
export async function applyInterviewLandedRewrite(candidateId: string): Promise<void> {
  const current = await currentBaseline(candidateId, 'targetFit')
  await updateCategoryBaseline(candidateId, 'targetFit', clamp(current + 8))
}

// An offer is the same signal, stronger.
export async function applyOfferReceivedRewrite(candidateId: string): Promise<void> {
  const current = await currentBaseline(candidateId, 'targetFit')
  await updateCategoryBaseline(candidateId, 'targetFit', clamp(current + 15))
}
