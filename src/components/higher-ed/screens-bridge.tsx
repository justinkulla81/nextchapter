// The skills bridge. Members: on the Learn tab, the skills their target jobs
// ask for that they don't show yet, each with the college's offerings that
// teach it. Staff (Lifelong Learning, Career Services): counts of what alumni
// need, what has no offering yet, and which offerings were followed by jobs.

import Link from 'next/link'
import { ArrowRight, GraduationCap } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { bridgeReport, memberBridge, type BridgeOffering } from '@/lib/higher-ed/skills-bridge'
import { MIN_CELL_SIZE } from '@/lib/admin/cell-suppression'
import { EmptyState } from '@/components/ui/empty-state'
// share is already a percentage (0 to 100), from the skills market snapshot.
import { fmtPct } from '@/lib/skills/market'
import { AddToPlanButton } from '@/components/dashboard/learning/PlanControls'
import { SITE_URL } from '@/lib/reports'

type Props = { ctx: WorkspaceContext; base: string }

const EMPTY = {
  'no-function': { title: 'Tell us the work you do', description: 'Add your field to your NextChapter profile and your bridge appears here.' },
  'no-skills': { title: 'Add your résumé first', description: 'Your bridge compares your résumé’s skills with what jobs in your field ask for.' },
  'no-data': { title: 'Not enough job data for your field yet', description: 'We show a bridge once enough open jobs in your field list their skills.' },
} as const
const KIND: Record<BridgeOffering['kind'], string> = { program: 'Program', audit: 'Audit a course', service: 'Offering' }

