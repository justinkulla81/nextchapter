// Admin › Impact by office (owner, 2026-11-21): one report, scoped to the whole university, a school or a department,
// showing what each office did for alumni in the last 12 months. Staff of one school or department see only theirs.

import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { officeImpact, impactScopes, shown } from '@/lib/higher-ed/office-impact'
import { officeNamesOf, getWorkspace } from '@/lib/higher-ed/workspaces'
import { readProfile } from '@/lib/higher-ed/profile'
import { StatTile } from './StatTile'
import { SubmitButton } from '@/components/ui/submit-button'

type Props = { ctx: WorkspaceContext; searchParams: Record<string, string | string[] | undefined> }

const enc = (school: string | null, department: string | null) => (school ? `${school}::${department ?? ''}` : '')
const dec = (v: string | undefined) => {
  if (!v) return { school: null, department: null }
  const [school, department] = v.split('::')
  return { school: school || null, department: department || null }
}

export async function AdminImpact({ ctx, searchParams }: Props) {
  const id = ctx.institution.id
  const units = ctx.units ?? null
  // A school's or department's own staff choose among their units only; whole-institution staff among every school and department.
  const options = units?.length
    ? units.map((u) => ({ value: enc(u.school, u.department), label: u.name }))
    : [
        { value: '', label: `All of ${ctx.institution.name}` },
        ...(await impactScopes(id)).map((s) => ({ value: enc(s.school, s.department), label: s.department ? `${s.school} › ${s.department}` : s.school })),
      ].filter((o, i, all) => all.findIndex((x) => x.value === o.value) === i)
  const asked = typeof searchParams.scope === 'string' ? searchParams.scope : ''
  const chosen = options.find((o) => o.value === asked) ?? options[0]
  const scope = dec(chosen?.value)
  const [r, inst] = await Promise.all([
    officeImpact(id, scope),
    prisma.institution.findUnique({ where: { id }, select: { enabledFeatures: true, profile: true } }),
  ])
  const names = officeNamesOf(inst?.enabledFeatures)
  const office = (key: string) => names[key] ?? getWorkspace(key)?.label ?? key
  const ventures = readProfile(inst?.profile).college?.entrepreneurshipCenter?.name ?? office('ventures')
  const pct = (a: number, b: number) => (b >= 20 && a >= 5 ? `${Math.round((a / b) * 100)}%` : null)
  const participation = pct(r.development.donors, r.alumni)

  const sections: { title: string; why: string; tiles: { label: string; value: string; note?: string }[] }[] = [
    {
      title: office('career'),
      why: 'Alumni who asked for help, and what happened next.',
      tiles: [
        { label: 'Answered a check-in', value: shown(r.career.answered) },
        { label: 'Asked for help (looking or laid off)', value: shown(r.career.askedHelp) },
        { label: 'On an advisor’s caseload', value: shown(r.career.onCaseload) },
        { label: 'Reported a new job', value: shown(r.career.landed), note: r.career.saidHelped ? `${shown(r.career.saidHelped)} said ${ctx.institution.name} helped` : undefined },
      ],
    },
    {
      title: office('alumni'),
      why: 'Alumni reached, and alumni helping each other.',
      tiles: [
        { label: 'Joined the portal', value: shown(r.joined), note: pct(r.joined, r.alumni) ? `${pct(r.joined, r.alumni)} of ${r.alumni.toLocaleString()} alumni` : undefined },
        { label: 'At an employer with a layoff notice', value: shown(r.alumniOffice.layoffMatched) },
        { label: 'Mentors who take calls', value: shown(r.alumniOffice.mentors) },
      ],
    },
    {
      title: office('development'),
      why: 'Giving, and the alumni Development leaves alone while they search.',
      tiles: [
        { label: 'Alumni donors', value: shown(r.development.donors), note: participation ? `${participation} participation` : undefined },
        { label: 'Gave after saying the college helped', value: shown(r.development.donorsHelped) },
        { label: 'Prospect signals (new jobs, promotions)', value: shown(r.development.signals) },
        { label: 'Asks paused during a search', value: shown(r.development.paused) },
      ],
    },
    {
      title: office('execed'),
      why: 'Skills alumni need, and the programs they opened.',
      tiles: [
        { label: 'Alumni with a skills gap', value: shown(r.learning.needGap) },
        { label: 'Opened a program for their gap', value: shown(r.learning.opened) },
        { label: 'Applied or enrolled', value: shown(r.learning.enrolled) },
      ],
    },
    { title: ventures, why: 'Alumni starting or running a company who told the college.', tiles: [{ label: 'Founders and would-be founders', value: shown(r.ventures.founders) }] },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          What each office did for {chosen?.label === `All of ${ctx.institution.name}` || !chosen ? 'your alumni' : `${chosen.label} alumni`} in the last 12 months. Counts only; groups under five are not shown exactly.
        </p>
        {options.length > 1 && (
          <form method="get" className="flex items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="impact-scope" className="text-xs font-medium">
                Show
              </label>
              <select id="impact-scope" name="scope" defaultValue={chosen?.value ?? ''} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                {options.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton size="sm" variant="outline" pendingLabel="Loading…">
              Show report
            </SubmitButton>
          </form>
        )}
      </div>
      {sections.map((s) => (
        <section key={s.title} aria-labelledby={`impact-${s.title}`} className="space-y-3">
          <div>
            <h2 id={`impact-${s.title}`} className="text-base font-semibold">
              {s.title}
            </h2>
            <p className="text-sm text-muted-foreground">{s.why}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {s.tiles.map((t) => (
              <StatTile key={t.label} label={t.label} value={t.value} note={t.note} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
