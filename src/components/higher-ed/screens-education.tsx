// Education Hub (a workforce organization): the region's training in one catalog — universities, third-party providers and what Louisville
// offers itself, including courses NextChapter builds for it — curated here and assigned to people by industry, experience and function.
// Everything about people is a count; a group under five is hidden.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { readLocal } from '@/lib/workforce/local'
import { marketJobs } from '@/lib/workforce/market-jobs'
import { loadSupply } from '@/lib/workforce/skills-supply'
import { MIN_GROUP } from '@/lib/workforce/skills-intel'
import { listOfferings, partnerCollegePrograms } from '@/lib/workforce/training'
import { TRAINING_SOURCES, audienceLine, coveredSkills, reach, sourceLabel } from '@/lib/workforce/training-rules'
import { institutionEntitlements, trialForLock } from '@/lib/plans/entitlements'
import { LockedFeature } from '@/components/plans/LockedFeature'
import { StatTile } from './StatTile'
import { ArchiveOfferingButton, AssignForm, ImportProgramButton, OfferingForm, type OfferingView } from './EducationForms'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const money = (c: number) => (c === 0 ? 'Free' : `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
const pct = (x: number) => `${Math.round(x * 100)}%`

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-labelledby={id}>
      <div>
        <h2 id={id} className="text-base font-semibold">{title}</h2>
        {intro && <p className="max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

export async function EducationCatalog({ ctx, searchParams, base }: Props) {
  const slug = ctx.institution.slug
  const [offerings, programs] = await Promise.all([listOfferings(ctx.institution.id), partnerCollegePrograms(ctx.institution.id).catch(() => [])])
  const source = TRAINING_SOURCES.find((s) => s.key === (searchParams as { source?: string }).source)?.key
  const shown = source ? offerings.filter((o) => o.source === source) : offerings
  const importedIds = new Set(offerings.map((o) => o.programId).filter(Boolean))
  const available = programs.filter((p) => !importedIds.has(p.programId))
  const count = (k: string) => offerings.filter((o) => o.source === k).length
  const edit = !ctx.readOnly
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        All the training your region can point people to, in one place: universities and colleges, third-party providers, and what {ctx.institution.programBrandName ?? ctx.institution.name} offers itself, including courses NextChapter builds for you.
        Curate the catalog here, then assign training to the people it fits.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="In the catalog" value={offerings.length} />
        <StatTile label="Universities and colleges" value={count('UNIVERSITY')} />
        <StatTile label="Third-party" value={count('THIRD_PARTY')} />
        <StatTile label="Offered by Louisville" value={count('LOCAL')} note={offerings.some((o) => o.ncCustom) ? `${offerings.filter((o) => o.ncCustom).length} built by NextChapter` : undefined} />
      </div>

      <nav aria-label="Filter by source" className="flex flex-wrap gap-2">
        {[{ key: undefined, label: 'All' }, ...TRAINING_SOURCES].map((s) => (
          <a key={s.key ?? 'all'} href={s.key ? `${base}/catalog?source=${s.key}` : `${base}`} aria-current={source === s.key ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm font-medium ${source === s.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'}`}>
            {s.label}
          </a>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {offerings.length === 0 ? 'Nothing in the catalog yet. Add the first training below, or pull in a program from a partner college.' : 'Nothing from this source yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {shown.map((o) => (
            <li key={o.id} className="space-y-1 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-72">
                  <p className="font-medium">
                    {o.url ? <a href={o.url} target="_blank" rel="noreferrer" className="hover:underline">{o.title}</a> : o.title}
                    {o.assignment === 'ASSIGNED' && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Assigned</span>}
                    {o.ncCustom && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Built by NextChapter for this region</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[sourceLabel(o.source), o.provider, o.hours ? `${o.hours} hours` : null, money(o.priceCents), o.wioaEligible ? 'Can be paid by the workforce board' : null].filter(Boolean).join(' · ')}
                  </p>
                  {o.summary && <p className="text-sm text-muted-foreground">{o.summary}</p>}
                  {o.skills.length > 0 && <p className="text-xs text-muted-foreground">Builds: {o.skills.join(', ')}</p>}
                  <p className="text-xs text-muted-foreground">{audienceLine(o)}</p>
                </div>
                {edit && <ArchiveOfferingButton slug={slug} id={o.id} title={o.title} />}
              </div>
              {edit && (
                <details className="pt-1">
                  <summary className="cursor-pointer text-sm font-medium text-primary">Edit</summary>
                  <div className="pt-3"><OfferingForm slug={slug} offering={o as OfferingView} /></div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      {edit && (
        <>
          <Section id="add-h" title="Add training">
            <details className="rounded-lg border border-border bg-card p-4" open={offerings.length === 0}>
              <summary className="cursor-pointer text-sm font-medium text-primary">Add a training to the catalog</summary>
              <div className="pt-3"><OfferingForm slug={slug} /></div>
            </details>
          </Section>
          <Section id="colleges-h" title="From your partner colleges" intro="Programs your confirmed partner colleges offer. Add the ones you want people pointed to.">
            {available.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                {programs.length === 0 ? 'No partner college has programs here yet. Confirm a college under Partners, and its programs show here.' : 'Every program from your partner colleges is already in the catalog.'}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {available.map((p) => (
                  <li key={p.programId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{[p.college, p.credential, p.hours ? `${p.hours} hours` : null, money(p.priceCents)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <ImportProgramButton slug={slug} programId={p.programId} name={p.name} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

export async function EducationAssign({ ctx }: Props) {
  const slug = ctx.institution.slug
  const allowed = institutionEntitlements({ plan: ctx.institution.plan }).trainingAssign
  const [offerings, people] = await Promise.all([listOfferings(ctx.institution.id), allowed ? loadSupply(ctx.institution.id).catch(() => []) : Promise.resolve([])])
  const who = people.map((p) => ({ industry: p.industry, function: p.function, level: p.level, years: p.years }))
  const assigned = offerings.filter((o) => o.assignment === 'ASSIGNED')
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Choose who each training is for by industry, experience and function. It then appears in Learn for the people it fits, with who chose it and why. People are counted without names, and a group under {MIN_GROUP} shows as “fewer than {MIN_GROUP}”.
      </p>
      {!allowed && <LockedFeature feature="trainingAssign" slug={slug} plan={ctx.institution.plan} trial={trialForLock(ctx.institution)} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Assigned now" value={assigned.length} />
        <StatTile label="Listed only" value={offerings.length - assigned.length} />
        <StatTile label="People in your group" value={allowed ? (people.length >= MIN_GROUP ? people.length.toLocaleString() : `<${MIN_GROUP}`) : '—'} />
      </div>
      {offerings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Add training to the catalog first, then assign it here.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {offerings.map((o) => {
            const n = allowed ? reach(who, o) : null
            return (
              <li key={o.id} className="space-y-1 p-4">
                <p className="font-medium">{o.title}</p>
                <p className="text-xs text-muted-foreground">
                  {sourceLabel(o.source)} · {o.assignment === 'ASSIGNED' ? 'Assigned' : 'Listed only'} · {audienceLine(o)}
                  {allowed && o.assignment === 'ASSIGNED' ? ` · reaches ${n === null ? `fewer than ${MIN_GROUP}` : n.toLocaleString()} ${n === 1 ? 'person' : 'people'}` : ''}
                </p>
                {allowed && !ctx.readOnly && (
                  <details className="pt-1">
                    <summary className="cursor-pointer text-sm font-medium text-primary">Choose who it is for</summary>
                    <div className="pt-3"><AssignForm slug={slug} offering={o as OfferingView} /></div>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export async function EducationGaps({ ctx, base }: Props) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const local = readLocal(inst.enabledFeatures)
  const [market, offerings] = await Promise.all([local ? marketJobs(local.anchorCity, local.anchorState).catch(() => null) : Promise.resolve(null), listOfferings(ctx.institution.id)])
  const covered = coveredSkills(offerings)
  const rows = (market?.skills ?? []).slice(0, 14).map((s) => ({ ...s, trainings: covered.get(s.skill.toLowerCase()) ?? 0 }))
  const missing = rows.filter((r) => r.trainings === 0)
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        What local employers ask for, set against the training in your catalog. A skill with no training is the next thing to find, fund or build, including as a custom course.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Postings read" value={market ? market.sampled.toLocaleString() : '—'} note={market ? `Newest in ${local?.anchorCity}` : 'Set your region to read postings'} />
        <StatTile label="Skills with training" value={rows.length - missing.length} note={`of ${rows.length} in demand`} />
        <StatTile label="Skills with none yet" value={missing.length} />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No postings with descriptions found for this region yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>{['Skill', 'In demand', 'Training in your catalog'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.skill} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.skill}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.share)} <span className="text-xs text-muted-foreground">({r.postings} postings)</span></td>
                  <td className="px-3 py-2">{r.trainings > 0 ? `${r.trainings} ${r.trainings === 1 ? 'training' : 'trainings'}` : <a href={base} className="font-medium text-primary hover:underline">None yet: add or build one</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
