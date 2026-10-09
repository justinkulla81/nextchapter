import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CRM_ACTIVITY_CUTOFF } from '@/lib/crm/cutoff'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrmLogLinkedInButton } from '@/components/admin/CrmLogLinkedInButton'
import { CrmInviteToggle } from '@/components/admin/CrmInviteToggle'
import { CrmNextChapterAccount } from '@/components/admin/CrmNextChapterAccount'
import { CrmReferrals } from '@/components/admin/CrmReferrals'
import { CrmIntroPaths } from '@/components/admin/CrmIntroPaths'
import { CrmStanceSelect, STANCE_LABEL, STANCE_CLASS } from '@/components/admin/CrmStanceSelect'
import { CrmGraduatePerson } from '@/components/admin/CrmGraduateButtons'
import { CrmInlineSelect } from '@/components/admin/CrmInlineSelect'
import { CrmPersonOrg } from '@/components/admin/CrmPersonOrg'
import { Collapsible, GroupHeading } from '@/components/admin/Collapsible'
import { CrmOutreachCompose } from '@/components/admin/CrmOutreachCompose'
import { CrmActivityReviewInline } from '@/components/admin/CrmActivityReviewInline'
import { RapSheetGenerateButton } from '@/components/admin/RapSheetControls'
import { PersonMailingSection } from '@/components/admin/mailing/PersonMailingSection'
import { MAILING_REF_PREFIX } from '@/lib/mailing/editions'
import { groupEmailChains, latestReplyOnly } from '@/lib/crm/email-thread'
import { updatePersonRoles, updatePersonField, setPersonLinkedIn } from '../../actions'
import {
  PERSON_ROLES, PERSON_ROLE_LABELS, QUALITIES, QUALITY_LABELS, WARMTH_LABELS,
  PRIORITY_TIERS, PRIORITY_TIER_LABELS, priorityTierClass,
  qualityClass, formatDate, sinceLabel, meetingLabel, MEMBERSHIP_STATUS_LABELS,
} from '@/lib/crm/labels'

export const maxDuration = 30

