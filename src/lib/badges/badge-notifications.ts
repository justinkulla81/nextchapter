import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendBadgeEarnedEmail } from '@/lib/email/send-badge-earned-email'
import { captureServerEvent } from '@/lib/posthog/server'

// Shared "diff against what's already persisted, upsert everything, notify
// only what's genuinely new" logic for both badge systems — weekly-badges.ts
// (WeeklyBadgeEarned, also shared by leaderboard/badges.ts's TOP3_* rows)
// and milestone-badges.ts (MilestoneBadge). Deliberately takes
// {badgeKey, label} pairs rather than importing the label maps itself —
// weekly-badges.ts/milestone-badges.ts both need to call INTO this module,
// so importing their label maps back here would be a circular import.
//
// The popup itself is a separate concern (getPendingBadgeNotices, gated on
// notifiedAt IS NULL) — this module never sets notifiedAt on the rows it
// creates, so a freshly-earned badge stays "pending" until the candidate
// actually sees the popup and it's acknowledged.

export interface PendingBadgeNotice {
  id: string
  badgeKey: string
  earnedAt: Date
}

async function notifyNewBadges(candidateId: string, newlyEarned: { badgeKey: string; label: string }[]): Promise<void> {
  if (newlyEarned.length === 0) return

  captureServerEvent(candidateId, 'badge_earned', { badgeKeys: newlyEarned.map((b) => b.badgeKey) })

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { id: true, userId: true, firstName: true },
  })
  if (!candidate) return

  await sendBadgeEarnedEmail(candidate, newlyEarned.map((b) => b.label)).catch((error) =>
    console.error('Failed to send badge-earned email:', error)
  )
}

export async function persistWeeklyBadgesAndNotify(
  candidateId: string,
  weekStartDate: Date,
  earned: { badgeKey: string; label: string }[]
): Promise<void> {
  if (earned.length === 0) return

  const existing = await prisma.weeklyBadgeEarned.findMany({
    where: { candidateId, weekStartDate, badgeKey: { in: earned.map((e) => e.badgeKey) } },
    select: { badgeKey: true },
  })
  const existingKeys = new Set(existing.map((r) => r.badgeKey))
  const newlyEarned = earned.filter((e) => !existingKeys.has(e.badgeKey))

  await Promise.all(
    earned.map((e) =>
      prisma.weeklyBadgeEarned
        .upsert({
          where: { candidateId_weekStartDate_badgeKey: { candidateId, weekStartDate, badgeKey: e.badgeKey } },
          update: {},
          create: { candidateId, weekStartDate, badgeKey: e.badgeKey },
        })
        .catch((error) => console.error('Failed to persist weekly badge:', error))
    )
  )

  await notifyNewBadges(candidateId, newlyEarned)
}

export async function persistMilestoneBadgesAndNotify(
  candidateId: string,
  earned: { badgeKey: string; label: string }[]
): Promise<void> {
  if (earned.length === 0) return

  const existing = await prisma.milestoneBadge.findMany({
    where: { candidateId, badgeKey: { in: earned.map((e) => e.badgeKey) } },
    select: { badgeKey: true },
  })
  const existingKeys = new Set(existing.map((r) => r.badgeKey))
  const newlyEarned = earned.filter((e) => !existingKeys.has(e.badgeKey))

  await Promise.all(
    earned.map((e) =>
      prisma.milestoneBadge
        .upsert({
          where: { candidateId_badgeKey: { candidateId, badgeKey: e.badgeKey } },
          update: {},
          create: { candidateId, badgeKey: e.badgeKey },
        })
        .catch((error) => console.error('Failed to persist milestone badge:', error))
    )
  )

  await notifyNewBadges(candidateId, newlyEarned)
}

// Raw {id, badgeKey, earnedAt} only — resolving badgeKey to a display label
// is the caller's job (it already needs WEEKLY_BADGE_LABEL/
// MILESTONE_BADGE_LABEL for other reasons, and importing them here would
// create the same circular-import problem noted above).
export async function getPendingBadgeNotices(
  candidateId: string
): Promise<{ weekly: PendingBadgeNotice[]; milestone: PendingBadgeNotice[] }> {
  const [weekly, milestone] = await Promise.all([
    prisma.weeklyBadgeEarned.findMany({
      where: { candidateId, notifiedAt: null },
      orderBy: { earnedAt: 'asc' },
      select: { id: true, badgeKey: true, earnedAt: true },
    }),
    prisma.milestoneBadge.findMany({
      where: { candidateId, notifiedAt: null },
      orderBy: { earnedAt: 'asc' },
      select: { id: true, badgeKey: true, earnedAt: true },
    }),
  ])
  return { weekly, milestone }
}

export async function acknowledgeBadgeNotices(
  candidateId: string,
  ids: { weeklyIds: string[]; milestoneIds: string[] }
): Promise<void> {
  await Promise.all([
    ids.weeklyIds.length > 0
      ? prisma.weeklyBadgeEarned.updateMany({
          where: { id: { in: ids.weeklyIds }, candidateId },
          data: { notifiedAt: new Date() },
        })
      : Promise.resolve(),
    ids.milestoneIds.length > 0
      ? prisma.milestoneBadge.updateMany({
          where: { id: { in: ids.milestoneIds }, candidateId },
          data: { notifiedAt: new Date() },
        })
      : Promise.resolve(),
  ])
}
