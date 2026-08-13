import Link from 'next/link'
import type { PublicDisclosureComfort, NetworkComfortLevel } from '@prisma/client'
import { PUBLIC_DISCLOSURE_COMFORT_OPTIONS } from '@/lib/constants/onboarding'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { PublicVisibilityComfortEditor } from '@/components/dashboard/marketing-plan/PublicVisibilityComfortEditor'
import { confirmPublicVisibilityComfort } from '@/app/dashboard/marketing-plan/actions'

// Same 4-value scale/labels as NetworkComfortCheck.tsx's OPTIONS.
const NETWORK_COMFORT_LABEL: Record<NetworkComfortLevel, string> = {
  VERY_COMFORTABLE: 'Very comfortable letting your network know you’re looking',
  SOMEWHAT_COMFORTABLE: 'Somewhat comfortable letting your network know you’re looking',
  NOT_VERY_COMFORTABLE: 'Not very comfortable letting your network know you’re looking',
  RATHER_NOT: 'You said you’d rather not let your network know yet',
}

// Interview Prep's Comfort Check is 3 separate 0-100 sliders
// (storyComfort/interviewComfort/elevatorPitchReady) — this collapses them
// into one plain-language line rather than showing three numbers, since
// this card is a summary, not the full check-in.
function summarizeInterviewComfort(
  storyComfort: number | null,
  interviewComfort: number | null,
  elevatorPitchReady: number | null
): string | null {
  const values = [storyComfort, interviewComfort, elevatorPitchReady].filter(
    (v): v is number => v !== null
  )
  if (values.length === 0) return null
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  if (avg >= 87.5) return 'Completely comfortable telling your story, interviewing, and pitching yourself'
  if (avg >= 62.5) return 'Mostly comfortable telling your story and interviewing'
  if (avg >= 37.5) return 'Somewhat comfortable — still building confidence here'
  return 'Not comfortable yet — this is worth spending real time on'
}

export function ComfortSummary({
  publicDisclosureComfort,
  publicVisibilityComfortBonusAt,
  storyComfort,
  interviewComfort,
  elevatorPitchReady,
  networkComfortLevel,
}: {
  publicDisclosureComfort: PublicDisclosureComfort | null
  publicVisibilityComfortBonusAt: Date | null
  storyComfort: number | null
  interviewComfort: number | null
  elevatorPitchReady: number | null
  networkComfortLevel: NetworkComfortLevel | null
}) {
  const publicLabel = publicDisclosureComfort
    ? PUBLIC_DISCLOSURE_COMFORT_OPTIONS.find((o) => o.value === publicDisclosureComfort)?.label
    : null
  const interviewSummary = summarizeInterviewComfort(storyComfort, interviewComfort, elevatorPitchReady)
  const networkLabel = networkComfortLevel ? NETWORK_COMFORT_LABEL[networkComfortLevel] : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Your comfort level</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-foreground">Being publicly visible in your search</p>
              <p className="text-muted-foreground">
                {publicLabel ?? "You haven't answered this yet."}
              </p>
            </div>
            {publicDisclosureComfort && !publicVisibilityComfortBonusAt && (
              <form action={confirmPublicVisibilityComfort}>
                <SubmitButton size="sm" variant="outline" pendingLabel="Claiming…">
                  Claim +5 points
                </SubmitButton>
              </form>
            )}
          </div>
          {/* Always editable, not just first-time — this used to be
              onboarding-only with no way to update it later, even though it
              now drives real branching on this page. */}
          <PublicVisibilityComfortEditor current={publicDisclosureComfort} />
        </div>

        <div>
          <p className="font-medium text-foreground">Interview readiness</p>
          <p className="text-muted-foreground">{interviewSummary ?? "You haven't answered this yet."}</p>
          {!interviewSummary && (
            <Link
              href="/dashboard/interview-prep"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Take the Comfort Check →
            </Link>
          )}
        </div>

        <div>
          <p className="font-medium text-foreground">Networking</p>
          <p className="text-muted-foreground">{networkLabel ?? "You haven't answered this yet."}</p>
          {!networkLabel && (
            <Link href="/dashboard/network" className="text-sm font-medium text-primary underline underline-offset-4">
              Answer this on My Network →
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
