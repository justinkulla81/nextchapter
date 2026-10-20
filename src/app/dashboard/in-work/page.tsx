import Link from 'next/link'
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
  // The workspace tables are applied by hand (prisma/manual/2026-10-13-in-work-track.sql).
  // Until they exist, show a plain notice instead of an error page.
  let data: Awaited<ReturnType<typeof loadWorkspace>>
  try {
    data = await loadWorkspace(profile)
  } catch (err) {
    const code = (err as { code?: string } | null)?.code
    const message = err instanceof Error ? err.message : ''
    if (code === 'P2021' || code === 'P2022' || /does not exist/i.test(message)) {
      return (
        <div className="mx-auto max-w-2xl space-y-2 p-6">
          <h1 className="text-xl font-semibold">Reviews, Raises and Promotion</h1>
          <p className="text-sm text-muted-foreground">This workspace is being set up and is not available yet. Please check back soon.</p>
        </div>
      )
    }
    throw err
  }

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

  const buildCaseLink = (
    <p className="text-sm text-muted-foreground">
      Going into a specific review, raise, promotion or offer conversation?{' '}
      <Link href="/dashboard/review-prep" className="font-medium text-primary underline underline-offset-4">
        Build your case for it
      </Link>
      .
    </p>
  )

  // The page opens with its one headline; the link to Build your case follows the workspace.
  return (
    <>
      <InWorkWorkspace data={data} initialTab={initialTab} />
      {buildCaseLink}
    </>
  )
}
