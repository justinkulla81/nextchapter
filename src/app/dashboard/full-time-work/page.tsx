import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { getMatchedRolesForCandidate } from '@/lib/matching/candidate-role-matches'
import { MatchedRoleList } from '@/components/dashboard/MatchedRoleList'
import { LockedFeatureNotice } from '@/components/dashboard/LockedFeatureNotice'

export const metadata: Metadata = { title: 'Full-time Work' }

// Net-new candidate surface — RoleProfile (Talent's role-posting model) was
// one-directional before this: employers search for candidates, candidates
// never saw a role matched back to them. This is the reverse direction,
// full-time roles only (see Board Advisory Work on Interim Work for the
// board/consulting types). A separate page rather than folding into
// find-my-job, since that page already covers several ExclusiveJobPosting/
// SurfacedJob/JobPosting sections and this is a different posting source
// entirely.
export default async function FullTimeWorkPage() {
  const profile = await getDashboardData()
  const dossierStatus = await isDossierUnlocked(profile.id)
  const matchedRoles = dossierStatus.unlocked ? await getMatchedRolesForCandidate(profile.id, ['FULL_TIME']) : []

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Full-time Work</h1>
        <PageHeaderBoxes pageKey="full-time-work" candidateId={profile.id} />
        <p className="text-sm text-muted-foreground">
          Full-time roles posted directly by employers on NextChapter, matched to your background.
        </p>
      </div>

      {!dossierStatus.unlocked ? (
        <LockedFeatureNotice
          title="Full-time Work"
          requirement="Unlock your Dossier to see employer-posted full-time roles matched to your background."
          status={dossierStatus.reason}
        />
      ) : (
        <MatchedRoleList
          roles={matchedRoles}
          emptyMessage="No full-time roles match your background yet — check back soon."
        />
      )}
    </div>
  )
}
