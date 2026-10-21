import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCoachByToken } from '@/lib/coach/access'
import { getCoachClientSummaries } from '@/lib/coach/client-summary'
import { getCoachCaseload } from '@/lib/coach/caseload'
import { GRADE_LABEL } from '@/lib/scoring/grade'
import { CoachBrandHeader } from '@/components/coach/CoachBrandHeader'
import { getParallelPathsFor } from '@/lib/job-reviews/data'
import { parallelPathView } from '@/lib/job-reviews/constants'

const SENTIMENT_TREND_ARROW: Record<'up' | 'down', string> = { up: '↑', down: '↓' }

// One page for a coach's clients (formerly "Your clients" and "Caseload"):
// stalled clients first, each row with grade, Market Reality, activity and
// sentiment at a glance; open a row for profile details and the brief.
const TREND_LABEL: Record<string, string> = {
  up: '↑ improving',
  down: '↓ declining',
  flat: '→ steady',
}

export default async function CoachClientsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const coach = await getCoachByToken(token)

  if (!coach) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">This link isn&apos;t valid</h1>
        <p className="mt-2 text-muted-foreground">Double check the link you were sent.</p>
      </div>
    )
  }

  const [clients, caseload, clientProfiles] = await Promise.all([
    getCoachClientSummaries(coach.id),
    getCoachCaseload(coach.id),
    prisma.candidateProfile.findMany({
      where: { coachId: coach.id },
      select: {
        id: true,
        targetRoleType: true,
        primaryFunction: true,
        highestLevelReached: true,
        targetIndustries: true,
      },
    }),
  ])
  const glance = new Map(caseload.map((c) => [c.id, c]))
  const stalled = caseload.filter((c) => c.isStalled)
  const profileById = new Map(clientProfiles.map((p) => [p.id, p]))
  const pathsById = await getParallelPathsFor(clientProfiles.map((p) => p.id))

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {coach.functions.length === 0 && coach.skills.length === 0 && coach.coachingStyles.length === 0 && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium text-foreground">Tell members how you coach</p>
          <p className="mt-1 text-muted-foreground">
            Members now ask for a coach who pushes them, supports them or holds them accountable, and are matched on
            function, level and skills too. Add yours so the right people are sent to you.{' '}
            <Link href={`/support/coach/settings/${token}`} className="font-medium text-foreground underline underline-offset-4">
              Add your specialties
            </Link>
          </p>
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <CoachBrandHeader firmName={coach.firmName} logoUrl={coach.logoUrl} />
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            {clients.length === 0
              ? 'No clients yet. Invite someone you coach, or share your invite link.'
              : `${clients.length} client${clients.length === 1 ? '' : 's'} on NextChapter. Open a row for their profile and pre-session brief.`}
          </p>
        </div>
        <Link
          href={`/support/coach/settings/${token}`}
          className="shrink-0 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Practice settings
        </Link>
      </div>

      {stalled.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {stalled.length} client{stalled.length > 1 ? 's' : ''} showing an avoidance pattern: {stalled.map((c) => c.name).join(', ')}.
          </p>
        </div>
      )}

      {clients.length === 0 && (
        <Link href="/support/coach/invite-client" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Invite a client
        </Link>
      )}

      <div className="space-y-3">
        {[...clients].sort((a, b) => Number(!!glance.get(b.id)?.isStalled) - Number(!!glance.get(a.id)?.isStalled)).map((client) => {
          const detail = profileById.get(client.id)
          const g = glance.get(client.id)
          return (
            <details key={client.id} className="group rounded-lg border border-border p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{client.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.weekNumber !== null ? `Week ${client.weekNumber}` : 'Not yet registered'}
                    {client.lastActiveAt && ` · Last active ${client.lastActiveAt.toLocaleDateString()}`}
                    {g?.isStalled && ' · Avoidance pattern flagged'}
                  </p>
                  {g && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Market Reality {g.marketRealityGrade ?? '—'} · {g.activityThisWeekPoints} pts this wk, {g.activityLastWeekPoints} last wk · {g.sentimentLabel ?? 'No check-ins'}
                      {g.sentimentTrend && ` ${SENTIMENT_TREND_ARROW[g.sentimentTrend]}`}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right text-sm">
                    {client.executionGrade ? (
                      <p className="font-medium text-foreground">
                        {client.executionGrade}{' '}
                        <span className="text-muted-foreground">
                          ({GRADE_LABEL[client.executionGrade]})
                        </span>
                      </p>
                    ) : (
                      <p className="text-muted-foreground">No grade yet</p>
                    )}
                    {client.trend && (
                      <p className="text-xs text-muted-foreground">{TREND_LABEL[client.trend]}</p>
                    )}
                  </div>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                </div>
              </summary>
              <div className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {detail?.targetRoleType && <p>Targeting: {detail.targetRoleType}</p>}
                {detail?.primaryFunction && <p>Function: {detail.primaryFunction}</p>}
                {detail?.highestLevelReached && <p>Level: {detail.highestLevelReached}</p>}
                {detail && detail.targetIndustries.length > 0 && (
                  <p>Industries: {detail.targetIndustries.join(', ')}</p>
                )}
                <AlongsideLine paths={pathsById.get(client.id) ?? null} />
                {!detail?.targetRoleType && !detail?.primaryFunction && !detail?.highestLevelReached && (
                  <p>Profile still being built out.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <Link
                    href={`/support/coach/clients/${token}/${client.id}`}
                    className="inline-block text-sm font-medium text-brand underline underline-offset-4"
                  >
                    View pre-session brief →
                  </Link>
                  <Link
                    href={`/support/coach/clients/${token}/${client.id}/full`}
                    className="inline-block text-sm font-medium text-brand underline underline-offset-4"
                  >
                    Full client view →
                  </Link>
                </div>
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}

// "Alongside the search: …" — what the client does besides looking for a job.
function AlongsideLine({ paths }: { paths: string[] | null }) {
  const view = parallelPathView(paths)
  if (view.state === 'unanswered') return <p>Alongside the search: not answered yet</p>
  if (view.state === 'none') return <p>Alongside the search: nothing</p>
  return <p>Alongside the search: {view.labels.join(', ')}</p>
}
