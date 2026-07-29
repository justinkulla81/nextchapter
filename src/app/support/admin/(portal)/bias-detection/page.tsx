import { requireAdmin } from '@/lib/admin/auth'
import { getBiasDetectionSections } from '@/lib/admin/bias-detection'
import { Card, CardContent } from '@/components/ui/card'

export const maxDuration = 30

export default async function BiasDetectionAdminPage() {
  await requireAdmin()
  const sections = await getBiasDetectionSections()
  const minCohortSize = sections[0]?.minCohortSize ?? 20

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bias Detection</h1>
        <p className="mt-1 text-muted-foreground">
          Aggregate-only comparisons across candidates who chose to answer the optional EEOC
          self-ID questions on their profile. Any group smaller than {minCohortSize} candidates is
          suppressed entirely — its numbers are never computed for display, not just hidden — so a
          small cohort can never be re-identified from this page.
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.dimension} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.dimension}</h2>
          {section.cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates have answered this question yet.</p>
          ) : (
            <div className="space-y-3">
              {section.cohorts.map((cohort) =>
                cohort.suppressed ? (
                  <Card key={cohort.label}>
                    <CardContent className="pt-6 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{cohort.label}</span> —
                      suppressed (fewer than {minCohortSize} candidates)
                    </CardContent>
                  </Card>
                ) : (
                  <Card key={cohort.label}>
                    <CardContent className="space-y-2 pt-6">
                      <p className="font-medium">
                        {cohort.label}{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                          (n={cohort.count})
                        </span>
                      </p>
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <p className="text-muted-foreground">Market Reality Grade distribution</p>
                          <p className="font-mono tabular-nums">
                            A {cohort.gradeDistribution.A}% · B {cohort.gradeDistribution.B}% · C{' '}
                            {cohort.gradeDistribution.C}% · D {cohort.gradeDistribution.D}% · F{' '}
                            {cohort.gradeDistribution.F}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg. Job Fit match score</p>
                          <p className="font-mono tabular-nums">
                            {cohort.avgJobFitScore != null ? `${cohort.avgJobFitScore}/100` : 'No data'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg. Skills & Execution score</p>
                          <p className="font-mono tabular-nums">
                            {cohort.avgSkillsExecutionScore != null
                              ? `${cohort.avgSkillsExecutionScore}/100`
                              : 'No data'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Badge-earning rate</p>
                          <p className="font-mono tabular-nums">{cohort.badgeEarningRatePct}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
