// Talent Hub › Market: skills gaps (demand from postings against supply from résumés) and the anonymous talent snapshot.
// Everything about people is a count or a coarse band; any group under five is hidden; no names, no employers, no exact titles.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { readLocal } from '@/lib/workforce/local'
import { marketJobs } from '@/lib/workforce/market-jobs'
import { loadSupply } from '@/lib/workforce/skills-supply'
import { MIN_GROUP, anonymizeCandidates, countBy, gapRows, planningCounts, seniorityBand, weeksBand } from '@/lib/workforce/skills-intel'
import { StatTile } from './StatTile'
import { LockedFeature } from '@/components/plans/LockedFeature'
import { institutionEntitlements, trialForLock } from '@/lib/plans/entitlements'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

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

const pct = (x: number) => `${Math.round(x * 100)}%`
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const shown = (n: number | null) => (n === null ? `<${MIN_GROUP}` : n.toLocaleString('en-US'))

export async function HubSkillsGaps({ ctx, base }: Props) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const local = readLocal(inst.enabledFeatures)
  const [market, people, programs] = await Promise.all([
    local ? marketJobs(local.anchorCity, local.anchorState).catch(() => null) : Promise.resolve(null),
    loadSupply(ctx.institution.id).catch(() => []),
    // The organization's own programs, to match each gap to what teaches it (a handful of rows).
    prisma.program.findMany({
      where: { institutionId: ctx.institution.id, isActive: true },
      select: { id: true, name: true, skills: true, wioaEligible: true, priceCents: true, cohorts: { where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } } },
    }),
  ])
  // The free plan sees the first few skills in full; the rest, and the retraining plan, are a preview (owner decision 2026-11-17).
  const freeRows = institutionEntitlements({ plan: ctx.institution.plan }).visibleSkillRows
  const withSkills = people.filter((p) => p.keywords.length > 0)
  const rows = market ? gapRows(market.skills, withSkills) : []
  const planning = planningCounts(people)
  const planningCell = (skill: string) => (planning.size === 0 ? '—' : !planning.has(skill) ? 'None' : planning.get(skill) === null ? `<${MIN_GROUP} people` : `${shown(planning.get(skill) as number)} people`)
  const enough = withSkills.length >= MIN_GROUP
  const biggest = enough ? [...rows].filter((r) => r.gap !== null).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0] : null
  // The five largest shortfalls, each with how many people lack it (hidden under MIN_GROUP) and the programs that teach it.
  const teaches = (skill: string) =>
    programs
      .filter((pg) => pg.skills.some((k) => k.toLowerCase() === skill.toLowerCase()) || pg.name.toLowerCase().includes(skill.toLowerCase()))
      .map((pg) => ({ id: pg.id, name: pg.name, priceCents: pg.priceCents, wioaEligible: pg.wioaEligible, next: pg.cohorts[0]?.startsAt ?? null }))
  const retrain = enough
    ? [...rows]
        .filter((r) => r.gap !== null && r.gap > 0.005)
        .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
        .slice(0, 5)
        .map((r) => {
          // When fewer than MIN_GROUP people have the skill their count is hidden, so the lacking count is a floor.
          const lack = r.supplyPeople === null ? withSkills.length - (MIN_GROUP - 1) : withSkills.length - r.supplyPeople
          const label = lack < MIN_GROUP ? `<${MIN_GROUP}` : `${lack.toLocaleString('en-US')}${r.supplyPeople === null ? ' or more' : ''}`
          return { skill: r.skill, demand: r.demandShare, lacking: label, teach: teaches(r.skill) }
        })
    : []
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        What local employers ask for, what the people you serve show on their résumés, and the gap. Use it to decide where to put money and cohorts, what colleges should teach, and where employers can find depth.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Postings read" value={market ? market.sampled.toLocaleString() : '—'} note={market ? `Newest in ${local?.anchorCity}` : 'Set your region to read postings'} />
        <StatTile label="People with résumé skills" value={enough ? withSkills.length.toLocaleString() : `<${MIN_GROUP}`} note="In your group, counted anonymously" />
        <StatTile label="Skills compared" value={rows.length} />
        <StatTile label="Largest gap" value={biggest ? biggest.skill : '—'} note={biggest && biggest.gap !== null ? `${Math.round(biggest.gap * 100)} ${Math.round(biggest.gap * 100) === 1 ? 'point' : 'points'} more demand than supply` : undefined} />
      </div>

      <Section title="Demand against supply" intro="Demand is the share of current local postings that name the skill. Supply is the share of people in your group whose résumé names it. A gap is demand minus supply. Planning to learn counts people whose own learning plan has a planned or started course that teaches the skill.">
        {!market || rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No postings with descriptions found for this region yet.</p>
        ) : !enough ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Supply appears once at least {MIN_GROUP} people in your group have résumé skills. Until then only demand is shown.
          </p>
        ) : null}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Skill', 'Demand', 'Supply', 'Gap', 'Planning to learn'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(freeRows === null ? rows : rows.slice(0, freeRows)).map((r) => (
                  <tr key={r.skill} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.skill}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {pct(r.demandShare)} <span className="text-xs text-muted-foreground">({r.demandPostings} postings)</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.supplyShare === null ? '—' : r.supplyPeople === null ? `<${MIN_GROUP} people` : `${pct(r.supplyShare)} (${shown(r.supplyPeople)} people)`}</td>
                    <td className="px-3 py-2 tabular-nums">{r.gap === null ? '—' : r.gap > 0.005 ? `${Math.max(1, Math.round(r.gap * 100))} ${Math.round(r.gap * 100) <= 1 ? 'point' : 'points'} short` : 'Covered'}</td>
                    <td className="px-3 py-2 tabular-nums">{planningCell(r.skill)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {freeRows !== null && rows.length > freeRows && (
          <div className="relative">
            <ul aria-hidden="true" className="pointer-events-none divide-y divide-border rounded-lg border border-border bg-card blur-sm select-none">
              {rows.slice(freeRows, freeRows + 4).map((r) => (
                <li key={r.skill} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                  <span className="font-medium">{r.skill}</span>
                  <span className="tabular-nums text-muted-foreground">00% · 00% · 00 points short</span>
                </li>
              ))}
            </ul>
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <LockedFeature feature="skillsGaps" slug={ctx.institution.slug} plan={ctx.institution.plan} trial={trialForLock(ctx.institution)} compact />
            </div>
          </div>
        )}
        {freeRows !== null && rows.length > freeRows && <p className="text-sm font-medium">{(rows.length - freeRows).toLocaleString()} more skills compared, and the retraining that closes each gap.</p>}
      </Section>
      {freeRows === null && enough && retrain.length > 0 && (
        <Section title="Retraining to close the gaps" intro="The largest shortfalls, how many people in your group lack each skill, and which of your programs teach it. A skill no program teaches is the gap to fund next.">
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {retrain.map((r) => (
              <li key={r.skill} className="grid gap-2 p-4 sm:grid-cols-[14rem_1fr]">
                <div>
                  <p className="font-medium">{r.skill}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.lacking} people lack it · in {pct(r.demand)} of local postings
                  </p>
                </div>
                {r.teach.length ? (
                  <ul className="space-y-1 text-sm">
                    {r.teach.map((pg) => (
                      <li key={pg.id}>
                        <a href={`${base}/programs`} className="font-medium hover:underline">
                          {pg.name}
                        </a>
                        <span className="text-muted-foreground">
                          {' '}
                          · {pg.priceCents === 0 ? 'free' : pg.wioaEligible ? 'can be paid by the workforce board' : 'paid'}
                          {pg.next ? ` · next cohort ${dayFmt.format(pg.next)}` : ' · no cohort scheduled'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No program of yours teaches this yet.{' '}
                    <a href={`${base}/programs`} className="font-medium text-primary hover:underline">
                      Add one in Programs
                    </a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="max-w-3xl text-xs text-muted-foreground">
        How this is made: skills are matched against a fixed vocabulary in posting text and in résumé keywords, one count per posting or person. It is a signal, not a ruling on a role. Learning plans are counted the same way, from the skills a planned or started course names. People are counted without names, and any group under {MIN_GROUP} is hidden.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubTalent({ ctx }: Props) {
  const people = await loadSupply(ctx.institution.id).catch(() => [])
  const withFn = people.filter((p) => p.function)
  const byFunction = countBy(withFn, (p) => p.function)
  const bySeniority = countBy(people, (p) => seniorityBand(p.level, p.years))
  const byWeeks = countBy(people, (p) => weeksBand(p.weeksOut))
  const { profiles, hidden } = anonymizeCandidates(people, `${ctx.institution.id}:${new Date().toISOString().slice(0, 10)}`)
  const optedIn = people.filter((p) => p.dossier).length
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        The talent in your group, with no names: by function, seniority and time out of work, and a few de-identified profiles. Employers and colleges can see this to understand the talent here. Anyone who wants to reach a person sends an introduction request, and the person decides.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="People in the snapshot" value={people.length >= MIN_GROUP ? people.length.toLocaleString() : `<${MIN_GROUP}`} />
        <StatTile label="Chose to share a profile" value={optedIn >= MIN_GROUP ? optedIn.toLocaleString() : `<${MIN_GROUP}`} note="Only these can appear as a profile" />
        <StatTile label="Out of work 26 weeks or more" value={shown(byWeeks.find((w) => w.label === '26 weeks or more out')?.n ?? null)} />
        <StatTile label="Functions represented" value={byFunction.filter((f) => f.n !== null).length} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          ['By function', byFunction],
          ['By seniority', bySeniority],
          ['Time out of work', byWeeks],
        ].map(([title, list]) => (
          <Section key={title as string} title={title as string}>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
              {(list as ReturnType<typeof countBy>).length === 0 ? (
                <li className="px-3 py-2 text-muted-foreground">Not enough people yet.</li>
              ) : (
                (list as ReturnType<typeof countBy>).map((x) => (
                  <li key={x.label} className="flex justify-between px-3 py-2">
                    <span>{x.label}</span>
                    <span className="tabular-nums text-muted-foreground">{shown(x.n)}</span>
                  </li>
                ))
              )}
            </ul>
          </Section>
        ))}
      </div>

      <Section title="De-identified profiles" intro={`Candidate A, B, C: coarse fields only. A profile appears only if the person chose to share it and at least ${MIN_GROUP} people share their function and seniority, so a rare combination cannot point to one person. Letters are reshuffled daily.`}>
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
    </div>
  )
}
