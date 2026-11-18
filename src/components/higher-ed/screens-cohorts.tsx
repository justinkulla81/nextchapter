// Talent Hub › People › Cohorts: groups of people defined by a rule, with their size and mix as anonymous counts and the updates posted to them.
// A cohort never shows a name; a size under five reads "fewer than five".

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { loadSupply } from '@/lib/workforce/skills-supply'
import { MIN_GROUP } from '@/lib/workforce/skills-intel'
import { canStartCohort, cohortStats, ruleLine } from '@/lib/workforce/talent-cohorts'
import { institutionEntitlements, trialForLock } from '@/lib/plans/entitlements'
import { LockedFeature } from '@/components/plans/LockedFeature'
import { StatTile } from './StatTile'
import { CohortPostForm, DeleteCohortButton, NewCohortForm } from './CohortForms'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const when = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d))

export async function HubCohorts({ ctx }: Props) {
  const slug = ctx.institution.slug
  const ent = institutionEntitlements({ plan: ctx.institution.plan })
  const [cohorts, people] = await Promise.all([
    prisma.talentCohort.findMany({
      where: { institutionId: ctx.institution.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true, name: true, purpose: true, industries: true, functions: true, levels: true, minWeeksOut: true, posts: { orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, body: true, authorLabel: true, createdAt: true } } },
    }),
    loadSupply(ctx.institution.id).catch(() => []),
  ])
  const room = canStartCohort(ent.cohortLimit, cohorts.length)
  const canPost = ent.cohortLimit === null
  const edit = !ctx.readOnly
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        A cohort is a group of people defined by a rule, such as operations managers, or anyone out of work 26 weeks or more. It fills on its own as people who fit join. You see its size and mix as counts, never names, and a group under {MIN_GROUP} shows as “fewer than {MIN_GROUP}”. Updates you post appear in the Learn page of the people in it.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Cohorts" value={cohorts.length} />
        <StatTile label="People in your group" value={people.length >= MIN_GROUP ? people.length.toLocaleString() : `<${MIN_GROUP}`} />
        <StatTile label="Updates posted" value={cohorts.reduce((n, c) => n + c.posts.length, 0)} note="Latest three per cohort" />
      </div>
      {edit &&
        (room.allowed ? (
          <details className="rounded-lg border border-border bg-card p-4" open={cohorts.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-primary">Start a cohort</summary>
            <div className="pt-3"><NewCohortForm slug={slug} /></div>
          </details>
        ) : (
          <LockedFeature feature="talentCohorts" slug={slug} plan={ctx.institution.plan} trial={trialForLock(ctx.institution)} compact />
        ))}
      {cohorts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No cohorts yet. Start one for each group of people you want to reach differently.</p>
      ) : (
        <ul className="space-y-4">
          {cohorts.map((c) => {
            const stats = cohortStats(people, c)
            return (
              <li key={c.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{ruleLine({ industries: c.industries, functions: c.functions, levels: c.levels, minWeeksOut: c.minWeeksOut })}</p>
                    {c.purpose && <p className="text-sm text-muted-foreground">{c.purpose}</p>}
                  </div>
                  <p className="text-sm tabular-nums">
                    {stats.size === null ? `Fewer than ${MIN_GROUP}` : stats.size.toLocaleString()} {stats.size === 1 ? 'person' : 'people'}
                  </p>
                </div>
                {(stats.byFunction.length > 0 || stats.byBand.length > 0) && (
                  <p className="text-xs text-muted-foreground">
                    {[...stats.byFunction.filter((x) => x.n !== null).map((x) => `${x.label} ${x.n}`), ...stats.byBand.filter((x) => x.n !== null).map((x) => `${x.label} ${x.n}`)].join(' · ')}
                  </p>
                )}
                {c.posts.length > 0 && (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {c.posts.map((p) => (
                      <li key={p.id} className="space-y-0.5 p-3 text-sm">
                        <p className="whitespace-pre-line">{p.body}</p>
                        <p className="text-xs text-muted-foreground">{p.authorLabel} · {when(p.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {edit && (
                  <div className="space-y-3">
                    {canPost ? <CohortPostForm slug={slug} cohortId={c.id} /> : <LockedFeature feature="talentCohorts" slug={slug} plan={ctx.institution.plan} trial={trialForLock(ctx.institution)} compact />}
                    <DeleteCohortButton slug={slug} cohortId={c.id} name={c.name} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
