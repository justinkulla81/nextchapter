import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WorkStyleProfileCard } from '@/components/dashboard/WorkStyleProfileCard'
import type { DimensionVectors } from '@/lib/scoring/assessment-vectors'

// A one-time item (not a weekly, recurring Search Action) — take it once,
// edit it anytime via the same retake flow. Surfaced on the dashboard as
// its own compact action rather than buried on the Stats page.
export function WorkingStyleActionCard({
  dimensionVectors,
}: {
  dimensionVectors: DimensionVectors | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Working Style</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {dimensionVectors ? (
          <>
            <WorkStyleProfileCard dimensionVectors={dimensionVectors} />
            <Link
              href="/dashboard/retake-assessment"
              className="inline-block text-sm text-primary underline underline-offset-4"
            >
              Edit your Working Style
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              A quick, optional assessment of how you prefer to work — helps us (and your
              references) understand what makes you thrive, not just what you can do.
            </p>
            <Link
              href="/dashboard/retake-assessment"
              className="inline-block text-sm font-medium text-primary underline underline-offset-4"
            >
              Take the Work Style Assessment
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}
