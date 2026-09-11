import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrmLogLinkedInButton } from '@/components/admin/CrmLogLinkedInButton'
import { updatePersonRoles, updatePersonField } from '../../actions'
import {
  PERSON_ROLES, PERSON_ROLE_LABELS, QUALITY_LABELS, WARMTH_LABELS,
  qualityClass, formatDate, sinceLabel,
} from '@/lib/crm/labels'

export const maxDuration = 30

export default async function CrmPersonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const person = await prisma.crmPerson.findUnique({
    where: { id },
    include: {
      affiliations: { include: { org: true }, orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }] },
      activities: { orderBy: { occurredAt: 'desc' }, take: 50 },
      sourceRecords: { orderBy: { importedAt: 'asc' } },
      researchItems: true,
      introPathsAsTarget: { include: { connectorPerson: { select: { id: true, fullName: true } } } },
      opportunities: { include: { pipeline: true, stage: true } },
    },
  })
  if (!person) notFound()

  const saveNotes = async (formData: FormData) => {
    'use server'
    await updatePersonField(id, 'notes', String(formData.get('notes') ?? ''))
  }
  const saveRoles = updatePersonRoles.bind(null, id)
  const sources = [...new Set(person.sourceRecords.map((s) => s.sourceFile))]

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm" className="text-muted-foreground hover:underline">← All people</Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{person.fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {person.affiliations[0]
              ? <>
                  {person.affiliations[0].title || 'No title on file'} at{' '}
                  <Link href={`/support/admin/crm/organizations/${person.affiliations[0].orgId}`} className="underline">
                    {person.affiliations[0].org.name}
                  </Link>
                </>
              : 'No organization on file'}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${qualityClass(person.leadQuality)}`}>
              {QUALITY_LABELS[person.leadQuality]}
            </span>
            <span className="text-muted-foreground">{WARMTH_LABELS[person.warmth]}</span>
            {person.email && <a href={`mailto:${person.email}`} className="underline">{person.email}</a>}
            {person.linkedinUrl && (
              <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="underline">LinkedIn</a>
            )}
          </p>
        </div>
        <CrmLogLinkedInButton personId={person.id} />
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label="Last contacted" value={sinceLabel(person.lastTouchedAt)} />
        <Stat label="Touches" value={String(person.touchCount)} />
        <Stat label="First replied" value={person.firstRepliedAt ? formatDate(person.firstRepliedAt) : '—'} />
        <Stat label="Connected" value={person.connectedAt ? formatDate(person.connectedAt) : '—'} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Contact type</h2>
        <form action={saveRoles} className="rounded-lg border border-border p-4">
          <fieldset>
            <legend className="sr-only">Contact types for {person.fullName}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {PERSON_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="roles" value={r} defaultChecked={person.roles.includes(r)} />
                  {PERSON_ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-3">
            <SubmitButton pendingLabel="Saving…">Save contact types</SubmitButton>
          </div>
        </form>
      </section>

      {person.affiliations.length > 1 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Affiliations</h2>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {person.affiliations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <Link href={`/support/admin/crm/organizations/${a.orgId}`} className="font-medium hover:underline">{a.org.name}</Link>
                  {a.title && <span className="text-muted-foreground"> — {a.title}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{a.isCurrent ? 'Current' : 'Past'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {person.opportunities.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Pipelines</h2>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {person.opportunities.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span>{o.title}</span>
                <span className="text-xs text-muted-foreground">{o.pipeline.label} · {o.stage.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Notes</h2>
        <form action={saveNotes} className="rounded-lg border border-border p-4">
          <label htmlFor="notes" className="sr-only">Notes about {person.fullName}</label>
          <textarea
            id="notes" name="notes" rows={4} defaultValue={person.notes ?? ''}
            placeholder="What matters about this person that isn't captured above."
            className="w-full rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          />
          <div className="mt-3"><SubmitButton pendingLabel="Saving…">Save notes</SubmitButton></div>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">History</h2>
        {person.activities.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nothing logged yet. Email and calendar sync arrive in a later phase; LinkedIn messages are logged with the button above.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {person.activities.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-medium">{a.subject ?? a.type}</span>
                  {a.body && <span className="block text-xs text-muted-foreground">{a.body}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(a.occurredAt)}
                  {a.isAutoLogged ? ' · auto' : ' · logged by hand'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sources.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Imported from: {sources.join(', ').toLowerCase().replace(/_/g, ' ')}
        </p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  )
}
