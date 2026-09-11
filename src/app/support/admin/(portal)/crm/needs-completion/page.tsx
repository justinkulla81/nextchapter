import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { acceptExportSuggestion, dismissCompletion } from '../actions'
import { PERSON_ROLE_LABELS } from '@/lib/crm/labels'
import { CrmCompletionBulkBar } from '@/components/admin/CrmCompletionBulkBar'
import { CrmSelectAll } from '@/components/admin/CrmSelectAll'
import { PageSizePicker, readPageSize } from '@/components/admin/PageSizePicker'

export const maxDuration = 30


export default async function CrmNeedsCompletionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const perPage = readPageSize(sp.per)

  const [total, rows] = await Promise.all([
    prisma.crmPerson.count({ where: { needsCompletion: true } }),
    prisma.crmPerson.findMany({
      where: { needsCompletion: true },
      orderBy: [{ leadQuality: 'asc' }, { fullName: 'asc' }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, fullName: true, roles: true, linkedinSlug: true,
        affiliations: { take: 1, select: { title: true, org: { select: { name: true } } } },
      },
    }),
  ])

  // One batched lookup rather than one per row.
  const slugs = rows.map((r) => r.linkedinSlug).filter((s): s is string => Boolean(s))
  const suggestions = await prisma.crmLinkedInConnection.findMany({ where: { slug: { in: slugs } } })
  const byslug = new Map(suggestions.map((s) => [s.slug, s]))
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm" className="text-muted-foreground hover:underline">← All people</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">Needs completion</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Records missing a title or an organization. Where the person is in your LinkedIn export,
          the suggestion below is one click away — completing a profile is usually accepting a
          prefill rather than typing.
        </p>
      </header>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nothing to complete.</p>
          <p className="mt-1 text-sm text-muted-foreground">Every record has a title and an organization.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">{total.toLocaleString()} to review</p>
              <label className="flex items-center gap-1.5 text-sm">
                <CrmSelectAll pageCount={rows.length} />
                <span className="text-muted-foreground">Select all on this page</span>
              </label>
            </div>
            <PageSizePicker basePath="/support/admin/crm/needs-completion" params={{}} current={perPage} label="people" />
          </div>
          <CrmCompletionBulkBar count={rows.length}>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {rows.map((p) => {
              const s = p.linkedinSlug ? byslug.get(p.linkedinSlug) : undefined
              const acceptAction = acceptExportSuggestion.bind(null, p.id)
              const dismissAction = dismissCompletion.bind(null, p.id)
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <input type="checkbox" name="selected" value={p.id} aria-label={`Select ${p.fullName}`} />
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={`/support/admin/crm/people/${p.id}`} className="font-medium hover:underline">{p.fullName}</Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.affiliations[0]?.org.name ?? 'No organization'}
                      {p.affiliations[0]?.title ? ` · ${p.affiliations[0].title}` : ' · no title'}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {p.roles.length > 0 ? p.roles.map((r) => PERSON_ROLE_LABELS[r]).join(' · ') : 'No contact type'}
                    </span>
                    {s && (
                      <p className="mt-1 text-xs">
                        <span className="text-muted-foreground">Your export says: </span>
                        <span className="font-medium">{s.position ?? 'no title'}</span>
                        {s.company && <span> at {s.company}</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {s ? (
                      <form action={acceptAction}>
                        <SubmitButton size="sm" pendingLabel="Applying…" savedLabel="Applied">Use this</SubmitButton>
                      </form>
                    ) : (
                      <Link href={`/support/admin/crm/people/${p.id}`} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                        Fill in by hand
                      </Link>
                    )}
                    <form action={dismissAction}>
                      <SubmitButton size="sm" variant="outline" pendingLabel="Marking…">Looks fine</SubmitButton>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
          </CrmCompletionBulkBar>

          {totalPages > 1 && (
            <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <span className="flex gap-2">
                {page > 1 && <Link href={`/support/admin/crm/needs-completion?per=${perPage}&page=${page - 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
                {page < totalPages && <Link href={`/support/admin/crm/needs-completion?per=${perPage}&page=${page + 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
              </span>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
