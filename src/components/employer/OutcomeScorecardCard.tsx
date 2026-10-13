import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BAND_LABEL, type EmployerScorecard } from '@/lib/employer/outcome-scorecard'

// Cohort-level only. Shows group counts and a coarse comparison band; never an
// individual, a ratio, pay or how anyone found work.
export function OutcomeScorecardCard({ scorecard }: { scorecard: EmployerScorecard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Re-employment compared with what is typical</CardTitle>
        <CardDescription>
          Graduates are compared only with people at the same stage of a job search, so a group that joined after a long search is not
          judged against everyone.
          {' Results are updated once a quarter, as of the end of the last complete quarter.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {scorecard.suppressed ? (
          <p className="text-sm text-muted-foreground">
            {scorecard.reason === 'TOO_FEW_PEOPLE'
              ? 'Not shown yet: fewer than 10 people have chosen to share anonymous results, and we never show numbers that could point to one person.'
              : 'Nothing to show yet. Results appear once at least 10 people in this program choose to share anonymous results.'}
          </p>
        ) : (
          <>
            <p className="text-sm text-foreground">
              About {scorecard.totalEnrolled} people are included.{' '}
              {scorecard.overallBand ? <strong>{BAND_LABEL[scorecard.overallBand]}.</strong> : 'We do not yet have enough verified comparison data to say how this compares.'}
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Re-employment by how long people had been out of work when they joined</caption>
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Weeks out of work when joined</th>
                    <th scope="col" className="px-4 py-2 font-medium">People</th>
                    <th scope="col" className="px-4 py-2 font-medium">Found work</th>
                    <th scope="col" className="px-4 py-2 font-medium">Compared with typical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {scorecard.groups.map((g) => (
                    <tr key={g.label}>
                      <th scope="row" className="px-4 py-2 font-medium">{g.label}</th>
                      <td className="px-4 py-2 tabular-nums">{g.enrolled}</td>
                      <td className="px-4 py-2 tabular-nums">{g.reemployed}</td>
                      <td className="px-4 py-2">
                        {g.band
                          ? BAND_LABEL[g.band]
                          : g.bandWithheld === 'TOO_FEW_EVENTS'
                            ? 'Too few expected to compare fairly'
                            : 'Comparison data pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Only people who chose to share are counted, so this reflects a self-selected group and shows association, not that the program caused
          the result. Counts are rounded to the nearest 5. Interim and fractional work is not counted as a permanent hire.
        </p>
      </CardContent>
    </Card>
  )
}
