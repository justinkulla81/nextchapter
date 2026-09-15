import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GRADE_LABEL, GRADE_TEXT_COLOR, GRADE_INTERVIEW_ODDS } from '@/lib/scoring/grade'
import type { CandidateProgress } from '@/lib/admin/candidate-progress'

const TIER_LABEL: Record<string, string> = {
  LOCKED: 'Locked',
  PREVIEW: 'Preview unlocked',
  COMPLETE: 'Dossier complete',
  RECRUITER_INTROS: 'Recruiter introductions',
  UNPOSTED_ROLES: 'Unposted roles',
}

function when(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** A met/unmet marker that does not rely on color alone. */
function Mark({ met }: { met: boolean }) {
  return (
    <span aria-hidden className={met ? 'text-success' : 'text-muted-foreground'}>
      {met ? '✓' : '○'}
    </span>
  )
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function CandidateProgressPanel({ progress }: { progress: CandidateProgress }) {
  const { likelihood, dossier, connections, searchStrategy, assessments, activity, badges, moduleGates } = progress
  const met = dossier.completeness.metCount
  const total = dossier.completeness.totalCount
  const assessmentsDone = assessments.filter((a) => a.completedAt).length

  return (
    <div className="space-y-6">
      {/* The three questions worth answering before reading anything else:
          how likely are they to land, how far through the Dossier are they,
          and are they actually doing the work. */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Likelihood of landing"
          value={
            likelihood ? (
              <span className={GRADE_TEXT_COLOR[likelihood.probabilityGrade]}>{likelihood.probabilityGrade}</span>
            ) : (
              <span className="text-muted-foreground">Not graded</span>
            )
          }
          hint={
            likelihood
              ? `${GRADE_LABEL[likelihood.probabilityGrade]} · ${GRADE_INTERVIEW_ODDS[likelihood.probabilityGrade]}`
              : 'Too little activity measured to grade yet'
          }
        />
        <Stat
          label="Dossier"
          value={dossier.unlock.unlocked ? <span className="text-success">Unlocked</span> : `${met} of ${total}`}
          hint={
            dossier.unlock.unlocked
              ? `${met} of ${total} checklist items · ladder: ${TIER_LABEL[dossier.tier] ?? dossier.tier}`
              : (TIER_LABEL[dossier.tier] ?? dossier.tier)
          }
        />
        <Stat
          label="Work done"
          value={activity.find((a) => a.key === 'applications')?.count ?? 0}
          hint={`applications · ${activity.find((a) => a.key === 'outreach')?.count ?? 0} outreach · ${assessmentsDone} assessments`}
        />
      </section>

      {likelihood && (
        <p className="text-sm text-muted-foreground">
          {likelihood.rollingAttempts === 0 ? (
            // With no applications there is nothing measured yet: the grade is
            // the starting band off their background alone. Saying "graded on
            // 0 attempts" would imply a track record that does not exist.
            <>
              Starting estimate from background alone — they have not applied to anything yet, so nothing has been
              measured. Worth about {(likelihood.perAttemptProbability * 100).toFixed(1)}% per application once they
              start.
            </>
          ) : (
            <>
              Measured over {likelihood.rollingAttempts} application{likelihood.rollingAttempts === 1 ? '' : 's'} in the
              last {likelihood.rollingWindowWeeks} weeks: about {(likelihood.perAttemptProbability * 100).toFixed(1)}%
              per application, compounding to {(likelihood.cumulativeProbability * 100).toFixed(0)}% across that run.
              Started at band {likelihood.startingBand}.
            </>
          )}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dossier unlock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{dossier.unlock.reason}</p>

          {dossier.unlock.unlocked && !dossier.completeness.isComplete && (
            // The two are measured differently and can disagree: the checklist
            // is the aspirational six, the unlock is three gates plus an
            // alternate path. Saying so stops the panel reading as a bug.
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              Unlocked without finishing the checklist below — the checklist is the full aspirational set, while the
              unlock needs three gates or the alternate path.
            </p>
          )}

          <ul className="space-y-2">
            {dossier.completeness.requirements.map((r) => (
              <li key={r.key} className="flex items-baseline gap-2 text-sm">
                <Mark met={r.met} />
                <span className={r.met ? '' : 'font-medium'}>{r.label}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {r.current} / {r.target}
                </span>
              </li>
            ))}
          </ul>

          {!dossier.unlock.unlocked && dossier.unlock.alternatePath.reason !== 'not yet met' && (
            <p className="rounded-md bg-muted/40 p-3 text-sm">{dossier.unlock.alternatePath.reason}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {connections.map((c) => (
                <li key={c.label} className="flex items-baseline gap-2 text-sm">
                  <Mark met={c.connected} />
                  <span>{c.label}</span>
                  <span className="ml-auto text-right text-xs text-muted-foreground">
                    {c.problem ? (
                      // A connection that quietly stopped working looks
                      // identical to a healthy one everywhere else.
                      <span className="text-destructive">{c.problem}</span>
                    ) : c.connected ? (
                      <>
                        {c.detail && <span className="block">{c.detail}</span>}
                        since {when(c.since)}
                      </>
                    ) : (
                      'Never connected'
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Search strategy ({searchStrategy.answeredCount} of {searchStrategy.totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchStrategy.checklist.incomplete.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every targeting question answered.</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-muted-foreground">Still unanswered:</p>
                <ul className="space-y-1.5">
                  {searchStrategy.checklist.incomplete.map((i) => (
                    <li key={i.key} className="flex items-baseline gap-2 text-sm">
                      <Mark met={false} />
                      {i.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium">Assessment</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">What they answered</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.key} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">
                      <Mark met={a.completedAt !== null} /> {a.label}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {a.completedAt ? when(a.completedAt) : <span className="text-muted-foreground">Not started</span>}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {a.summary ?? (a.completedAt ? 'Recorded' : '—')}
                      {a.flag && <span className="block text-destructive">{a.flag}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What they have done</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={a.key} className="flex items-baseline gap-3 text-sm">
                  <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{a.count}</span>
                  <span>{a.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {a.lastAt ? `last ${when(a.lastAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badges ({badges.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {badges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No badges earned yet.</p>
            ) : (
              <ul className="space-y-2">
                {badges.slice(0, 18).map((b, i) => (
                  <li key={`${b.source}-${b.key}-${i}`} className="flex items-baseline gap-2 text-sm">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{b.source}</span>
                    <span>{b.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {b.detail ?? when(b.earnedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {moduleGates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Module access</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {moduleGates.map((g) => (
                <li key={g.key} className="flex items-baseline gap-2 text-sm">
                  <Mark met={g.unlocked} />
                  <span>{g.label}</span>
                  {!g.unlocked && <span className="ml-auto text-xs text-muted-foreground">{g.reason}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
