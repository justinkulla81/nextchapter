import Link from 'next/link'
import type { LikelyOpeningSignalType } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { LikelyOpeningFilingLink } from '@/components/likely-openings/FilingLink'
import { SIGNAL_LABELS, roleShortLabel } from '@/lib/likely-openings/roles'
import { formatAmount } from '@/lib/likely-openings/parse-form-d'
import { cn } from '@/lib/utils'

export const maxDuration = 30

const TYPES: LikelyOpeningSignalType[] = ['EXEC_DEPARTURE', 'EXEC_APPOINTMENT', 'FUNDING_RAISE']
const SHOW = 300

type Row = Awaited<ReturnType<typeof load>>[number]

function load(type: LikelyOpeningSignalType | null) {
  return prisma.likelyOpening.findMany({
    where: { expiresAt: { gt: new Date() }, ...(type ? { signalType: type } : {}) },
    orderBy: [{ filingDate: 'desc' }, { createdAt: 'desc' }],
    take: SHOW,
  })
}

// Signals from SEC filings (8-K Item 5.02, Form D) that a senior role is
// about to open. Written daily by /api/cron/likely-openings; read-only here.
export default async function AdminLikelyOpeningsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const type = TYPES.find((t) => t === sp.type) ?? null
  const [rows, counts] = await Promise.all([
    load(type),
    prisma.likelyOpening.groupBy({ by: ['signalType'], where: { expiresAt: { gt: new Date() } }, _count: true }),
  ])
  const countFor = (t: LikelyOpeningSignalType) => counts.find((c) => c.signalType === t)?._count ?? 0
  const total = TYPES.reduce((n, t) => n + countFor(t), 0)

  const columns: AdminColumn<Row>[] = [
    {
      header: 'Filed',
      className: 'px-3 py-2 font-medium whitespace-nowrap',
      render: (r) => r.filingDate.toISOString().slice(0, 10),
    },
    { header: 'Company', render: (r) => <span className="font-medium">{r.companyName}</span> },
    { header: 'Signal', render: (r) => SIGNAL_LABELS[r.signalType] },
    {
      header: 'Roles / amount',
      render: (r) =>
        r.signalType === 'FUNDING_RAISE'
          ? `${r.amountRaised ? formatAmount(r.amountRaised) : ''}${r.industry ? ` · ${r.industry}` : ''}`
          : r.roles.map(roleShortLabel).join(', '),
    },
    { header: 'Summary', render: (r) => <span className="text-muted-foreground">{r.summary}</span> },
    {
      header: 'Filing',
      render: (r) => (
        <LikelyOpeningFilingLink
          likelyOpeningId={r.id}
          companyName={r.companyName}
          signalType={r.signalType}
          href={r.filingUrl}
          source="admin"
          label="SEC filing"
        />
      ),
    },
  ]

  const filters: { key: LikelyOpeningSignalType | null; label: string; count: number }[] = [
    { key: null, label: 'All', count: total },
    ...TYPES.map((t) => ({ key: t, label: SIGNAL_LABELS[t], count: countFor(t) })),
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Likely Openings</h1>
        <p className="mt-1 text-muted-foreground">
          Senior roles likely to open soon, read from public SEC filings: officer departures and new leaders (8-K
          Item 5.02) and private raises of $10M or more (Form D). Pulled daily; each signal stays live for 120 days.
        </p>
      </div>

      <nav aria-label="Filter by signal" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.key ? `/support/admin/likely-openings?type=${f.key}` : '/support/admin/likely-openings'}
            aria-current={type === f.key ? 'page' : undefined}
            className={cn(
              'rounded-md border border-border px-3 py-1 text-sm',
              type === f.key ? 'bg-foreground text-background' : 'hover:bg-muted'
            )}
          >
            {f.label} <span className="tabular-nums opacity-70">{f.count}</span>
          </Link>
        ))}
      </nav>

      {rows.length === SHOW && <p className="text-sm text-muted-foreground">Showing the newest {SHOW}.</p>}

      <AdminDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage="No live signals yet. The daily SEC pull runs at 9:30 UTC."
      />
    </div>
  )
}
