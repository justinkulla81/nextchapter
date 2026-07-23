import type { CoachingNotes } from '@/lib/coach/coaching-notes'
import { MotivationChart } from '@/components/dashboard/MotivationChart'
import { MarketRealityTrendChart } from '@/components/dashboard/MarketRealityTrendChart'

const SENTIMENT_ALERT_REASON_TEXT: Record<'low_average' | 'declining_trend', string> = {
  low_average: "their mood check-ins have run mostly \"Stuck\" over the last two weeks",
  declining_trend: 'their mood check-ins have been trending down over the last two weeks',
}

// Coach-only panel (Prompt 54) — deliberately broader than the external
// Executive Dossier ever shows. In-app only: no download, export, print, or
// forward affordance anywhere in this component or its parent page.
export function CoachingNotesPanel({ notes }: { notes: CoachingNotes }) {
  return (
    <div className="space-y-5">
      {notes.sentimentAlert.lowSentiment && notes.sentimentAlert.reason && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-semibold text-foreground">Sentiment flag</p>
          <p className="mt-1 text-sm text-foreground">
            Worth a check-in: {SENTIMENT_ALERT_REASON_TEXT[notes.sentimentAlert.reason]}.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Sentiment trend</p>
          <div className="mt-2">
            <MotivationChart baseline={null} history={notes.moodHistory} />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Market Reality Grade trend</p>
          <div className="mt-2">
            <MarketRealityTrendChart snapshots={notes.marketRealityTrend} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Disclosure &amp; network history</p>
        <dl className="mt-2 grid gap-2 text-sm">
          {notes.publicDisclosureComfortLabel && (
            <div>
              <dt className="text-muted-foreground">Public disclosure comfort</dt>
              <dd className="text-foreground">{notes.publicDisclosureComfortLabel}</dd>
            </div>
          )}
          {notes.hasBeenReferredBefore !== null && (
            <div>
              <dt className="text-muted-foreground">Networked/referred into a job before</dt>
              <dd className="text-foreground">
                {notes.hasBeenReferredBefore ? 'Yes' : 'No'}
                {notes.referralRecencyLabel ? ` — ${notes.referralRecencyLabel}` : ''}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Compensation</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Last/current salary</dt>
            <dd className="text-foreground tabular-nums">
              {notes.lastSalary ? `$${notes.lastSalary.toLocaleString()}` : 'Not given'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Target/expected</dt>
            <dd className="text-foreground tabular-nums">
              {notes.targetCompMin ? `$${notes.targetCompMin.toLocaleString()}+` : 'Not given'}
            </dd>
          </div>
        </dl>
      </div>

      {notes.financialPressureContext && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Financial pressure context</p>
          <p className="mt-1 text-sm text-foreground">{notes.financialPressureContext}</p>
        </div>
      )}

      {notes.gapAnalysis && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Full Gap Analysis (unfiltered)</p>
          <p className="mt-1 text-sm text-muted-foreground">Targeting: {notes.gapAnalysis.targetRole}</p>
          <ul className="mt-2 space-y-2">
            {notes.gapAnalysis.gaps.map((gap, i) => (
              <li key={i} className="rounded-md border border-border p-2 text-sm">
                <p className="font-medium text-foreground">{gap.area}</p>
                <p className="text-muted-foreground">{gap.why}</p>
                <p className="mt-1 text-foreground">
                  Remediation ({gap.remediationType}): {gap.remediation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.avoidancePattern && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Victoria-detected pattern</p>
          <p className="mt-1 text-sm text-foreground">
            Has left &quot;{notes.avoidancePattern.actionType}&quot; incomplete {notes.avoidancePattern.weeksAvoided}{' '}
            weeks running while completing other committed actions.
          </p>
        </div>
      )}

      {notes.coachingOnboardingAnswers && notes.coachingOnboardingAnswers.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Coaching Onboarding Form answers</p>
          <dl className="mt-2 grid gap-3 text-sm">
            {notes.coachingOnboardingAnswers.map((a, i) => (
              <div key={i}>
                <dt className="text-muted-foreground">{a.label}</dt>
                <dd className="text-foreground">{a.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {notes.jobFitHistory.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Full Job Fit reaction history</p>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
            {notes.jobFitHistory.map((j, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-foreground">
                <span className="truncate">
                  {j.title}
                  {j.companyName ? ` — ${j.companyName}` : ''}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{j.reaction}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
