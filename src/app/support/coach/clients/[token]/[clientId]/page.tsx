import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { getPreSessionBrief } from '@/lib/coach/pre-session-brief'
import { GRADE_LABEL } from '@/lib/scoring/grade'
import { LogSessionForm } from '@/components/coach/LogSessionForm'
import { CoachBrandHeader } from '@/components/coach/CoachBrandHeader'

const TREND_LABEL: Record<string, string> = {
  up: '↑ improving',
  down: '↓ declining',
  flat: '→ steady',
}

export default async function PreSessionBriefPage({
  params,
}: {
  params: Promise<{ token: string; clientId: string }>
}) {
  const { token, clientId } = await params

  const coach = await getCoachByToken(token)
  if (!coach) notFound()

  const candidate = await getCoachClient(coach.id, clientId)
  if (!candidate) notFound()

  const brief = await getPreSessionBrief(candidate.id)

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href={`/support/coach/clients/${token}`} className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to clients
      </Link>

      <div className="mt-4 mb-8 space-y-1">
        <CoachBrandHeader firmName={coach.firmName} logoUrl={coach.logoUrl} />
        <p className="text-sm font-medium text-muted-foreground">Pre-Session Brief</p>
        <h1 className="text-2xl font-semibold tracking-tight">{brief.candidateName}</h1>
        <p className="text-muted-foreground">
          {brief.weekNumber !== null ? `Week ${brief.weekNumber} in search` : 'Not yet registered'}
        </p>
      </div>

      <div className="space-y-5">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Market Reality Grade</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {brief.executionGrade ? (
              <>
                {brief.executionGrade} <span className="text-muted-foreground">({GRADE_LABEL[brief.executionGrade]})</span>
                {brief.trend && <span className="ml-2 text-sm text-muted-foreground">{TREND_LABEL[brief.trend]}</span>}
              </>
            ) : (
              'No grade yet'
            )}
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">This week&apos;s actions</p>
          {brief.thisWeekActions.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nothing committed this week yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {brief.thisWeekActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={action.completed ? 'text-brand' : 'text-muted-foreground'}>
                    {action.completed ? '✓' : '○'}
                  </span>
                  <span className={action.completed ? 'text-foreground' : 'text-muted-foreground'}>{action.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {brief.avoidancePattern && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm font-medium text-foreground">Avoidance pattern</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Has committed to &ldquo;{brief.avoidancePattern.actionType}&rdquo; actions {brief.avoidancePattern.weeksAvoided}{' '}
              weeks running without completing one, while completing other action types.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Last mood check-in</p>
          {brief.lastMood ? (
            <p className="mt-1 text-sm text-foreground">
              {brief.lastMood.label} ({brief.lastMood.checkedInAt.toLocaleDateString()})
              {brief.moodPatternNote && <span className="text-muted-foreground"> — {brief.moodPatternNote}</span>}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No check-ins logged yet.</p>
          )}
        </div>

        <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-medium text-foreground">Suggested opening question</p>
          <p className="mt-1 text-sm text-foreground">&ldquo;{brief.suggestedOpeningQuestion}&rdquo;</p>
        </div>

        {(brief.nonNegotiables || brief.biggestWorry) && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">From their Coaching Onboarding Form</p>
            {brief.nonNegotiables && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground">Non-negotiables / constraints</p>
                <p className="text-sm text-foreground">{brief.nonNegotiables}</p>
              </div>
            )}
            {brief.biggestWorry && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground">Biggest worry about the process</p>
                <p className="text-sm text-foreground">{brief.biggestWorry}</p>
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Log this session</p>
          <div className="mt-3">
            <LogSessionForm token={token} clientId={clientId} />
          </div>
        </div>

        <Link
          href={`/support/coach/clients/${token}/${clientId}/full`}
          className="inline-block text-sm font-medium text-brand underline underline-offset-4"
        >
          View full client profile →
        </Link>
      </div>
    </div>
  )
}
