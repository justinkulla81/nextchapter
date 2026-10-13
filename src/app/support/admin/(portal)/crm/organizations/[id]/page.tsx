import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmIntroPaths } from '@/components/admin/CrmIntroPaths'
import { CrmMeetLink } from '@/components/admin/CrmMeetLink'
import { CrmGraduateOrganization } from '@/components/admin/CrmGraduateButtons'
import { CrmCollegeProfile } from '@/components/admin/CrmCollegeProfile'
import { CrmOrgQualitySelect } from '@/components/admin/CrmOrgQualitySelect'
import { CrmDealStatusSelect } from '@/components/admin/CrmDealStatusSelect'
import { CrmOrgBackgroundSections } from '@/components/admin/CrmOrgBackgroundSections'
import { CrmAddOrgOpportunity } from '@/components/admin/CrmOrgOpportunities'
import { OPPORTUNITY_KINDS, kindForPipeline } from '@/lib/crm/opportunity-kinds'
import { ORG_TYPE_LABELS, ELIGIBILITY_LABELS, QUALITY_LABELS, qualityClass, formatDate } from '@/lib/crm/labels'

export const maxDuration = 30

export default async function CrmOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const org = await prisma.crmOrganization.findUnique({
    where: { id },
    include: {
      affiliations: { include: { person: { select: { id: true, fullName: true, roles: true, lastTouchedAt: true } } } },
      opportunities: { include: { pipeline: true, stage: true, deadlines: { where: { dueAt: { not: null } }, orderBy: { dueAt: 'asc' }, take: 1 } } },
      deadlines: { orderBy: [{ dueAt: 'asc' }] },
      researchItems: true,
      introPathsAsTarget: {
        include: { connectorPerson: { select: { id: true, fullName: true } } },
        orderBy: [{ strength: 'asc' }, { createdAt: 'asc' }],
      },
      investorProfile: true,
      outplacementProfile: true,
      partnerProfile: true,
      researchProfile: true,
      company: { select: { id: true, name: true } },
    },
  })
  if (!org) notFound()
  const pipelines = await prisma.crmPipeline.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { key: true, label: true } })

  // Meetings tied to this organization directly or through one of its
  // opportunities. One calendar event is logged once per attendee, so group by
  // event to show each call once with everyone who was on it.
  const meetingRows = await prisma.crmActivity.findMany({
    where: { type: 'MEETING', OR: [{ orgId: id }, { opportunity: { orgId: id } }] },
    orderBy: { occurredAt: 'desc' },
    take: 60,
    select: {
      id: true, subject: true, occurredAt: true, sourceRef: true, body: true, meetUrl: true, notesDocUrl: true,
      person: { select: { id: true, fullName: true } },
      opportunity: { select: { id: true, title: true } },
    },
  })
  const meetings = [...meetingRows.reduce((m, a) => {
    const key = a.sourceRef?.split(':')[0] ?? a.id
    const cur = m.get(key)
    if (cur) {
      if (a.person && !cur.people.some((p) => p.id === a.person!.id)) cur.people.push(a.person)
      if (!cur.body && a.body) { cur.body = a.body; cur.notesDocUrl = a.notesDocUrl }
    } else {
      m.set(key, { ...a, people: a.person ? [a.person] : [] })
    }
    return m
  }, new Map<string, (typeof meetingRows)[number] & { people: { id: string; fullName: string }[] }>()).values()].slice(0, 20)

  // Candidates who have worked here: free-text work history matched on the same
  // normalized name the organization is keyed by, plus employment rows on the
  // linked directory Company. One person can appear in both, so merge by id.
  const [historyRows, employmentRows] = await Promise.all([
    prisma.workHistoryEntry.findMany({
      where: { companyNameNormalized: org.canonicalNameNormalized },
      select: { candidateId: true, roleTitle: true, startDate: true, endDate: true, isCurrent: true, candidate: { select: { firstName: true, lastName: true } } },
      orderBy: { startDate: 'desc' },
      take: 50,
    }),
    org.companyId
      ? prisma.memberEmployment.findMany({
          where: { companyId: org.companyId },
          select: { candidateId: true, title: true, startDate: true, endDate: true, isCurrent: true, candidate: { select: { firstName: true, lastName: true } } },
          take: 50,
        })
      : Promise.resolve([]),
  ])
  const alumni = new Map<string, { id: string; name: string; title: string; startDate: Date | null; endDate: Date | null; isCurrent: boolean }>()
  for (const r of [
    ...historyRows.map((h) => ({ ...h, title: h.roleTitle })),
    ...employmentRows,
  ]) {
    if (alumni.has(r.candidateId)) continue
    alumni.set(r.candidateId, {
      id: r.candidateId,
      name: [r.candidate.firstName, r.candidate.lastName].filter(Boolean).join(' ') || 'Unnamed',
      title: r.title, startDate: r.startDate, endDate: r.endDate, isCurrent: r.isCurrent,
    })
  }
  const alumniList = [...alumni.values()]
  const year = (d: Date | null) => (d ? String(d.getFullYear()) : '')

  return (
    <div className="space-y-8">
      <nav className="text-sm">
        <Link href="/support/admin/crm/organizations" className="text-muted-foreground hover:underline">← All organizations</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">{org.name}</h1>
        {org.focus && <p className="mt-2 max-w-prose text-sm text-muted-foreground">{org.focus}</p>}
      </header>

      <section aria-label="Details" className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-base font-semibold">Details</h2>
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Type</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {org.orgTypes.length === 0 ? '—' : org.orgTypes.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{ORG_TYPE_LABELS[t]}</span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Grade</dt>
            <dd className="mt-1"><CrmOrgQualitySelect orgId={org.id} value={org.leadQuality} /></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Deal status{org.dealStatusAt ? ` · since ${formatDate(org.dealStatusAt)}` : ''}</dt>
            <dd className="mt-1"><CrmDealStatusSelect orgId={org.id} value={org.dealStatus} /></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Location</dt>
            <dd className="mt-1">{org.hqRegion ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Website</dt>
            <dd className="mt-1">
              {org.website ? <a href={org.website} target="_blank" rel="noreferrer" className="underline">Open ↗</a> : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Company intel</dt>
            <dd className="mt-1">
              {org.company ? <Link href={`/support/admin/companies/${org.company.id}`} className="underline">Open</Link> : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <CrmCollegeProfile orgId={org.id} />

          {org.investorProfile && (
            <section className="rounded-lg border border-border p-4">
              <h2 className="text-base font-semibold">Investor profile</h2>
              <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
                <Field label="Check size" value={org.investorProfile.checkSizeNote} />
                <Field label="Eligibility" value={ELIGIBILITY_LABELS[org.investorProfile.eligibility]} />
                <Field label="Responsiveness (estimate)" value={org.investorProfile.responsiveness} />
              </dl>
              {org.investorProfile.thesis && <p className="mt-3 text-sm text-muted-foreground">{org.investorProfile.thesis}</p>}
            </section>
          )}

          {org.outplacementProfile && (
            <section className="rounded-lg border border-border p-4">
              <h2 className="text-base font-semibold">Outplacement lead</h2>
              <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-4">
                <Field label="Headcount affected" value={org.outplacementProfile.headcountAffected?.toLocaleString() ?? null} />
                <Field label="White collar" value={org.outplacementProfile.pctWhiteCollar} />
                <Field label="Announced" value={org.outplacementProfile.announcedAt ? formatDate(org.outplacementProfile.announcedAt) : null} />
                <Field label="Incumbent provider" value={org.outplacementProfile.incumbentProvider} />
              </dl>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-base font-semibold">Opportunities ({org.opportunities.length})</h2>
            <div className="divide-y divide-border rounded-lg border border-border">
              {OPPORTUNITY_KINDS.map((kind) => {
                const opps = org.opportunities.filter((o) => kindForPipeline(o.pipeline.key)?.key === kind.key)
                if (opps.length === 0 && !kind.alwaysShown) return null
                const choices = kind.pipelineKeys
                  .map((k) => pipelines.find((p) => p.key === k))
                  .filter((p): p is { key: string; label: string } => Boolean(p))
                return (
                  <div key={kind.key} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">
                        {kind.label}
                        <span className="ml-2 font-normal text-muted-foreground">{opps.length === 0 ? 'None' : opps.length}</span>
                      </h3>
                      {choices.length > 0 && <CrmAddOrgOpportunity orgId={org.id} pipelines={choices} />}
                    </div>
                    {opps.length > 0 && (
                      <ul className="mt-2 space-y-2">
                        {opps.map((o) => {
                          const due = o.committedFollowUpAt ?? o.nextStepDueAt ?? o.deadlines[0]?.dueAt ?? null
                          const dueLabel = o.committedFollowUpAt ? 'Promised' : o.nextStepDueAt ? 'Next step' : o.deadlines[0]?.dueAt ? 'Deadline' : null
                          return (
                            <li key={o.id} className="text-sm">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <Link href={`/support/admin/crm/pipelines/${o.pipeline.key}`} className="font-medium hover:underline">{o.title}</Link>
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span className={`rounded px-1.5 py-0.5 font-semibold ${qualityClass(o.leadQuality)}`} title="Rating">
                                    {o.leadQuality === 'UNGRADED' ? 'Ungraded' : o.leadQuality}
                                  </span>
                                  <span title="Priority score">Score {o.priorityOverride ?? Math.round(o.priorityScore)}</span>
                                  <span title="Stage">{o.stage.label}</span>
                                  <span title="Date">
                                    {due && dueLabel ? `${dueLabel} ${formatDate(due)}` : `Added ${formatDate(o.createdAt)}`}
                                  </span>
                                  {o.amountUsdMax ? (
                                    <span>{o.amountUsdMin && o.amountUsdMin !== o.amountUsdMax ? `$${o.amountUsdMin.toLocaleString()}–` : 'up to '}${o.amountUsdMax.toLocaleString()}</span>
                                  ) : null}
                                </span>
                              </div>
                              {o.nextStep && <p className="mt-0.5 text-xs text-muted-foreground">{o.nextStep}</p>}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">Research ({org.researchItems.length})</h2>
            {org.researchItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing saved for this organization yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {org.researchItems.map((r) => (
                  <li key={r.id} className="p-3 text-sm">
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{r.title} ↗</a>
                    ) : <span className="font-medium">{r.title}</span>}
                    {(r.authorNames || r.publishedYear) && (
                      <span className="ml-2 text-xs text-muted-foreground">{[r.authorNames, r.publishedYear].filter(Boolean).join(' · ')}</span>
                    )}
                    {r.keyClaim && <p className="mt-1 text-xs text-muted-foreground">{r.keyClaim}</p>}
                    {r.relevanceNote && <p className="mt-1 text-xs">{r.relevanceNote}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">Candidates who worked here ({alumniList.length})</h2>
            {alumniList.length === 0 ? (
              <p className="text-sm text-muted-foreground">None of our candidates list this organization.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {alumniList.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                    <span>
                      <Link href={`/support/admin/candidates/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
                      <span className="text-muted-foreground"> — {a.title}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.isCurrent ? `${year(a.startDate)}–present` : [year(a.startDate), year(a.endDate)].filter(Boolean).join('–')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold">People in the CRM ({org.affiliations.length})</h2>
            {org.affiliations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody here is in your network yet — add a route in from the sidebar.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {org.affiliations.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <span>
                      <Link href={`/support/admin/crm/people/${a.person.id}`} className="font-medium hover:underline">{a.person.fullName}</Link>
                      {a.title && <span className="text-muted-foreground"> — {a.title}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.person.lastTouchedAt ? `Last contacted ${formatDate(a.person.lastTouchedAt)}` : 'Never contacted'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <details open={org.introPathsAsTarget.length > 0} className={org.introPathsAsTarget.length > 0 ? 'rounded-lg border border-border p-3' : 'text-muted-foreground'}>
            <summary className="cursor-pointer text-sm font-semibold">
              {org.introPathsAsTarget.length > 0 ? `Routes in (${org.introPathsAsTarget.length})` : 'Add a route in'}
            </summary>
            <div className="mt-3">
              <CrmIntroPaths
                compact
                targetOrgId={org.id}
                targetName={org.name}
                paths={org.introPathsAsTarget.map((p) => ({
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
            </div>
          </details>

          {meetings.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Meetings ({meetings.length})</h2>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {meetings.map((m) => (
                  <li key={m.id} className="p-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{m.subject ?? 'Meeting'}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(m.occurredAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.people.map((p, i) => (
                        <span key={p.id}>{i > 0 && ', '}<Link href={`/support/admin/crm/people/${p.id}`} className="underline">{p.fullName}</Link></span>
                      ))}
                      {m.opportunity && <> · Opportunity: {m.opportunity.title}</>}
                      {m.meetUrl && <> · <CrmMeetLink href={m.meetUrl} label="Meet link" kind="join" orgId={org.id} /></>}
                      {m.notesDocUrl && <> · <CrmMeetLink href={m.notesDocUrl} label="Notes by Gemini" kind="notes" orgId={org.id} /></>}
                    </p>
                    {m.body && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">Show meeting notes</summary>
                        <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{m.body}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {org.deadlines.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Dates</h2>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {org.deadlines.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <span className="font-medium">{d.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.dueAt ? formatDate(d.dueAt) : `${d.rawText ?? 'No date'} — no date to track`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <CrmOrgBackgroundSections
            org={{ id: org.id, name: org.name, canonicalNameNormalized: org.canonicalNameNormalized, companyId: org.companyId }}
          />

          {org.orgTypes.includes('OUTPLACEMENT_LEAD') && (
            <section>
              <h2 className="mb-1 text-sm font-semibold">Convert</h2>
              <p className="mb-2 text-xs text-muted-foreground">
                Creates an outplacement employer with contracts and seats. This record keeps its history.
              </p>
              <CrmGraduateOrganization orgId={org.id} outplacementOrgId={org.outplacementOrgId} />
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value ?? '—'}</dd>
    </div>
  )
}
