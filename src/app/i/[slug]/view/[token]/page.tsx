import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { accentTextOnWhite, readableTextOn } from '@/lib/higher-ed/branding'
import { readLocal } from '@/lib/workforce/local'
import { marketJobs } from '@/lib/workforce/market-jobs'
import { loadSupply } from '@/lib/workforce/skills-supply'
import { MIN_GROUP, anonymizeCandidates, countBy, gapRows, seniorityBand, weeksBand } from '@/lib/workforce/skills-intel'
import { isPlausibleToken, viewStatus } from '@/lib/workforce/partner-views'
import { loadRegionJobs } from '@/components/higher-ed/screens-hub-jobs'
import { InstitutionMark } from '@/components/higher-ed/InstitutionMark'

// A partner view: a read-only page of an organization's regional data, opened by an unlisted link. Aggregates only; revocable; expires.
export const metadata: Metadata = { robots: { index: false, follow: false }, title: { absolute: 'Regional talent and skills' } }
export const dynamic = 'force-dynamic'

const day = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d))
const pct = (x: number) => `${Math.round(x * 100)}%`
const shown = (n: number | null) => (n === null ? `<${MIN_GROUP}` : n.toLocaleString('en-US'))
const money = (n: number | null) => (n ? `$${Math.round(n / 1000)}k` : null)

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {intro && <p className="max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

export default async function PartnerViewPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  if (!isPlausibleToken(token)) notFound()
  const v = await prisma.partnerView
    .findUnique({ where: { token }, include: { institution: { select: { id: true, slug: true, name: true, programBrandName: true, logoUrl: true, accentColor: true, enabledFeatures: true } } } })
    .catch(() => null)
  if (!v || v.institution.slug !== slug) notFound()
  const inst = v.institution
  const accent = inst.accentColor ?? '#1f5f8b'
  const style = { ['--primary' as string]: accent, ['--primary-foreground' as string]: readableTextOn(accent), ['--accent-text' as string]: accentTextOnWhite(accent) }
  const orgName = inst.programBrandName ?? inst.name
  const header = (
    <div className="flex items-center gap-3">
      <InstitutionMark name={inst.name} logoUrl={inst.logoUrl} />
      <p className="font-semibold">{orgName}</p>
    </div>
  )
  if (viewStatus(v) !== 'Active') {
    return (
      <div className="min-h-screen bg-background" style={style}>
        <main className="mx-auto max-w-2xl space-y-4 px-4 py-12">
          {header}
          <h1 className="text-2xl font-semibold tracking-tight">This link is no longer active</h1>
          <p className="text-muted-foreground">It has expired or been switched off. Ask {orgName} for a new one.</p>
        </main>
      </div>
    )
  }
  await prisma.partnerView.update({ where: { id: v.id }, data: { openCount: { increment: 1 }, lastOpenedAt: new Date() } }).catch(() => null)
  captureServerEvent(`partner-view:${v.id}`, 'partner_view_opened', { institutionId: inst.id, viewId: v.id, partnerKind: v.partnerKind, scopes: v.scopes })

  const has = (s: string) => v.scopes.includes(s)
  const local = readLocal(inst.enabledFeatures)
  const needsPeople = has('SKILLS') || has('TALENT') || has('PROFILES')
  const [people, market, jobs, programs] = await Promise.all([
    needsPeople ? loadSupply(inst.id).catch(() => []) : Promise.resolve([]),
    has('SKILLS') && local ? marketJobs(local.anchorCity, local.anchorState).catch(() => null) : Promise.resolve(null),
    has('JOBS') && local ? loadRegionJobs(local.anchorCity, local.anchorState).catch(() => []) : Promise.resolve([]),
    has('PROGRAMS') ? prisma.program.findMany({ where: { institutionId: inst.id, isActive: true }, take: 20, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, summary: true, credential: true, hours: true, skills: true, wioaEligible: true } }).catch(() => []) : Promise.resolve([]),
  ])
  const withSkills = people.filter((p) => p.keywords.length > 0)
  const rows = market ? gapRows(market.skills, withSkills) : []
  const enough = withSkills.length >= MIN_GROUP
  const byFunction = countBy(people.filter((p) => p.function), (p) => p.function)
  const bySeniority = countBy(people, (p) => seniorityBand(p.level, p.years))
  const byWeeks = countBy(people, (p) => weeksBand(p.weeksOut))
  const { profiles, hidden } = has('PROFILES') ? anonymizeCandidates(people, `${v.id}:${new Date().toISOString().slice(0, 10)}`) : { profiles: [], hidden: 0 }

  return (
    <div className="min-h-screen bg-background" style={style}>
      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        {header}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Regional talent and skills, prepared for {v.partnerName}</h1>
          <p className="text-sm text-muted-foreground">
            {local ? `${local.anchorCity} region · ` : ''}As of {day(new Date())} · This link works until {day(v.expiresAt)}
          </p>
          {v.note && <p className="max-w-3xl rounded-lg border border-border bg-muted/40 p-4 text-sm">{v.note}</p>}
        </div>

        {has('SKILLS') && (
          <Section title="Skills: demand, supply and the gap" intro="Demand is the share of current local postings that name the skill. Supply is the share of people in the group whose résumé names it. A gap is demand minus supply.">
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No postings with descriptions found for this region yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Skill', 'Demand', 'Supply', 'Gap'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.skill} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{r.skill}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {pct(r.demandShare)} <span className="text-xs text-muted-foreground">({r.demandPostings} postings)</span>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{!enough || r.supplyShare === null ? '—' : r.supplyPeople === null ? `<${MIN_GROUP} people` : pct(r.supplyShare)}</td>
                        <td className="px-3 py-2 tabular-nums">{r.gap === null ? '—' : r.gap > 0.005 ? `${Math.max(1, Math.round(r.gap * 100))} ${Math.round(r.gap * 100) <= 1 ? 'point' : 'points'} short` : 'Covered'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {has('TALENT') && (
          <Section title="Talent in the group" intro="Counts only, by function, seniority and time out of work. Any group under five is hidden.">
            <div className="grid gap-6 md:grid-cols-3">
              {(
                [
                  ['By function', byFunction],
                  ['By seniority', bySeniority],
                  ['Time out of work', byWeeks],
                ] as const
              ).map(([title, list]) => (
                <div key={title} className="space-y-2">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                    {list.length === 0 ? (
                      <li className="px-3 py-2 text-muted-foreground">Not enough people yet.</li>
                    ) : (
                      list.map((x) => (
                        <li key={x.label} className="flex justify-between px-3 py-2">
                          <span>{x.label}</span>
                          <span className="tabular-nums text-muted-foreground">{shown(x.n)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}

        {has('PROFILES') && (
          <Section title="De-identified profiles" intro={`Candidate A, B, C: coarse fields only, for people who chose to share a profile. A profile appears only if at least ${MIN_GROUP} people share their function and seniority. To reach someone, ask ${orgName} to send an introduction request; the person decides.`}>
            {profiles.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No profiles to show yet.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {profiles.map((p) => (
                  <li key={p.label} className="rounded-lg border border-border bg-card p-4 text-sm">
                    <p className="font-medium">{p.label}</p>
                    <p className="mt-1 text-muted-foreground">{p.summary}</p>
                  </li>
                ))}
              </ul>
            )}
            {hidden > 0 && <p className="text-xs text-muted-foreground">{hidden} more are not shown because too few people share their combination.</p>}
          </Section>
        )}

        {has('JOBS') && (
          <Section title="Jobs in the region" intro="The newest open jobs, from employers’ own career sites.">
            {jobs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No open jobs found for this region yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Job', 'Employer', 'Where', 'Pay'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.slice(0, 25).map((j) => (
                      <tr key={j.id} className="border-t border-border">
                        <td className="min-w-48 px-3 py-2">
                          <a href={j.url} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--accent-text,var(--primary))] hover:underline">
                            {j.title}
                          </a>
                        </td>
                        <td className="px-3 py-2">{j.companyName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{j.location ? j.location.replace(/,?\s*UNITED STATES$/i, '') : '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{j.salaryMin && j.salaryMax ? `${money(j.salaryMin)} to ${money(j.salaryMax)}` : <span className="text-muted-foreground">Not stated</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {has('PROGRAMS') && (
          <Section title={`${orgName} programs`} intro="Courses and programs the organization runs with its partners.">
            {programs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No programs listed yet.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {programs.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                    <p className="font-medium">{p.name}</p>
                    {p.summary && <p className="mt-1 text-muted-foreground">{p.summary}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{[p.credential, p.hours ? `${p.hours} hours` : null, p.wioaEligible ? 'Workforce funds can pay' : null].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <p className="max-w-3xl text-xs text-muted-foreground">
          Prepared by {orgName} with NextChapter. Skills are matched against a fixed vocabulary in posting text and résumé keywords: a signal, not a ruling on a role. People are counted without names, and any group under {MIN_GROUP} is hidden.
        </p>
      </main>
    </div>
  )
}
