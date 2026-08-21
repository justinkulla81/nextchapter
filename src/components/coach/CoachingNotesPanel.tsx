import type { CoachingNotes } from '@/lib/coach/coaching-notes'
import { ReferenceBreakdownSection } from '@/components/coach/ReferenceBreakdownSection'
import type { FocusLabel, VolumeAssessment } from '@/lib/network/application-trends'
import { MotivationChart } from '@/components/dashboard/MotivationChart'
import { MarketRealityTrendChart } from '@/components/dashboard/MarketRealityTrendChart'

const FOCUS_LABEL: Record<FocusLabel, string> = {
  focused: 'Focused',
  mixed: 'A mix',
  scattered: 'Scattered',
}

const VOLUME_ASSESSMENT_LABEL: Record<VolumeAssessment, string> = {
  too_few: 'Below a healthy pace',
  on_track: 'On pace',
  too_many: 'Very high volume',
}

const SENTIMENT_ALERT_REASON_TEXT: Record<'low_average' | 'declining_trend', string> = {
  low_average: "their mood check-ins have run mostly \"Stuck\" over the last two weeks",
  declining_trend: 'their mood check-ins have been trending down over the last two weeks',
}

const VISIBILITY_COMFORT_ALERT_REASON_TEXT: Record<'low_average' | 'declining_trend', string> = {
  low_average: 'their weekly visibility check-ins have run mostly "keeping this private"',
  declining_trend: 'their comfort with being publicly visible has been trending down week over week',
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

      {notes.visibilityComfortTrend.lowComfort && notes.visibilityComfortTrend.reason && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-semibold text-foreground">Visibility comfort flag</p>
          <p className="mt-1 text-sm text-foreground">
            Worth a check-in: {VISIBILITY_COMFORT_ALERT_REASON_TEXT[notes.visibilityComfortTrend.reason]}.
          </p>
        </div>
      )}

      {notes.searchPatternFlags.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-semibold text-foreground">Search strategy patterns</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deterministic reads on real activity — not self-reported, not LLM-generated.
          </p>
          <div className="mt-3 space-y-3">
            {notes.searchPatternFlags.map((flag) => (
              <div key={flag.key}>
                <p className="text-sm font-medium text-foreground">{flag.label}</p>
                <p className="text-sm text-muted-foreground">{flag.detail}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {flag.causes.map((c, i) => (
                    <li key={i} className="text-foreground">
                      {c.cause} <span className="text-muted-foreground">— {c.fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
          <p className="text-sm font-medium text-muted-foreground">Current Market Reality trend</p>
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
              <dt className="text-muted-foreground">Public disclosure comfort (onboarding baseline)</dt>
              <dd className="text-foreground">{notes.publicDisclosureComfortLabel}</dd>
            </div>
          )}
          {notes.latestWeeklyVisibilityComfortLabel && (
            <div>
              <dt className="text-muted-foreground">Public disclosure comfort (most recent weekly check-in)</dt>
              <dd className="text-foreground">{notes.latestWeeklyVisibilityComfortLabel}</dd>
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

      {notes.opennessToLearning && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Openness to learning</p>
          <p className="mt-1 text-sm text-foreground">
            <span className="font-medium">{notes.opennessToLearning.label}.</span>{' '}
            {notes.opennessToLearning.detail}
          </p>
        </div>
      )}

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
        {notes.salaryGapFlag && (
          <p className="mt-2 rounded-md border border-orange/30 bg-orange/5 p-2 text-xs text-foreground">
            Target minimum is <span className="font-medium tabular-nums">{notes.salaryGapFlag.gapPercent}%</span>{' '}
            below their last salary — could mean the past salary was inflated, or they&apos;re more open to a
            lower offer than they&apos;re letting on.{' '}
            {notes.salaryGapFlag.consistentWithStatedFlexibility
              ? 'Consistent with the comp flexibility they flagged in Search Strategy.'
              : "They haven't flagged comp flexibility or willingness to start lower elsewhere — worth confirming this is intentional."}
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Flexibility</p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Title / level</dt>
            <dd className="text-foreground">
              {notes.flexibility.titleLevel.current ?? 'Not specified'}
              {notes.flexibility.titleLevel.willingToStartLower && (
                <span className="block text-xs text-muted-foreground">
                  Willing to start at a lower level/title
                  {notes.flexibility.titleLevel.startLowerRationale
                    ? ` — ${notes.flexibility.titleLevel.startLowerRationale}`
                    : ''}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Job function</dt>
            <dd className="text-foreground">
              {notes.flexibility.jobFunction.primary ?? 'Not specified'}
              {notes.flexibility.jobFunction.target &&
                notes.flexibility.jobFunction.target !== notes.flexibility.jobFunction.primary &&
                ` → targeting ${notes.flexibility.jobFunction.target}`}
              {notes.flexibility.jobFunction.isPivoting && (
                <span className="block text-xs text-muted-foreground">Considering a pivot to a different function</span>
              )}
              {notes.flexibility.jobFunction.secondary && (
                <span className="block text-xs text-muted-foreground">
                  Also relevant: {notes.flexibility.jobFunction.secondary}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Industry</dt>
            <dd className="text-foreground">
              {notes.flexibility.industry.primary ?? 'Not specified'}
              {notes.flexibility.industry.secondary && `, ${notes.flexibility.industry.secondary}`}
              {notes.flexibility.industry.targetIndustries.length > 0 && (
                <span className="block text-xs text-muted-foreground">
                  Open to: {notes.flexibility.industry.targetIndustries.join(', ')}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Location</dt>
            <dd className="text-foreground">
              {notes.flexibility.location.preferenceLabel ?? 'Not specified'}
              <span className="block text-xs text-muted-foreground">
                {notes.flexibility.location.openToRelocation ? 'Open to relocating' : 'Not open to relocating'}
                {notes.flexibility.location.relocationNotes ? ` — ${notes.flexibility.location.relocationNotes}` : ''}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Compensation</dt>
            <dd className="text-foreground">
              {notes.flexibility.compensation.flexible ? 'Flexible on comp' : 'Not flexible on comp'}
              {notes.flexibility.compensation.equityImportant && (
                <span className="block text-xs text-muted-foreground">Equity matters to them</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Company</dt>
            <dd className="text-foreground">
              {notes.flexibility.company.sizeLabel ?? 'Any size'}
              {notes.flexibility.company.stageLabel ? ` · ${notes.flexibility.company.stageLabel}` : ''}
            </dd>
          </div>
        </dl>
        {notes.flexibility.priorityRanking.length > 0 && (
          <div className="mt-3">
            <dt className="text-sm text-muted-foreground">What matters most to them, in order</dt>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-foreground">
              {notes.flexibility.priorityRanking.map((p) => (
                <li key={p.label}>{p.label}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {notes.redLines.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Red lines</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Non-negotiables worth knowing before spending time on a role that was never going to work.
          </p>
          <ul className="mt-2 space-y-2">
            {notes.redLines.map((r, i) => (
              <li key={i} className="rounded-md border border-border p-2 text-sm">
                <p className="font-medium text-foreground">{r.label}</p>
                <p className="text-muted-foreground">{r.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.personalContext && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Blockers &amp; motivations</p>
          <p className="mt-1 text-xs text-muted-foreground">
            In their own words — coach context only, never shown in the Dossier or to the candidate.
          </p>
          <dl className="mt-2 space-y-3 text-sm">
            {notes.personalContext.blockerLabels.length > 0 && (
              <div>
                <dt className="text-xs text-muted-foreground">Practical blockers</dt>
                <dd className="text-foreground">{notes.personalContext.blockerLabels.join(', ')}</dd>
              </div>
            )}
            {notes.personalContext.blockersOpenText && (
              <div>
                <dt className="text-xs text-muted-foreground">More, in their own words</dt>
                <dd className="text-foreground">{notes.personalContext.blockersOpenText}</dd>
              </div>
            )}
            {notes.personalContext.consistencySelfRating !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">Self-rated consistency</dt>
                <dd className="text-foreground tabular-nums">{notes.personalContext.consistencySelfRating}/100</dd>
              </div>
            )}
            {notes.personalContext.motivationLabels.length > 0 && (
              <div>
                <dt className="text-xs text-muted-foreground">What&apos;s driving them</dt>
                <dd className="text-foreground">{notes.personalContext.motivationLabels.join(', ')}</dd>
              </div>
            )}
            {notes.personalContext.motivationsElaboration && (
              <div>
                <dt className="text-xs text-muted-foreground">More, in their own words</dt>
                <dd className="text-foreground">{notes.personalContext.motivationsElaboration}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {(notes.searchPlan.applicationVolumeGoal !== null ||
        notes.searchPlan.skillsToBuild.length > 0 ||
        notes.searchPlan.interimConsultingInterest) && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Search plan</p>
          <dl className="mt-2 space-y-2 text-sm">
            {notes.searchPlan.applicationVolumeGoal !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">Applications/week goal</dt>
                <dd className="text-foreground">{notes.searchPlan.applicationVolumeGoal}</dd>
              </div>
            )}
            {notes.searchPlan.skillsToBuild.length > 0 && (
              <div>
                <dt className="text-xs text-muted-foreground">Skills they&apos;re building</dt>
                <dd className="text-foreground">{notes.searchPlan.skillsToBuild.join(', ')}</dd>
              </div>
            )}
            {notes.searchPlan.interimConsultingInterest && (
              <div>
                <dd className="text-foreground">Open to fractional/interim consulting work while searching</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {notes.referenceBreakdown && <ReferenceBreakdownSection breakdown={notes.referenceBreakdown} />}

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

      {notes.selfAwarenessFlags.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Worth calibrating together</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Their self-assessment reads higher than the outside evidence on more than one dimension.
            This stays here — it never appears in their Dossier or on their dashboard. More
            completed references sharpen this read either way.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {notes.selfAwarenessFlags.map((flag) => (
              <li key={flag.categoryLabel}>
                <span className="font-medium">{flag.categoryLabel}:</span> {flag.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.visibilityCalibration.gap && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Visibility calibration</p>
          <p className="mt-1 text-sm text-foreground">{notes.visibilityCalibration.note}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Good jumping-off point for building their own Marketing Plan together.
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

      {notes.confidentialDisclosure?.hasDisclosure && notes.confidentialDisclosure.disclosureText && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Confidential disclosure</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted directly to you, separate from the Coaching Onboarding Form above — never shown back to the
            candidate or in the Dossier.
          </p>
          <p className="mt-2 text-sm text-foreground">{notes.confidentialDisclosure.disclosureText}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {notes.confidentialDisclosure.submittedAt.toLocaleDateString()}
          </p>
        </div>
      )}

      {notes.jobSearchPatternSummary && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">What&apos;s My Pattern</p>
          <p className="mt-2 text-sm text-foreground">{notes.jobSearchPatternSummary}</p>
        </div>
      )}

      {notes.applicationTrends?.eligible && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Application trends</p>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2 text-sm">
            {notes.applicationTrends.functionFocus && (
              <div>
                <dt className="text-xs text-muted-foreground">Job function</dt>
                <dd className="text-foreground">{FOCUS_LABEL[notes.applicationTrends.functionFocus]}</dd>
                {notes.applicationTrends.functionBreakdown && (
                  <dd className="text-xs text-muted-foreground">
                    {notes.applicationTrends.functionBreakdown.map((b) => `${b.label} (${b.count})`).join(', ')}
                  </dd>
                )}
              </div>
            )}
            {notes.applicationTrends.industryFocus && (
              <div>
                <dt className="text-xs text-muted-foreground">Industry</dt>
                <dd className="text-foreground">{FOCUS_LABEL[notes.applicationTrends.industryFocus]}</dd>
                {notes.applicationTrends.industryBreakdown && (
                  <dd className="text-xs text-muted-foreground">
                    {notes.applicationTrends.industryBreakdown.map((b) => `${b.label} (${b.count})`).join(', ')}
                  </dd>
                )}
              </div>
            )}
            {notes.applicationTrends.geographyFocus && (
              <div>
                <dt className="text-xs text-muted-foreground">Geography</dt>
                <dd className="text-foreground">{FOCUS_LABEL[notes.applicationTrends.geographyFocus]}</dd>
                {notes.applicationTrends.geographyBreakdown && (
                  <dd className="text-xs text-muted-foreground">
                    {notes.applicationTrends.geographyBreakdown.map((b) => `${b.label} (${b.count})`).join(', ')}
                  </dd>
                )}
              </div>
            )}
            {notes.applicationTrends.volumeAssessment && (
              <div>
                <dt className="text-xs text-muted-foreground">Application pace</dt>
                <dd className="text-foreground">
                  {VOLUME_ASSESSMENT_LABEL[notes.applicationTrends.volumeAssessment]}
                  {notes.applicationTrends.applicationsPerWeek !== null &&
                    ` — ${notes.applicationTrends.applicationsPerWeek}/week`}
                  {notes.applicationTrends.volumeGoalPerWeek &&
                    ` (goal: ${notes.applicationTrends.volumeGoalPerWeek}/week)`}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-muted-foreground">Job search activity (all-time)</p>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Applications</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">{notes.jobActivity.totalApplications}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Rejections</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">{notes.jobActivity.totalRejections}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Interviews landed</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">{notes.jobActivity.totalInterviewsLanded}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Offers received</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">{notes.jobActivity.totalOffersReceived}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Networking outreaches</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">{notes.jobActivity.totalNetworkingOutreach}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Calendar meetings</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">{notes.jobActivity.totalCalendarMeetings}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Follow-ups sent</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">{notes.jobActivity.followUpsSentCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Follow-ups currently owed</dt>
            <dd className="text-lg font-semibold text-foreground tabular-nums">{notes.jobActivity.followUpsPendingCount}</dd>
          </div>
        </dl>
        {(notes.jobActivity.applicationToInterviewRate !== null || notes.jobActivity.interviewToOfferRate !== null) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {notes.jobActivity.applicationToInterviewRate !== null &&
              `${notes.jobActivity.applicationToInterviewRate}% of applications have led to an interview`}
            {notes.jobActivity.applicationToInterviewRate !== null && notes.jobActivity.interviewToOfferRate !== null && ' — '}
            {notes.jobActivity.interviewToOfferRate !== null &&
              `${notes.jobActivity.interviewToOfferRate}% of interviews have led to an offer`}
          </p>
        )}

        {notes.jobActivity.rejectedJobs.length > 0 && (
          <div className="mt-3">
            <dt className="text-xs text-muted-foreground">Rejected</dt>
            <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-sm">
              {notes.jobActivity.rejectedJobs.map((j, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-foreground">
                  <span className="truncate">
                    {j.title ?? 'Unknown title'}
                    {j.companyName ? ` — ${j.companyName}` : ''}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {j.declinedAt.toLocaleDateString()}
                    {j.declinedBy === 'CANDIDATE' ? ' (they passed)' : j.declinedBy === 'COMPANY' ? ' (company passed)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {notes.jobActivity.jobsWithConnections.length > 0 && (
          <div className="mt-3">
            <dt className="text-xs text-muted-foreground">Applications with a Support Network connection attached</dt>
            <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-sm">
              {notes.jobActivity.jobsWithConnections.map((j, i) => (
                <li key={i} className="text-foreground">
                  <span className="truncate">
                    {j.title ?? 'Unknown title'}
                    {j.companyName ? ` — ${j.companyName}` : ''}
                  </span>
                  <span className="block text-xs text-muted-foreground">Via: {j.contactNames.join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {notes.watchedCompanies.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Companies they&apos;re tracking</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {notes.watchedCompanies.map((name, i) => (
              <span key={i} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {notes.appliedJobs.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Companies and roles they&apos;ve applied to</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
            {notes.appliedJobs.map((j, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-foreground">
                <span className="truncate">
                  {j.title ?? 'Unknown title'}
                  {j.companyName ? ` — ${j.companyName}` : ''}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {j.appliedAt.toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.interestedJobs.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Jobs they marked Interested</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
            {notes.interestedJobs.map((j, i) => (
              <li key={i} className="text-foreground">
                {j.title}
                {j.companyName ? ` — ${j.companyName}` : ''}
              </li>
            ))}
          </ul>
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
