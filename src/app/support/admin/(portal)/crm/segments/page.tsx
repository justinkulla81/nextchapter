import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { createSegment, deleteSegment } from './actions'
import { PERSON_ROLES, PERSON_ROLE_LABELS, QUALITIES, QUALITY_LABELS, formatDate } from '@/lib/crm/labels'

export const maxDuration = 30

export default async function CrmSegmentsPage() {
  await requireAdmin()
  const [segments, recentSends] = await Promise.all([
    prisma.crmSegment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true, broadcasts: true } } },
    }),
    prisma.crmBroadcast.findMany({
      where: { sentAt: { not: null } }, orderBy: { sentAt: 'desc' }, take: 5,
      include: { segment: { select: { name: true } } },
    }),
  ])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Segments and updates</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Saved audiences for one-off updates. Nothing is sent without a preview and a typed confirmation.
          </p>
        </div>
        <Link href="/support/admin/crm" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">People</Link>
      </header>

      <div className="rounded-lg border border-orange/40 bg-orange/5 p-3 text-sm">
        <p className="font-medium">This is the only part of the CRM that reaches real inboxes.</p>
        <p className="mt-1 text-muted-foreground">
          Send the first one to a segment of one — yourself — before anything wider. A broadcast built on a
          half-checked list is how the same investor gets two emails addressed to different names.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Your segments</h2>
        {segments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No segments yet. Create one below.
          </p>
        ) : (
          <ul className="space-y-2">
            {segments.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">
                    <Link href={`/support/admin/crm/segments/${s.id}`} className="hover:underline">{s.name}</Link>
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
                      {s.kind === 'DYNAMIC' ? 'Re-evaluates each time' : 'Fixed list'}
                    </span>
                  </p>
                  {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s._count.broadcasts} {s._count.broadcasts === 1 ? 'update' : 'updates'} sent
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/support/admin/crm/segments/${s.id}`} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                    Preview and send
                  </Link>
                  <form action={deleteSegment.bind(null, s.id)}>
                    <SubmitButton size="sm" variant="outline" pendingLabel="Deleting…">Delete</SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">New segment</h2>
        <form action={createSegment} className="space-y-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <input name="name" required placeholder="Investors I've met"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Description</span>
              <input name="description" placeholder="What this list is for"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand" />
            </label>
          </div>

          {/* Two discrete options -> adjacent radios, per design-principles.md. */}
          <fieldset>
            <legend className="mb-1 text-sm font-medium">How membership works</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="kind" value="DYNAMIC" defaultChecked />
                Re-evaluate each time — stays current as people change
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="kind" value="PINNED" />
                Fixed list — membership frozen once set
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Contact type</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {PERSON_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" name="roles" value={r} /> {PERSON_ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Quality</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {QUALITIES.map((q) => (
                  <label key={q} className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name="quality" value={q} /> {QUALITY_LABELS[q].split(' —')[0]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Contacted</span>
              <select name="contacted" defaultValue="" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Either</option>
                <option value="ever">At least once</option>
                <option value="never">Never</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Name or company contains</span>
              <input name="search" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Only people with an email address are ever included — a recipient list is addresses, not people.
          </p>
          <SubmitButton pendingLabel="Creating…">Create segment</SubmitButton>
        </form>
      </section>

      {recentSends.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Recently sent</h2>
          <ul className="rounded-lg border border-border divide-y divide-border text-sm">
            {recentSends.map((b) => (
              <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span>
                  <span className="font-medium">{b.subject}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{b.segment?.name ?? 'segment deleted'}</span>
                  {b.error && <span className="mt-0.5 block text-xs text-destructive">{b.error}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {b.recipientCount} recipients · {formatDate(b.sentAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
