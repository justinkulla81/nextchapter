// Business Hub (owner, 2026-11-17): a workforce customer's business side, next to Talent Hub. Who could move or expand here,
// a pitch built from the region's own data, and the employers and small businesses already here. Every figure in a pitch is
// one we hold or one the organization entered, with its source; nothing is invented.

import Link from 'next/link'
import { ArrowRight, Building2 } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { readLocal } from '@/lib/workforce/local'
import { marketJobs } from '@/lib/workforce/market-jobs'
import { loadSupply } from '@/lib/workforce/skills-supply'
import { MIN_GROUP, countBy } from '@/lib/workforce/skills-intel'
import { nearbyColleges } from '@/lib/workforce/colleges-near'
import { memberCompanies } from '@/lib/workforce/hub'
import { expansionNews, growingCompanies } from '@/lib/workforce/business-leads'
import { readPitchSettings } from '@/lib/workforce/business-pitch'
import { getAwards, readRankingIndex } from '@/lib/rankings/store'
import { groupByMonth, viewAwards } from '@/lib/rankings/awards'
import { cityAwardKeys } from '@/lib/rankings/place-keys'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from './StatTile'
import { PrintButton } from './PrintButton'
import { PitchSettingsForm } from './PitchSettingsForm'

type Props = { ctx: WorkspaceContext; searchParams: { company?: string }; base: string }

const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const money = (n: number) => `$${Math.round(n / 1000).toLocaleString('en-US')}k`

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {intro && <p className="max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

async function settingsOf(institutionId: string) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true, profile: true } })
  return { local: readLocal(inst.enabledFeatures), pitch: readPitchSettings(inst.enabledFeatures), profile: inst.profile as { region?: { unemployment?: { area: string; rate: number; period: string; laborForce?: number | null; source?: string }[] } } | null }
}

// ── Overview ────────────────────────────────────────────────────────────────

