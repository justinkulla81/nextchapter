import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { WorkSampleForm } from '@/components/dashboard/WorkSampleForm'
import { WorkSampleTypeGateForm } from '@/components/dashboard/WorkSampleTypeGateForm'
import { WorkHistoryForm } from '@/components/dashboard/WorkHistoryForm'
import { WorkHistoryList } from '@/components/dashboard/WorkHistoryList'
import { deleteWorkSample } from './actions'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

export default async function WorkSamplesPage() {
  const profile = await getDashboardData()

  if (!profile.workSampleType) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work Samples</h1>
          <p className="mt-1 text-muted-foreground">
            Show, don&apos;t just tell. What you add here goes straight into your dossier — the
            hiring manager sees it alongside your resume, and it adds directly to your execution
            score.
          </p>
        </div>
        <WorkSampleTypeGateForm />

        <div className="space-y-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your work history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Feeds your Certified Executive Dossier and What They See — fractional/interim/consulting roles
              are never labeled as such externally, so add them here without hesitation. Landing your
              first interim or fractional client also counts toward your Landed an Interim Role
              badge — see the full path on the{' '}
              <a href="/dashboard/interim-work" className="text-primary underline underline-offset-4">
                Interim Work
              </a>{' '}
              page.
            </p>
          </div>
          <WorkHistoryList entries={profile.workHistory} />
          <WorkHistoryForm />
        </div>
      </div>
    )
  }

  if (profile.workSampleType === 'none') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work Samples</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You said there&apos;s nothing you&apos;d want to share here — nothing needed. If that
            changes, pick a type below.
          </p>
        </div>
        <WorkSampleTypeGateForm />

        <div className="space-y-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your work history</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Feeds your Certified Executive Dossier and What They See — fractional/interim/consulting roles
              are never labeled as such externally, so add them here without hesitation. Landing your
              first interim or fractional client also counts toward your Landed an Interim Role
              badge — see the full path on the{' '}
              <a href="/dashboard/interim-work" className="text-primary underline underline-offset-4">
                Interim Work
              </a>{' '}
              page.
            </p>
          </div>
          <WorkHistoryList entries={profile.workHistory} />
          <WorkHistoryForm />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Work Samples</h1>
        <p className="mt-1 text-muted-foreground">
          Show, don&apos;t just tell. What you add here goes straight into your dossier — the
          hiring manager sees it alongside your resume, and it adds directly to your execution
          score.
        </p>
      </div>

      <WorkSampleForm />

      {profile.workSamples.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Your samples</h2>
          {profile.workSamples.map((sample) => (
            <Card key={sample.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div className="space-y-1">
                  <p className="font-medium">{sample.title}</p>
                  <p className="text-sm text-muted-foreground">{sample.description}</p>
                  {(sample.fileUrl || sample.externalUrl) && (
                    <a
                      href={sample.fileUrl ?? sample.externalUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      View
                    </a>
                  )}
                </div>
                <form action={deleteWorkSample.bind(null, sample.id)}>
                  <SubmitButton variant="ghost" size="sm">
                    Remove
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your work history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Feeds your Certified Executive Dossier and What They See — fractional/interim/consulting roles
            are never labeled as such externally, so add them here without hesitation. Landing your
            first interim or fractional client also counts toward your Landed an Interim Role
            badge — see the full path on the{' '}
            <a href="/dashboard/interim-work" className="text-primary underline underline-offset-4">
              Interim Work
            </a>{' '}
            page.
          </p>
        </div>
        <WorkHistoryList entries={profile.workHistory} />
        <WorkHistoryForm />
      </div>
    </div>
  )
}
