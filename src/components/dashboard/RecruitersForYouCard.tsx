import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { recommendFirmsForCandidate } from '@/lib/search-firms/recommend-data'
import { LockedFeatureNotice } from './LockedFeatureNotice'
import { RecruiterFirmLink } from './RecruiterFirmLink'

// Candidate+ extra: recruiters and search firms matched to the member's
// function and industry, from the ~1,300 firms the ncrawl crawler tracks.
export async function RecruitersForYouCard({ candidateId }: { candidateId: string }) {
  const plus = await isDossierUnlocked(candidateId)
  if (!plus.unlocked) {
    return (
      <LockedFeatureNotice
        title="Recruiters and search firms for you"
        requirement="A list of search firms running searches in your function and industry. Included with Candidate+."
        status={plus.reason}
      />
    )
  }

  const firms = await recommendFirmsForCandidate(candidateId)
  return (
    <section className="space-y-3" aria-labelledby="recruiters-for-you">
      <div>
        <h2 id="recruiters-for-you" className="text-lg font-semibold">
          Recruiters and search firms for you
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Firms whose recent searches match your function or industry. Reach out to the partner who covers your area; their team
          page lists who that is.
        </p>
      </div>
      {firms.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          No firm in our list is running searches in your function or industry right now. Confirm your function and target
          industries on your profile so we can match you; the list refreshes every week.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {firms.map((f, i) => (
            <li key={f.id} className="space-y-0.5 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">
                {f.url ? (
                  <RecruiterFirmLink href={f.url} firmId={f.id} rank={i + 1} kind="website">
                    {f.name}
                  </RecruiterFirmLink>
                ) : (
                  f.name
                )}
                <span className="font-normal text-muted-foreground"> · {f.segmentLabel}</span>
              </p>
              <p className="text-muted-foreground">
                {f.why}
                {f.teamUrl && (
                  <>
                    {' · '}
                    <RecruiterFirmLink href={f.teamUrl} firmId={f.id} rank={i + 1} kind="team">
                      Team page
                    </RecruiterFirmLink>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
