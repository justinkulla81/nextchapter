import Link from 'next/link'
import type { Prisma, CrmResearchStance } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminFilterBar } from '@/components/admin/AdminFilterBar'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrmStanceSelect, STANCE_LABEL, STANCE_CLASS } from '@/components/admin/CrmStanceSelect'
import { updateResearchItem } from '../actions'

export const maxDuration = 30

export default async function CrmResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const stance = sp.stance ?? ''

  const where: Prisma.CrmResearchItemWhereInput = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { keyClaim: { contains: q, mode: 'insensitive' } },
            { org: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(stance ? { stance: stance as CrmResearchStance } : {}),
  }

  const [items, counts] = await Promise.all([
    prisma.crmResearchItem.findMany({
      where,
      orderBy: [{ stance: 'asc' }, { publishedYear: 'desc' }],
      include: { org: { select: { id: true, name: true } }, person: { select: { id: true, fullName: true } } },
    }),
    prisma.crmResearchItem.groupBy({ by: ['stance'], _count: { _all: true } }),
  ])
  const countBy = new Map(counts.map((c) => [c.stance, c._count._all]))
  const unjudged = countBy.get('UNSET') ?? 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Research</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Evidence attached to people and organizations, and whether it helps or hurts the premise
            NextChapter is built on.
          </p>
        </div>
        <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
          People
        </Link>
      </header>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <p className="text-muted-foreground">
          A researcher whose findings argue displacement is overstated is a <strong className="text-foreground">risk</strong> in
          a pitch meeting, not an asset — which is the whole reason stance is recorded, and why it is never inferred
          automatically.
        </p>
        {unjudged > 0 && (
          <p className="mt-2">
            <strong>{unjudged}</strong> {unjudged === 1 ? 'item has' : 'items have'} no stance set yet.
          </p>
        )}
      </div>

      <AdminFilterBar
        basePath="/support/admin/crm/research"
        searchValue={q}
        searchPlaceholder="Search title, claim or organization…"
        filters={[{
          key: 'stance', label: 'Stance', value: stance,
          options: [
            { value: '', label: 'Any stance' },
            ...(['UNSET', 'SUPPORTS', 'CONTRADICTS', 'MIXED', 'NEUTRAL'] as const).map((s) => ({
              value: s, label: `${STANCE_LABEL[s]} (${countBy.get(s) ?? 0})`,
            })),
          ],
        }]}
      />

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No research matches these filters.</p>
          <Link href="/support/admin/crm/research" className="mt-2 inline-block text-sm font-medium text-brand underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const save = updateResearchItem.bind(null, r.id)
            return (
              <li key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">{r.title}</a>
                      ) : r.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.org && (
                        <Link href={`/support/admin/crm/organizations/${r.org.id}`} className="hover:underline">{r.org.name}</Link>
                      )}
                      {r.person && (
                        <Link href={`/support/admin/crm/people/${r.person.id}`} className="hover:underline">{r.person.fullName}</Link>
                      )}
                      {r.publishedYear && <span>{r.publishedYear}</span>}
                      {r.useInPitch && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-brand">In the deck</span>}
                    </p>
                    {r.keyClaim && <p className="mt-1.5 text-xs">{r.keyClaim}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STANCE_CLASS[r.stance]}`}>
                      {STANCE_LABEL[r.stance]}
                    </span>
                    <CrmStanceSelect itemId={r.id} stance={r.stance} title={r.title} />
                  </div>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Edit claim and notes
                  </summary>
                  <form action={save} className="mt-2 space-y-2">
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium">The sentence you&apos;d quote, or have to answer</span>
                      <textarea name="keyClaim" rows={2} defaultValue={r.keyClaim ?? ''}
                        className="w-full rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand" />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium">Why it matters to us</span>
                      <input name="relevanceNote" type="text" defaultValue={r.relevanceNote ?? ''}
                        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand" />
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" name="useInPitch" defaultChecked={r.useInPitch} />
                      Cite this in the deck
                    </label>
                    <SubmitButton size="sm" pendingLabel="Saving…">Save research item</SubmitButton>
                  </form>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
