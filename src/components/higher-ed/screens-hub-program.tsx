// Program workspace tabs that show what a region can coordinate that other
// workforce software does not: learning partners as one system, employer
// upskilling, future skills in job specs, rapid response for every layoff,
// benefits, attracting people from elsewhere, and grant-ready reporting.
// Shown on demo workspaces only (see demoOnly in workspaces.ts). Real data
// where we have it (colleges near the region, WARN notices, the member
// companies and seats); everything invented is labeled "Sample".

import Link from 'next/link'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { regionNotices } from '@/lib/higher-ed/rapid-response'
import { readLocal, localArea, isInArea } from '@/lib/workforce/local'
import { hubLayoffs, memberCompanies, small } from '@/lib/workforce/hub'
import { BENEFITS, DEMAND_SKILLS, FUNNEL, LANES, ORIGINS, RESPONSE_STEPS, rand01, randInt } from '@/lib/workforce/program-content'
import { StatTile } from './StatTile'
import { PrintButton } from './PrintButton'
import { FutureSkillsTool } from './FutureSkillsTool'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '—')

function Sample({ children = 'Sample' }: { children?: React.ReactNode }) {
  return <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle text-[11px] font-medium text-muted-foreground">{children}</span>
}

function Section({ title, intro, sample, children }: { title: string; intro?: string; sample?: boolean; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">
          {title}
          {sample && <Sample />}
        </h2>
        {intro && <p className="max-w-2xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>
}

// Real colleges near the region (IPEDS), largest first. One bounded read of
// the state's rows with a few columns, filtered to the demo's area.
async function nearbyColleges(institutionId: string) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true } })
  const local = readLocal(inst.enabledFeatures)
  if (!local) return []
  const area = await localArea(local)
  if (!area) return []
  const rows = await prisma.collegeProfile.findMany({
    where: { state: local.anchorState, enrollment: { gt: 400 } },
    orderBy: { enrollment: 'desc' },
    take: 80,
    select: { unitid: true, name: true, city: true, state: true, control: true, level: true, enrollment: true, hasExecEd: true, hasRetraining: true, aiPrograms: true, website: true },
  })
  return rows.filter((c) => isInArea(area, c.city, c.state)).slice(0, 8)
}

function aiAwards(ai: unknown): number {
  const programs = (ai as { programs?: { awards?: number }[] } | null)?.programs
  return Array.isArray(programs) ? programs.reduce((n, p) => n + (p.awards ?? 0), 0) : 0
}

function lanesOf(c: { hasExecEd: boolean | null; hasRetraining: boolean | null; level: string | null; ai: number }) {
  const out = new Set<string>(['degree'])
  if (c.hasExecEd) out.add('execed')
  if (c.hasRetraining) out.add('retrain')
  if (c.ai > 0) out.add('upskill')
  return [...out]
}

const laneLabel = (k: string) => LANES.find((l) => l.key === k)?.label ?? k

// ---------------------------------------------------------------------------