export async function SkillsBridgeSection({ ctx }: Props) {
  if (!ctx.memberId) return null
  const slug = ctx.institution.slug
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const [bridge, member] = await Promise.all([
    memberBridge({ institution: { id: ctx.institution.id, slug }, memberId: ctx.memberId, enabledFeatures: row.enabledFeatures }),
    prisma.institutionMember.findUnique({ where: { id: ctx.memberId }, select: { candidateId: true } }),
  ])
  // Titles already in the alum's own learning plan (at most 12 rows), so a course shows "In your plan" instead of the button.
  const planned = new Set(
    member?.candidateId ? (await prisma.learningPlanEntry.findMany({ where: { candidateId: member.candidateId }, select: { title: true }, take: 50 })).map((e) => e.title) : [],
  )
  const bridgeUrl = (key: string, skill: string) => `${SITE_URL}/i/${slug}/bridge?o=${encodeURIComponent(key)}&s=${encodeURIComponent(skill)}`
  return (
    <section aria-labelledby="bridge-h" className="space-y-3">
      <div>
        <h2 id="bridge-h" className="text-base font-semibold">
          Your skills bridge
        </h2>
        <p className="text-sm text-muted-foreground">The skills jobs in your field ask for that your résumé doesn’t show yet, and what {ctx.institution.name} offers to learn them.</p>
      </div>
      {bridge.state !== 'ready' ? (
        <EmptyState icon={GraduationCap} {...EMPTY[bridge.state]} />
      ) : !bridge.rows.length ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm">
          You already show the skills {bridge.fnLabel} jobs ask for most{bridge.have.length ? `: ${bridge.have.slice(0, 5).join(', ')}` : ''}. Nothing to bridge right now.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            From {bridge.basis.toLocaleString()} open {bridge.fnLabel} jobs that list skills. The percentage is the share of them asking for the skill.
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {bridge.rows.map((r) => (
              <li key={r.slug} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
                <div>
                  <p className="font-medium">{r.skill}</p>
                  <p className="text-xs text-muted-foreground">Asked for in {fmtPct(r.share)} of these jobs</p>
                </div>
                {r.offerings.length ? (
                  <ul className="space-y-1">
                    {r.offerings.map((o) => (
                      <li key={o.key}>
                        <Link href={`/i/${slug}/bridge?o=${encodeURIComponent(o.key)}&s=${encodeURIComponent(r.skill)}`} className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                          {o.name}
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {KIND[o.kind]}
                          {o.detail ? ` · ${o.detail}` : ''}
                        </span>
                        {member?.candidateId && (
                          <div className="mt-1">
                            <AddToPlanButton title={o.name} provider={ctx.institution.name} url={bridgeUrl(o.key, r.skill)} slot="more" inPlan={planned.has(o.name)} skill={r.skill} source="skills_bridge" />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{ctx.institution.name} doesn’t offer this one yet. We’ve let them know alumni need it.</p>
                )}
              </li>
            ))}
          </ul>
          {bridge.have.length > 0 && <p className="text-xs text-muted-foreground">You already show: {bridge.have.slice(0, 8).join(', ')}.</p>}
        </>
      )}
    </section>
  )
}

export async function StaffSkillsBridge({ ctx }: Props) {
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const r = await bridgeReport({ id: ctx.institution.id, slug: ctx.institution.slug }, row.enabledFeatures)
  const few = `<${MIN_CELL_SIZE}`
  const untaught = r.needs.filter((n) => !n.hasOffering && n.alumni !== null)
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Each joined alum sees the skills jobs in their field ask for that they don’t show yet, and your offerings that teach them. Here: which skills alumni
        need, which you don’t teach yet, how many plan to learn each, and which offerings were followed by a new job. Planning to learn counts alumni whose own
        learning plan has a planned or started course that teaches the skill. Counts only; groups under {MIN_CELL_SIZE} show as “{few}.” Tag
        what each offering teaches on the program, the audit course, or Admin › Services (“Skills it teaches”).
      </p>

      <section aria-labelledby="sb-next" className="space-y-2">
        <h2 id="sb-next" className="text-base font-semibold">
          What to teach next
        </h2>
        {untaught.length ? (
          <ul className="flex flex-wrap gap-2">
            {untaught.slice(0, 12).map((n) => (
              <li key={n.skill} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm">
                {n.skill} <span className="text-xs text-muted-foreground">· {n.alumni} alumni need it, no offering</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No skill that {MIN_CELL_SIZE} or more alumni need is missing an offering.</p>
        )}
      </section>

      <section aria-labelledby="sb-needs" className="space-y-2">
        <h2 id="sb-needs" className="text-base font-semibold">
          Skills alumni need <span className="text-sm font-normal text-muted-foreground">{r.totalNeeding.toLocaleString()} alumni have seen their bridge</span>
        </h2>
        {r.needs.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Skills alumni need, and whether an offering teaches each</caption>
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  {['Skill', 'Alumni who need it', 'Planning to learn', 'Your offering'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {r.needs.map((n) => (
                  <tr key={n.skill}>
                    <td className="px-4 py-2">{n.skill}</td>
                    <td className="px-4 py-2 tabular-nums">{n.alumni ?? few}</td>
                    <td className="px-4 py-2 tabular-nums">{n.planning ?? few}</td>
                    <td className="px-4 py-2">{n.hasOffering ? 'Yes' : 'None yet'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={GraduationCap} title="No bridges seen yet" description="This fills in as joined alumni open their Learn tab." />
        )}
      </section>

      <section aria-labelledby="sb-offerings" className="space-y-2">
        <h2 id="sb-offerings" className="text-base font-semibold">
          Offerings on the bridge
        </h2>
        {r.offerings.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Offerings tagged with skills: alumni who opened them from the bridge, and how many then reported a new job</caption>
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  {['Offering', 'Kind', 'Opened from the bridge', 'Then reported a new job'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {r.offerings.map((o) => (
                  <tr key={o.key}>
                    <td className="px-4 py-2">{o.name}</td>
                    <td className="px-4 py-2">{KIND[o.kind]}</td>
                    <td className="px-4 py-2 tabular-nums">{o.opened ?? few}</td>
                    <td className="px-4 py-2 tabular-nums">{o.landed ?? few}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={GraduationCap} title="No offering lists its skills yet" description="Add skills to a program, an audit course or a service, and it joins the bridge." />
        )}
        <p className="text-xs text-muted-foreground">
          “Then reported a new job” counts alumni who reported a job after first opening the offering from their bridge. It shows what followed, not what caused it.
        </p>
      </section>
    </div>
  )
}
