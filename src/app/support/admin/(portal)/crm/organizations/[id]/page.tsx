import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { orgSlug, canonicalFromSlug } from '@/lib/crm/org-slug'
import { CrmIntroPaths } from '@/components/admin/CrmIntroPaths'
import { SectionTitle } from '@/components/admin/Collapsible'
import { setTodoDone } from '../../todos/actions'
import { CrmMeetLink } from '@/components/admin/CrmMeetLink'
import { CrmGraduateOrganization } from '@/components/admin/CrmGraduateButtons'
import { CrmCollegeProfile } from '@/components/admin/CrmCollegeProfile'
import { CrmOrgContext } from '@/components/admin/CrmOrgContext'
import { CrmOrgQualitySelect } from '@/components/admin/CrmOrgQualitySelect'
import { CrmDealStatusSelect } from '@/components/admin/CrmDealStatusSelect'
import { CrmOrgBackgroundSections } from '@/components/admin/CrmOrgBackgroundSections'
import { CrmAddOrgOpportunity } from '@/components/admin/CrmOrgOpportunities'
import { BenefitsPanel } from '@/components/admin/BenefitsPanel'
import { programsForEmployer } from '@/lib/benefits/store'
import { CrmFundingMatches } from '@/components/admin/CrmFundingMatches'
import { kindsForOrg } from '@/lib/funding-opportunities/eligibility'
import { opportunitiesForKinds } from '@/lib/funding-opportunities/store'
import { OPPORTUNITY_KINDS, kindForPipeline } from '@/lib/crm/opportunity-kinds'
import { ORG_TYPE_LABELS, ELIGIBILITY_LABELS, qualityClass, formatDate, meetingLabel } from '@/lib/crm/labels'
import { loadOrgDemandData } from '@/lib/crm/org-page-data'
import { schoolsWithCoreRecruiter } from '@/lib/higher-ed/recruiting'
import { loadWarmDoors } from '@/lib/crm/warm-doors'
import { rateProspect, isDecisionMakerTitle, daysSince, type ProspectBand } from '@/lib/crm/org-prospect'
import { captureServerEvent } from '@/lib/posthog/server'
import { CrmHiringClient } from '@/components/admin/CrmHiringClient'
import { MANDATE_STATUS_LABELS } from '@/lib/crm/mandates'
import { Suspense } from 'react'
import { publicPageForOrg } from '@/lib/seo/public-page-for-org'
import { CompanyHiringIndex, CompanyHiringIndexSkeleton } from '@/components/companies/CompanyHiringIndex'

export const maxDuration = 30

