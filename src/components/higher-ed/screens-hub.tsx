// Program workspace screens for workforce customers (boards, economic
// development orgs, chambers): dashboard, member companies, layoffs,
// participants and kept-in-region. Counts under five show as "<5".

import Link from 'next/link'
import { Building2, MapPin, Users } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { regionNotices } from '@/lib/higher-ed/rapid-response'
import { hubDashboard, hubLayoffs, keptInRegion, memberCompanies, participants, seatRequests, small, type LocalSplit } from '@/lib/workforce/hub'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from './StatTile'
import { HiringToggle, LayoffOpenToggle, LayoffSeatsForm, LocalAreaForm, MemberAccess, MemberCompanyForm, ParticipantForm, SeatRequestAnswer } from './HubForms'
import { BriefCard } from './BriefCard'

type Props = { ctx: WorkspaceContext; searchParams: { q?: string; company?: string }; base: string }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '—')
const pct = (x: number | null) => (x === null ? 'Too early' : `${Math.round(x * 100)}%`)
const STAGE: Record<string, string> = { EXPLORING: 'Exploring', PREPARING: 'Preparing', APPLYING: 'Applying', INTERVIEWING: 'Interviewing', OFFER: 'Has an offer', LANDED: 'Landed', PAUSED: 'Paused' }

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>
}

