import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { CrmQuickAdd } from '@/components/admin/CrmQuickAdd'
import { CrmBulkBar } from '@/components/admin/CrmBulkBar'
import { CrmInlineSelect } from '@/components/admin/CrmInlineSelect'
import {
  PERSON_ROLES, PERSON_ROLE_LABELS, QUALITIES, QUALITY_LABELS,
  WARMTHS, WARMTH_LABELS, qualityClass, sinceLabel,
} from '@/lib/crm/labels'
import type { CrmPersonRole, CrmLeadQuality, CrmWarmth } from '@prisma/client'

export const maxDuration = 30

const PAGE_SIZE = 50

export default async function CrmPeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const role = sp.role ?? ''
  const quality = sp.quality ?? ''
  const warmth = sp.warmth ?? ''
  const touched = sp.touched ?? ''
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)

  const where: Prisma.CrmPersonWhereInput = {
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { affiliations: { some: { org: { name: { contains: q, mode: 'insensitive' } } } } },
            { affiliations: { some: { title: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
    ...(role ? { roles: { has: role as CrmPersonRole } } : {}),
    ...(quality ? { leadQuality: quality as CrmLeadQuality } : {}),
    ...(warmth ? { warmth: warmth as CrmWarmth } : {}),
    ...(touched === 'never' ? { lastTouchedAt: null } : {}),
    ...(touched === 'ever' ? { lastTouchedAt: { not: null } } : {}),
  }

  const [total, rows, needsCompletion] = await Promise.all([
    prisma.crmPerson.count({ where }),
    prisma.crmPerson.findMany({
      where,
      orderBy: [{ priorityScore: 'desc' }, { leadQuality: 'asc' }, { fullName: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, fullName: true, roles: true, leadQuality: true, warmth: true,
        lastTouchedAt: true, touchCount: true, priorityScore: true, linkedinUrl: true,
        affiliations: {
          where: { isPrimary: true }, take: 1,
          select: { title: true, org: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.crmPerson.count({ where: { needsCompletion: true } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const baseParams = { q, role, quality, warmth, touched }
  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...baseParams, ...over })) if (v) p.set(k, String(v))
    return p.toString()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CRM — people</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every person across fundraising, BD, outplacement, coaching, recruiting and policy.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/support/admin/crm/queue" className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-muted">
            Queue
          </Link>
          <Link href="/support/admin/crm/leads" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            All leads
          </Link>
          <Link href="/support/admin/crm/pipelines" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Pipelines
          </Link>
          <Link href="/support/admin/crm/organizations" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Organizations
          </Link>
          <Link href="/support/admin/crm/needs-completion" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Needs completion{needsCompletion > 0 && <span className="ml-1.5 rounded-full bg-orange/20 px-1.5 text-xs font-semibold text-orange">{needsCompletion}</span>}
          </Link>
          <Link href={`/support/admin/crm/export?${qs({})}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted" prefetch={false}>
            Download CSV
          </Link>
          <Link href="/support/admin/crm/import" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            Upload CSV
          </Link>
        </nav>
      </header>

      <CrmQuickAdd />

      <AdminFilterBar
        basePath="/support/admin/crm"
        searchValue={q}
        searchPlaceholder="Search name, company, title, email or notes…"
        filters={[
          { key: 'role', label: 'Contact type', value: role, options: [{ value: '', label: 'Any contact type' }, ...PERSON_ROLES.map((r) => ({ value: r, label: PERSON_ROLE_LABELS[r] }))] },
          { key: 'quality', label: 'Quality', value: quality, options: [{ value: '', label: 'Any quality' }, ...QUALITIES.map((x) => ({ value: x, label: QUALITY_LABELS[x] }))] },
          { key: 'warmth', label: 'Warmth', value: warmth, options: [{ value: '', label: 'Any warmth' }, ...WARMTHS.map((x) => ({ value: x, label: WARMTH_LABELS[x] }))] },
          { key: 'touched', label: 'Contact', value: touched, options: [{ value: '', label: 'Contacted or not' }, { value: 'never', label: 'Never contacted' }, { value: 'ever', label: 'Contacted at least once' }] },
        ]}
      />

      <p className="text-sm text-muted-foreground">
        {total.toLocaleString()} {total === 1 ? 'person' : 'people'}
        {q || role || quality || warmth || touched ? ' matching these filters' : ''}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No one matches these filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Clear the search, or add someone with the box above.
          </p>
          <Link href="/support/admin/crm" className="mt-3 inline-block text-sm font-medium text-brand underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <CrmBulkBar count={rows.length}>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="w-8 px-3 py-2"><span className="sr-only">Select</span></th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Organization</th>
                  <th className="px-3 py-2 font-medium">Contact type</th>
                  <th className="px-3 py-2 font-medium">Quality</th>
                  <th className="px-3 py-2 font-medium">Warmth</th>
                  <th className="px-3 py-2 font-medium">Last contacted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <input type="checkbox" name="selected" value={p.id} aria-label={`Select ${p.fullName}`} />
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/support/admin/crm/people/${p.id}`} className="font-medium hover:underline">
                        {p.fullName}
                      </Link>
                      {p.affiliations[0]?.title && (
                        <span className="block text-xs text-muted-foreground">{p.affiliations[0].title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.affiliations[0]?.org ? (
                        <Link href={`/support/admin/crm/organizations/${p.affiliations[0].org.id}`} className="hover:underline">
                          {p.affiliations[0].org.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.roles.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {p.roles.map((r) => (
                            <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-xs">{PERSON_ROLE_LABELS[r]}</span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${qualityClass(p.leadQuality)}`}>
                        {p.leadQuality === 'UNGRADED' ? '—' : p.leadQuality}
                      </span>
                      <CrmInlineSelect
                        personId={p.id} field="leadQuality" value={p.leadQuality}
                        label={`Quality for ${p.fullName}`}
                        options={QUALITIES.map((x) => ({ value: x, label: QUALITY_LABELS[x] }))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <CrmInlineSelect
                        personId={p.id} field="warmth" value={p.warmth}
                        label={`Warmth for ${p.fullName}`}
                        options={WARMTHS.map((x) => ({ value: x, label: WARMTH_LABELS[x] }))}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={p.lastTouchedAt ? '' : 'text-muted-foreground'}>{sinceLabel(p.lastTouchedAt)}</span>
                      {p.touchCount > 0 && <span className="ml-1 text-xs text-muted-foreground">({p.touchCount})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CrmBulkBar>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={`/support/admin/crm?${qs({ page: page - 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/support/admin/crm?${qs({ page: page + 1 })}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">
                Next
              </Link>
            )}
          </span>
        </nav>
      )}
    </div>
  )
}