export default async function CrmOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id: param } = await params
  // The URL carries either a readable slug (/organizations/mastercard) or an id.
  const org = await prisma.crmOrganization.findFirst({
    where: { OR: [{ id: param }, { canonicalNameNormalized: canonicalFromSlug(param) }] },
    include: {
      organization: { select: { id: true, name: true } },
      affiliations: { include: { person: { select: { id: true, fullName: true, roles: true, lastTouchedAt: true, nextMeetingAt: true, nextMeetingUrl: true } } } },
      mandates: { include: { recruiter: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' } },
      opportunities: { include: { pipeline: true, stage: true, deadlines: { where: { dueAt: { not: null } }, orderBy: { dueAt: 'asc' }, take: 1 } } },
      deadlines: { orderBy: [{ dueAt: 'asc' }] },
      tasks: { where: { status: 'OPEN' }, orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }], include: { person: { select: { id: true, fullName: true } } } },
      researchItems: true,
      introPathsAsTarget: {
        include: { connectorPerson: { select: { id: true, fullName: true } } },
        orderBy: [{ strength: 'asc' }, { createdAt: 'asc' }],
      },
      investorProfile: true,
      outplacementProfile: true,
      partnerProfile: true,
      researchProfile: true,
      company: { select: { id: true, name: true, chroName: true, chroEmail: true, chroLinkedinUrl: true } },
    },
  })
  if (!org) notFound()
  const id = org.id
  const slug = orgSlug(org.canonicalNameNormalized)
  const publicPage = await publicPageForOrg(org).catch(() => null)
  if (slug && param !== slug) redirect(`/support/admin/crm/organizations/${slug}`)
  // Open federal grants this organization could apply for. The table is applied
  // by hand, so a missing one reads as "none" rather than breaking the page.
  const inBoardDirectory = org.orgTypes.includes('GOVERNMENT')
    ? Boolean(await prisma.workforceBoard.findFirst({ where: { name: { equals: org.name, mode: 'insensitive' } }, select: { id: true } }).catch(() => null))
    : false
  const employerBenefits = await programsForEmployer(org.canonicalNameNormalized)
  const funding = await opportunitiesForKinds(kindsForOrg({ orgTypes: org.orgTypes, name: org.name, inBoardDirectory }), { state: org.usState }).catch(() => [])
  // Everything below depends only on the org, so it all loads together.
  // Meetings tied to this organization directly or through one of its
  // opportunities. One calendar event is logged once per attendee, so group by
  // event (below) to show each call once with everyone who was on it.
  // Candidates who have worked here: free-text work history matched on the same
  // normalized name the organization is keyed by, plus employment rows on the
  // linked directory Company. One person can appear in both, so merge by id.
  const [demand, warmDoors, pipelines, meetingRows, historyRows, employmentRows, coreSchools] = await Promise.all([
    loadOrgDemandData(org),
    loadWarmDoors({ orgId: org.id }).catch(() => []),
    prisma.crmPipeline.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { key: true, label: true } }),
    prisma.crmActivity.findMany({
      where: { type: 'MEETING', OR: [{ orgId: id }, { opportunity: { orgId: id } }] },
      orderBy: { occurredAt: 'desc' },
      take: 60,
      select: {
        id: true, subject: true, occurredAt: true, sourceRef: true, body: true, meetUrl: true, notesDocUrl: true,
        person: { select: { id: true, fullName: true } },
        opportunity: { select: { id: true, title: true } },
      },
    }),
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
    // Colleges that flag this company as a core recruiter. Admin-only: a college never sees another's list.
    org.companyId ? schoolsWithCoreRecruiter(org.companyId).catch(() => []) : Promise.resolve([]),
  ])
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
  const money = (n: number) => `$${n.toLocaleString()}`

  // ── prospect rating ──────────────────────────────────────────────────────
  const lastTouch = org.affiliations.reduce<Date | null>((m, a) => {
    const t = a.person.lastTouchedAt
    return t && (!m || t > m) ? t : m
  }, null)
  const rating = rateProspect({
    layoff: demand.layoffSummary,
    openRoles: demand.openJobs.length,
    seniorRoles: demand.seniorRoles,
    candidatesApplied: demand.appliedCount,
    candidatesWhoWorkedHere: alumniList.length,
    contacts: org.affiliations.length,
    decisionMakers: org.affiliations.filter((a) => isDecisionMakerTitle(a.title)).length,
    routesIn: org.introPathsAsTarget.length,
    meetings: meetings.length,
    daysSinceLastTouch: lastTouch ? daysSince(lastTouch) : null,
    inTheNews: demand.layoffNews.length + demand.researchNews.length,
    leadQuality: org.leadQuality,
    dealStatus: org.dealStatus,
    opportunities: org.opportunities.length,
  })
  captureServerEvent(org.id, 'crm_org_page_viewed', {
    orgName: org.name, prospectScore: rating.score, prospectBand: rating.band,
    openJobs: demand.openJobs.length, candidatesWhoWant: demand.wantToWork.length,
    layoffsPastYear: demand.layoffYear.events, laidOffPastYear: demand.layoffYear.employees, openMandates: demand.mandates.length, coreRecruiterColleges: coreSchools.length,
  })

  const BAND_LABEL: Record<ProspectBand, string> = { hot: 'Hot prospect', warm: 'Warm prospect', cool: 'Cool', cold: 'Cold' }
  const chro = org.company?.chroName || org.company?.chroEmail || org.company?.chroLinkedinUrl ? org.company : null
  const JOB_LIMIT = 25

  const nav = [
    { id: 'next', label: 'Next up', n: org.tasks.length + org.opportunities.length },
    { id: 'contacts', label: 'Contacts', n: org.affiliations.length },
    { id: 'candidates', label: 'Candidates', n: demand.wantToWork.length + alumniList.length },
    { id: 'jobs', label: 'Open jobs', n: demand.openJobs.length },
    { id: 'mandates', label: 'Recruiter mandates', n: demand.mandates.length },
    { id: 'layoffs', label: 'Layoffs', n: demand.notices.length + demand.layoffNews.length },
    { id: 'research', label: 'News & research', n: demand.researchNews.length + org.researchItems.length },
    { id: 'data', label: 'Data', n: null },
  ]

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm/organizations" className="text-muted-foreground hover:underline">← Organizations</Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1">
            {org.orgTypes.map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{ORG_TYPE_LABELS[t]}</span>
            ))}
            {org.hqRegion && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{org.hqRegion}</span>}
          </div>
          {publicPage && (
            <p className="mt-2 text-sm">
              <a href={publicPage.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">{publicPage.label}</a>
              {!publicPage.indexed && <span className="ml-2 text-xs text-muted-foreground">not offered to search engines yet</span>}
            </p>
          )}
          <CrmHiringClient orgId={org.id} value={org.hiringClient} />
          {org.focus && <p className="mt-3 max-w-prose text-sm text-muted-foreground">{org.focus}</p>}
        </div>

        <section aria-label="Prospect rating" className="w-full rounded-lg border border-border p-4 sm:w-80">
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl font-semibold ${qualityClass(rating.letter)}`}>
              {rating.letter}
            </span>
            <div>
              <p className="text-sm font-semibold">{BAND_LABEL[rating.band]}</p>
              <p className="text-xs text-muted-foreground">Prospect rating · {rating.score}/100</p>
            </div>
          </div>
          {rating.reasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {rating.reasons.slice(0, 4).map((r) => <li key={r}>+ {r}</li>)}
            </ul>
          )}
          {rating.cautions.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {rating.cautions.map((c) => <li key={c}>− {c}</li>)}
            </ul>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">How it is scored</summary>
            <ul className="mt-2 space-y-1.5 text-xs">
              {rating.components.map((c) => (
                <li key={c.key}>
                  <div className="flex justify-between"><span>{c.label}</span><span className="text-muted-foreground">{c.points}/{c.max}</span></div>
                  <div className="mt-0.5 h-1 rounded bg-muted"><div className="h-1 rounded bg-foreground/60" style={{ width: `${(c.points / c.max) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Computed from live signals, separate from the grade you set. Graded D or marked lost always reads cold.
            </p>
          </details>
        </section>
      </header>

      <nav aria-label="On this page" className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-1 border-b border-border bg-background/95 px-1 py-2 backdrop-blur">
        {nav.map((n) => (
          <a key={n.id} href={`#${n.id}`} className="rounded-full px-3 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            {n.label}{n.n !== null && <span className="ml-1.5 text-xs">{n.n}</span>}
          </a>
        ))}
      </nav>

      {/* ── Next up: what you can act on ───────────────────────────────── */}
      <section id="next" className="scroll-mt-16 space-y-6">
        <SectionTitle tone="action">Next up</SectionTitle>

        {(org.tasks.length > 0 || org.affiliations.some((a) => a.person.nextMeetingAt)) && (
          <div className="space-y-3">
            {org.affiliations.filter((a) => a.person.nextMeetingAt).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange/50 bg-orange/10 p-3 text-sm">
                <span>
                  <span className="font-medium">Meeting {meetingLabel(a.person.nextMeetingAt)}</span>
                  {' with '}<Link href={`/support/admin/crm/people/${a.person.id}`} className="underline">{a.person.fullName}</Link>
                </span>
                {a.person.nextMeetingUrl && <CrmMeetLink href={a.person.nextMeetingUrl} label="Join on Google Meet" kind="join" orgId={org.id} />}
              </div>
            ))}
            {org.tasks.length > 0 && (
              <ul className="divide-y divide-orange/20 rounded-lg border border-orange/30 bg-orange/5">
                {org.tasks.map((t) => {
                  const late = t.dueAt && t.dueAt < new Date(new Date().setHours(0, 0, 0, 0))
                  return (
                    <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{t.title}</p>
                        {t.person && <p className="mt-0.5 text-xs text-muted-foreground">{t.person.fullName}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${late ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                          {t.dueAt ? `${late ? 'Overdue · ' : 'Due '}${formatDate(t.dueAt)}` : 'No date'}
                        </span>
                        <form action={setTodoDone.bind(null, t.id, true)}>
                          <button type="submit" className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted">Done</button>
                        </form>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Grade (your call)</dt>
            <dd className="mt-1"><CrmOrgQualitySelect orgId={org.id} value={org.leadQuality} /></dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Deal status{org.dealStatusAt ? ` · since ${formatDate(org.dealStatusAt)}` : ''}</dt>
            <dd className="mt-1"><CrmDealStatusSelect orgId={org.id} value={org.dealStatus} /></dd>
          </div>
        </dl>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Opportunities ({org.opportunities.length})</h3>
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
                  <h4 className="text-sm font-medium">
                    {kind.label}
                    <span className="ml-2 font-normal text-muted-foreground">{opps.length === 0 ? 'None' : opps.length}</span>
                  </h4>
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
      </div>


      {org.deadlines.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Dates</h3>
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
        </div>
      )}

      </section>

      {warmDoors.length > 0 && (
        <section aria-label="Strong candidates with a warm way in" className="rounded-lg border border-border bg-muted/40 p-4">
          <h2 className="text-sm font-semibold">Strong candidates who applied here, and we know someone ({warmDoors.length})</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Good background and real work done in NextChapter. Reach out through the contact below to help them land it.
          </p>
          <ul className="mt-3 space-y-3">
            {warmDoors.map((w) => (
              <li key={w.candidate.id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <Link href={`/support/admin/candidates/${w.candidate.id}`} className="font-medium hover:underline">{w.candidate.name}</Link>
                  <span className="text-xs text-muted-foreground">
                    Applied{w.application.title ? ` — ${w.application.title}` : ''} · {formatDate(w.application.appliedAt)} · backchannel now
                    {w.isNew && ' · new'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Way in:{' '}
                  {w.doors.map((d, i) => (
                    <span key={`${d.kind}-${d.personId ?? d.name}-${i}`}>
                      {i > 0 && '; '}
                      {d.personId ? <Link href={`/support/admin/crm/people/${d.personId}`} className="underline">{d.name}</Link> : d.name}
                      {d.title && ` (${d.title})`} — {d.note.toLowerCase()}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Contacts ─────────────────────────────────────────────────────── */}
      <section id="contacts" className="scroll-mt-16 space-y-6">
        <SectionTitle tone="history">Contacts</SectionTitle>

        <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
          <Field label="Website" value={org.website ? <a href={org.website} target="_blank" rel="noreferrer" className="underline">{org.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} ↗</a> : null} />
          <Field label="Location" value={org.hqRegion ?? org.hqCity} />
          <Field label="Email domain" value={org.emailDomain ? `@${org.emailDomain}` : null} />
          <Field label="Last contacted" value={lastTouch ? formatDate(lastTouch) : 'Never'} />
          {chro && (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs text-muted-foreground">CHRO / head of people (from company record)</dt>
              <dd className="mt-0.5">
                {org.company?.chroName ?? 'Unnamed'}
                {org.company?.chroEmail && <> · <a href={`mailto:${org.company.chroEmail}`} className="underline">{org.company.chroEmail}</a></>}
                {org.company?.chroLinkedinUrl && <> · <a href={org.company.chroLinkedinUrl} target="_blank" rel="noreferrer" className="underline">LinkedIn ↗</a></>}
              </dd>
            </div>
          )}
        </dl>

        <div>
          <h3 className="mb-2 text-sm font-semibold">People in the CRM ({org.affiliations.length})</h3>
          {org.affiliations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody here is in your network yet — add a route in below.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {org.affiliations.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    <Link href={`/support/admin/crm/people/${a.person.id}`} className="font-medium hover:underline">{a.person.fullName}</Link>
                    {a.title && <span className="text-muted-foreground"> — {a.title}</span>}
                    {isDecisionMakerTitle(a.title) && <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs">Decision maker</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.person.lastTouchedAt ? `Last contacted ${formatDate(a.person.lastTouchedAt)}` : 'Never contacted'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {org.mandates.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Recruiters with a mandate ({org.mandates.length})</h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {org.mandates.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    <Link href={`/support/admin/crm/people/${m.recruiter.id}`} className="font-medium hover:underline">{m.recruiter.fullName}</Link>
                    {m.scope && <span className="text-muted-foreground"> — {m.scope}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{MANDATE_STATUS_LABELS[m.status]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details open={org.introPathsAsTarget.length > 0} className="rounded-lg border border-border p-3">
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
          <div>
            <h3 className="mb-2 text-sm font-semibold">Meetings ({meetings.length})</h3>
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
          </div>
        )}

        <CrmOrgBackgroundSections
          org={{ id: org.id, name: org.name, canonicalNameNormalized: org.canonicalNameNormalized, companyId: org.companyId }}
        />

        {/* Hiring history, employer pay level and layoffs — the linked directory
            company's public business facts only (company wall). */}
        {org.companyId && (
          <Suspense fallback={<CompanyHiringIndexSkeleton />}>
            <CompanyHiringIndex companyId={org.companyId} viewer="crm" />
          </Suspense>
        )}
      </section>

      {/* ── Candidates ───────────────────────────────────────────────────── */}
      <section id="candidates" className="scroll-mt-16 space-y-6">
        <SectionTitle tone="action">Candidates</SectionTitle>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Applied here ({demand.wantToWork.length})</h3>
          {demand.wantToWork.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidate has applied to a job at this organization.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {demand.wantToWork.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                  <Link href={`/support/admin/candidates/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                  <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {c.applied.map((a, i) => (
                      <span key={i}>
                        {a.outcome === 'offer' ? 'Offer' : a.outcome === 'interview' ? 'Interviewing' : a.outcome === 'declined' ? 'Declined' : 'Applied'}
                        {a.title ? ` — ${a.title}` : ''} · {formatDate(a.at)}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Worked here ({alumniList.length})</h3>
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
        </div>
      </section>

      {/* ── Open jobs ────────────────────────────────────────────────────── */}
      <section id="jobs" className="scroll-mt-16 space-y-3">
        <SectionTitle>Open jobs ({demand.openJobs.length})</SectionTitle>
        {demand.openJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No live postings on the job board for this organization.</p>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {demand.openJobs.slice(0, JOB_LIMIT).map((j) => (
                <li key={j.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <a href={j.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{j.title} ↗</a>
                    <span className="text-xs text-muted-foreground">Posted {formatDate(j.postedAt ?? j.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {j.location && <span>{j.location}</span>}
                    {j.postingType === 'recruiter_search' && <span>Recruiter-led search{j.sourceName ? ` · ${j.sourceName}` : ''}</span>}
                    {j.salaryMin && j.salaryMax && <span>{money(j.salaryMin)}–{money(j.salaryMax)}</span>}
                    {j.disclosure === 'CONFIDENTIAL' && <span>Confidential on the board</span>}
                    {j.badges.map((b) => <span key={b} className="rounded-full bg-muted px-1.5">{b}</span>)}
                  </p>
                </li>
              ))}
            </ul>
            {demand.openJobs.length > JOB_LIMIT && (
              <p className="text-xs text-muted-foreground">Showing the {JOB_LIMIT} newest of {demand.openJobs.length}.</p>
            )}
          </>
        )}
      </section>

      {/* ── Recruiter mandates ───────────────────────────────────────────── */}
      <section id="mandates" className="scroll-mt-16 space-y-3">
        <SectionTitle>Recruiter mandates ({demand.mandates.length})</SectionTitle>
        {demand.mandates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recruiter has an open search naming this organization as the client.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {demand.mandates.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                <span>
                  <span className="font-medium">{m.role}</span>
                  <span className="text-muted-foreground">{[m.location, m.kind].filter(Boolean).map((t) => ` · ${t}`)}</span>
                </span>
                <span className="text-xs text-muted-foreground">{m.by} · since {formatDate(m.since)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {coreSchools.length > 0 && (
        <section id="schools" className="scroll-mt-16 space-y-3">
          <SectionTitle>Colleges that list it as a core recruiter ({coreSchools.length})</SectionTitle>
          <ul className="flex flex-wrap gap-2 text-sm">
            {coreSchools.map((c) => <li key={c.institutionId} className="rounded-full bg-muted px-3 py-1">{c.name}</li>)}
          </ul>
        </section>
      )}

      <div className="space-y-2">
        <SectionTitle>At a glance</SectionTitle>
      <section aria-label="Company snapshot" className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <p className="text-2xl font-semibold">{demand.layoffYear.events === 0 ? '0' : demand.layoffYear.employees > 0 ? `${demand.layoffYear.employees.toLocaleString()}${demand.layoffYear.unstated > 0 ? '+' : ''}` : 'Not stated'}</p>
          <p className="text-xs text-muted-foreground">
            People laid off, past 12 months
            {demand.layoffYear.events > 0 && ` (${demand.layoffYear.events} ${demand.layoffYear.events === 1 ? 'layoff' : 'layoffs'})`}
          </p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{demand.openJobs.length}</p>
          <p className="text-xs text-muted-foreground">Open jobs · {demand.newPostings90d} new in 90 days</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{alumniList.length}</p>
          <p className="text-xs text-muted-foreground">Candidates who worked here</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{demand.wantToWork.length}</p>
          <p className="text-xs text-muted-foreground">Candidates who applied</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{demand.mandates.length}</p>
          <p className="text-xs text-muted-foreground">Open recruiter mandates</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{coreSchools.length}</p>
          <p className="text-xs text-muted-foreground">Colleges with it as a core recruiter</p>
        </div>
      </section>
      </div>

      {/* ── Layoffs ──────────────────────────────────────────────────────── */}
      <section id="layoffs" className="scroll-mt-16 space-y-3">
        <SectionTitle>Layoffs</SectionTitle>
        {demand.notices.length === 0 && demand.layoffNews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No layoff notices or layoff news found for this organization.</p>
        ) : (
          <>
            {demand.layoffYear.events > 0 && (
              <p className="text-sm">
                <span className="font-medium">Past 12 months: </span>
                {demand.layoffYear.employees > 0 ? `${demand.layoffYear.employees.toLocaleString()}${demand.layoffYear.unstated > 0 ? '+' : ''} people` : 'headcount not stated'}
                {` across ${demand.layoffYear.events} ${demand.layoffYear.events === 1 ? 'layoff' : 'layoffs'}`}
                <span className="text-muted-foreground">
                  {demand.layoffYear.filingEvents > 0 && ` · ${demand.layoffYear.fromFilings.toLocaleString()} from ${demand.layoffYear.filingEvents} filed or logged`}
                  {demand.layoffYear.newsOnlyEvents > 0 && ` · ${demand.layoffYear.fromNewsOnly.toLocaleString()} from ${demand.layoffYear.newsOnlyEvents} reported in the news only`}
                  {demand.layoffYear.unstated > 0 && ` · ${demand.layoffYear.unstated} gave no number, so the total is a minimum`}
                </span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {demand.layoffTimeline.status === 'recent_cut' && 'A recent cut, and no rehiring seen since.'}
              {demand.layoffTimeline.status === 'hiring_again' && 'Cut roles, and has posted new jobs since.'}
              {demand.layoffTimeline.status === 'quiet' && 'Cut roles, and quiet on hiring since.'}
              {demand.layoffTimeline.status === 'before_tracking' && 'Latest notice predates our job tracking, so hiring since is unknown.'}
              {demand.layoffTimeline.totalEmployees > 0 && ` ${demand.layoffTimeline.totalEmployees.toLocaleString()} roles across dated notices.`}
            </p>
            {demand.notices.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {demand.notices.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                    <span>
                      <span className="font-medium">{n.employees ? `${n.employees.toLocaleString()} roles` : 'Roles not stated'}</span>
                      <span className="text-muted-foreground">
                        {[n.layoffType, n.state, n.source === 'MANUAL_ANNOUNCEMENT' ? 'Announcement' : 'WARN filing'].filter(Boolean).map((t) => ` · ${t}`)}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {n.noticeDate ? formatDate(n.noticeDate) : `Fetched ${formatDate(n.fetchedAt)}`}
                      {n.sourceUrl && <> · <a href={n.sourceUrl} target="_blank" rel="noreferrer" className="underline">Source ↗</a></>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {demand.layoffNews.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {demand.layoffNews.map((n) => (
                  <li key={n.id} className="p-3 text-sm">
                    <a href={n.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{n.headline} ↗</a>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[n.publisher, n.publishedAt ? formatDate(n.publishedAt) : null, n.employees ? `${n.employees.toLocaleString()} roles` : null].filter(Boolean).join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* ── News & research ──────────────────────────────────────────────── */}
      <section id="research" className="scroll-mt-16 space-y-6">
        <SectionTitle>News & research</SectionTitle>

        <div>
          <h3 className="mb-2 text-sm font-semibold">In the research library ({demand.researchNews.length})</h3>
          {demand.researchNews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in the research library names this organization.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {demand.researchNews.map((r) => (
                <li key={r.id} className="p-3 text-sm">
                  <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{r.title ?? r.url} ↗</a>
                  <span className="ml-2 text-xs text-muted-foreground">{formatDate(r.dateFound)}</span>
                  {r.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.summary}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Saved research ({org.researchItems.length})</h3>
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
        </div>
      </section>

      {/* ── Data ─────────────────────────────────────────────────────────── */}
      <section id="data" className="scroll-mt-16 space-y-6">
        <SectionTitle>Data</SectionTitle>

        <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Industry" value={org.industry} />
          <Field
            label="Company intel"
            value={org.company ? <Link href={`/support/admin/companies/${org.company.id}`} className="underline">Open</Link> : null}
          />
        </dl>

        <Suspense fallback={<section className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground" aria-busy="true">Account context is loading: pulling the latest unemployment, layoffs, open jobs and local groups…</section>}>
          <CrmOrgContext orgId={org.id} />
        </Suspense>

        <CrmCollegeProfile orgId={org.id} />

        {org.investorProfile && (
          <section className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">Investor profile</h3>
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
            <h3 className="text-sm font-semibold">Outplacement lead</h3>
            <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-4">
              <Field label="Headcount affected" value={org.outplacementProfile.headcountAffected?.toLocaleString() ?? null} />
              <Field label="White collar" value={org.outplacementProfile.pctWhiteCollar} />
              <Field label="Announced" value={org.outplacementProfile.announcedAt ? formatDate(org.outplacementProfile.announcedAt) : null} />
              <Field label="Incumbent provider" value={org.outplacementProfile.incumbentProvider} />
            </dl>
          </section>
        )}

        <BenefitsPanel title="Benefits this company offers" note="Relocation packages and incentives this employer itself offers, from the Benefits catalog." groups={[{ label: org.name, rows: employerBenefits }]} />
        <CrmFundingMatches opportunities={funding} />

        {org.orgTypes.includes('OUTPLACEMENT_LEAD') && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">Convert</h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Creates an outplacement employer with contracts and seats. This record keeps its history.
            </p>
            <CrmGraduateOrganization orgId={org.id} outplacementOrgId={org.outplacementOrgId} />
          </div>
        )}

        <div>
          <h3 className="mb-1 text-sm font-semibold">Customer portals</h3>
          {org.organization ? (
            <p className="text-sm">
              This record is the customer{' '}
              <Link href={`/support/admin/organizations/${org.organization.id}`} className="font-medium text-primary underline underline-offset-4">
                {org.organization.name}
              </Link>
              . Its portals, brand and demo are managed there.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                When this deal is won, create the customer: choose its portals (one or many), brand it, and make it live or a demo with sample data.
              </p>
              <Link href={`/support/admin/organizations/new?crm=${org.id}`} className="inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Create organization and portals
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value ?? '—'}</dd>
    </div>
  )
}