export async function HubHome({ ctx }: Props) {
  const d = await hubDashboard(ctx.institution.id)
  const slug = ctx.institution.slug
  const activation = d.participants ? Math.round((d.joined / d.participants) * 100) : null
  return (
    <div className="space-y-6">
      <BriefCard institutionId={ctx.institution.id} agent="workforce_dev" />
      {!d.local && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          Set your region in <Link href={`/i/${slug}/hub/local`} className="font-medium text-primary hover:underline">Kept in region</Link> so local jobs rank first for your participants and we can count who stays.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Participants" value={d.participants.toLocaleString()} href={`/i/${slug}/hub/participants`} />
        <StatTile label="Joined NextChapter" value={small(d.joined)} note={activation === null ? undefined : `${activation}% activation`} />
        <StatTile label="Active this week" value={small(d.activeThisWeek)} />
        <StatTile label="Applying or interviewing" value={small(d.searching)} note={`${small(d.interviewing)} interviewing`} />
        <StatTile label="Landed new roles" value={small(d.landed)} note="Of people who share their outcome" />
        <StatTile label={`Kept in ${d.local?.label ?? 'region'}`} value={pct(d.kept)} note="Local or remote, of hires with a known place" href={`/i/${slug}/hub/local`} />
        <StatTile label="Seats used" value={`${d.seats.used.toLocaleString()} of ${d.seats.pool.toLocaleString()}`} />
        <StatTile label="Member companies" value={d.companies} note={`${d.layoffs} layoff${d.layoffs === 1 ? '' : 's'} with seats`} href={`/i/${slug}/hub/companies`} />
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Counts only. Where someone is in their search shows only for people who chose to share it, and any group under five shows as &lt;5.
      </p>
    </div>
  )
}

export async function HubCompanies({ ctx }: Props) {
  const rows = await memberCompanies(ctx.institution.id)
  const slug = ctx.institution.slug
  return (
    <div className="space-y-6">
      {!ctx.readOnly && (
        <details className="rounded-lg border border-border bg-card p-4" open={rows.length === 0}>
          <summary className="cursor-pointer text-sm font-medium text-primary">Add a member company</summary>
          <div className="pt-3">
            <MemberCompanyForm slug={slug} />
          </div>
        </details>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={Building2} title="No member companies yet" description="Add the companies you serve. When one has a layoff, you give its people seats from your pool." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Company</Th>
                <Th>Where</Th>
                <Th>Participants</Th>
                <Th>Joined</Th>
                <Th>Layoffs</Th>
                <Th>Hiring</Th>
                <Th>Portal access</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="min-w-40 px-3 py-2">
                    <span className="font-medium">{c.name}</span>
                    {c.industry && <span className="block text-xs text-muted-foreground">{c.industry}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{small(c.participants)}</td>
                  <td className="px-3 py-2 tabular-nums">{small(c.joined)}</td>
                  <td className="px-3 py-2">
                    {c.layoffs.length ? `${c.layoffs.length} · ${c.seatsGiven.toLocaleString()} seats` : '—'}
                    {!ctx.readOnly && (
                      <Link href={`/i/${slug}/hub/layoffs?company=${c.id}`} className="ml-2 text-xs font-medium text-primary hover:underline">
                        Open seats
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2">{ctx.readOnly ? (c.hiring ? 'Hiring' : '—') : <HiringToggle slug={slug} companyId={c.id} hiring={c.hiring} />}</td>
                  <td className="px-3 py-2">
                    {c.employerProfileId ? (
                      <span className="text-xs text-emerald-800">Connected</span>
                    ) : ctx.readOnly ? (
                      <span className="text-xs text-muted-foreground">{c.invitedAt ? 'Invited' : '—'}</span>
                    ) : (
                      <MemberAccess slug={slug} companyId={c.id} contactEmail={c.contactEmail} invitedAt={c.invitedAt?.toISOString() ?? null} connected={false} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export async function HubLayoffs({ ctx, searchParams }: Props) {
  const slug = ctx.institution.slug
  const [rows, companies, notices, inst, given, requests] = await Promise.all([
    hubLayoffs(ctx.institution.id),
    prisma.memberCompany.findMany({ where: { institutionId: ctx.institution.id }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    regionNotices(ctx.institution.id).catch(() => []),
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { includedSeats: true } }),
    prisma.rapidResponse.aggregate({ where: { institutionId: ctx.institution.id, isActive: true, memberCompanyId: { not: null } }, _sum: { seats: true } }),
    seatRequests(ctx.institution.id),
  ])
  const seatsLeft = inst.includedSeats - (given._sum.seats ?? 0)
  return (
    <div className="space-y-6">
      {requests.length > 0 && (
        <section aria-labelledby="requests" className="space-y-2">
          <h2 id="requests" className="text-base font-semibold">
            Seat requests from member companies
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">
                    {r.memberCompany?.name ?? 'A member company'} · {(r.seats ?? 0).toLocaleString()} people · asked {day(r.requestedAt)}
                  </p>
                  {r.requestNote && <p className="text-xs text-muted-foreground">“{r.requestNote}”</p>}
                </div>
                {ctx.readOnly ? <span className="text-xs text-muted-foreground">Waiting</span> : <SeatRequestAnswer slug={slug} id={r.id} requested={r.seats ?? 1} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!ctx.readOnly && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby="open-seats">
          <h2 id="open-seats" className="text-base font-semibold">
            Give seats for a layoff
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">You get a sign-up page to share with the company&apos;s HR team. Each person who signs up uses one seat and gets NextChapter free.</p>
          <LayoffSeatsForm
            slug={slug}
            companies={companies}
            seatsLeft={seatsLeft}
            defaultCompanyId={searchParams.company}
            notices={notices.map((n) => ({ id: n.id, label: `${n.employer} · ${n.county ?? n.state} · ${n.employees ?? '?'} workers · ${day(n.noticeDate)}` }))}
          />
        </section>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No layoffs with seats yet" description="When a member company has a layoff, give its people seats here." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
              <div className="space-y-0.5">
                <p className="font-medium">{r.memberCompany?.name ?? r.employerName}</p>
                <p className="text-muted-foreground">
                  {r._count.participants.toLocaleString()} of {(r.seats ?? 0).toLocaleString()} seats claimed · opened {day(r.createdAt)}
                  {r.warnNotice ? ` · WARN: ${r.warnNotice.employees ?? '?'} workers` : ''}
                </p>
                <Link href={`/i/${slug}/rapid/${r.id}`} target="_blank" className="text-xs font-medium text-primary hover:underline">
                  Sign-up page{r.isActive ? '' : ' (closed)'}
                </Link>
              </div>
              {!ctx.readOnly && <LayoffOpenToggle slug={slug} id={r.id} isActive={r.isActive} />}
            </li>
          ))}
        </ul>
      )}
      {notices.length > 0 && (
        <section className="space-y-2" aria-labelledby="warn">
          <h2 id="warn" className="text-base font-semibold">
            WARN notices in your region
          </h2>
          <p className="text-sm text-muted-foreground">Public layoff filings from the last four months. Add the employer as a member company to give its people seats.</p>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {notices.slice(0, 12).map((n) => (
              <li key={n.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span className="font-medium">{n.employer}</span>
                <span className="text-muted-foreground">
                  {[n.county, n.state].filter(Boolean).join(', ')} · {n.employees ?? '?'} workers · {day(n.noticeDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export async function HubParticipants({ ctx, searchParams }: Props) {
  const slug = ctx.institution.slug
  const [rows, companies] = await Promise.all([
    participants(ctx.institution.id, { q: searchParams.q?.trim() || undefined, companyId: searchParams.company }),
    prisma.memberCompany.findMany({ where: { institutionId: ctx.institution.id }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  return (
    <div className="space-y-6">
      {!ctx.readOnly && (
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">Add someone</summary>
          <div className="pt-3">
            <ParticipantForm slug={slug} companies={companies} />
            <p className="mt-3 text-xs text-muted-foreground">
              Adding many? Upload a spreadsheet in <Link href={`/i/${slug}/admin/roster`} className="font-medium text-primary hover:underline">Admin › Roster</Link> with affiliation PARTICIPANT, or connect your system there.
            </p>
          </div>
        </details>
      )}
      <form className="flex max-w-md gap-2" action={`/i/${slug}/hub/participants`}>
        <label htmlFor="pq" className="sr-only">
          Search participants
        </label>
        <input id="pq" name="q" defaultValue={searchParams.q ?? ''} placeholder="Search by name or email" className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm" />
        <button className="rounded-md border border-border px-3 text-sm">Search</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No participants yet" description="People join when you give a company seats and they sign up, or when you add them here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Name</Th>
                <Th>Laid off from</Th>
                <Th>Joined</Th>
                <Th>Where they are</Th>
                <Th>Added</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="min-w-40 px-3 py-2">
                    {[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                    <span className="block text-xs text-muted-foreground">{p.email}</span>
                  </td>
                  <td className="px-3 py-2">{p.memberCompany?.name ?? '—'}</td>
                  <td className="px-3 py-2">{p.joined ? 'Joined' : 'Not yet'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.stage ? STAGE[p.stage] : p.joined ? 'Not shared' : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{day(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SplitTiles({ s }: { s: LocalSplit }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="In the region" value={small(s.local)} />
      <StatTile label="Remote (still living here)" value={small(s.remote)} />
      <StatTile label="Moved or took a job elsewhere" value={small(s.elsewhere)} />
      <StatTile label="Place not given" value={small(s.unknown)} />
    </div>
  )
}

export async function HubLocal({ ctx }: Props) {
  const k = await keptInRegion(ctx.institution.id)
  const known = k.split.local + k.split.remote + k.split.elsewhere
  const kept = known >= 5 ? Math.round(((k.split.local + k.split.remote) / known) * 100) : null
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby="region-def">
        <h2 id="region-def" className="text-base font-semibold">
          Your region
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A city and the miles around it, across state lines. Jobs inside it rank first for your participants, and a hire inside it, or a remote job, counts as kept.
        </p>
        {ctx.readOnly ? (
          <p className="text-sm">{k.settings ? `${k.settings.radiusMiles} miles around ${k.settings.anchorCity}, ${k.settings.anchorState}` : 'Not set yet.'}</p>
        ) : (
          <LocalAreaForm slug={ctx.institution.slug} value={k.settings} />
        )}
      </section>
      {k.split.total === 0 ? (
        <EmptyState icon={MapPin} title="No hires reported yet" description="When participants report a new job, they say where it is. That's what this page counts." />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Kept in {k.settings?.label ?? 'the region'}</p>
            <p className="text-3xl font-semibold tabular-nums">{kept === null ? 'Too early' : `${kept}%`}</p>
            <p className="text-sm text-muted-foreground">
              {small(k.split.local + k.split.remote)} of {small(known)} hires with a known place
            </p>
          </div>
          <SplitTiles s={k.split} />
          <section className="space-y-2" aria-labelledby="by-company">
            <h2 id="by-company" className="text-base font-semibold">
              By company
            </h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <Th>Laid off from</Th>
                    <Th>Hires</Th>
                    <Th>In the region</Th>
                    <Th>Remote</Th>
                    <Th>Elsewhere</Th>
                  </tr>
                </thead>
                <tbody>
                  {k.companies.map((c) => (
                    <tr key={c.name} className="border-t border-border">
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2 tabular-nums">{small(c.split.total)}</td>
                      <td className="px-3 py-2 tabular-nums">{c.split.total < 5 ? '—' : small(c.split.local)}</td>
                      <td className="px-3 py-2 tabular-nums">{c.split.total < 5 ? '—' : small(c.split.remote)}</td>
                      <td className="px-3 py-2 tabular-nums">{c.split.total < 5 ? '—' : small(c.split.elsewhere)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {k.cities.length > 0 && (
            <section className="space-y-2" aria-labelledby="cities">
              <h2 id="cities" className="text-base font-semibold">
                Where people landed
              </h2>
              <ul className="flex flex-wrap gap-2 text-sm">
                {k.cities.map(([c, n]) => (
                  <li key={c} className="rounded-full border border-border px-3 py-1">
                    {c} · {n}
                  </li>
                ))}
              </ul>
              {k.hiddenCities > 0 && <p className="text-xs text-muted-foreground">Cities with fewer than five hires aren&apos;t listed.</p>}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// Admin › Overview for a workforce customer: its launch steps and license.
export async function WorkforceOverview({ ctx }: Props) {
  const id = ctx.institution.id
  const base = `/i/${ctx.institution.slug}`
  const [inst, companies, layoffs, staff, people, keys] = await Promise.all([
    prisma.institution.findUniqueOrThrow({ where: { id }, select: { name: true, programBrandName: true, slug: true, orgType: true, includedSeats: true, licenseStartAt: true, licenseEndAt: true, enabledFeatures: true } }),
    prisma.memberCompany.count({ where: { institutionId: id } }),
    prisma.rapidResponse.count({ where: { institutionId: id, memberCompanyId: { not: null } } }),
    prisma.institutionUser.count({ where: { institutionId: id, revokedAt: null } }),
    prisma.institutionMember.count({ where: { institutionId: id, affiliation: 'PARTICIPANT' } }),
    prisma.orgApiKey.count({ where: { orgKind: 'institution', orgId: id, revokedAt: null } }),
  ])
  const ef = (inst.enabledFeatures ?? {}) as { local?: unknown; services?: unknown }
  const steps = [
    { done: !!ef.local, label: 'Set your region', detail: 'A city and the miles around it. Local jobs rank first, and hires there count as kept.', href: `${base}/hub/local` },
    { done: companies > 0, label: 'Add member companies', detail: companies ? `${companies} on your list.` : 'The companies you serve.', href: `${base}/hub/companies` },
    { done: layoffs > 0, label: 'Give seats for a layoff', detail: 'A sign-up page for a member company’s people.', href: `${base}/hub/layoffs` },
    { done: !!ef.services, label: 'Choose your services', detail: 'Switch on what you offer; each becomes a card for job seekers.', href: `${base}/admin/services` },
    { done: staff > 0, label: 'Invite your team', detail: 'Program staff, business services, your career center.', href: `${base}/admin/users` },
    { done: people > 0 || keys > 0, label: 'Load or connect your participants', detail: people ? `${people.toLocaleString()} participants.` : 'Upload a spreadsheet or connect your system.', href: `${base}/admin/roster` },
  ]
  const done = steps.filter((s) => s.done).length
  const facts: [string, string][] = [
    ['Name', inst.name],
    ['Program name', inst.programBrandName ?? '—'],
    ['Kind of organization', ({ WORKFORCE_BOARD: 'Workforce board', ECONOMIC_DEVELOPMENT: 'Economic development', CHAMBER: 'Chamber of commerce', COMMUNITY_ORG: 'Community organization', COLLEGE: 'College' } as const)[inst.orgType]],
    ['Portal address', `/i/${inst.slug}`],
    ['Seat pool', inst.includedSeats.toLocaleString()],
    ['License', [inst.licenseStartAt, inst.licenseEndAt].filter(Boolean).map((d) => day(d as Date)).join(' – ') || '—'],
  ]
  return (
    <div className="space-y-6">
      <section aria-labelledby="wf-launch" className="space-y-3">
        <h2 id="wf-launch" className="text-base font-semibold">
          Launch checklist · {done} of {steps.length}
        </h2>
        <ol className="divide-y divide-border rounded-lg border border-border bg-card">
          {steps.map((st) => (
            <li key={st.label} className="flex items-start gap-3 px-4 py-3">
              <span aria-label={st.done ? 'Done' : 'To do'} className={st.done ? 'text-emerald-700' : 'text-muted-foreground'}>
                {st.done ? '✓' : '○'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{st.label}</p>
                <p className="text-xs text-muted-foreground">{st.detail}</p>
              </div>
              {!st.done && (
                <Link href={st.href} className="text-sm font-medium text-primary hover:underline">
                  Do this
                </Link>
              )}
            </li>
          ))}
        </ol>
      </section>
      <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