export default async function CrmPersonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const person = await prisma.crmPerson.findUnique({
    where: { id },
    include: {
      affiliations: { include: { org: true }, orderBy: [{ isPrimary: 'desc' }, { isCurrent: 'desc' }] },
      backgrounds: { include: { org: { select: { id: true, name: true } } }, orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }] },
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
      rapSheets: { where: { content: { not: Prisma.DbNull } }, orderBy: { generatedAt: 'desc' }, take: 5, select: { id: true, generatedAt: true, meetingTitle: true } },
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
  const primaryAff = person.affiliations[0] ?? null
  const othersAtOrg = primaryAff
    ? await prisma.crmAffiliation.count({ where: { orgId: primaryAff.orgId, personId: { not: person.id }, person: { deletedAt: null } } })
    : 0
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
  // List emails on the history: what each person did with them lives on the recipient row.
  const mailingIds = person.activities.flatMap((a) => (a.sourceRef?.startsWith(MAILING_REF_PREFIX) ? [a.sourceRef.slice(MAILING_REF_PREFIX.length)] : []))
  const mailingRecipients = new Map(
    (mailingIds.length
      ? await prisma.mailingEditionRecipient.findMany({
          where: { id: { in: mailingIds } },
          select: { id: true, editionId: true, deliveredAt: true, openCount: true, clickCount: true, repliedAt: true, bouncedAt: true, unsubscribedAt: true },
        })
      : []
    ).map((r) => [r.id, r]),
  )
  const needsReview = person.activities.filter((a) => a.needsReview)
  const confirmedActivities = person.activities.filter((a) => !a.needsReview)
  // Surfaced as a banner rather than buried in a list: walking into a meeting
  // unaware that your counterpart's own research undercuts your premise is the
  // specific failure this field exists to prevent.
  const contradicting = person.researchItems.filter((r) => r.stance === 'CONTRADICTS')

  // Emails collapse into one chain per conversation; everything else stays a single row.
  type Activity = (typeof confirmedActivities)[number]
  const emailChains = groupEmailChains(confirmedActivities.filter((a) => a.type === 'EMAIL'))
  const historyItems = [
    ...emailChains.map((chain) => ({ kind: 'chain' as const, chain, at: chain.latest })),
    ...confirmedActivities.filter((a) => a.type !== 'EMAIL').map((activity) => ({ kind: 'single' as const, activity, at: activity.occurredAt })),
  ].sort((x, y) => y.at.getTime() - x.at.getTime())
  const chainCount = emailChains.length

  const renderActivity = (a: Activity, showSubject: boolean) => {
    // Synced mail stores the whole quoted thread; only the newest message's own text is shown.
    const reply = a.type === 'EMAIL' ? latestReplyOnly(a.body) : (a.body ?? '')
    const m = a.sourceRef?.startsWith(MAILING_REF_PREFIX) ? mailingRecipients.get(a.sourceRef.slice(MAILING_REF_PREFIX.length)) : undefined
    const mailingBits = m ? [
      m.bouncedAt ? 'Bounced' : m.deliveredAt ? 'Delivered' : 'Not delivered yet',
      m.openCount > 0 ? `opened ${m.openCount}× (approx.)` : 'not opened',
      m.clickCount > 0 ? `${m.clickCount} ${m.clickCount === 1 ? 'click' : 'clicks'}` : null,
      m.repliedAt ? 'replied' : null,
      m.unsubscribedAt ? 'unsubscribed' : null,
    ].filter(Boolean) : []
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          {showSubject && <span className="font-medium">{a.subject ?? a.type}</span>}
          {!showSubject && (
            <span className="text-xs font-medium">{a.direction === 'INBOUND' ? 'Received' : 'Sent'}</span>
          )}
          {reply && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">Show message</summary>
              <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{reply}</p>
            </details>
          )}
          {m && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {mailingBits.join(' · ')} · <Link href={`/support/admin/crm/mailing/editions/${m.editionId}`} className="underline">open the send</Link>
            </span>
          )}
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
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(a.occurredAt)}
          {a.isAutoLogged ? ' · auto' : ' · logged by hand'}
        </span>
      </div>
    )
  }

  // "BD: Coach" -> group "Business development", item "Coach".
  const ROLE_GROUPS: Record<string, string> = {
    BD: 'Business development', F: 'Funding', FF: 'Friends and family', GTM: 'Go-to-market', 'Higher ed': 'Higher ed', NC: 'NextChapter',
  }
  const roleGroups = new Map<string, { role: (typeof PERSON_ROLES)[number]; label: string }[]>()
  for (const r of PERSON_ROLES) {
    const [prefix, ...rest] = PERSON_ROLE_LABELS[r].split(': ')
    const group = ROLE_GROUPS[prefix] ?? prefix
    roleGroups.set(group, [...(roleGroups.get(group) ?? []), { role: r, label: rest.join(': ') || PERSON_ROLE_LABELS[r] }])
  }
  const selectedRoles = person.roles.map((r) => PERSON_ROLE_LABELS[r])

  return (
    <div className="space-y-8">
      <nav className="text-sm">
        <Link href="/support/admin/crm" className="text-muted-foreground hover:underline">← All people</Link>
      </nav>

      {/* Who they are, and the few things you do from here. */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {person.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photoUrl} alt={`Photo of ${person.fullName}`} className="h-20 w-20 shrink-0 rounded-full border border-border object-cover" />
          ) : (
            <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-semibold text-muted-foreground">
              {person.fullName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
            </span>
          )}
        <div>
          <h1 className="text-2xl font-semibold">{person.fullName}</h1>
          {person.location && <p className="mt-0.5 text-sm text-muted-foreground">{person.location}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {person.email && <a href={`mailto:${person.email}`} className="underline">{person.email}</a>}
            {!person.email && person.guessedEmail && (
              <span title={`Guessed from the format others there use: ${person.guessedEmailBasis ?? ''}. Not confirmed.`}>
                <a href={`mailto:${person.guessedEmail}`} className="underline">{person.guessedEmail}</a>
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">guessed</span>
              </span>
            )}
            {person.phone && <a href={`tel:${person.phone}`} className="underline">{person.phone}</a>}
            {person.linkedinUrl ? (
              <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="underline">LinkedIn profile ↗</a>
            ) : (
              <details>
                <summary className="cursor-pointer text-muted-foreground underline">Add LinkedIn link</summary>
                <form action={setPersonLinkedIn.bind(null, person.id)} className="mt-2 flex items-center gap-2">
                  <label htmlFor="linkedinUrl" className="sr-only">LinkedIn profile URL</label>
                  <input
                    id="linkedinUrl" name="linkedinUrl" type="url" placeholder="https://www.linkedin.com/in/…"
                    className="h-8 w-72 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
                  />
                  <SubmitButton size="sm" pendingLabel="Saving…">Save link</SubmitButton>
                </form>
              </details>
            )}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
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
            {person.linkedinDegree && (
              <span
                className="text-muted-foreground"
                title={person.linkedinDegreeSeenAt ? `Seen on their LinkedIn profile ${formatDate(person.linkedinDegreeSeenAt)}` : undefined}
              >
                · LinkedIn {person.linkedinDegree}
              </span>
            )}
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
            {!person.email && person.guessedEmail && (
              <span title={`Guessed from the format others there use: ${person.guessedEmailBasis ?? ''}. Not confirmed.`}>
                <a href={`mailto:${person.guessedEmail}`} className="underline">{person.guessedEmail}</a>
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">guessed</span>
              </span>
            )}
          </p>
        </div>
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
        <Stat label="Last contacted" value={sinceLabel(person.lastTouchedAt)} hint={meetingLabel(person.nextMeetingAt) ? `Meeting scheduled · ${meetingLabel(person.nextMeetingAt)}` : person.awaitingReplySince ? 'Waiting on their reply' : undefined} />
        <Stat label="Touches" value={String(person.touchCount)} />
        <Stat label="First replied" value={person.firstRepliedAt ? formatDate(person.firstRepliedAt) : '—'} />
        <Stat label="Connected" value={person.connectedAt ? formatDate(person.connectedAt) : '—'} />
      </section>

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

      <section className="space-y-3">
        <GroupHeading>Organization</GroupHeading>
        <CrmPersonOrg
          personId={person.id}
          org={primaryAff ? { id: primaryAff.orgId, name: primaryAff.org.name } : null}
          title={primaryAff?.title ?? null}
          othersCount={othersAtOrg}
        />
      {person.affiliations.length > 1 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">Affiliations</h2>
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

      {person.backgrounds.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">Background</h2>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {person.backgrounds.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <Link href={`/support/admin/crm/organizations/${b.orgId}`} className="font-medium hover:underline">{b.org.name}</Link>
                  {b.detail && <span className="text-muted-foreground"> — {b.detail}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{b.kind === 'SCHOOL' ? 'School' : 'Former employer'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      </section>

      <section className="space-y-3">
        <GroupHeading>Conversation</GroupHeading>
        <Collapsible title="Send outreach" hint={person.email ? `to ${person.email}` : 'no email on file'}>
          <CrmOutreachCompose personId={person.id} personEmail={person.email} personName={person.fullName} />
        </Collapsible>
      {needsReview.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">
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
                  {a.body && <span className="block text-xs text-muted-foreground">{a.type === 'EMAIL' ? latestReplyOnly(a.body) : a.body}</span>}
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


        <div>
          <h3 className="mb-2 text-base font-semibold">
            History{chainCount > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">{chainCount} email {chainCount === 1 ? 'conversation' : 'conversations'}</span>}
          </h3>
          {confirmedActivities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing logged yet. Email and calendar sync arrive in a later phase; LinkedIn messages are logged with the button above.
            </p>
          ) : (
            <ul className="space-y-2">
              {historyItems.map((item) =>
                item.kind === 'chain' ? (
                  <li key={item.chain.key}>
                    <details className="rounded-lg border border-border">
                      <summary className="flex cursor-pointer select-none flex-wrap items-baseline justify-between gap-2 p-3 text-sm hover:bg-muted/50">
                        <span className="font-medium">{item.chain.messages[0].subject}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.chain.messages.length} {item.chain.messages.length === 1 ? 'email' : 'emails'} · latest {formatDate(item.chain.latest)}
                        </span>
                      </summary>
                      {/* One continuous rule down the left ties the messages into a single chain. */}
                      <ol className="mx-4 mb-3 ml-5 space-y-2 border-l-2 border-border pl-4 pt-1">
                        {item.chain.messages.map((a) => (
                          <li key={a.id} className="relative text-sm">
                            <span className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full bg-border" aria-hidden />
                            {renderActivity(a, false)}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </li>
                ) : (
                  <li key={item.activity.id} className="rounded-lg border border-border p-3 text-sm">{renderActivity(item.activity, true)}</li>
                ),
              )}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <GroupHeading>Meeting briefs</GroupHeading>
        <p className="text-sm text-muted-foreground">
          Local layoffs, initiatives, white-collar metrics and a tailored pitch for a meeting with {person.fullName.split(' ')[0]}, emailed to you.
          Costs about $0.30–1.00 per build.
        </p>
        {person.rapSheets.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {person.rapSheets.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/support/admin/crm/rap-sheets/${r.id}`} className="font-medium underline">
                  {r.meetingTitle || 'Meeting brief'}
                </Link>
                <span className="text-xs text-muted-foreground">Built {r.generatedAt ? formatDate(r.generatedAt) : '—'}</span>
              </li>
            ))}
          </ul>
        )}
        <RapSheetGenerateButton personId={person.id} label={person.rapSheets[0] ? 'Rebuild meeting brief and email me' : 'Build meeting brief and email me'} />
      </section>

      <section className="space-y-3">
        <GroupHeading>Relationships</GroupHeading>
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

        <Collapsible title="Referrals" hint="candidates they have recommended">
          <CrmReferrals personId={person.id} />
        </Collapsible>
      {person.researchItems.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">Their research</h2>
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

      </section>

      <section className="space-y-3">
        <GroupHeading>About this person</GroupHeading>
        <Collapsible title="Contact type" hint={selectedRoles.length ? selectedRoles.join(' · ') : 'None set'}>
          <form action={saveRoles}>
            <fieldset className="space-y-3">
              <legend className="sr-only">Contact types for {person.fullName}</legend>
              {[...roleGroups.entries()].map(([group, items]) => (
                <div key={group}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{group}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {items.map(({ role, label }) => (
                      <label key={role} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="roles" value={role} defaultChecked={person.roles.includes(role)} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <div className="mt-3">
              <SubmitButton pendingLabel="Saving…">Save contact types</SubmitButton>
            </div>
          </form>
        </Collapsible>
        <Collapsible title="Notes" hint={person.notes ? person.notes.slice(0, 80) : 'Nothing yet'} defaultOpen={!!person.notes}>
          <form action={saveNotes}>
            <label htmlFor="notes" className="sr-only">Notes about {person.fullName}</label>
            <textarea
              id="notes" name="notes" rows={4} defaultValue={person.notes ?? ''}
              placeholder="What matters about this person that isn't captured above."
              className="w-full rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
            />
            <div className="mt-3"><SubmitButton pendingLabel="Saving…">Save notes</SubmitButton></div>
          </form>
        </Collapsible>
      {person.opportunities.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-semibold">Pipelines</h2>
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

      </section>

      <section className="space-y-3">
        <GroupHeading>NextChapter account and lists</GroupHeading>
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
        <Collapsible title="Mailing lists and reports">
          <PersonMailingSection personId={person.id} email={person.email} />
        </Collapsible>
        <Collapsible title="Convert to a production record" hint="optional">
          <p className="mb-2 text-sm text-muted-foreground">
            Contact types are enough on their own — a person stays unconverted and keeps every type. Converting creates a real production
            record and links it here. Every email, intro path and stage change stays on this record; the CRM owns the relationship before
            conversion, production owns it after.
          </p>
          <CrmGraduatePerson personId={person.id} coachId={person.coachId} recruiterId={person.recruiterId} />
        </Collapsible>
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
