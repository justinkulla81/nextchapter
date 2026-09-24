import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CRM_ACTIVITY_CUTOFF } from '@/lib/crm/cutoff'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrmLogLinkedInButton } from '@/components/admin/CrmLogLinkedInButton'
import { CrmInviteToggle } from '@/components/admin/CrmInviteToggle'
import { CrmNextChapterAccount } from '@/components/admin/CrmNextChapterAccount'
import { CrmIntroPaths } from '@/components/admin/CrmIntroPaths'
import { CrmStanceSelect, STANCE_LABEL, STANCE_CLASS } from '@/components/admin/CrmStanceSelect'
import { CrmGraduatePerson } from '@/components/admin/CrmGraduateButtons'
import { CrmInlineSelect } from '@/components/admin/CrmInlineSelect'
import { CrmOutreachCompose } from '@/components/admin/CrmOutreachCompose'
import { CrmActivityReviewInline } from '@/components/admin/CrmActivityReviewInline'
import { updatePersonRoles, updatePersonField } from '../../actions'
import {
  PERSON_ROLES, PERSON_ROLE_LABELS, QUALITIES, QUALITY_LABELS, WARMTH_LABELS,
  PRIORITY_TIERS, PRIORITY_TIER_LABELS, priorityTierClass,
  qualityClass, formatDate, sinceLabel, MEMBERSHIP_STATUS_LABELS,
} from '@/lib/crm/labels'

export const maxDuration = 30

