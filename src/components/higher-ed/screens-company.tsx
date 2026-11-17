// "Your company": a workforce org's member company in the org's portal.
// Counts only about its people; groups under five show as "<5".

import Link from 'next/link'
import { Building2 } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { companyOverview, memberCompanyFor } from '@/lib/workforce/company-portal'
import { small } from '@/lib/workforce/hub'
import { employerCan } from '@/lib/higher-ed/workspaces'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from './StatTile'
import { CollaborationForm, GrantOfferForm, HiringStatus, SeatRequestForm, TrainingRequestForm } from './CompanyForms'
import { nearbyColleges } from '@/lib/workforce/colleges-near'
import { commitmentLabel, ecoStatusLabel } from '@/lib/workforce/ecosystem'
import { prisma } from '@/lib/prisma'
import { readLocal } from '@/lib/workforce/local'
import { marketJobs } from '@/lib/workforce/market-jobs'
import { applicationsNaming, companyRequests } from '@/lib/workforce/company-requests'
import { GRANT_OFFER_LABELS, REQUEST_STATUS_LABELS, offerLabel, type GrantOffer } from '@/lib/workforce/contact-roles'

type Props = { ctx: WorkspaceContext }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '—')

function NotConnected({ ctx }: Props) {
  return <EmptyState icon={Building2} title="Not connected to a company" description={`Ask ${ctx.institution.name} to invite your company to its portal.`} />
}