export async function HubLearning({ ctx }: Props) {
  const colleges = await nearbyColleges(ctx.institution.id)
  const seed = ctx.institution.slug
  const programs = await prisma.program.findMany({ where: { institutionId: ctx.institution.id, isActive: true }, select: { name: true, _count: { select: { cohorts: true } } }, take: 10 })
  const enrolled = await prisma.enrollment.count({ where: { cohort: { program: { institutionId: ctx.institution.id } } } })
  const rows = colleges.map((c) => ({ ...c, ai: aiAwards(c.aiPrograms) })).map((c) => ({ ...c, lanes: lanesOf(c) }))
  const covers = (lane: string) => rows.filter((r) => r.lanes.includes(lane))
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Learning partners" value={rows.length} note="Colleges in your region (federal data)" />
        <StatTile label="Open programs" value={programs.length} note="Run by this program" />
        <StatTile label="People enrolled" value={small(enrolled)} note="In this program’s courses" />
        <StatTile label="Skills with no partner yet" value={DEMAND_SKILLS.filter((d) => !rows.some((r) => r.lanes.includes(d.lane))).length} note="Where to recruit a provider" />
      </div>

      <Section title="One picture: exec ed, degrees, retraining, upskilling" intro="Each lane has different people and a different payer. Seeing them together shows who is covered and who is not.">
        <div className="grid gap-3 md:grid-cols-2">
          {LANES.map((l) => {
            const list = covers(l.key)
            return (
              <div key={l.key} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{l.label}</h3>
                  <span className="text-xs text-muted-foreground">{l.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">{l.who}</p>
                <p className="mt-2 text-sm">{list.length ? list.slice(0, 4).map((r) => r.name).join(' · ') : 'No partner listed yet.'}</p>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="What employers need, and who can teach it" intro="Demand comes from the job-spec check and member companies. A gap is a skill no partner covers: that is where you convene or recruit a provider." sample>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Skill employers ask for</Th>
                <Th>Employers asking</Th>
                <Th>Lane</Th>
                <Th>Partners covering it</Th>
                <Th>Suggested next move</Th>
              </tr>
            </thead>
            <tbody>
              {DEMAND_SKILLS.map((d, i) => {
                const list = covers(d.lane)
                const asking = randInt(seed, `ask${i}`, 3, 8)
                return (
                  <tr key={d.skill} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{d.skill}</td>
                    <td className="px-3 py-2 tabular-nums">{asking}</td>
                    <td className="px-3 py-2">{laneLabel(d.lane)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{list.length ? list.slice(i % list.length, (i % list.length) + 2).map((r) => r.name).join(', ') || list[0].name : 'None yet'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{list.length ? 'Convene partners and employers for a joint cohort' : 'Recruit a provider'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Learning partners in your region" intro="Real colleges from federal data. The coordination column shows what you would track for each.">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No colleges found for this region. Set the region on Kept in region to list partners.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <Th>Institution</Th>
                  <Th>Enrollment</Th>
                  <Th>Offers</Th>
                  <Th>AI, data and robotics awards</Th>
                  <Th>Coordination</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.unitid} className="border-t border-border">
                    <td className="min-w-48 px-3 py-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="block text-xs text-muted-foreground">{[r.control, r.city].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.enrollment?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2">{r.lanes.map(laneLabel).join(', ')}</td>
                    <td className="px-3 py-2 tabular-nums">{r.ai > 0 ? r.ai.toLocaleString() : 'None reported'}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {['Cohort planned with employers', 'Shared job-skills brief sent', 'Introduced to member companies', 'Intro meeting set'][Math.floor(rand01(seed, `co${i}`) * 4)]}
                      <Sample />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubUpskill({ ctx }: Props) {
  const companies = await memberCompanies(ctx.institution.id)
  const seed = ctx.institution.slug
  const rows = companies.map((c) => {
    const headcount = randInt(seed, `hc${c.id}`, 80, 900)
    const enrolled = Math.round(headcount * (0.04 + rand01(seed, `en${c.id}`) * 0.18))
    return { c, enrolled, headcount, skill: DEMAND_SKILLS[Math.floor(rand01(seed, `sk${c.id}`) * DEMAND_SKILLS.length)].skill }
  })
  const total = rows.reduce((n, r) => n + r.enrolled, 0)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Employers upskilling people" value={rows.length} note="Layoff or no layoff" />
        <StatTile label="Employees in courses" value={total.toLocaleString()} note="Sample" />
        <StatTile label="Skills requested" value={new Set(rows.map((r) => r.skill)).size} note="Across members" />
      </div>
      <Section title="Every member company, not only the ones with layoffs" intro="Employers that keep people current are less likely to lay them off. Each row is the course demand a partner could fill." sample>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Company</Th>
                <Th>Employees in courses</Th>
                <Th>Most requested skill</Th>
                <Th>Suggested next step</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, enrolled, headcount, skill }) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="min-w-44 px-3 py-2">
                    <span className="font-medium">{c.name}</span>
                    {c.industry && <span className="block text-xs text-muted-foreground">{c.industry}</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {enrolled} <span className="text-xs text-muted-foreground">of about {headcount}</span>
                  </td>
                  <td className="px-3 py-2">{skill}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.hiring ? 'Match a cohort to its open roles' : 'Offer a group rate with a partner course'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubSkills({ ctx }: Props) {
  const colleges = await nearbyColleges(ctx.institution.id)
  return (
    <div className="space-y-6">
      <Section title="Put the skills of the future into job specs" intro="Work with a hiring manager on one role. Paste the description, see what AI changes about it, and name the skills in the spec so local people can learn them and apply.">
        <FutureSkillsTool slug={ctx.institution.slug} partnerNames={colleges.map((c) => c.name)} />
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubRapid({ ctx }: Props) {
  const [notices, layoffs] = await Promise.all([regionNotices(ctx.institution.id), hubLayoffs(ctx.institution.id)])
  const seed = ctx.institution.slug
  const slug = ctx.institution.slug
  const stepsDone = (started: boolean, active: boolean, k: number) => (started ? (active ? Math.min(4, 2 + (k % 3)) : 6) : 1)
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Every layoff gets the same six steps: a WARN filing, a company that tells you, or one you read about. Professionals and managers are covered the same as the production line.
      </p>
      <Section title="Steps for every layoff">
        <ol className="grid gap-2 md:grid-cols-3">
          {RESPONSE_STEPS.map((s, i) => (
            <li key={s.key} className="rounded-lg border border-border bg-card p-3 text-sm">
              <p className="font-medium">
                {i + 1}. {s.label}
              </p>
              <p className="text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Layoffs filed in your region" intro={`Real WARN notices from the last 120 days.${notices[0]?.inRegion === false ? ' None in your counties, so this shows the state.' : ''}`}>
        {notices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No notices on file for your region in the last 120 days.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <Th>Employer</Th>
                  <Th>Workers</Th>
                  <Th>Notice date</Th>
                  <Th>Response</Th>
                </tr>
              </thead>
              <tbody>
                {notices.slice(0, 10).map((n, k) => (
                  <tr key={n.id} className="border-t border-border">
                    <td className="min-w-44 px-3 py-2">
                      <span className="font-medium">{n.employer}</span>
                      <span className="block text-xs text-muted-foreground">{[n.county, n.state].filter(Boolean).join(', ')}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{n.employees?.toLocaleString() ?? '—'}</td>
                    <td className="px-3 py-2">{day(n.noticeDate)}</td>
                    <td className="px-3 py-2">{n.responseId ? 'Response open' : `Step 1 of 6 · ${k < 3 ? 'contact the employer' : 'not started'}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Responses with seats" intro="Where a member company’s people have free access." sample>
        {layoffs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No layoffs with seats yet.</p>
        ) : (
          <ul className="space-y-2">
            {layoffs.map((l, k) => {
              const done = stepsDone(true, l.isActive, k + randInt(seed, `r${l.id}`, 0, 2))
              return (
                <li key={l.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{l.memberCompany?.name ?? l.employerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.seats?.toLocaleString() ?? 0} seats · {small(l._count.participants)} signed up · {day(l.createdAt)}
                    </p>
                  </div>
                  <div className="mt-2 flex gap-1" role="img" aria-label={`${done} of 6 steps done`}>
                    {RESPONSE_STEPS.map((s, i) => (
                      <span key={s.key} title={s.label} className={`h-2 flex-1 rounded-full ${i < done ? 'bg-primary' : 'bg-muted'}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {done >= 6 ? 'All six steps done.' : `Next: ${RESPONSE_STEPS[done].label.toLowerCase()}.`}{' '}
                    <Link href={`/i/${slug}/hub/layoffs`} className="font-medium text-primary hover:underline">
                      Open seats
                    </Link>
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubBenefits({ ctx }: Props) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { profile: true, name: true } })
  const board = (inst.profile as { workforce?: { board?: { name?: string; website?: string | null } } } | null)?.workforce?.board
  const groups = [...new Set(BENEFITS.map((b) => b.group))]
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        What a person who loses a job, or moves here, can use, in one place that {inst.name} keeps current. These are general descriptions; amounts and deadlines are set by the state and the workforce board.
        {board?.website && (
          <>
            {' '}
            Confirm local rules with{' '}
            <a href={board.website} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
              {board.name ?? 'your workforce board'}
            </a>
            .
          </>
        )}
      </p>
      {groups.map((g) => (
        <Section key={g} title={g}>
          <ul className="grid gap-2 md:grid-cols-2">
            {BENEFITS.filter((b) => b.group === g).map((b) => (
              <li key={b.name} className="rounded-lg border border-border bg-card p-4 text-sm">
                <p className="font-medium">{b.name}</p>
                <p className="text-muted-foreground">{b.what}</p>
                <p className="mt-1 text-xs text-muted-foreground">{b.how}</p>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubAttract({ ctx }: Props) {
  const seed = ctx.institution.slug
  const funnel = FUNNEL.map((label, i) => ({ label, n: Math.round(4200 * Math.pow(0.42, i) * (0.9 + rand01(seed, `f${i}`) * 0.2)) }))
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Bring people here for the job, not only the place. A person outside the region sees real local jobs next to what they pay and what life costs, builds a profile, and you can count who actually moved.
      </p>
      <Section title="From interest to a move" intro="Each step is something you can count. A move counts only with proof, such as an employer confirming a start date or a lease." sample>
        <ol className="grid gap-2 md:grid-cols-5">
          {funnel.map((f) => (
            <li key={f.label} className="rounded-lg border border-border bg-card p-3">
              <p className="text-2xl font-semibold tabular-nums">{f.n.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{f.label}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Where people could come from" intro="Real places. Interest counts are sample." sample>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Place</Th>
                <Th>Why</Th>
                <Th>People interested</Th>
              </tr>
            </thead>
            <tbody>
              {ORIGINS.map((o, i) => (
                <tr key={o.metro} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{o.metro}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.reason}</td>
                  <td className="px-3 py-2 tabular-nums">{randInt(seed, `o${i}`, 40, 480)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="What a person sees before they decide" intro="One page per person that pairs their field with local jobs and the benefits in this workspace.">
        <ul className="grid gap-2 md:grid-cols-3">
          {['Local jobs that match their field, with pay', 'How their pay compares with the cost of living here', 'Colleges, courses and benefits that help them settle'].map((t) => (
            <li key={t} className="rounded-lg border border-border bg-card p-4 text-sm">
              {t}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubGrants({ ctx }: Props) {
  const seed = ctx.institution.slug
  const households = randInt(seed, 'hh', 60, 140)
  const grant = 480000
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Funders ask the same four questions: how many, at what cost, proven how, and what did you put in. This view keeps the answers current so the semiannual report is a print, not a project.
        </p>
        <PrintButton />
      </div>

      <Section title="Households and people, with proof" sample intro="A move or a placement counts only when it has evidence on file.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Households relocated" value={households} note="Goal 140 · proof on file for each" />
          <StatTile label="Cost per household" value={`$${Math.round(grant / households).toLocaleString()}`} note="Grant cost divided by households" />
          <StatTile label="Students reached" value={randInt(seed, 'st', 800, 1600).toLocaleString()} note="Employer connections: 24" />
          <StatTile label="Qualified leads" value={randInt(seed, 'ql', 900, 1800).toLocaleString()} note="High-intent actions: 410" />
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Evidence type</Th>
                <Th>On file</Th>
                <Th>How it is collected</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Employer confirms a start date', 'Employer portal attestation'],
                ['Lease or utility agreement', 'Uploaded by the household, kept private'],
                ['Survey: intent to stay', 'Sent to students and new residents'],
                ['Verified in-state placement', 'Graduate or employer confirms'],
              ].map(([t, how], i) => (
                <tr key={t} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{t}</td>
                  <td className="px-3 py-2 tabular-nums">{randInt(seed, `ev${i}`, 20, households)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Cost per completed participant" sample intro="For unit-rate contracts: pay per person who finishes, with the attendance rule applied.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Enrolled" value="100" />
          <StatTile label="Completed (80% attendance)" value="86" />
          <StatTile label="Work products delivered" value="6 of 6" note="Plan, résumé, prompts, posting, interview, ethics" />
          <StatTile label="Unit rate" value="$985" note="Total $84,710 of $100,000" />
        </div>
      </Section>

      <Section title="Local match ledger" sample intro="A twenty percent match can be cash or in-kind: staff time, memberships, services. Log it as it happens.">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Source</Th>
                <Th>Form</Th>
                <Th>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Program staff time', 'In-kind', 140000],
                ['Event space and employer meetings', 'In-kind', 48000],
                ['Member company sponsorships', 'Cash', 52000],
                ['Partner college services', 'In-kind', 20000],
              ].map(([s, f, a]) => (
                <tr key={String(s)} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{s}</td>
                  <td className="px-3 py-2">{f}</td>
                  <td className="px-3 py-2 tabular-nums">${Number(a).toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/30 font-medium">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2">{Math.round((260000 / (grant + 260000)) * 100)}% of project</td>
                <td className="px-3 py-2 tabular-nums">$260,000</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Required: 20% of total project cost. This ledger covers {Math.round((260000 / (grant + 260000)) * 100)}%, above the minimum. Sample amounts; the grant of ${grant.toLocaleString()} is sample.</p>
      </Section>

      <Section title="How we handle people’s data">
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>People choose what to share; nothing is shared by default.</li>
          <li>Counts under five show as &lt;5.</li>
          <li>Participant data is not used to train AI models.</li>
          <li>We never write to a person’s Google account.</li>
        </ul>
      </Section>
    </div>
  )
}
