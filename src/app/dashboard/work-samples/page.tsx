import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { WorkSampleForm } from '@/components/dashboard/WorkSampleForm'
import { deleteWorkSample } from './actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function WorkSamplesPage() {
  const profile = await getDashboardData()

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
                  <Button type="submit" variant="ghost" size="sm">
                    Remove
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
