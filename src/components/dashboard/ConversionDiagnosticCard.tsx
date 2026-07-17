import type { ApplicationChannel } from '@prisma/client'
import { Card, CardContent } from '@/components/ui/card'
import { computeConversionDiagnostic, APPLICATION_CHANNEL_LABELS } from '@/lib/jobs/conversion-diagnostic'

export function ConversionDiagnosticCard({
  jobPostings,
}: {
  jobPostings: { channel: ApplicationChannel | null; appliedAt: Date | null; interviewLandedAt: Date | null }[]
}) {
  const diagnostic = computeConversionDiagnostic(jobPostings)
  if (!diagnostic) return null

  const best = diagnostic[0]

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <p className="text-sm font-medium">Where your interviews are coming from</p>
          <p className="text-sm text-muted-foreground">
            {APPLICATION_CHANNEL_LABELS[best.channel]} is converting best for you so far — worth
            leaning into it this week.
          </p>
        </div>
        <div className="space-y-1.5">
          {diagnostic.map(({ channel, appliedCount, interviewCount, interviewRate }) => (
            <div key={channel} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{APPLICATION_CHANNEL_LABELS[channel]}</span>
              <span className="tabular-nums text-muted-foreground">
                {interviewCount}/{appliedCount} interviewed ({Math.round(interviewRate * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
