import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { PageHeader } from '@/components/candidate/PageHeader'
import { canUseWorkHelp } from '@/lib/work-help/access'
import { isMissingTable, listForMe, listMine, viewerFor } from '@/lib/work-help/questions'
import { WorkHelpPage } from '@/components/work-help/WorkHelpPage'

export const metadata: Metadata = { title: 'A hard situation at work' }

// What the member types about their situation is never loaded or stored here. Only the questions they chose to ask,
// and the ones they can answer, come from the database.
export default async function WorkHelpRoute() {
  const profile = await getDashboardProfile()

  if (!canUseWorkHelp(profile)) {
    return (
      <div className="space-y-8">
        <PageHeader title="A hard situation at work" intro="This is for members who currently have a job." />
        <section className="space-y-3 rounded-2xl border border-border p-7">
          <h2 className="font-display text-xl font-semibold text-ink">Why it is only for people who are working</h2>
          <p className="max-w-xl text-base text-ink">Questions here are shared with other working professionals at other companies, so everyone in it needs a current job. If you have one, update your situation and this opens up.</p>
          <Link href="/dashboard/profile" className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
            Update my situation
          </Link>
        </section>
      </div>
    )
  }

  let mine: Awaited<ReturnType<typeof listMine>> = []
  let others: Awaited<ReturnType<typeof listForMe>> = []
  try {
    const viewer = await viewerFor(profile)
    ;[mine, others] = await Promise.all([listMine(profile.id), listForMe(viewer)])
  } catch (err) {
    // The tables are applied by hand (prisma/manual/2026-10-19-work-questions.sql). Until they exist, the private helper still works.
    if (!isMissingTable(err)) throw err
  }
  return <WorkHelpPage mine={mine} others={others} />
}
