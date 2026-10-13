import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { loadWorkspace } from '@/lib/in-work/workspace-data'
import { InWorkWorkspace, type InWorkTab } from '@/components/in-work/InWorkWorkspace'

export const metadata: Metadata = { title: 'In-work workspace' }

const TABS: InWorkTab[] = ['overview', 'impact', 'prep', 'salary', 'promotion', 'feedback', 'outcome']

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function InWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const profile = await getDashboardProfile()
  const data = await loadWorkspace(profile)

  const tabParam = first(sp.tab)
  const initialTab: InWorkTab = TABS.includes(tabParam as InWorkTab) ? (tabParam as InWorkTab) : 'overview'

  // The review-cycle emails link here with src=inwork_email.
  if (first(sp.src) === 'inwork_email') {
    captureServerEvent(profile.id, 'in_work_email_clicked', {
      kind: first(sp.kind) ?? null,
      cycleKey: first(sp.cycle) ?? null,
      tab: initialTab,
    })
  }
  captureServerEvent(profile.id, 'in_work_workspace_viewed', {
    tab: initialTab,
    inWorkJourney: data.inWorkJourney,
    winCount: data.wins.length,
    hasReviewDate: !!data.settings.nextReviewDate || data.settings.anchorMonth !== null,
    fromEmail: first(sp.src) === 'inwork_email',
  })

  return <InWorkWorkspace data={data} initialTab={initialTab} />
}
