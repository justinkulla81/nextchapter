import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { isMissingTable, listForMe, listMine, viewerFor } from '@/lib/work-help/questions'
import { WorkHelpPage } from '@/components/work-help/WorkHelpPage'

export const metadata: Metadata = { title: 'A hard situation at work' }

// What the member types about their situation is never loaded or stored here. Only the questions they chose to ask,
// and the ones they can answer, come from the database.
export default async function WorkHelpRoute() {
  const profile = await getDashboardProfile()
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