export async function BusinessHome({ ctx, base }: Props) {
  const [{ local, pitch }, news, growing, members] = await Promise.all([
    settingsOf(ctx.institution.id),
    expansionNews().catch(() => []),
    growingCompanies().catch(() => []),
    prisma.memberCompany.count({ where: { institutionId: ctx.institution.id } }),
  ])
  const city = local?.anchorCity ?? 'your region'
  const steps = [
    { title: 'Expansion leads', line: `${news.length} recent stories of companies opening offices or moving, and the ${growing.length} companies growing fastest by open roles.`, href: `${base}/leads` },
    { title: 'Pitch builder', line: `A one-page case for growing in ${city}, from the region's own data, ready to print or send.`, href: `${base}/pitch` },
    { title: 'Incentives and costs', line: pitch.incentives.length ? `${pitch.incentives.length} incentive${pitch.incentives.length === 1 ? '' : 's'} entered${pitch.officeCost ? ', with office costs' : ''}.` : 'Nothing entered yet. Pitches show incentives and office costs only once you add them, with sources.', href: `${base}/incentives` },
    { title: 'Big employers', line: `${members} member compan${members === 1 ? 'y' : 'ies'}, and who is hiring most in ${city} now.`, href: `${base}/employers` },
    { title: 'Startups and small business', line: 'Where founders and small-business owners get free help.', href: `${base}/small` },
  ]
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Bring employers to {city} and help the ones already here grow. Talent Hub is the people; Business Hub is the companies.
      </p>
      {!pitch.incentives.length && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <span>Pitches leave out incentives and office costs until you add them. Add them once, with their sources, and every pitch uses them.</span>
          <Link href={`${base}/incentives`} className="font-medium text-primary hover:underline">
            Add incentives and costs
          </Link>
        </div>
      )}
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {steps.map((s) => (
          <li key={s.title}>
            <Link href={s.href} className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40">
              <span>
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.line}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Expansion leads ─────────────────────────────────────────────────────────

export async function BusinessLeads({ base }: Props) {
  const [news, growing] = await Promise.all([expansionNews().catch(() => []), growingCompanies().catch(() => [])])
  const pitchFor = (name: string) => `${base}/pitch?company=${encodeURIComponent(name)}`
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Companies that are growing or moving. Neither list says a company is looking at your region: they are who to pitch. Build a pitch for any of them in one click.
      </p>
      <Section title="In the news" intro="Stories from the last two weeks of companies opening offices, expanding operations or moving headquarters. Refreshed twice a day.">
        {news.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No stories found in the last two weeks. The list refreshes twice a day.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {news.slice(0, 25).map((n) => (
              <li key={n.url} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <a href={n.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {n.title}
                  </a>
                  <span className="block text-xs text-muted-foreground">{[n.source, n.publishedAt ? day.format(new Date(n.publishedAt)) : null].filter(Boolean).join(' · ')}</span>
                </span>
                <Link href={`${base}/pitch`} className="text-xs font-medium text-primary hover:underline">
                  Build a pitch
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Growing fastest" intro="Companies whose open roles grew most over the last 12 weeks, from the job postings NextChapter tracks across the U.S.">
        {growing.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No growth signals this week.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Company', 'Open roles', 'Added in 12 weeks', 'Hiring most for', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {growing.map((g) => (
                  <tr key={g.name} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{g.name}</td>
                    <td className="px-3 py-2 tabular-nums">{g.openRoles.toLocaleString('en-US')}</td>
                    <td className="px-3 py-2 tabular-nums">+{g.added12wk.toLocaleString('en-US')}</td>
                    <td className="px-3 py-2 text-muted-foreground">{g.topFunctions.join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={pitchFor(g.name)} className="text-xs font-medium text-primary hover:underline">
                        Build a pitch
                      </Link>
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

// ── Pitch builder ───────────────────────────────────────────────────────────

function Fact({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{source}</p>
    </div>
  )
}

export async function BusinessPitch({ ctx, searchParams, base }: Props) {
  const company = (searchParams.company ?? '').trim().slice(0, 80)
  const { local, pitch, profile } = await settingsOf(ctx.institution.id)
  if (!local) {
    return <EmptyState icon={Building2} title="Set your region first" description="The pitch is built from your region's data. Set the city and radius in Talent Hub › Kept in region." />
  }
  const [market, people, colleges, programs, awards, index] = await Promise.all([
    marketJobs(local.anchorCity, local.anchorState).catch(() => null),
    loadSupply(ctx.institution.id).catch(() => []),
    nearbyColleges(ctx.institution.id).catch(() => []),
    prisma.program.findMany({ where: { institutionId: ctx.institution.id, isActive: true }, select: { name: true, credential: true }, take: 6 }),
    getAwards(cityAwardKeys(local.anchorCity, local.anchorState)).catch(() => []),
    readRankingIndex().catch(() => []),
  ])
  captureServerEvent(ctx.userId, 'business_pitch_viewed', { institutionId: ctx.institution.id, company: company || null, incentives: pitch.incentives.length })
  const un = profile?.region?.unemployment?.[0]
  const ranks = groupByMonth(viewAwards(awards, index))[0]?.items.slice(0, 3) ?? []
  const byFunction = countBy(people, (p) => p.function).filter((c) => c.n !== null).slice(0, 5)
  const enrolled = colleges.reduce((n, c) => n + (c.enrollment ?? 0), 0)
  const city = local.anchorCity
  return (
    <div className="space-y-6">
      <form className="flex max-w-xl flex-wrap items-end gap-2 print:hidden" action={`${base}/pitch`}>
        <div className="min-w-56 flex-1 space-y-1">
          <label htmlFor="company" className="text-sm font-medium">
            Company to pitch
          </label>
          <input id="company" name="company" defaultValue={company} placeholder="Company name" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
        </div>
        <button className="h-9 rounded-md border border-border px-3 text-sm">Build the pitch</button>
        <PrintButton />
      </form>

      <article className="space-y-6 rounded-xl border border-border bg-card p-6">
        <header className="space-y-1">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{ctx.institution.name}</p>
          <h2 className="text-2xl font-semibold">{company ? `Why ${company} should grow in ${city}` : `Why grow in ${city}`}</h2>
          {pitch.pitchLine && <p className="text-base">{pitch.pitchLine}</p>}
        </header>

        <Section title="Talent">
          <div className="grid gap-3 sm:grid-cols-3">
            {un && <Fact label={`Labor force, ${un.area}`} value={un.laborForce ? un.laborForce.toLocaleString('en-US') : '—'} source={`${un.period}, U.S. Bureau of Labor Statistics`} />}
            {un && <Fact label={`Unemployment, ${un.area}`} value={`${un.rate}%`} source={`${un.period}, U.S. Bureau of Labor Statistics`} />}
            {market && market.medianMid !== null && <Fact label={`Median posted pay, ${city}`} value={money(market.medianMid)} source={`${market.withPay} current postings with pay, NextChapter`} />}
          </div>
          {byFunction.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">Ready to hire through {ctx.institution.name}:</span>{' '}
              {byFunction.map((c) => `${c.n} in ${c.label.toLowerCase()}`).join(', ')}. <span className="text-xs text-muted-foreground">People in the program, counted without names; groups under {MIN_GROUP} left out.</span>
            </p>
          )}
          {market && market.skills.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">Skills local employers ask for most:</span> {market.skills.slice(0, 5).map((s) => s.skill).join(', ')}.{' '}
              <span className="text-xs text-muted-foreground">From {market.sampled} current postings in {city}.</span>
            </p>
          )}
        </Section>

        <Section title="Education and training">
          {colleges.length > 0 && (
            <p className="text-sm">
              {colleges.length} colleges within reach, {enrolled.toLocaleString('en-US')} students enrolled, including {colleges.slice(0, 3).map((c) => c.name).join(', ')}.{' '}
              <span className="text-xs text-muted-foreground">U.S. Department of Education (IPEDS).</span>
            </p>
          )}
          {programs.length > 0 && (
            <p className="text-sm">
              Training {ctx.institution.name} runs: {programs.map((p) => p.name + (p.credential ? ` (${p.credential})` : '')).join('; ')}.
            </p>
          )}
          {!colleges.length && !programs.length && <p className="text-sm text-muted-foreground">No colleges or programs found for the region yet.</p>}
        </Section>

        <Section title="Costs and incentives">
          {pitch.incentives.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {pitch.incentives.map((i) => (
                <li key={i.name}>
                  <span className="font-medium">{i.name}</span>
                  {i.detail && `: ${i.detail}`} <span className="text-xs text-muted-foreground">Source: {i.source}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground print:hidden">
              No incentives entered.{' '}
              <Link href={`${base}/incentives`} className="font-medium text-primary hover:underline">
                Add them in Incentives and costs
              </Link>
            </p>
          )}
          {pitch.officeCost && (
            <p className="text-sm">
              <span className="font-medium">Office space:</span> {pitch.officeCost.perSqFtYear !== null ? `$${pitch.officeCost.perSqFtYear} per square foot a year` : ''}
              {pitch.officeCost.note ? ` (${pitch.officeCost.note})` : ''} <span className="text-xs text-muted-foreground">Source: {pitch.officeCost.source}</span>
            </p>
          )}
        </Section>

        {ranks.length > 0 && (
          <Section title={`Where ${city} ranks`}>
            <ul className="space-y-1 text-sm">
              {ranks.map((a) => (
                <li key={a.slug}>
                  <span className="font-semibold">#{a.rank}</span> {a.title} <span className="text-xs text-muted-foreground">of {a.places}, {a.month}, NextChapter rankings</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </article>
    </div>
  )
}

// ── Incentives and costs ────────────────────────────────────────────────────

export async function BusinessIncentives({ ctx }: Props) {
  const { pitch } = await settingsOf(ctx.institution.id)
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-muted-foreground">What a company could use to grow here, and what office space costs. Every pitch shows these with their sources. Leave a row empty to skip it.</p>
      {ctx.readOnly ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          This is a read-only view, so the form is hidden. {pitch.incentives.length ? `${pitch.incentives.length} incentives are entered.` : 'Nothing is entered yet.'}
        </p>
      ) : (
        <PitchSettingsForm slug={ctx.institution.slug} value={pitch} />
      )}
    </div>
  )
}

// ── Big employers ───────────────────────────────────────────────────────────

export async function BusinessEmployers({ ctx, base }: Props) {
  const { local } = await settingsOf(ctx.institution.id)
  const [members, market] = await Promise.all([memberCompanies(ctx.institution.id), local ? marketJobs(local.anchorCity, local.anchorState).catch(() => null) : Promise.resolve(null)])
  const hubBase = base.replace(/\/business$/, '/hub')
  return (
    <div className="space-y-8">
      <Section title="Hiring most right now" intro={local ? `Employers with the most current postings in ${local.anchorCity}, from the newest ${market?.sampled ?? 0} postings NextChapter holds.` : 'Set your region to see who is hiring.'}>
        {market && market.companies.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {market.companies.slice(0, 8).map((c) => (
              <StatTile key={c.name} label={c.name} value={String(c.n)} note={c.n === 1 ? 'posting' : 'postings'} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No current postings found for the region.</p>
        )}
      </Section>
      <Section title="Your member companies" intro="The companies you serve. Their layoffs, seats and hiring are in Talent Hub › Employers.">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No member companies yet.{' '}
            <Link href={`${hubBase}/companies`} className="font-medium text-primary hover:underline">
              Add them in Talent Hub
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground">{[m.industry, m.hiring ? 'hiring' : null, m.layoffs.length ? `${m.layoffs.length} layoff${m.layoffs.length === 1 ? '' : 's'} with seats` : null].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

// ── Startups and small business ─────────────────────────────────────────────

// National programs with free help for founders and small-business owners; each link is the program's own site.
const SMALL_BUSINESS_HELP = [
  { name: 'Small Business Development Centers', what: 'Free one-to-one advising on plans, financing and growth, in every state.', href: 'https://americassbdc.org/find-your-sbdc/' },
  { name: 'SCORE mentors', what: 'Free mentoring from experienced business owners and executives.', href: 'https://www.score.org/find-mentor' },
  { name: 'U.S. Small Business Administration', what: 'Loan programs, government contracting and the local SBA district office.', href: 'https://www.sba.gov/local-assistance' },
  { name: 'Women’s Business Centers', what: 'Training and counseling for women entrepreneurs.', href: 'https://www.sba.gov/local-assistance/resource-partners/womens-business-centers' },
  { name: 'Veterans Business Outreach Centers', what: 'Help for veterans and military spouses starting or growing a business.', href: 'https://www.sba.gov/local-assistance/resource-partners/veterans-business-outreach-center-vboc-program' },
]

export async function BusinessSmall({ ctx }: Props) {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Where founders and small-business owners in your region get free help. Point people here, or link your own programs alongside them. People in {ctx.institution.name}&apos;s
        program who want to start or buy a business get a guided path in their NextChapter account.
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {SMALL_BUSINESS_HELP.map((r) => (
          <li key={r.name} className="px-4 py-3">
            <a href={r.href} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
              {r.name}
            </a>
            <p className="text-xs text-muted-foreground">{r.what}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
