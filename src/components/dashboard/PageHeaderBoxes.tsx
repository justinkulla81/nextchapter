import type { ReactNode } from 'react'
import { prisma } from '@/lib/prisma'
import { getPageBoxContent, type PageKey } from '@/lib/dashboard/page-content'
import { getWatchlistAlertContent } from '@/lib/company-tracker/watchlist'
import { getSearchStrategyDailyMessageOverride } from '@/lib/weekly/search-strategy-checklist'
import { DailyMessageBox } from '@/components/dashboard/DailyMessageBox'
import { ActionPlanBox } from '@/components/dashboard/ActionPlanBox'

// Pages where a new watchlisted-company job posting should preempt the
// admin-authored Daily Message rotation. Deliberately not every page in
// PAGE_KEYS — this is a jobs-search-specific nudge, not sitewide content.
const WATCHLIST_ALERT_PAGES: readonly PageKey[] = ['dashboard', 'find-my-job']

// The standardized 2-box header: Daily Message (dismissable for the day)
// and Action Plan (every real, doable action on this specific page —
// minimizable for the day via its own arrow, see ActionPlanCollapsible).
// Drop this once, right under a page's <h1>, instead of hand-writing a
// subhead paragraph and a SprintActionCompletion call.
export async function PageHeaderBoxes({
  pageKey,
  candidateId,
  lifetimeProgress,
  dailyMessageOverride,
}: {
  pageKey: PageKey
  candidateId: string
  lifetimeProgress?: Partial<Record<string, { current: number; target: number }>>
  // Lets a page substitute per-candidate computed content (e.g. the Network
  // page's outreach plan, which depends on the candidate's own comfort-level
  // answer) in the Daily Message slot instead of the generic admin-authored
  // rotation — avoids stacking two near-identical "personalized message"
  // cards on the same page.
  dailyMessageOverride?: ReactNode
}) {
  const watchlistAlert = WATCHLIST_ALERT_PAGES.includes(pageKey) ? await getWatchlistAlertContent(candidateId) : null
  const searchStrategyAlert =
    pageKey === 'search-strategy' ? await getSearchStrategyDailyMessageOverride(candidateId) : null

  const dailyMessage = dailyMessageOverride
    ? null
    : await getPageBoxContent(candidateId, pageKey, 'DAILY_MESSAGE', watchlistAlert ?? searchStrategyAlert)

  // "How NextChapter works with Victoria" — dashboard-only, appended below
  // whichever Daily Message content is currently rotating in rather than
  // tied to one specific rotation entry, so it stays visible across the
  // daily rotation until actually watched (see markWelcomeVideoWatched).
  const showWelcomeVideo =
    pageKey === 'dashboard' &&
    !(await prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { welcomeVideoWatchedAt: true } }))
      ?.welcomeVideoWatchedAt

  return (
    <div className="space-y-3">
      {dailyMessageOverride ?? (
        <DailyMessageBox pageKey={pageKey} content={dailyMessage} showWelcomeVideo={showWelcomeVideo} />
      )}
      <ActionPlanBox pageKey={pageKey} candidateId={candidateId} lifetimeProgress={lifetimeProgress} />
    </div>
  )
}
