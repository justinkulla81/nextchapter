import 'server-only'
import { prisma } from '@/lib/prisma'
import { startOfPacificDay } from '@/lib/dashboard/pacific-day'
import type { PageBoxType, VideoProvider } from '@prisma/client'

// Every page the sitewide 3-box header rolls out to. Adding a page later
// only requires adding its key here plus seeding content for it — no
// architecture change.
export const PAGE_KEYS = [
  'dashboard',
  'network',
  'network-contacts',
  'find-my-job',
  'resume',
  'interview-prep',
  'marketing-plan',
  'learning',
  'linkedin',
  'interim-work',
  'work-samples',
  'community',
  'profile',
  'privacy',
  'portfolio',
  'references',
  'skills-assessments',
  'search-strategy',
  'stats',
  'got-hired',
  'benefits',
  'support',
  'webinars',
  'market-reality',
] as const

export type PageKey = (typeof PAGE_KEYS)[number]

export function isPageKey(value: string): value is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(value)
}

export interface PageContentView {
  id: string
  title: string
  leadIn: string | null
  bullets: string[]
  footer: string | null
  videoProvider: VideoProvider | null
  videoUrl: string | null
  useInlineEmbed: boolean
  isPinned: boolean
}

// Selection mirrors the old getNextDashboardMessage (pinned wins, then
// sequenceOrder asc nulls-last, then createdAt asc) but is scoped per page
// and box type, and respects a publish/expire window. WHY_IT_MATTERS
// dismissals are permanent (that box type is no longer rendered
// candidate-side, but the dismissal contract stays generic); ACTION_PLAN
// dismissals ("minimized") only count for the rest of the day (see
// isActionPlanMinimizedToday below). DAILY_MESSAGE dismissals are also
// permanent, but per-message rather than per-box: dismissing one message
// excludes just that PageContent.id from future selection (dismissedAt
// itself is unused for this boxType) — a pinned message says its piece
// once and then steps aside for the rotation, and once the whole pool for
// a page is exhausted the box simply stops rendering, rather than the same
// message reappearing every day forever.
//
// dynamicOverride lets a caller inject a computed, non-admin-authored
// message (e.g. "new jobs at a company you're watching" — see
// getWatchlistAlertContent) that takes priority over the static rotation
// below whenever it's present. It still goes through the same per-message
// dismissal check as everything else.
export async function getPageBoxContent(
  candidateId: string,
  pageKey: PageKey,
  boxType: PageBoxType,
  dynamicOverride?: PageContentView | null
): Promise<PageContentView | null> {
  const dismissal = await prisma.pageBoxDismissal.findUnique({
    where: { candidateId_pageKey_boxType: { candidateId, pageKey, boxType } },
  })

  if (boxType !== 'DAILY_MESSAGE') {
    const isDismissed = dismissal
      ? boxType === 'WHY_IT_MATTERS' || dismissal.dismissedAt >= startOfPacificDay()
      : false
    if (isDismissed) return null
  }

  const dismissedContentIds = dismissal?.dismissedContentIds ?? []

  if (dynamicOverride) return dismissedContentIds.includes(dynamicOverride.id) ? null : dynamicOverride

  const now = new Date()
  const where = {
    pageKey,
    boxType,
    isActive: true,
    id: { notIn: dismissedContentIds },
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
  }

  const pinned =
    boxType === 'DAILY_MESSAGE' ? await prisma.pageContent.findFirst({ where: { ...where, isPinned: true } }) : null
  if (pinned) return pinned

  return prisma.pageContent.findFirst({
    where: { ...where, isPinned: false },
    orderBy: [{ sequenceOrder: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  })
}

// contentId is required for DAILY_MESSAGE (the message actually shown —
// see getPageBoxContent's per-message dismissal above) and ignored for
// every other boxType, which still key off dismissedAt alone.
export async function dismissPageBox(
  candidateId: string,
  pageKey: PageKey,
  boxType: PageBoxType,
  contentId?: string
): Promise<void> {
  if (boxType === 'DAILY_MESSAGE' && contentId) {
    await prisma.pageBoxDismissal.upsert({
      where: { candidateId_pageKey_boxType: { candidateId, pageKey, boxType } },
      create: { candidateId, pageKey, boxType, dismissedContentIds: [contentId] },
      update: { dismissedAt: new Date(), dismissedContentIds: { push: contentId } },
    })
    return
  }

  await prisma.pageBoxDismissal.upsert({
    where: { candidateId_pageKey_boxType: { candidateId, pageKey, boxType } },
    create: { candidateId, pageKey, boxType },
    update: { dismissedAt: new Date() },
  })
}

// Action Plan minimize state reuses the same PageBoxDismissal row/contract
// as Daily Message dismissal (see dismissPageBox above) — "dismissed" here
// means "minimized," and it resets at the same 12:01am Pacific boundary.
// Unlike Daily Message, this one is bidirectional within the same day: the
// candidate can re-maximize before the boundary, which clears the row
// entirely (no dismissal record == not minimized) rather than waiting for
// tomorrow like a normal dismissal would.
export async function isActionPlanMinimizedToday(candidateId: string, pageKey: PageKey): Promise<boolean> {
  const dismissal = await prisma.pageBoxDismissal.findUnique({
    where: { candidateId_pageKey_boxType: { candidateId, pageKey, boxType: 'ACTION_PLAN' } },
  })
  return dismissal ? dismissal.dismissedAt >= startOfPacificDay() : false
}

export async function minimizeActionPlanBox(candidateId: string, pageKey: PageKey): Promise<void> {
  await dismissPageBox(candidateId, pageKey, 'ACTION_PLAN')
}

export async function maximizeActionPlanBox(candidateId: string, pageKey: PageKey): Promise<void> {
  await prisma.pageBoxDismissal.deleteMany({
    where: { candidateId, pageKey, boxType: 'ACTION_PLAN' },
  })
}

