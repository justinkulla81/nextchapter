import { getPageBoxContent, type PageKey } from '@/lib/dashboard/page-content'
import { getWatchlistAlertContent } from '@/lib/company-tracker/watchlist'
import { DailyMessageBox } from '@/components/dashboard/DailyMessageBox'
import { WhyItMattersBox } from '@/components/dashboard/WhyItMattersBox'
import { ActionPlanBox } from '@/components/dashboard/ActionPlanBox'

// Pages where a new watchlisted-company job posting should preempt the
// admin-authored Daily Message rotation. Deliberately not every page in
// PAGE_KEYS — this is a jobs-search-specific nudge, not sitewide content.
const WATCHLIST_ALERT_PAGES: readonly PageKey[] = ['dashboard', 'find-my-job']

// The standardized 3-box header: Daily Message (dismissable for the day),
// Why It Matters (dismissable permanently, re-enableable from
// /dashboard/privacy), and Action Plan (not dismissable — every real,
// doable action on this specific page). Drop this once, right under a
// page's <h1>, instead of hand-writing a subhead paragraph and a
// SprintActionCompletion call.
export async function PageHeaderBoxes({
  pageKey,
  candidateId,
  lifetimeProgress,
}: {
  pageKey: PageKey
  candidateId: string
  lifetimeProgress?: Partial<Record<string, { current: number; target: number }>>
}) {
  const watchlistAlert = WATCHLIST_ALERT_PAGES.includes(pageKey) ? await getWatchlistAlertContent(candidateId) : null

  const [dailyMessage, whyItMatters] = await Promise.all([
    getPageBoxContent(candidateId, pageKey, 'DAILY_MESSAGE', watchlistAlert),
    getPageBoxContent(candidateId, pageKey, 'WHY_IT_MATTERS'),
  ])

  return (
    <div className="space-y-3">
      <DailyMessageBox pageKey={pageKey} content={dailyMessage} />
      <WhyItMattersBox pageKey={pageKey} content={whyItMatters} />
      <ActionPlanBox pageKey={pageKey} candidateId={candidateId} lifetimeProgress={lifetimeProgress} />
    </div>
  )
}
