// Program workspace screens for workforce customers (boards, economic
// development orgs, chambers): dashboard, member companies, layoffs,
// participants and kept-in-region. Counts under five show as "<5".

import Link from 'next/link'
import { Building2, MapPin, Users } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { regionNotices } from '@/lib/higher-ed/rapid-response'
import { hubDashboard, hubLayoffs, keptInRegion, memberCompanies, seatRequests, small, type LocalSplit } from '@/lib/workforce/hub'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from './StatTile'
import { HiringToggle, LayoffOpenToggle, LayoffSeatsForm, LocalAreaForm, MemberAccess, MemberCompanyForm, SeatRequestAnswer } from './HubForms'
import { BriefCard } from './BriefCard'
import { nextReserveDeadline } from './screens-hub-program'
import { ResponseFlow, loadFlowData } from './screens-hub-flow'
import { PortalHomeMore, PortalNeeds, PortalNumbers, PortalTable, type NeedsItem } from '@/components/partners/PortalHome'
import { PortalHomeLink } from '@/components/partners/PortalHomeLink'

type Props = { ctx: WorkspaceContext; searchParams: { q?: string; company?: string }; base: string }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '—')
const pct = (x: number | null) => (x === null ? 'Too early' : `${Math.round(x * 100)}%`)
function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>
}

