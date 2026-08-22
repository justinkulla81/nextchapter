import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCrucibleEmployerDashboardData } from '@/lib/crucible/employers/get-employer-dashboard-data'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — Contests' },
  robots: { index: false, follow: false },
}

const STATE_LABEL: Record<string, string> = { DRAFT: 'Draft', OPEN: 'Open', CLOSED: 'Closed' }

export default async function CrucibleContestsPage() {
  const employer = await getCrucibleEmployerDashboardData()

  const contests = await prisma.crucibleContest.findMany({
    where: { employerId: employer.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { entries: true } } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contests</h1>
          <p className="mt-1 text-muted-foreground">
            Post a real business problem for a shot at a tailored, paid hire.
          </p>
        </div>
        <Link href="/noexperience/employers/contests/new" className={buttonVariants({ variant: 'default' })}>
          New contest
        </Link>
      </div>

      {contests.length === 0 ? (
        <p className="rounded-lg border border-border p-6 text-center text-muted-foreground">
          No contests yet — post your first one.
        </p>
      ) : (
        <ul className="space-y-3">
          {contests.map((contest) => (
            <li key={contest.id}>
              <Link
                href={`/noexperience/employers/contests/${contest.id}`}
                className="block rounded-lg border border-border p-4 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-foreground">{contest.title}</span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {STATE_LABEL[contest.state]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {contest._count.entries} {contest._count.entries === 1 ? 'entry' : 'entries'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
