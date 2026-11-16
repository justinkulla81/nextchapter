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
import { marketJobs } from '@/lib/workforce/market-jobs'
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

const PLEDGES = ['Hire local first', 'Share openings with the pool', 'Fund upskilling', 'Name future skills in job specs']

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>
}

// Real colleges near the region (IPEDS), largest first. One bounded read of
// the state's rows with a few columns, filtered to the demo's area.
const NARROW = /seminary|theological|nursing|medical|beauty|barber|cosmetology|massage|bible/i

async function nearbyColleges(institutionId: string) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true, profile: true } })
  const local = readLocal(inst.enabledFeatures)
  if (!local) return []
  const area = await localArea(local)
  if (!area) return []
  // Both sides of a border: every state the region covers.
  const states = [...new Set([local.anchorState, ...((inst.profile as { region?: { areas?: { state: string }[] } } | null)?.region?.areas ?? []).map((a) => a.state)])]
  const rows = await prisma.collegeProfile.findMany({
    where: { state: { in: states }, enrollment: { gt: 400 } },
    orderBy: { enrollment: 'desc' },
    take: 300,
    select: { unitid: true, name: true, city: true, state: true, control: true, level: true, enrollment: true, hasExecEd: true, hasRetraining: true, aiPrograms: true, website: true },
  })
  return rows.filter((c) => isInArea(area, c.city, c.state) && !NARROW.test(c.name)).slice(0, 10)
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
  const local = readLocal((await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })).enabledFeatures)
  const market = local ? await marketJobs(local.anchorCity, local.anchorState).catch(() => null) : null
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
      {market && market.skills.length > 0 && (
        <Section title="Skills gaps of people who are employed" intro="Demand is real: how many current local postings ask for each skill. Supply is the share of employed participants whose résumé shows it, from consented résumé analysis." sample>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <Th>Skill</Th>
                  <Th>Postings asking (real)</Th>
                  <Th>Employed participants who show it</Th>
                  <Th>Gap</Th>
                </tr>
              </thead>
              <tbody>
                {market.skills.slice(0, 8).map((k, i) => {
                  const have = Math.round(100 * Math.max(0.05, Math.min(0.9, k.share * (0.35 + rand01(ctx.institution.slug, `gap${i}`) * 0.7))))
                  const want = Math.round(k.share * 100)
                  return (
                    <tr key={k.skill} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{k.skill}</td>
                      <td className="px-3 py-2 tabular-nums">{want}% <span className="text-xs text-muted-foreground">({k.postings} postings)</span></td>
                      <td className="px-3 py-2 tabular-nums">{have}%</td>
                      <td className="px-3 py-2 tabular-nums">{want - have > 0 ? `${want - have} points short` : 'Covered'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Talent pledge" intro="Employers choose which commitments to make. The scoreboard shows who made them; it is the community’s, not a ranking of employers." sample>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Employer</Th>
                {PLEDGES.map((p) => (
                  <Th key={p}>{p}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c }) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  {PLEDGES.map((p, i) => (
                    <td key={p} className="px-3 py-2">{rand01(seed, `pl${c.id}${i}`) < 0.6 ? 'Pledged' : <span className="text-muted-foreground">Not yet</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

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

      <Section title="From spec to hire" intro="Follow one skill from a job description to a course to a hire, so you can show the skill someone named ended up in a job." sample>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Role</Th>
                <Th>Skill named</Th>
                <Th>Course</Th>
                <Th>Enrolled</Th>
                <Th>Hired into the role</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Senior Financial Analyst', 'AI-assisted forecasting', colleges[0]?.name ?? 'Partner college'],
                ['HR Business Partner', 'Skills-based hiring', colleges[1]?.name ?? 'Partner college'],
                ['Operations Manager', 'Process automation', colleges[2]?.name ?? 'Partner college'],
              ].map(([role, skill, course], i) => {
                const enrolled = randInt(ctx.institution.slug, `sp${i}`, 8, 30)
                return (
                  <tr key={role} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{role}</td>
                    <td className="px-3 py-2">{skill}</td>
                    <td className="px-3 py-2 text-muted-foreground">{course}</td>
                    <td className="px-3 py-2 tabular-nums">{enrolled}</td>
                    <td className="px-3 py-2 tabular-nums">{Math.round(enrolled * (0.1 + rand01(ctx.institution.slug, `sh${i}`) * 0.25))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubRapid({ ctx }: Props) {
  const [notices, layoffs, companies] = await Promise.all([regionNotices(ctx.institution.id), hubLayoffs(ctx.institution.id), memberCompanies(ctx.institution.id)])
  const hiring = companies.filter((c) => c.hiring)
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

      <Section title="Hiring pool before the exit date" intro="Employers that are hiring see the group’s skills, with each person’s consent, while people are still on the payroll. Nobody is named to an employer until they say yes." sample>
        {layoffs.length === 0 || hiring.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Appears when a layoff has seats and a member company is hiring.</p>
        ) : (
          <ul className="space-y-2">
            {layoffs.filter((l) => l.isActive).map((l) => {
              const affected = l.seats ?? 0
              const consented = Math.round(affected * (0.3 + rand01(seed, `pc${l.id}`) * 0.25))
              return (
                <li key={l.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                  <p className="font-medium">
                    {l.memberCompany?.name ?? l.employerName}: {affected.toLocaleString()} affected, {small(consented)} agreed to be introduced
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {hiring.map((h, i) => `${h.name} (${randInt(seed, `h${l.id}${i}`, 2, 9)} open roles match)`).join(' · ')}
                  </p>
                </li>
              )
            })}
          </ul>
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

      <RelocationInterest slug={ctx.institution.slug} ctxId={ctx.institution.id} />

      <Section title="Relocation concierge" intro="Everything around the job, so the move holds. Each step is a link or a download the household uses; nothing is written to their accounts." sample>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['Partner job search', 'The partner’s field and local jobs, ranked first, with employer introductions.'],
            ['Schools and neighborhoods', 'Short guides matched to the household’s commute and kids’ ages.'],
            ['Housing', 'Where to look and what rents and prices run, with sources.'],
            ['Welcome network', 'A local host from a member employer, and a first-month event list as a calendar download.'],
            ['Alumni who left', `Graduates of partner colleges now living elsewhere: ${randInt(ctx.institution.slug, 'al', 900, 2400).toLocaleString()} reachable through the colleges, with their consent.`],
            ['Proof for the funder', 'A lease, a utility start, or an employer’s start-date confirmation, kept private.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-medium">{t}</p>
              <p className="text-muted-foreground">{d}</p>
            </div>
          ))}
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

// ---------------------------------------------------------------------------

async function RelocationInterest({ slug, ctxId }: { slug: string; ctxId: string }) {
  const local = readLocal((await prisma.institution.findUniqueOrThrow({ where: { id: ctxId }, select: { enabledFeatures: true } })).enabledFeatures)
  const market = local ? await marketJobs(local.anchorCity, local.anchorState).catch(() => null) : null
  const fields = [
    { f: 'Finance and accounting', n: randInt(slug, 'rf1', 30, 120) },
    { f: 'Technology and data', n: randInt(slug, 'rf2', 40, 140) },
    { f: 'Operations and supply chain', n: randInt(slug, 'rf3', 25, 90) },
    { f: 'Marketing and sales', n: randInt(slug, 'rf4', 20, 80) },
    { f: 'People and HR', n: randInt(slug, 'rf5', 10, 50) },
  ].sort((a, b) => b.n - a.n)
  const score = randInt(slug, 'rs', 58, 72)
  return (
    <Section title="People interested in moving here, and what their résumés show" intro="Counts and averages only, from people who chose to share. Where there are fewer than five people, the cell is hidden." sample>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Interested in moving" value={fields.reduce((n, x) => n + x.n, 0).toLocaleString()} />
        <StatTile label="Average résumé score" value={`${score} of 100`} note="Before suggested fixes" />
        <StatTile label="Skills match local postings" value={`${randInt(slug, 'sm', 54, 78)}%`} note="At least three skills in common" />
        <StatTile label="Could start within 3 months" value={`${randInt(slug, 'st3', 22, 41)}%`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Field</Th>
                <Th>People</Th>
              </tr>
            </thead>
            <tbody>
              {fields.map((x) => (
                <tr key={x.f} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{x.f}</td>
                  <td className="px-3 py-2 tabular-nums">{x.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">What local employers ask for that these résumés lack</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
            {(market?.skills.slice(0, 4) ?? []).map((k, i) => (
              <li key={k.skill}>
                {k.skill}: missing from {randInt(slug, `ms${i}`, 25, 55)}% of résumés <span className="text-xs">(in {k.postings} local postings)</span>
              </li>
            ))}
            {!market?.skills.length && <li>Appears when local postings are available.</li>}
          </ul>
        </div>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------

export async function HubJobs({ ctx }: Props) {
  const local = readLocal((await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })).enabledFeatures)
  if (!local) return <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Set your region on Kept in region to see local jobs and skills.</p>
  const m = await marketJobs(local.anchorCity, local.anchorState)
  const money = (n: number | null) => (n ? `$${Math.round(n / 1000)}k` : '—')
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted-foreground">
        What employers in {local.anchorCity} are asking for right now, from current postings. Skills are counted from the job descriptions, so you can plan courses and cohorts around real demand.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Current postings read" value={m.sampled.toLocaleString()} note="Newest 250 in the area" />
        <StatTile label="State a pay range" value={m.sampled ? `${Math.round((m.withPay / m.sampled) * 100)}%` : '—'} />
        <StatTile label="Middle of pay ranges" value={money(m.medianMid)} />
        <StatTile label="Mention AI" value={`${Math.round(m.aiShare * 100)}%`} note="Of postings read" />
      </div>
      <Section title="Skills being asked for">
        {m.skills.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No postings with descriptions found for this area yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {m.skills.slice(0, 12).map((k) => (
              <li key={k.skill} className="grid grid-cols-[14rem_1fr_6rem] items-center gap-3 text-sm">
                <span className="font-medium">{k.skill}</span>
                <span className="h-2 rounded-full bg-muted" role="img" aria-label={`${Math.round(k.share * 100)}% of postings`}>
                  <span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.max(3, Math.round(k.share * 100))}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground">{k.postings} postings</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Seniority">
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {m.byLevel.slice(0, 8).map((l) => (
              <li key={l.level} className="flex justify-between px-3 py-2">
                <span>{l.level.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</span>
                <span className="tabular-nums text-muted-foreground">{l.n}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Employers hiring most">
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {m.companies.map((c) => (
              <li key={c.name} className="flex justify-between px-3 py-2">
                <span>{c.name}</span>
                <span className="tabular-nums text-muted-foreground">{c.n}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
      <Section title="Newest postings">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Th>Role</Th>
                <Th>Employer</Th>
                <Th>Pay range</Th>
              </tr>
            </thead>
            <tbody>
              {m.titles.map((t, i) => (
                <tr key={`${t.title}${i}`} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{t.title}</td>
                  <td className="px-3 py-2">{t.company}</td>
                  <td className="px-3 py-2 tabular-nums">{t.min && t.max ? `${money(t.min)} to ${money(t.max)}` : 'Not stated'}</td>
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

const PIPELINE: { key: string; track: string; journeys: string[]; attract: string; land: string; retain: string; improve: string }[] = [
  { key: 'move', track: 'Moving here', journeys: [], attract: 'Campaign to people elsewhere; local jobs next to pay and cost of living', land: 'Interview help, relocation guidance, employer introductions', retain: 'Welcome network, partner job search, school and housing help', improve: 'Career plan and courses after the move' },
  { key: 'laid', track: 'Laid off', journeys: ['LAID_OFF'], attract: 'Rapid response reaches people the week of the notice', land: 'Benefits session, free seats, hiring employers matched', retain: 'Keep them in the region: local jobs rank first', improve: 'Retraining paid where funds allow' },
  { key: 'pivot', track: 'Career pivot', journeys: ['CAREER_CHANGE'], attract: 'Pivot paths from shrinking to growing roles', land: 'Skills check against local postings', retain: 'Employer introductions in the new field', improve: 'Certificate or exec ed with a partner college' },
  { key: 'grow', track: 'Employed and growing', journeys: ['GROWING', 'PROMOTION', 'EXPLORING_MOVE'], attract: 'Employers enroll teams, layoff or not', land: 'Skills gaps found from résumés and postings', retain: 'Stay-interview prompts and local options before they leave', improve: 'Upskilling courses, AI skills first' },
  { key: 'grad', track: 'New graduates', journeys: ['STUDENT_NEW_GRAD', 'RETURNING'], attract: 'Partner colleges connect students to local employers', land: 'First-job support', retain: 'Alumni network keeps graduates here', improve: 'Early-career course paths' },
]

export async function HubPipeline({ ctx }: Props) {
  const slug = ctx.institution.slug
  const members = await prisma.institutionMember.findMany({
    where: { institutionId: ctx.institution.id, candidateId: { not: null } },
    take: 1000,
    select: { candidate: { select: { journey: true } } },
  })
  const count = (j: string[]) => members.filter((m) => !!m.candidate?.journey && j.includes(m.candidate.journey)).length
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        One plan from the first day to the next promotion: attract people, help them land, keep them here, and improve their careers. Each row is a kind of person; each column is what the program does for them.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <Th>Who</Th>
              <Th>Attract</Th>
              <Th>Land</Th>
              <Th>Retain</Th>
              <Th>Improve</Th>
            </tr>
          </thead>
          <tbody>
            {PIPELINE.map((r) => {
              const n = r.journeys.length ? count(r.journeys) : randInt(slug, `pipe${r.key}`, 140, 420)
              return (
                <tr key={r.key} className="border-t border-border align-top">
                  <td className="min-w-36 px-3 py-3">
                    <span className="font-medium">{r.track}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {r.journeys.length ? `${small(n)} in this demo` : (<>{n} interested<Sample /></>)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{r.attract}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.land}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.retain}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.improve}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Counts under five show as &lt;5. People in this demo are sample participants.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

type Link2 = { name: string; address?: string | null; phone?: string | null; website?: string | null }

export async function HubSystem({ ctx }: Props) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { profile: true } })
  const wf = (inst.profile as { workforce?: { board?: { name?: string; website?: string | null; counties?: string[]; source?: string; sourceUrl?: string }; careerLinks?: Link2[] } } | null)?.workforce
  const board = wf?.board
  const centers = wf?.careerLinks ?? []
  const services = [
    ['Adult and dislocated worker services', 'Career coaching and, for people who lost a job, help with training costs through the board.'],
    ['Rapid response', 'Sessions for people affected by a layoff, set up with the employer before the last day.'],
    ['Individual training accounts', 'Funds for approved training on the state’s eligible provider list.'],
    ['Youth services', 'Career and education help for young people, run through the board’s providers.'],
  ]
  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted-foreground">
        The public workforce system in your region, and how this program works beside it: referrals both ways, a shared view of who is served, and no one counted twice.
      </p>
      <Section title="Your workforce board">
        {board?.name ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <p className="font-medium">{board.name}</p>
            {board.counties && board.counties.length > 0 && <p className="text-muted-foreground">Serves {board.counties.slice(0, 8).join(', ')}</p>}
            {board.website && (
              <a href={board.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {board.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Source: {board.source ?? 'CareerOneStop'}</p>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No workforce board found for this region.</p>
        )}
      </Section>
      <Section title="American Job Centers and career centers">
        {centers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No centers listed for this region yet.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {centers.slice(0, 8).map((c) => (
              <li key={c.name} className="rounded-lg border border-border bg-card p-4 text-sm">
                <p className="font-medium">{c.name}</p>
                {c.address && <p className="text-muted-foreground">{c.address}</p>}
                {c.phone && <p className="text-muted-foreground">{c.phone}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="What the public system offers" intro="General descriptions. Funding and eligibility are set by the board and the state.">
        <ul className="grid gap-2 md:grid-cols-2">
          {services.map(([t, d]) => (
            <li key={t} className="rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-medium">{t}</p>
              <p className="text-muted-foreground">{d}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="How the two work together" sample>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>A layoff the board hears about first becomes a response here the same day, and the other way round.</li>
          <li>Professionals and managers get the same first-week plan as everyone, with services the board does not usually offer.</li>
          <li>Training the board pays for shows up in the program’s counts without a second sign-up.</li>
        </ul>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------

type Opp = {
  name: string
  funder: string
  amount: string
  deadline: string
  who: string
  fit: 'Best fit' | 'Good fit' | 'Partner role' | 'Watch'
  why: string
  partners: string
  next: string
  checked: 'Read in the official document' | 'Read on the official page' | 'Reported by a secondary source: confirm' | 'No open call found'
  source: string
  url: string
}

// The first Wednesday of a month, in UTC: the Governor's Reserve Fund's monthly deadline.
function firstWednesday(y: number, m: number) {
  const d = new Date(Date.UTC(y, m, 1))
  d.setUTCDate(1 + ((3 - d.getUTCDay() + 7) % 7))
  return d
}
function nextReserveDeadline(now = new Date()) {
  let d = firstWednesday(now.getUTCFullYear(), now.getUTCMonth())
  if (d.getTime() + 86_400_000 <= now.getTime()) d = firstWednesday(now.getUTCFullYear() + (now.getUTCMonth() === 11 ? 1 : 0), (now.getUTCMonth() + 1) % 12)
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d)
}

const APPLICANT_NOTE = 'A company such as NextChapter cannot be the applicant: the nonprofit, local board or government applies, and a vendor joins as a partner.'

function opportunities(now = new Date()): Opp[] {
  return [
    {
      name: 'Governor’s Reserve Fund',
      funder: 'Kentucky Education and Labor Cabinet',
      amount: 'Set by the request; projects run up to two years',
      deadline: `Monthly: close of business on the first Wednesday. Next: ${nextReserveDeadline(now)}`,
      who: 'Local workforce areas, state and quasi-governmental agencies, and nonprofits that provide workforce activities. Not for-profits.',
      fit: 'Best fit',
      why: 'Two tracks, Local Initiative and Innovation or Governor’s Priority Investments. A professional career pathway with AI skills, with statewide impact and measured outcomes, is the kind of innovative practice it describes. It is rolling, so it is the fastest way to fund a pilot.',
      partners: 'KentuckianaWorks as the local area, One Louisville as the nonprofit lead, two or three partner colleges, member employers who commit to ongoing support (the application asks for partner contributions and sustainability).',
      next: 'Draft the project and budget, gather the previous-grant performance sheet, and name partner commitments. ' + APPLICANT_NOTE,
      checked: 'Read in the official document',
      source: 'Governor’s Reserve Fund application instructions, rev. Aug 2026',
      url: 'https://kwib.ky.gov/Documents/WIOA_Governors_Reserve_Fund_Application.pdf',
    },
    {
      name: 'Kentucky Talent Recruitment Grant',
      funder: 'Kentucky Cabinet for Economic Development (HB 576, 2026)',
      amount: 'Up to $500,000 per applicant; 20% local match, cash or in-kind; up to 18 months',
      deadline: 'During an open window the Cabinet announces: confirm the current window',
      who: 'City and county governments, economic development organizations, and 501(c)(3) or (6) nonprofits. Regional applications are preferred.',
      fit: 'Best fit',
      why: 'Funds relocation (50% of the fund), student retention (25%) and marketing (25%). Households are counted against an income minimum with proof such as an employer’s confirmation or a lease, which is what the Attract and Reporting tabs track. Staff time can count as match.',
      partners: 'Neighboring counties for a regional application, partner colleges for retention, member employers for confirmations, Live in Lou for the marketing track.',
      next: 'Decide which category to lead with, line up the 20% match, and set the household goal.',
      checked: 'Read in the official document',
      source: 'Talent Recruitment Grant Application Framework, October 2026',
      url: 'https://newkentuckyhome.ky.gov/Locating_Expanding/Talent',
    },
    {
      name: 'National Dislocated Worker Grants',
      funder: 'U.S. Department of Labor, through the state',
      amount: 'Not stated on the page',
      deadline: 'Rolling: no closing date at this time',
      who: 'States, and through the state the local boards. Employment Recovery grants respond to large layoffs.',
      fit: 'Good fit',
      why: 'A large professional layoff in the region could qualify for an Employment Recovery grant, which pays for the response and for training. Kentucky’s guidance, reissued August 2026, sets how local boards ask.',
      partners: 'KentuckianaWorks and the state Education and Labor Cabinet as applicants, the affected employer, partner colleges for training.',
      next: 'Keep the rapid-response record current so a layoff can be shown quickly, and ask the board how it plans to use the grant.',
      checked: 'Read on the official page',
      source: 'U.S. Department of Labor, Grant Funding Opportunities',
      url: 'https://www.dol.gov/node/149597',
    },
    {
      name: 'AI-Ready America Coordination Hubs (NSF TechAccess)',
      funder: 'National Science Foundation, with the Department of Labor',
      amount: '$1 million a year for three years per hub, with a possible fourth; one hub per state',
      deadline: 'Round 2: letter of intent December 15, 2026, proposal January 15, 2027. Round 3: June 1 and July 1, 2027',
      who: 'A lead with statewide convening power and experience running multi-sector initiatives; workforce organizations and nonprofits are named partners, with letters of collaboration.',
      fit: 'Partner role',
      why: 'Kentucky would have one hub, so a Louisville organization is more likely a partner than the lead. It could anchor the professional and AI-skills layer and the Louisville data.',
      partners: 'The state workforce board and Education and Labor Cabinet, the state’s universities and community colleges, employer associations, KentuckianaWorks and other local boards.',
      next: 'Find out who in Kentucky is leading an application and offer the Louisville layer before the December letter of intent.',
      checked: 'Read in the official document',
      source: 'NSF 26-508 solicitation',
      url: 'https://www.nsf.gov/funding/opportunities/techaccess-ai-ready-america/nsf26-508/solicitation',
    },
    {
      name: 'Kentucky AI Workforce Readiness Network',
      funder: 'Issued by SCWDB (Reskill grant funding)',
      amount: 'Planning target of about 980 participants; no ceiling stated',
      deadline: 'Solicitation questions and answers dated August 2026: check whether it is still open',
      who: 'Teams and primes, including out-of-state for-profits; local areas give support letters.',
      fit: 'Partner role',
      why: 'Five training pathways and only one near white-collar work. A professional layer fits beside them, and teaming is allowed.',
      partners: 'A prime contractor, KentuckianaWorks for a letter of support, partner colleges.',
      next: 'Ask KentuckianaWorks and the state whether a second round or a subaward is planned.',
      checked: 'Read in the official document',
      source: 'Solicitation questions and answers, August 2026',
      url: '',
    },
    {
      name: 'AI-powered career readiness workshops',
      funder: 'Issued by SCWDB',
      amount: 'Not to exceed $100,000; about 100 participants; a rate for each completed participant',
      deadline: 'Request for proposals dated July 2026: likely closed',
      who: 'Providers; privacy and no model training on participant data are required.',
      fit: 'Watch',
      why: 'Useful as a template: eight modules, six participant work products and an 80% completion rule are the shape a local version could take.',
      partners: 'Local board and employers.',
      next: 'Use it to set expectations for a Louisville workshop, not to apply.',
      checked: 'Read in the official document',
      source: 'Request for proposals, July 2026',
      url: '',
    },
    {
      name: 'Reskill Dislocated Worker Grants',
      funder: 'U.S. Department of Labor',
      amount: 'About $50 million; awards of $2 million to $8 million',
      deadline: 'Closed in August 2026; watch for a next round',
      who: 'States and eligible applicants through them.',
      fit: 'Watch',
      why: 'Shows the direction of federal money: retraining for people displaced by AI and automation.',
      partners: 'State Education and Labor Cabinet, KentuckianaWorks.',
      next: 'Ask the state how Kentucky’s award is being spent and where a local project could join.',
      checked: 'Reported by a secondary source: confirm',
      source: 'Grants aggregator, November 2026',
      url: 'https://www.dol.gov/node/149597',
    },
    {
      name: 'Strengthening Community Colleges Training Grants',
      funder: 'U.S. Department of Labor',
      amount: '$65 million in the sixth round',
      deadline: 'Issued February 24, 2026: confirm whether it has closed',
      who: 'Community colleges, usually with workforce and employer partners.',
      fit: 'Partner role',
      why: 'A partner college could apply with employers and the board. A shared skills picture from this program strengthens the employer side.',
      partners: 'Jefferson Community and Technical College, other colleges, member employers, KentuckianaWorks.',
      next: 'Ask the colleges whether they plan to apply and offer the employer demand data.',
      checked: 'Reported by a secondary source: confirm',
      source: 'State workforce notice, 2026',
      url: '',
    },
    {
      name: 'AI Upskill Accelerator Pilot',
      funder: 'U.S. Economic Development Administration',
      amount: 'Not confirmed',
      deadline: 'Launched June 2026: confirm the notice and its deadline',
      who: 'Not confirmed: the official page blocked automated access.',
      fit: 'Watch',
      why: 'A federal pilot built around AI upskilling, in line with this program’s focus.',
      partners: 'To be set once eligibility is confirmed.',
      next: 'Open the notice and confirm who can apply.',
      checked: 'Reported by a secondary source: confirm',
      source: 'EDA, June 2026',
      url: 'https://www.eda.gov/ai-upskill/ai-upskill-accelerator-pilot-program-notice-of-funding-opportunity',
    },
    {
      name: 'Foundation funding for workforce and AI skills',
      funder: 'Lumina, Ascendium, Walmart Foundation, JPMorgan Chase, LinkedIn',
      amount: 'Varies',
      deadline: 'No open call found on November 16, 2026. LinkedIn’s 2026 Future of Work Fund closed March 15; the JFF early-career call closed February 25',
      who: 'Mostly nonprofits and colleges.',
      fit: 'Watch',
      why: 'Foundation calls come and go. A funded pilot with measured outcomes is what they ask for.',
      partners: 'A community foundation or a funder collaborative, plus the partners above.',
      next: 'Check each funder’s site monthly and ask the Louisville community foundation about its plans.',
      checked: 'No open call found',
      source: 'Funder websites',
      url: '',
    },
  ]
}

const FIT_STYLE: Record<Opp['fit'], string> = {
  'Best fit': 'bg-primary text-primary-foreground',
  'Good fit': 'bg-muted text-foreground',
  'Partner role': 'bg-muted text-foreground',
  Watch: 'bg-muted text-muted-foreground',
}

export async function HubFunding({ ctx }: Props) {
  void ctx
  const list = opportunities()
  const groups: [string, Opp['fit'][]][] = [
    ['Apply now', ['Best fit']],
    ['Apply or join', ['Good fit', 'Partner role']],
    ['Watch and learn from', ['Watch']],
  ]
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Funding this organization and its partners could pursue, with our read on fit, the partners to bring in, and the next move. Dates were checked on November 16, 2026; confirm each in its official notice before you plan around it.
      </p>
      {groups.map(([title, fits]) => {
        const rows = list.filter((o) => fits.includes(o.fit))
        return (
          <Section key={title} title={title}>
            <ul className="space-y-3">
              {rows.map((o) => (
                <li key={o.name} className="rounded-lg border border-border bg-card p-4 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{o.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FIT_STYLE[o.fit]}`}>{o.fit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{o.funder}</p>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 md:grid-cols-[9rem_1fr]">
                    <dt className="font-medium">Amount</dt>
                    <dd className="text-muted-foreground">{o.amount}</dd>
                    <dt className="font-medium">Deadline</dt>
                    <dd className="text-muted-foreground">{o.deadline}</dd>
                    <dt className="font-medium">Who can apply</dt>
                    <dd className="text-muted-foreground">{o.who}</dd>
                    <dt className="font-medium">Why it fits</dt>
                    <dd className="text-muted-foreground">{o.why}</dd>
                    <dt className="font-medium">Partners to bring in</dt>
                    <dd className="text-muted-foreground">{o.partners}</dd>
                    <dt className="font-medium">Next move</dt>
                    <dd className="text-muted-foreground">{o.next}</dd>
                  </dl>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {o.checked} · {o.source}
                    {o.url && (
                      <>
                        {' · '}
                        <a href={o.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          Open
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )
      })}
      <Section title="Contests and challenges" intro="Hiring challenges, pitch contests and employer competitions sit here beside grants, so one calendar shows what is open.">
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">None found for this region on November 16, 2026.</p>
      </Section>
    </div>
  )
}