export default async function CrmPersonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const person = await prisma.crmPerson.findUnique({
    where: { id },
    include: {
      affiliations: { include: { org: true }, orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }] },
      // Only what happened since the CRM began — see CRM_ACTIVITY_CUTOFF.
      // Pre-cutoff rows stay in the table (nothing is deleted) but a decade
      // of pre-company mail is not this person's outreach history.
      activities: {
        where: { occurredAt: { gte: CRM_ACTIVITY_CUTOFF } },
        orderBy: { occurredAt: 'desc' }, take: 50,
        include: { outreachTracking: { include: { links: true } } },
      },
      sourceRecords: { orderBy: { importedAt: 'asc' } },
      researchItems: true,
      introPathsAsTarget: {
        include: { connectorPerson: { select: { id: true, fullName: true } } },
        orderBy: [{ strength: 'asc' }, { createdAt: 'asc' }],
      },
      opportunities: { include: { pipeline: true, stage: true } },
      // Only ever set when this person is also a real NextChapter
      // candidate (see CrmPerson.candidateId's schema comment) — shown as a
      // plain fact, since their own membership-upgrade opportunity above
      // already carries the deal-stage view of the same thing.
      candidate: { select: { id: true, createdAt: true, membershipSubscription: { select: { status: true } } } },
    },
  })
  if (!person) notFound()
  // Sign-ups that look like someone invited from here, waiting on a yes/no.
  const inviteMatches = person.candidateId ? [] : await prisma.candidateIdentityMatch.findMany({
    where: { source: 'CRM_INVITE', sourceRecordId: person.id, status: 'PENDING' },
    select: { id: true, strength: true, candidate: { select: { firstName: true, lastName: true, email: true, createdAt: true } } },
  })

  const saveNotes = async (formData: FormData) => {
    'use server'
    await updatePersonField(id, 'notes', String(formData.get('notes') ?? ''))
  }
  const saveRoles = updatePersonRoles.bind(null, id)
  const sources = [...new Set(person.sourceRecords.map((s) => s.sourceFile))]
  const needsReview = person.activities.filter((a) => a.needsReview)
  const confirmedActivities = person.activities.filter((a) => !a.needsReview)
  // Surfaced as a banner rather than buried in a list: walking into a meeting
  // unaware that your counterpart's own research undercuts your premise is the
  // specific failure this field exists to prevent.
  const contradicting = person.researchItems.filter((r) => r.stance === 'CONTRADICTS')

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
          {person.location && <p className="mt-0.5 text-sm text-muted-foreground">{person.location}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${qualityClass(person.leadQuality)}`}>
              {QUALITY_LABELS[person.leadQuality]}
            </span>
            <CrmInlineSelect
              personId={person.id} field="leadQuality" value={person.leadQuality}
              label={`Quality for ${person.fullName}`}
              options={QUALITIES.map((q) => ({ value: q, label: QUALITY_LABELS[q] }))}
            />
            {/* Labeled rather than bare — "Hot" on its own reads as a stray
                word; "Warmth: Hot" says what it is without a hover or click. */}
            <span className="ml-2 text-muted-foreground">Warmth: {WARMTH_LABELS[person.warmth]}</span>
            {/* Priority lived on the People list row and nowhere else — the
                one place you're actually looking at someone had no way to
                set it. Same inline-select, same P0/P1/P2 color coding. */}
            <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-semibold ${priorityTierClass(person.priority)}`}>
              {person.priority ?? '—'}
            </span>
            <CrmInlineSelect
              personId={person.id} field="priority" value={person.priority ?? ''}
              label={`Priority for ${person.fullName}`}
              options={[{ value: '', label: 'No priority' }, ...PRIORITY_TIERS.map((t) => ({ value: t, label: `${t} — ${PRIORITY_TIER_LABELS[t]}` }))]}
            />
            {person.email && <a href={`mailto:${person.email}`} className="underline">{person.email}</a>}
            {person.linkedinUrl && (
              <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="underline">LinkedIn</a>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CrmLogLinkedInButton personId={person.id} />
          <CrmInviteToggle
            personId={person.id}
            invitedAt={person.candidateInvitedAt ? formatDate(person.candidateInvitedAt) : null}
            isCandidate={!!person.candidateId}
          />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label="Last contacted" value={sinceLabel(person.lastTouchedAt)} hint={person.awaitingReplySince ? 'Waiting on their reply' : undefined} />
        <Stat label="Touches" value={String(person.touchCount)} />
        <Stat label="First replied" value={person.firstRepliedAt ? formatDate(person.firstRepliedAt) : '—'} />
        <Stat label="Connected" value={person.connectedAt ? formatDate(person.connectedAt) : '—'} />
      </section>

      <CrmNextChapterAccount
        info={{
          account: person.candidate
            ? { href: `/support/admin/candidates/${person.candidate.id}`, since: formatDate(person.candidate.createdAt) }
            : null,
          invitedAt: person.candidateInvitedAt ? formatDate(person.candidateInvitedAt) : null,
          possibleSignups: inviteMatches.map((m) => ({
            matchId: m.id,
            name: [m.candidate.firstName, m.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed',
            email: m.candidate.email,
            signedUp: formatDate(m.candidate.createdAt),
            sameEmail: m.strength === 'EMAIL_EXACT',
          })),
        }}
        membership={person.candidate ? `membership: ${MEMBERSHIP_STATUS_LABELS[person.candidate.membershipSubscription?.status ?? 'FREE']}` : undefined}
      />

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

      {contradicting.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium">Before you meet them</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {contradicting.length === 1 ? 'A piece' : `${contradicting.length} pieces`} of their research{' '}
            {contradicting.length === 1 ? 'cuts' : 'cut'} against the premise NextChapter is built on. Worth
            reading before the conversation, not during it.
          </p>
          <ul className="mt-2 space-y-1">
            {contradicting.map((r) => (
              <li key={r.id} className="text-sm">
                <span className="font-medium">{r.title}</span>
                {r.keyClaim && <span className="block text-xs text-muted-foreground">{r.keyClaim}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CrmIntroPaths
        targetPersonId={person.id}
        targetName={person.fullName}
        youKnowThemDirectly={person.warmth === 'HOT'}
        paths={person.introPathsAsTarget.map((p) => ({
          id: p.id,
          connectorPersonId: p.connectorPersonId,
          connectorName: p.connectorName,
          connectorRecordName: p.connectorPerson?.fullName ?? null,
          relationshipNote: p.relationshipNote,
          strength: p.strength,
          status: p.status,
          askedAt: p.askedAt ? p.askedAt.toISOString() : null,
        }))}
      />

      {person.researchItems.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Their research</h2>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {person.researchItems.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
                <span className="min-w-0">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{r.title}</a>
                  ) : <span className="font-medium">{r.title}</span>}
                  {r.keyClaim && <span className="mt-0.5 block text-xs text-muted-foreground">{r.keyClaim}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STANCE_CLASS[r.stance]}`}>
                    {STANCE_LABEL[r.stance]}
                  </span>
                  <CrmStanceSelect itemId={r.id} stance={r.stance} title={r.title} />
                </span>
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
        <h2 className="mb-1 text-lg font-semibold">Convert</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          Creates a real production record and links it here. Everything above — every email, intro path and
          stage change — stays on this record; the CRM owns the relationship before conversion, production
          owns it after.
        </p>
        <CrmGraduatePerson personId={person.id} coachId={person.coachId} recruiterId={person.recruiterId} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Send outreach</h2>
        <CrmOutreachCompose personId={person.id} personEmail={person.email} personName={person.fullName} />
      </section>

      {needsReview.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">
            Needs review <span className="text-sm font-normal text-muted-foreground">{needsReview.length}</span>
          </h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Outbound, doesn&apos;t mention NextChapter — real mail you sent, not yet counted as outreach until
            you confirm it belongs here.
          </p>
          <ul className="rounded-lg border border-orange/40 bg-orange/5 divide-y divide-orange/20">
            {needsReview.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-medium">{a.subject ?? a.type}</span>
                  {a.body && <span className="block text-xs text-muted-foreground">{a.body}</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {formatDate(a.occurredAt)}
                  <CrmActivityReviewInline activityId={a.id} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">History</h2>
        {confirmedActivities.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nothing logged yet. Email and calendar sync arrive in a later phase; LinkedIn messages are logged with the button above.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {confirmedActivities.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-medium">{a.subject ?? a.type}</span>
                  {a.body && <span className="block text-xs text-muted-foreground">{a.body}</span>}
                  {a.outreachTracking && (
                    <span className="mt-1 block text-xs">
                      <span className={a.outreachTracking.openCount > 0 ? 'text-success' : 'text-muted-foreground'}>
                        {a.outreachTracking.openCount > 0 ? `Opened ${a.outreachTracking.openCount}×` : 'Not opened yet'}
                      </span>
                      {a.outreachTracking.links.length > 0 && (
                        <span className="text-muted-foreground">
                          {' · '}{a.outreachTracking.links.reduce((n, l) => n + l.clickCount, 0)} link click(s)
                        </span>
                      )}
                    </span>
                  )}
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      {hint && <p className="mt-1 inline-block rounded-full bg-orange/15 px-1.5 py-0.5 text-xs font-medium text-orange">{hint}</p>}
    </div>
  )
}
