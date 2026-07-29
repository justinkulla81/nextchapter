import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { createLayoffCohort, deactivateLayoffCohort } from './actions'
import { LayoffCohortForm } from '@/components/admin/LayoffCohortForm'
import { LayoffCohortMatchRow } from '@/components/admin/LayoffCohortMatchRow'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { orgNamesMatch as companiesMatch } from '@/lib/text/org-name-match'

export const maxDuration = 30

export default async function LayoffCohortsAdminPage() {
  await requireAdmin()

  const [cohorts, candidates] = await Promise.all([
    prisma.layoffCohort.findMany({
      include: { candidates: { select: { id: true, firstName: true, displayName: true } } },
      orderBy: [{ isActive: 'desc' }, { layoffDate: 'desc' }],
    }),
    // Unassigned, laid-off candidates — the pool suggested matches are drawn from.
    prisma.candidateProfile.findMany({
      where: { currentJobStatus: 'LAID_OFF', layoffCohortId: null },
      select: {
        id: true,
        firstName: true,
        displayName: true,
        workHistory: { select: { companyName: true } },
      },
    }),
  ])

  const activeCohorts = cohorts.filter((c) => c.isActive)
  const inactiveCohorts = cohorts.filter((c) => !c.isActive)

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Layoff Cohorts</h1>
        <p className="mt-1 text-muted-foreground">
          Group candidates from the same layoff event so they can find each other in Community.
        </p>
      </div>

      <LayoffCohortForm action={createLayoffCohort} />

      <div className="space-y-6">
        <h2 className="text-sm font-medium text-muted-foreground">
          Active cohorts ({activeCohorts.length})
        </h2>
        {activeCohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active cohorts yet.</p>
        ) : (
          activeCohorts.map((cohort) => {
            const suggestedMatches = candidates.filter((candidate) =>
              candidate.workHistory.some((entry) => companiesMatch(entry.companyName, cohort.companyName))
            )

            return (
              <Card key={cohort.id}>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{cohort.companyName}</p>
                      <p className="text-sm text-muted-foreground">
                        Laid off {cohort.layoffDate.toLocaleDateString()}
                        {cohort.estimatedSize && ` · ~${cohort.estimatedSize} people`}
                      </p>
                      {cohort.newsUrl && (
                        <a
                          href={cohort.newsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline underline-offset-4"
                        >
                          News link
                        </a>
                      )}
                    </div>
                    <form action={deactivateLayoffCohort.bind(null, cohort.id)}>
                      <SubmitButton variant="ghost" size="sm">
                        Deactivate
                      </SubmitButton>
                    </form>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Matched candidates ({cohort.candidates.length})
                    </p>
                    {cohort.candidates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No candidates confirmed yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {cohort.candidates.map((candidate) => (
                          <LayoffCohortMatchRow
                            key={candidate.id}
                            candidateId={candidate.id}
                            name={candidate.displayName || candidate.firstName || 'Unknown'}
                            confirmed
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Suggested matches ({suggestedMatches.length})
                    </p>
                    {suggestedMatches.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No unmatched, laid-off candidates with a work history at this company yet.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {suggestedMatches.map((candidate) => (
                          <LayoffCohortMatchRow
                            key={candidate.id}
                            candidateId={candidate.id}
                            cohortId={cohort.id}
                            name={candidate.displayName || candidate.firstName || 'Unknown'}
                            confirmed={false}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {inactiveCohorts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Inactive cohorts ({inactiveCohorts.length})
          </h2>
          <div className="space-y-1">
            {inactiveCohorts.map((cohort) => (
              <p key={cohort.id} className="text-sm text-muted-foreground">
                {cohort.companyName} — laid off {cohort.layoffDate.toLocaleDateString()} (
                {cohort.candidates.length} matched)
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