const periodDay = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '')
const periodLabel = (p: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(p)
  return m ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]} ${m[1]}` : p
}

type Notice = Awaited<ReturnType<typeof regionNotices>>[number]
type Verb = { verb: string; line: string; tab: string; demoOnly?: boolean; from?: 'execed' | 'workforce' }
const VERBS: Verb[] = [
  { verb: 'Attract', line: 'Bring people here for the job, with benefits and proof of a move.', tab: 'attract', demoOnly: true },
  { verb: 'Retrain', line: 'Colleges and partners that move people into growing roles.', tab: 'learning', demoOnly: true },
  { verb: 'Support', line: 'A plan for every layoff, from the first day.', tab: 'layoffs' },
  { verb: 'Train', line: 'Programs, cohorts and who is enrolled.', tab: 'programs', from: 'execed' },
  { verb: 'Fund', line: 'Grants and funding, with the partners to bring in.', tab: 'funding', demoOnly: true },
  { verb: 'Understand', line: 'Jobs, skills, pay and unemployment in your region.', tab: 'region' },
  { verb: 'Coordinate', line: 'Employers, colleges and the public system in one picture.', tab: 'companies' },
]

// The splash picture: the organization's own, or a generic placeholder until it uploads one.
function HomeHero({ name, region, tagline, imageUrl, stats }: { name: string; region: string; tagline: string | null; imageUrl: string | null; stats: { label: string; value: string; note?: string }[] }) {
  return (
    <section aria-label={`${name} overview`} className="overflow-hidden rounded-xl border border-border">
      <div className="relative h-44 w-full bg-primary/10 sm:h-56">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <svg viewBox="0 0 800 220" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Placeholder skyline: upload your own picture in Admin, Branding" className="absolute inset-0 size-full text-primary">
            <rect width="800" height="220" fill="currentColor" opacity="0.08" />
            <g fill="currentColor" opacity="0.28">
              <rect x="40" y="110" width="60" height="110" />
              <rect x="110" y="70" width="50" height="150" />
              <rect x="170" y="130" width="70" height="90" />
              <rect x="250" y="40" width="56" height="180" />
              <rect x="316" y="95" width="64" height="125" />
              <rect x="390" y="120" width="48" height="100" />
              <rect x="448" y="60" width="62" height="160" />
              <rect x="520" y="105" width="70" height="115" />
              <rect x="600" y="80" width="52" height="140" />
              <rect x="662" y="125" width="80" height="95" />
            </g>
          </svg>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/55 to-transparent p-4 pt-10 sm:p-6 sm:pt-12">
          <p className="text-sm font-medium text-white/90">{region}</p>
          {tagline && <p className="text-lg font-semibold text-white sm:text-xl">{tagline}</p>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {stats.map((x) => (
          <div key={x.label} className="bg-card p-4">
            <dt className="text-xs font-medium text-muted-foreground">{x.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{x.value}</dd>
            {x.note && <p className="mt-0.5 text-xs text-muted-foreground">{x.note}</p>}
          </div>
        ))}
      </dl>
    </section>
  )
}

export async function HubHome({ ctx, base }: Props) {
  const slug = ctx.institution.slug
  const id = ctx.institution.id
  const now = new Date()
  const redZoneCutoff = new Date(now.getTime() - 26 * 7 * 86_400_000)
  const [d, inst, notices, requests, redZone, dueFunding, claimsWaiting] = await Promise.all([
    hubDashboard(id),
    prisma.institution.findUniqueOrThrow({ where: { id }, select: { profile: true, enabledFeatures: true } }),
    regionNotices(id).catch(() => [] as Notice[]),
    seatRequests(id),
    // In the group for 26 weeks or more without landing. Counts only.
    prisma.institutionMember.count({ where: { institutionId: id, candidate: { journey: 'LAID_OFF', journeyStage: { not: 'LANDED' }, journeyChangedAt: { lte: redZoneCutoff } } } }),
    // Funding still being considered or drafted with a deadline in the next three weeks.
    prisma.fundingApplication.findMany({ where: { institutionId: id, status: { in: ['CONSIDERING', 'DRAFTING'] }, dueDate: { lte: new Date(now.getTime() + 21 * 86_400_000) } }, orderBy: { dueDate: 'asc' }, take: 3, select: { name: true, funder: true, status: true, dueDate: true } }).catch(() => []),
    prisma.ecosystemPartner.count({ where: { institutionId: id, status: 'CLAIMED' } }).catch(() => 0),
  ])
  const profile = inst.profile as { heroImageUrl?: string; tagline?: string; region?: { name?: string; unemployment?: { area: string; rate: number; period: string; laborForce?: number | null }[] } } | null
  const demo = (inst.enabledFeatures as { demo?: { preparedFor?: string | null } } | null)?.demo
  const un = profile?.region?.unemployment?.[0]
  const activation = d.participants ? Math.round((d.joined / d.participants) * 100) : null
  const unanswered = notices.filter((n) => !n.responseId).length
  const isDemo = ctx.institution.isDemo
  const needs: { label: string; detail: string; href: string; cta: string }[] = []
  if (unanswered > 0) needs.push({ label: `${unanswered} layoff${unanswered === 1 ? '' : 's'} filed in your region with no response yet`, detail: 'Real filings from the last 120 days.', href: `${base}/${isDemo ? 'rapid' : 'layoffs'}`, cta: 'Plan the response' })
  if (requests.length > 0) needs.push({ label: `${requests.length} seat request${requests.length === 1 ? '' : 's'} from member companies waiting`, detail: 'A company asked for free access for its people.', href: `${base}/layoffs`, cta: 'Answer the request' })
  if (redZone > 0) needs.push({ label: `${small(redZone)} people out of work 26 weeks or more`, detail: 'The longest searches, where outreach matters most.', href: `${base}/participants`, cta: 'See who' })
  if (claimsWaiting > 0) needs.push({ label: `${claimsWaiting} organization${claimsWaiting === 1 ? '' : 's'} asked to join your talent network`, detail: 'Check who they are, then confirm or decline.', href: `${base}/ecosystem`, cta: 'Review requests' })
  for (const f of dueFunding) needs.push({ label: `${f.name}: due ${periodDay(f.dueDate)}`, detail: `${f.status === 'DRAFTING' ? 'Drafting' : 'Considering'}${f.funder ? ` · ${f.funder}` : ''}`, href: `${base}/applications`, cta: 'Open application' })
  if (isDemo && dueFunding.length === 0) needs.push({ label: `Governor’s Reserve Fund: next deadline ${nextReserveDeadline(now)}`, detail: 'Monthly, first Wednesday. Check fit and partners.', href: `${base}/funding`, cta: 'See funding' })
  const verbs = VERBS.filter((v) => (!v.demoOnly || isDemo) && (!v.from || ctx.workspaces.includes(v.from)))
  // The portal Home pattern (src/components/partners/PortalHome.tsx): one line and one primary action, what needs you, three
  // numbers with their sources, the region's layoffs as a dense table. The picture, the seven verbs, the brief and the full
  // participation tiles sit under "More". Same reads as before: no new query.
  // The primary action is the top item's own action; the item stays in the list with its reason.
  const primary = needs[0]
  const items: NeedsItem[] = needs.map((n) => ({ key: n.cta.toLowerCase().replace(/\W+/g, '_'), title: n.label, why: n.detail, href: n.href, action: n.cta }))
  const action = primary ? { href: primary.href, label: primary.cta } : { href: `${base}/participants`, label: 'See your people' }
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl space-y-1">
          {demo?.preparedFor && (
            <p className="text-sm text-muted-foreground">
              Prepared for <span className="font-medium text-foreground">{demo.preparedFor}</span>, {ctx.institution.name}. Sample people and companies; regional data is real.
            </p>
          )}
          <p className="text-base text-muted-foreground">
            {needs.length === 0 ? 'Nothing needs you this week.' : `${needs.length} ${needs.length === 1 ? 'thing needs' : 'things need'} you this week.`}{' '}
            {d.participants > 0 && `${d.participants.toLocaleString()} people helped, ${small(d.landed)} landed.`}
          </p>
        </div>
        <PortalHomeLink
          href={action.href}
          portal="workforce"
          item="primary_action"
          className="nc-action inline-flex h-11 shrink-0 items-center rounded-lg px-5 text-sm font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {action.label}
        </PortalHomeLink>
      </div>

      <PortalNeeds portal="workforce" items={items} empty="Nothing needs you this week." />

      <div className="space-y-2">
        <PortalNumbers
          items={[
            { value: d.participants.toLocaleString(), label: 'People helped', source: activation === null ? 'Signed up through your pages and partners' : `${activation}% have joined NextChapter`, highlight: true },
            { value: small(d.landed), label: 'Landed new roles', source: 'Of people who share their outcome' },
            { value: pct(d.kept), label: `Kept in ${d.local?.label ?? 'region'}`, source: d.local ? 'Local or remote, of hires with a known place' : 'Set your region to count who stays' },
          ]}
        />
        <p className="max-w-2xl text-xs text-muted-foreground">Counts only. Where someone is in their search shows only for people who chose to share it, and any group under five shows as &lt;5.</p>
      </div>

      <PortalTable
        title="Layoffs in your region"
        link={{ href: `${base}/${isDemo ? 'rapid' : 'layoffs'}`, label: 'See all layoffs' }}
        columns={['Employer', 'Jobs', 'Filed', 'Where', 'Response']}
        rows={notices.slice(0, 6).map((n) => ({
          key: n.id,
          cells: [n.employer, n.employees ? n.employees.toLocaleString() : '—', periodDay(n.noticeDate), [n.county, n.state].filter(Boolean).join(', ') || '—', n.responseId ? 'Response planned' : 'Not started'],
        }))}
        empty={un ? 'No layoff filings in your region in the last 120 days.' : 'Set your region to see layoff filings there.'}
      />

      {!d.local && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          Set your region in <Link href={`/i/${slug}/hub/local`} className="font-medium text-primary hover:underline">Kept in region</Link> so local jobs rank first for your participants and we can count who stays.
        </p>
      )}

      <PortalHomeMore label="More: your region, your team's work and participation">
        <HomeHero
          name={ctx.institution.name}
          region={profile?.region?.name ?? ctx.institution.name}
          tagline={profile?.tagline ?? null}
          imageUrl={profile?.heroImageUrl ?? null}
          stats={[
            { label: un ? `Unemployment, ${un.area}` : 'Unemployment', value: un ? `${un.rate}%` : '—', note: un ? `${periodLabel(un.period)}, U.S. Bureau of Labor Statistics` : 'Set your region to show it' },
            { label: 'Labor force', value: un?.laborForce ? un.laborForce.toLocaleString() : '—', note: un?.laborForce ? un.area : undefined },
            { label: 'People helped', value: d.participants.toLocaleString(), note: activation === null ? undefined : `${activation}% have joined` },
            { label: 'Member companies', value: String(d.companies), note: `${d.layoffs} layoff${d.layoffs === 1 ? '' : 's'} with seats` },
          ]}
        />
        <section aria-labelledby="verbs-h" className="space-y-3">
          <h3 id="verbs-h" className="font-semibold text-ink">
            What your team does
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {verbs.map((v) => (
              <li key={v.verb}>
                <Link href={`${base}/${v.tab}`} className="block h-full rounded-lg border border-border p-4 transition-colors hover:border-[var(--portal,var(--ink))]">
                  <p className="font-semibold text-[color:var(--accent-text,var(--primary))]">{v.verb}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{v.line}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <BriefCard institutionId={id} agent="workforce_dev" />
        <section aria-labelledby="part-h" className="space-y-3">
          <h3 id="part-h" className="font-semibold text-ink">
            Participation
          </h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Joined NextChapter" value={small(d.joined)} note={activation === null ? undefined : `${activation}% activation`} />
            <StatTile label="Active this week" value={small(d.activeThisWeek)} />
            <StatTile label="Applying or interviewing" value={small(d.searching)} note={`${small(d.interviewing)} interviewing`} />
            <StatTile label="Seats used" value={`${d.seats.used.toLocaleString()} of ${d.seats.pool.toLocaleString()}`} />
          </div>
        </section>
      </PortalHomeMore>
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
  const flow = await loadFlowData(ctx.institution.id, rows.map((r) => r.id))
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
            <li key={r.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="font-medium">{r.memberCompany?.name ?? r.employerName}</p>
                <p className="text-muted-foreground">
                  {r._count.participants.toLocaleString()} of {(r.seats ?? 0).toLocaleString()} seats claimed · opened {day(r.createdAt)}
                  {r.warnNotice ? ` · Layoff notice: ${r.warnNotice.employees ?? '?'} workers` : ''}
                </p>
                <Link href={`/i/${slug}/rapid/${r.id}`} target="_blank" className="text-xs font-medium text-primary hover:underline">
                  Sign-up page{r.isActive ? '' : ' (closed)'}
                </Link>
              </div>
              {!ctx.readOnly && <LayoffOpenToggle slug={slug} id={r.id} isActive={r.isActive} />}
              </div>
              <ResponseFlow ctx={ctx} responseId={r.id} done={flow.done.get(r.id) ?? new Set()} funding={flow.funding} fundingId={r.fundingApplicationId} />
            </li>
          ))}
        </ul>
      )}
      {notices.length > 0 && (
        <section className="space-y-2" aria-labelledby="warn">
          <h2 id="warn" className="text-base font-semibold">
            Layoff notices in your region
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
