import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

export default async function CrmPipelinesPage() {
  await requireAdmin()
  const pipelines = await prisma.crmPipeline.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      stages: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { opportunities: true } },
    },
  })
  const open = await prisma.crmOpportunity.groupBy({ by: ['pipelineId'], where: { outcome: 'OPEN' }, _count: { _all: true } })
  const openBy = new Map(open.map((o) => [o.pipelineId, o._count._all]))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pipelines</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nine workstreams on one stage spine. A person can sit in several at once.
          </p>
        </div>
        <Link href="/support/admin/crm/leads" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          All leads
        </Link>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pipelines.map((p) => {
          const n = openBy.get(p.id) ?? 0
          return (
            <li key={p.id}>
              <Link
                href={`/support/admin/crm/pipelines/${p.key}`}
                className="block rounded-lg border border-border p-4 hover:border-brand"
              >
                <p className="font-medium">{p.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {n > 0 ? `${n} open` : 'Nothing here yet'}
                  {p._count.opportunities > n && ` · ${p._count.opportunities - n} closed`}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.stages.filter((s) => !s.isLost).map((s) => s.label).join(' → ')}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
