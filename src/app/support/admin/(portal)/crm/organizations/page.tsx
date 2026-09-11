import Link from 'next/link'
import type { Prisma, CrmOrgType } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { ORG_TYPES, ORG_TYPE_LABELS } from '@/lib/crm/labels'

export const maxDuration = 30
const PAGE_SIZE = 50

export default async function CrmOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const type = sp.type ?? ''
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  const where: Prisma.CrmOrganizationWhereInput = {
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    ...(type ? { orgTypes: { has: type as CrmOrgType } } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.crmOrganization.count({ where }),
    prisma.crmOrganization.findMany({
      where,
      orderBy: [{ priorityScore: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, orgTypes: true, hqRegion: true,
        investorProfile: { select: { checkSizeNote: true } },
        _count: { select: { affiliations: true, opportunities: true } },
      },
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ q, type, ...over })) if (v) p.set(k, String(v))
    return p.toString()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One record per organization, however many things it is to us.
          </p>
        </div>
        <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          People
        </Link>
      </header>

      <AdminFilterBar
        basePath="/support/admin/crm/organizations"
        searchValue={q}
        searchPlaceholder="Search organizations…"
        filters={[{
          key: 'type', label: 'Type', value: type,
          options: [{ value: '', label: 'Any type' }, ...ORG_TYPES.map((t) => ({ value: t, label: ORG_TYPE_LABELS[t] }))],
        }]}
      />

      <p className="text-sm text-muted-foreground">{total.toLocaleString()} organizations</p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No organizations match these filters.</p>
          <Link href="/support/admin/crm/organizations" className="mt-2 inline-block text-sm font-medium text-brand underline">Clear filters</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Organization</th>
                <th className="px-3 py-2 font-medium">What it is to us</th>
                <th className="px-3 py-2 font-medium">People</th>
                <th className="px-3 py-2 font-medium">Pipelines</th>
                <th className="px-3 py-2 font-medium">Check size</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/support/admin/crm/organizations/${o.id}`} className="font-medium hover:underline">{o.name}</Link>
                    {o.hqRegion && <span className="block text-xs text-muted-foreground">{o.hqRegion}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {o.orgTypes.map((t) => (
                        <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{ORG_TYPE_LABELS[t]}</span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2">{o._count.affiliations || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">{o._count.opportunities || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 text-xs">{o.investorProfile?.checkSizeNote ?? <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={`/support/admin/crm/organizations?${qs({ page: page - 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
            {page < totalPages && <Link href={`/support/admin/crm/organizations?${qs({ page: page + 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
          </span>
        </nav>
      )}
    </div>
  )
}