export async function CompanyOverview({ ctx }: Props) {
  const c = await memberCompanyFor(ctx)
  if (!c) return <NotConnected ctx={ctx} />
  const slug = ctx.institution.slug
  // Each person sees their part of the company's view: outplacement its people after a layoff, hiring its hiring status,
  // L&D its training requests, grants the applications that name it.
  const outplacement = employerCan(ctx.tokens, 'outplacement')
  const hiring = employerCan(ctx.tokens, 'hiring')
  const learning = employerCan(ctx.tokens, 'learning')
  const grants = employerCan(ctx.tokens, 'grants')
  const workforce = employerCan(ctx.tokens, 'workforce')
  const colleges = employerCan(ctx.tokens, 'colleges')
  const [o, training, apps, wfOffers, collegeOffers] = await Promise.all([
    outplacement ? companyOverview(ctx.institution.id, c.id) : null,
    learning ? companyRequests(ctx.institution.id, c.id, 'TRAINING') : null,
    grants ? applicationsNaming(ctx.institution.id, c.name) : null,
    workforce ? companyRequests(ctx.institution.id, c.id, 'WORKFORCE_COLLAB') : null,
    colleges ? companyRequests(ctx.institution.id, c.id, 'COLLEGE_COLLAB') : null,
  ])
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{c.name}</h2>
        <p className="text-sm text-muted-foreground">A member of {ctx.institution.programBrandName ?? ctx.institution.name}{c.industry ? ` · ${c.industry}` : ''}</p>
      </div>
      {o && (
      <section aria-labelledby="your-people" className="space-y-2">
        <h3 id="your-people" className="text-base font-semibold">
          Your people after a layoff
        </h3>
        {o.signedUp === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one yet. When you have a layoff, <Link href={`/i/${slug}/employer/support`} className="font-medium text-primary hover:underline">ask for seats</Link> and share the sign-up page.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Signed up" value={small(o.signedUp)} />
            <StatTile label="Joined NextChapter" value={small(o.joined)} />
            <StatTile label="Applying or interviewing" value={small(o.searching)} />
            <StatTile label="Landed new roles" value={small(o.landed)} note="Of people who share their outcome" />
            <StatTile label={`Stayed in ${o.regionLabel}`} value={o.kept === null ? 'Too early' : `${Math.round(o.kept * 100)}%`} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">Counts only. You never see who joined, how anyone&apos;s search is going, or where any one person landed.</p>
      </section>
      )}
      {hiring && (
      <section className="rounded-lg border border-border bg-card p-4">
        <HiringStatus slug={slug} hiring={c.hiring} readOnly={ctx.readOnly} />
      </section>
      )}
      {(training || apps || wfOffers || collegeOffers) && (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {training && (
            <li className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span>
                <span className="font-medium">Training</span>
                <span className="block text-muted-foreground">
                  {training.length === 0 ? 'No requests yet.' : `${training.filter((r) => r.status === 'REQUESTED').length} waiting for an answer, ${training.filter((r) => r.status === 'ACCEPTED').length} accepted.`}
                </span>
              </span>
              <Link href={`/i/${slug}/employer/training`} className="text-sm font-medium text-primary hover:underline">
                {training.length === 0 ? 'Ask for training' : 'Open training'}
              </Link>
            </li>
          )}
          {apps && (
            <li className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span>
                <span className="font-medium">Grants and RFPs</span>
                <span className="block text-muted-foreground">
                  {apps.length === 0 ? 'No applications name your company yet.' : `${apps.length} ${apps.length === 1 ? 'application names' : 'applications name'} your company as a partner.`}
                </span>
              </span>
              <Link href={`/i/${slug}/employer/grants`} className="text-sm font-medium text-primary hover:underline">
                Open grants
              </Link>
            </li>
          )}
          {(
            [
              [wfOffers, 'Workforce partnerships', 'workforce'],
              [collegeOffers, 'College partnerships', 'colleges'],
            ] as const
          ).map(([rows, label, tab]) =>
            rows ? (
              <li key={tab} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="block text-muted-foreground">
                    {rows.length === 0 ? 'No offers yet.' : `${rows.filter((r) => r.status === 'REQUESTED').length} waiting for an answer, ${rows.filter((r) => r.status === 'ACCEPTED').length} accepted.`}
                  </span>
                </span>
                <Link href={`/i/${slug}/employer/${tab}`} className="text-sm font-medium text-primary hover:underline">
                  {rows.length === 0 ? 'Make an offer' : 'Open'}
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </div>
  )
}

const STATUS: Record<string, string> = { REQUESTED: 'Waiting for an answer', APPROVED: 'Approved', DECLINED: 'Declined' }

export async function CompanySupport({ ctx }: Props) {
  const c = await memberCompanyFor(ctx)
  if (!c) return <NotConnected ctx={ctx} />
  const o = await companyOverview(ctx.institution.id, c.id)
  const slug = ctx.institution.slug
  return (
    <div className="space-y-6">
      {!ctx.readOnly && (
        <section aria-labelledby="ask" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="ask" className="text-base font-semibold">
            Ask for seats for a layoff
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {ctx.institution.name} gives the people you lay off free NextChapter: their job market, a weekly plan, coaching and local employers first. Once it approves,
            you get a sign-up page to share in your exit packet.
          </p>
          <SeatRequestForm slug={slug} />
        </section>
      )}
      {o.layoffs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No layoffs or requests yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {o.layoffs.map((l) => (
            <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="space-y-0.5">
                <p className="font-medium">{(l.seats ?? 0).toLocaleString()} seats · {l.requestStatus ? STATUS[l.requestStatus] ?? l.requestStatus : 'Given by the organization'}</p>
                <p className="text-muted-foreground">
                  {l.requestedAt ? `Asked ${day(l.requestedAt)}` : `Opened ${day(l.createdAt)}`}
                  {l.isActive || l.requestStatus === 'APPROVED' || !l.requestStatus ? ` · ${l._count.participants.toLocaleString()} signed up` : ''}
                </p>
                {l.requestNote && <p className="text-xs text-muted-foreground">“{l.requestNote}”</p>}
              </div>
              {(!l.requestStatus || l.requestStatus === 'APPROVED') && (
                <Link href={`/i/${slug}/rapid/${l.id}`} target="_blank" className="text-xs font-medium text-primary hover:underline">
                  Sign-up page to share{l.isActive ? '' : ' (closed)'}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const dollars = (n: number | null) => (n ? `$${n.toLocaleString()}` : null)

function Answer({ r }: { r: { status: string; answerNote: string | null; answeredAt: Date | null; createdAt: Date } }) {
  return (
    <p className="text-muted-foreground">
      Sent {day(r.createdAt)} · <span className={r.status === 'ACCEPTED' ? 'text-emerald-800' : undefined}>{REQUEST_STATUS_LABELS[r.status] ?? r.status}</span>
      {r.answeredAt ? ` ${day(r.answeredAt)}` : ''}
      {r.answerNote ? ` · “${r.answerNote}”` : ''}
    </p>
  )
}

// Learning and development: ask the organization for training, against what local postings ask for.
export async function CompanyTraining({ ctx }: Props) {
  const c = await memberCompanyFor(ctx)
  if (!c) return <NotConnected ctx={ctx} />
  const [requests, inst, programs] = await Promise.all([
    companyRequests(ctx.institution.id, c.id, 'TRAINING'),
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } }),
    prisma.program.findMany({ where: { institutionId: ctx.institution.id, isActive: true }, orderBy: { name: 'asc' }, take: 12, select: { id: true, name: true } }),
  ])
  const local = readLocal(inst.enabledFeatures)
  const market = local ? await marketJobs(local.anchorCity, local.anchorState).catch(() => null) : null
  const skills = market?.skills.slice(0, 8) ?? []
  return (
    <div className="space-y-6">
      {!ctx.readOnly && (
        <section aria-labelledby="ask-training" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="ask-training" className="text-base font-semibold">
            Ask for training for your people
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {ctx.institution.name} works with local colleges and training providers. Tell it what your people need to learn; it answers here.
            {programs.length > 0 && ` Programs it runs now: ${programs.map((p) => p.name).join(', ')}.`}
          </p>
          <TrainingRequestForm slug={ctx.institution.slug} suggestions={skills.map((k) => k.skill)} />
        </section>
      )}
      <section aria-labelledby="your-training" className="space-y-2">
        <h2 id="your-training" className="text-base font-semibold">
          Your requests
        </h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {requests.map((r) => (
              <li key={r.id} className="space-y-0.5 p-3">
                <p className="font-medium">
                  {r.topic}
                  {r.people ? ` · ${r.people.toLocaleString()} people` : ''}
                </p>
                <Answer r={r} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {skills.length > 0 && (
        <section aria-labelledby="local-skills" className="space-y-2">
          <h2 id="local-skills" className="text-base font-semibold">
            What local jobs ask for
          </h2>
          <p className="text-sm text-muted-foreground">Share of current postings in {local?.label ?? 'the region'} that name each skill, so you can train ahead of what the market wants.</p>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {skills.map((k) => (
              <li key={k.skill} className="flex justify-between gap-3 rounded-md border border-border px-3 py-2">
                <span>{k.skill}</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(k.share * 100)}% · {k.postings.toLocaleString()} postings
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// Grants and RFPs: the organization's applications that name this company, and the support it offers.
export async function CompanyGrants({ ctx }: Props) {
  const c = await memberCompanyFor(ctx)
  if (!c) return <NotConnected ctx={ctx} />
  const [apps, offers] = await Promise.all([applicationsNaming(ctx.institution.id, c.name), companyRequests(ctx.institution.id, c.id, 'GRANT_PARTNER')])
  const offered = new Set(offers.map((o) => o.fundingApplicationId).filter(Boolean))
  return (
    <div className="space-y-6">
      <section aria-labelledby="apps-naming" className="space-y-2">
        <h2 id="apps-naming" className="text-base font-semibold">
          Applications that name {c.name}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">Grants {ctx.institution.name} is pursuing with your company as a partner. Funders ask for partner commitments; offer what you can.</p>
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. When {ctx.institution.name} lists you as a partner on an application, it shows here.</p>
        ) : (
          <ul className="space-y-3">
            {apps.map((a) => (
              <li key={a.id} className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{[a.funder, a.dueDate ? `due ${day(a.dueDate)}` : null].filter(Boolean).join(' · ')}</p>
                </div>
                <p className="text-muted-foreground">
                  {[a.amountRequested ? `${dollars(a.amountRequested)} requested` : null, a.matchRequired ? `match ${dollars(a.matchCommitted) ?? '$0'} of ${dollars(a.matchRequired)} committed` : null].filter(Boolean).join(' · ') || 'Amounts not set yet'}
                </p>
                {!ctx.readOnly &&
                  (offered.has(a.id) ? (
                    <p className="text-xs text-muted-foreground">You offered support. See Your offers below.</p>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-primary">Offer support</summary>
                      <div className="pt-3">
                        <GrantOfferForm slug={ctx.institution.slug} applicationId={a.id} applicationName={a.name} />
                      </div>
                    </details>
                  ))}
              </li>
            ))}
          </ul>
        )}
        {!ctx.readOnly && (
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-primary">Offer support for another grant or RFP</summary>
            <div className="pt-3">
              <GrantOfferForm slug={ctx.institution.slug} />
            </div>
          </details>
        )}
      </section>
      <section aria-labelledby="your-offers" className="space-y-2">
        <h2 id="your-offers" className="text-base font-semibold">
          Your offers
        </h2>
        {offers.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {offers.map((o) => (
              <li key={o.id} className="space-y-0.5 p-3">
                <p className="font-medium">{o.topic}</p>
                <p>
                  {o.offers.map((x) => GRANT_OFFER_LABELS[x as GrantOffer] ?? x).join(', ')}
                  {o.matchAmount ? ` · ${dollars(o.matchAmount)} match` : ''}
                </p>
                <Answer r={o} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function OfferList({ rows, empty }: { rows: Awaited<ReturnType<typeof companyRequests>>; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y divide-border rounded-lg border border-border text-sm">
      {rows.map((r) => (
        <li key={r.id} className="space-y-0.5 p-3">
          <p className="font-medium">
            {r.offers.map(offerLabel).join(', ')}
            {r.people ? ` · ${r.people.toLocaleString()} spots` : ''}
          </p>
          <p>{r.topic}</p>
          <Answer r={r} />
        </li>
      ))}
    </ul>
  )
}

type WorkforceProfile = { workforce?: { board?: { name?: string; website?: string | null }; careerLinks?: { name: string; address?: string | null; phone?: string | null }[] } }

// Workforce development: what the company offers the public workforce system, and who that system is here.
export async function CompanyWorkforce({ ctx }: Props) {
  const c = await memberCompanyFor(ctx)
  if (!c) return <NotConnected ctx={ctx} />
  const [offers, inst, eco] = await Promise.all([
    companyRequests(ctx.institution.id, c.id, 'WORKFORCE_COLLAB'),
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { profile: true } }),
    prisma.ecosystemPartner.findFirst({ where: { institutionId: ctx.institution.id, source: 'MEMBER_COMPANY', refId: c.id }, select: { status: true, commitments: true } }),
  ])
  const wf = (inst.profile as WorkforceProfile | null)?.workforce
  const centers = wf?.careerLinks?.slice(0, 6) ?? []
  return (
    <div className="space-y-6">
      {!ctx.readOnly && (
        <section aria-labelledby="offer-workforce" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="offer-workforce" className="text-base font-semibold">
            Work with the workforce system
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Apprenticeships, on-the-job training and work experience bring you trained local people, often with part of the cost covered. Tell {ctx.institution.name} what you would do; it
            connects you with the board and job centers and answers here.
          </p>
          <CollaborationForm slug={ctx.institution.slug} kind="WORKFORCE_COLLAB" />
        </section>
      )}
      <section aria-labelledby="your-workforce" className="space-y-2">
        <h2 id="your-workforce" className="text-base font-semibold">
          Your offers
        </h2>
        {eco && (
          <p className="text-sm text-muted-foreground">
            In {ctx.institution.name}&apos;s talent network: {ecoStatusLabel(eco.status).toLowerCase()}
            {eco.commitments.length ? ` · ${eco.commitments.map(commitmentLabel).join(', ').toLowerCase()}` : ''}.
          </p>
        )}
        <OfferList rows={offers} empty="None yet." />
      </section>
      {(wf?.board?.name || centers.length > 0) && (
        <section aria-labelledby="system-here" className="space-y-2">
          <h2 id="system-here" className="text-base font-semibold">
            The workforce system here
          </h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {wf?.board?.name && (
              <li className="rounded-md border border-border px-3 py-2">
                <span className="font-medium">{wf.board.name}</span>
                <span className="block text-muted-foreground">Workforce board{wf.board.website ? ` · ${wf.board.website.replace(/^https?:\/\//, '')}` : ''}</span>
              </li>
            )}
            {centers.map((j) => (
              <li key={j.name} className="rounded-md border border-border px-3 py-2">
                <span className="font-medium">{j.name}</span>
                <span className="block text-muted-foreground">{[j.address, j.phone].filter(Boolean).join(' · ') || 'Job center'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// College partnerships: what the company offers colleges near the region (internships, projects, advisory seats).
export async function CompanyColleges({ ctx }: Props) {
  const c = await memberCompanyFor(ctx)
  if (!c) return <NotConnected ctx={ctx} />
  const [offers, colleges] = await Promise.all([companyRequests(ctx.institution.id, c.id, 'COLLEGE_COLLAB'), nearbyColleges(ctx.institution.id).catch(() => [])])
  return (
    <div className="space-y-6">
      {!ctx.readOnly && (
        <section aria-labelledby="offer-colleges" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="offer-colleges" className="text-base font-semibold">
            Work with colleges near you
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Internships, student projects and advisory seats shape what local graduates can do on day one. Tell {ctx.institution.name} what you would offer; it brings in the
            college and answers here.
          </p>
          <CollaborationForm slug={ctx.institution.slug} kind="COLLEGE_COLLAB" places={colleges.map((x) => x.name)} />
        </section>
      )}
      <section aria-labelledby="your-colleges" className="space-y-2">
        <h2 id="your-colleges" className="text-base font-semibold">
          Your offers
        </h2>
        <OfferList rows={offers} empty="None yet." />
      </section>
      {colleges.length > 0 && (
        <section aria-labelledby="colleges-here" className="space-y-2">
          <h2 id="colleges-here" className="text-base font-semibold">
            Colleges near you
          </h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {colleges.map((x) => (
              <li key={x.unitid} className="rounded-md border border-border px-3 py-2">
                <span className="font-medium">{x.name}</span>
                <span className="block text-muted-foreground">
                  {[x.city, x.enrollment ? `${x.enrollment.toLocaleString()} students` : null].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
