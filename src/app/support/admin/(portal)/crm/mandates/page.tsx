import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { MANDATE_STATUSES, MANDATE_STATUS_LABELS, type MandateStatusKey } from '@/lib/crm/mandates'

export const maxDuration = 30

/** Every recruiter mandate, newest first, filterable by status. */
export default async function MandatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = await searchParams
  const status = (MANDATE_STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as MandateStatusKey) : ''
  const rows = await prisma.crmMandate.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true, scope: true, status: true, startedAt: true,
      recruiter: { select: { id: true, fullName: true } },
      org: { select: { id: true, name: true } },
    },
  })
  const tab = (value: string, label: string) => (
    <Link
      href={value ? `/support/admin/crm/mandates?status=${value}` : '/support/admin/crm/mandates'}
      aria-current={status === value ? 'page' : undefined}
      className={`h-8 rounded-md border px-3 text-sm leading-8 ${status === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
    >
      {label}
    </Link>
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Mandates</h1>
        <p className="mt-1 text-sm text-muted-foreground">Which recruiters a company has engaged. Add a mandate from the recruiter&apos;s record.</p>
      </header>
      <div role="group" aria-label="Filter by status" className="flex gap-1">
        {tab('', 'All')}
        {MANDATE_STATUSES.map((s) => <span key={s}>{tab(s, MANDATE_STATUS_LABELS[s])}</span>)}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          {status ? `No ${MANDATE_STATUS_LABELS[status].toLowerCase()} mandates.` : 'No mandates yet. Open a recruiter under People and choose Add mandate.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>
                <Link href={`/support/admin/crm/people/${m.recruiter.id}`} className="font-medium hover:underline">{m.recruiter.fullName}</Link>
                <span className="text-muted-foreground"> at </span>
                <Link href={`/support/admin/crm/organizations/${m.org.id}`} className="font-medium hover:underline">{m.org.name}</Link>
                {m.scope && <span className="text-muted-foreground"> — {m.scope}</span>}
              </span>
              <span className="text-xs text-muted-foreground">{MANDATE_STATUS_LABELS[m.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
