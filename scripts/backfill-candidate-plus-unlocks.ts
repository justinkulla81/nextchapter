// One-time backfill (2026-10-16): Candidate+ is permanent once earned.
// 1. Anyone whose WeeklySprint history ever reached the 6-week streak gets
//    candidatePlusUnlockedAt = the end of that week, source 'streak'.
// 2. Everyone else is checked through isDossierUnlocked itself, which records a
//    first unlock on the main path ('requirements'). Read-only for everyone else.
// Skips anyone already recorded or revoked by an admin. Idempotent.
//
// Dry run:  npx tsx --conditions=react-server --env-file=.env.local scripts/backfill-candidate-plus-unlocks.ts
// Write:    ... scripts/backfill-candidate-plus-unlocks.ts --apply

import { prisma } from '@/lib/prisma'
import { firstStreakReachedAt } from '@/lib/scoring/streak-history'

const STREAK_WEEKS = 6 // ALTERNATE_UNLOCK_SPRINT_STREAK_WEEKS in dossier-unlock.ts
const apply = process.argv.includes('--apply')

async function main() {
  const members = await prisma.candidateProfile.findMany({
    where: { candidatePlusUnlockedAt: null, candidatePlusRevokedAt: null },
    select: { id: true },
  })
  const sprints = await prisma.weeklySprint.findMany({
    where: { candidateId: { in: members.map((m) => m.id) } },
    select: { candidateId: true, weekStartDate: true, committedActions: true },
  })
  const byMember = new Map<string, typeof sprints>()
  for (const s of sprints) byMember.set(s.candidateId, [...(byMember.get(s.candidateId) ?? []), s])

  let streak = 0
  const streakIds = new Set<string>()
  for (const [id, rows] of byMember) {
    const at = firstStreakReachedAt(rows, STREAK_WEEKS)
    if (!at) continue
    streak++
    streakIds.add(id)
    console.log(`${id}: streak reached ${at.toISOString().slice(0, 10)}`)
    if (apply) {
      await prisma.candidateProfile.updateMany({
        where: { id, candidatePlusUnlockedAt: null, candidatePlusRevokedAt: null },
        data: { candidatePlusUnlockedAt: at, candidatePlusUnlockSource: 'streak' },
      })
    }
  }

  let requirements = 0
  if (apply) {
    const { isDossierUnlocked } = await import('@/lib/scoring/dossier-unlock')
    for (const { id } of members) {
      if (streakIds.has(id)) continue
      const status = await isDossierUnlocked(id)
      if (status.unlocked) {
        requirements++
        console.log(`${id}: requirements met`)
      }
    }
  }
  console.log(`\nMembers checked: ${members.length}. Streak unlocks ${apply ? 'recorded' : 'to record'}: ${streak}.${apply ? ` Requirement unlocks recorded: ${requirements}.` : ''}`)
}

main().finally(() => prisma.$disconnect())
