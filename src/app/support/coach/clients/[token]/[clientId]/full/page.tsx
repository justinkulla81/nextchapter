import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { getFullClientView } from '@/lib/coach/full-client-view'
import { getDossierSections } from '@/lib/reports/dossier-sections'
import { getCoachingNotes } from '@/lib/coach/coaching-notes'
import { GRADE_LABEL } from '@/lib/scoring/grade'
import { CoachBrandHeader } from '@/components/coach/CoachBrandHeader'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { CoachingNotesPanel } from '@/components/coach/CoachingNotesPanel'

export default async function FullClientViewPage({
  params,
}: {
  params: Promise<{ token: string; clientId: string }>
}) {
  const { token, clientId } = await params

  const coach = await getCoachByToken(token)
  if (!coach) notFound()

  const candidate = await getCoachClient(coach.id, clientId)
  if (!candidate) notFound()

  const view = await getFullClientView(candidate.id)
  const hasConsent = candidate.coachDossierConsentedAt !== null
  const [dossier, coachingNotes] = hasConsent
    ? await Promise.all([getDossierSections(candidate.id), getCoachingNotes(candidate.id)])
    : [null, null]

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/support/coach/clients/${token}/${clientId}`}
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        ← Back to pre-session brief
      </Link>

      <div className="mt-4 mb-8 space-y-1">
        <CoachBrandHeader firmName={coach.firmName} logoUrl={coach.logoUrl} />
        <p className="text-sm font-medium text-muted-foreground">Full Client View</p>
        <h1 className="text-2xl font-semibold tracking-tight">{view.candidateName}</h1>
        <p className="text-muted-foreground">
          {view.weekNumber !== null ? `Week ${view.weekNumber} in search` : 'Not yet registered'}
          {view.email && ` · ${view.email}`}
        </p>
      </div>

      <div className="space-y-5">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Targeting</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {view.statusLabel && (
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-foreground">{view.statusLabel}</dd>
              </div>
            )}
            {view.targetRoleType && (
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="text-foreground">{view.targetRoleType}</dd>
              </div>
            )}
            {view.primaryFunction && (
              <div>
                <dt className="text-muted-foreground">Function</dt>
                <dd className="text-foreground">{view.primaryFunction}</dd>
              </div>
            )}
            {view.targetIndustries.length > 0 && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Industries</dt>
                <dd className="text-foreground">{view.targetIndustries.join(', ')}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Grade history</p>
          {view.gradeHistory.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No reports generated yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {view.gradeHistory.map((g, i) => (
                <li key={i} className="text-foreground">
                  {g.generatedAt.toLocaleDateString()} — Market{' '}
                  {g.marketGrade ? `${g.marketGrade} (${GRADE_LABEL[g.marketGrade]})` : '—'}, Execution{' '}
                  {g.executionGrade ? `${g.executionGrade} (${GRADE_LABEL[g.executionGrade]})` : '—'}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Work history</p>
          {view.workHistory.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {view.workHistory.map((w, i) => (
                <li key={i} className="text-foreground">
                  {w.roleTitle} at {w.companyName} ({w.startDate.getFullYear()}–
                  {w.isCurrent ? 'Present' : w.endDate?.getFullYear()})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">References</p>
          {view.references.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {view.references.map((r, i) => (
                <li key={i}>
                  {r.refereeName} — {r.status}
                  {r.wouldHireAgain !== null && (r.wouldHireAgain ? ', would hire again' : ', would not hire again')}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Recent moods</p>
          {view.recentMoods.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No check-ins logged yet.</p>
          ) : (
            <p className="mt-1 text-sm text-foreground">
              {view.recentMoods.map((m) => m.label).join(' · ')}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Session log</p>
          {view.sessions.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No sessions logged yet.</p>
          ) : (
            <div className="mt-2 space-y-3">
              {view.sessions.map((s) => (
                <div key={s.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <p className="text-sm font-medium text-foreground">
                    {s.occurredAt.toLocaleDateString()}
                    {s.durationMinutes && ` · ${s.durationMinutes} min`}
                  </p>
                  {s.notes && <p className="mt-1 text-sm text-muted-foreground">Notes: {s.notes}</p>}
                  {s.directives && (
                    <p className="mt-1 text-sm text-muted-foreground">Directives: {s.directives}</p>
                  )}
                  {!s.notes && !s.directives && (
                    <p className="mt-1 text-sm text-muted-foreground">No notes or directives logged.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Executive Dossier &amp; Coaching Notes</p>
          <p className="mt-1 text-xs text-muted-foreground">
            In-app only — never downloadable, exportable, or forwardable from here.
          </p>
          {!hasConsent ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {candidate.firstName ?? 'This candidate'}{' '}
              hasn&apos;t agreed to share their Executive Dossier and Coaching Notes with you yet.
              Nothing below this point is available until they do.
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              <div className="space-y-5">{dossier && <DossierSectionsView dossier={dossier} readOnly />}</div>
              <div className="border-t border-border pt-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Coaching Notes
                </p>
                {coachingNotes && <CoachingNotesPanel notes={coachingNotes} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
