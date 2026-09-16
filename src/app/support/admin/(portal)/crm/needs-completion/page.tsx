import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { acceptExportSuggestion, deletePerson, mergePersonIntoPerson } from '../actions'
import { PERSON_ROLE_LABELS } from '@/lib/crm/labels'
import { isPlaceholderName } from '@/lib/resume/placeholder-name'
import { CrmCompletionBulkBar } from '@/components/admin/CrmCompletionBulkBar'
import { CrmSelectAll } from '@/components/admin/CrmSelectAll'
import { PageSizePicker, readPageSize } from '@/components/admin/PageSizePicker'
import { CrmInlineText } from '@/components/admin/CrmInlineText'
import { CrmInlineOrgEdit } from '@/components/admin/CrmInlineOrgEdit'
import { CrmMergePicker } from '@/components/admin/CrmMergePicker'
import { ConfirmForm } from '@/components/admin/ConfirmForm'

export const maxDuration = 30

function completenessScore(p: { email: string | null; affiliations: { org: { name: string } }[] }): number {
  return (p.affiliations.length > 0 ? 2 : 0) + (p.email ? 1 : 0)
}

/** Discards mergePersonIntoPerson's return value so a plain <form action> (native DOM typing wants void|Promise<void>) can use it directly. */
async function mergeFormAction(sourceId: string, targetId: string) {
  'use server'
  await mergePersonIntoPerson(sourceId, targetId)
}

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
    prisma.crmPerson.count({ where: { needsCompletion: true, deletedAt: null } }),
    prisma.crmPerson.findMany({
      where: { needsCompletion: true, deletedAt: null },
      orderBy: [{ leadQuality: 'asc' }, { fullName: 'asc' }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, fullName: true, roles: true, linkedinSlug: true, linkedinUrl: true,
        email: true, candidateId: true, coachId: true, recruiterId: true,
        affiliations: { take: 1, select: { title: true, org: { select: { name: true } } } },
      },
    }),
  ])

  // One batched lookup rather than one per row.
  const slugs = rows.map((r) => r.linkedinSlug).filter((s): s is string => Boolean(s))
  const suggestions = await prisma.crmLinkedInConnection.findMany({ where: { slug: { in: slugs } } })
  const byslug = new Map(suggestions.map((s) => [s.slug, s]))

  // Same full name anywhere else in the (non-deleted) table is the duplicate
  // signal — batched once for the whole page rather than once per row. Every
  // row matches at least itself, so the per-row lookup below always excludes
  // its own id before picking a target.
  const uniqueNames = [...new Set(rows.map((r) => r.fullName))]
  const nameMatches = uniqueNames.length > 0
    ? await prisma.crmPerson.findMany({
        where: {
          deletedAt: null,
          OR: uniqueNames.map((n) => ({ fullName: { equals: n, mode: 'insensitive' as const } })),
        },
        select: {
          id: true, fullName: true, email: true,
          affiliations: { take: 1, select: { org: { select: { name: true } } } },
        },
      })
    : []
  const matchesByName = new Map<string, typeof nameMatches>()
  for (const m of nameMatches) {
    const key = m.fullName.trim().toLowerCase()
    matchesByName.set(key, [...(matchesByName.get(key) ?? []), m])
  }

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
              const deleteAction = deletePerson.bind(null, p.id)

              const dupes = (matchesByName.get(p.fullName.trim().toLowerCase()) ?? []).filter((m) => m.id !== p.id)
              const mergeTarget = dupes.length > 0
                ? [...dupes].sort((a, b) => completenessScore(b) - completenessScore(a))[0]
                : null
              const notAPerson = isPlaceholderName(p.fullName)

              // One clear recommendation per row, in priority order — a real
              // duplicate or a fake-looking name both matter more than
              // whether an export happens to have a prefill for it.
              const recommendation = notAPerson
                ? { label: 'Doesn’t look like a real person', tone: 'text-destructive' }
                : mergeTarget
                  ? {
                      label: `Possible duplicate — merge into ${mergeTarget.fullName}${mergeTarget.affiliations[0] ? ` (${mergeTarget.affiliations[0].org.name})` : ''}`,
                      tone: 'text-amber-700',
                    }
                  : s
                    ? { label: 'Export has a prefill — Use this', tone: 'text-success' }
                    : { label: 'No info available — fill in by hand or delete', tone: 'text-muted-foreground' }

              const roleTag = p.candidateId ? 'Candidate' : p.coachId ? 'Coach' : p.recruiterId ? 'Recruiter' : null

              return (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                  <input type="checkbox" name="selected" value={p.id} className="mt-1.5" aria-label={`Select ${p.fullName}`} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <CrmInlineText personId={p.id} field="fullName" value={p.fullName} label={`Name for ${p.fullName}`} />
                      <Link href={`/support/admin/crm/people/${p.id}`} className="text-xs text-muted-foreground hover:underline">open</Link>
                      {roleTag && (
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">{roleTag}</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <CrmInlineOrgEdit personId={p.id} orgName={p.affiliations[0]?.org.name ?? null} />
                      <span className="text-muted-foreground">·</span>
                      <CrmInlineText
                        personId={p.id} field="title" value={p.affiliations[0]?.title ?? ''}
                        label={`Title for ${p.fullName}`} placeholder="Title"
                      />
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{p.email ?? 'No email on file'}</span>
                      {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="underline">LinkedIn</a>}
                      <span>{p.roles.length > 0 ? p.roles.map((r) => PERSON_ROLE_LABELS[r]).join(' · ') : 'No contact type'}</span>
                    </p>
                    {s && (
                      <p className="mt-1 text-xs">
                        <span className="text-muted-foreground">Your export says: </span>
                        <span className="font-medium">{s.position ?? 'no title'}</span>
                        {s.company && <span> at {s.company}</span>}
                      </p>
                    )}
                    <p className={`mt-1.5 text-xs font-medium ${recommendation.tone}`}>{recommendation.label}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {mergeTarget && (
                      <form action={mergeFormAction.bind(null, p.id, mergeTarget.id)}>
                        <SubmitButton size="sm" pendingLabel="Merging…">Merge into {mergeTarget.fullName}</SubmitButton>
                      </form>
                    )}
                    {s && (
                      <form action={acceptAction}>
                        <SubmitButton size="sm" variant="outline" pendingLabel="Applying…" savedLabel="Applied">Use this</SubmitButton>
                      </form>
                    )}
                    {!mergeTarget && !s && (
                      <Link href={`/support/admin/crm/people/${p.id}`} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                        Fill in by hand
                      </Link>
                    )}
                    <CrmMergePicker personId={p.id} personName={p.fullName} />
                    <ConfirmForm action={deleteAction} confirmMessage={`Delete ${p.fullName}? This can't be undone.`}>
                      <SubmitButton size="sm" variant="outline" pendingLabel="Deleting…">Delete</SubmitButton>
                    </ConfirmForm>
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
