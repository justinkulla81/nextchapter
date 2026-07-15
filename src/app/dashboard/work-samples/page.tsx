import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { WorkSampleForm } from '@/components/dashboard/WorkSampleForm'
import { WorkSampleTypeGateForm } from '@/components/dashboard/WorkSampleTypeGateForm'
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
            Show, don&apos;t just tell. Upload something that proves what you can do.
          </p>
        </div>
        <WorkSampleTypeGateForm />
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
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Work Samples</h1>
        <p className="mt-1 text-muted-foreground">
          Show, don&apos;t just tell. Upload something that proves what you can do.
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
    </div>
  )
}
