// Talent Hub › Market: skills gaps (demand from postings against supply from résumés) and the anonymous talent snapshot.
// Everything about people is a count or a coarse band; any group under five is hidden; no names, no employers, no exact titles.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { readLocal } from '@/lib/workforce/local'
import { marketJobs } from '@/lib/workforce/market-jobs'
import { loadSupply } from '@/lib/workforce/skills-supply'
import { MIN_GROUP, anonymizeCandidates, countBy, gapRows, seniorityBand, weeksBand } from '@/lib/workforce/skills-intel'
import { StatTile } from './StatTile'

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
const shown = (n: number | null) => (n === null ? `<${MIN_GROUP}` : n.toLocaleString('en-US'))

export async function HubSkillsGaps({ ctx }: Props) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const local = readLocal(inst.enabledFeatures)
  const [market, people] = await Promise.all([local ? marketJobs(local.anchorCity, local.anchorState).catch(() => null) : Promise.resolve(null), loadSupply(ctx.institution.id).catch(() => [])])
  const withSkills = people.filter((p) => p.keywords.length > 0)
  const rows = market ? gapRows(market.skills, withSkills) : []
  const enough = withSkills.length >= MIN_GROUP
  const biggest = enough ? [...rows].filter((r) => r.gap !== null).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0] : null
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

      <Section title="Demand against supply" intro="Demand is the share of current local postings that name the skill. Supply is the share of people in your group whose résumé names it. A gap is demand minus supply.">
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
                    <td className="px-3 py-2 tabular-nums">{r.supplyShare === null ? '—' : r.supplyPeople === null ? `<${MIN_GROUP} people` : `${pct(r.supplyShare)} (${shown(r.supplyPeople)} people)`}</td>
                    <td className="px-3 py-2 tabular-nums">{r.gap === null ? '—' : r.gap > 0.005 ? `${Math.max(1, Math.round(r.gap * 100))} ${Math.round(r.gap * 100) <= 1 ? 'point' : 'points'} short` : 'Covered'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <p className="max-w-3xl text-xs text-muted-foreground">
        How this is made: skills are matched against a fixed vocabulary in posting text and in résumé keywords, one count per posting or person. It is a signal, not a ruling on a role. People are counted without names, and any group under {MIN_GROUP} is hidden.
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
