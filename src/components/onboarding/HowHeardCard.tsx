import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { submitHowHeard } from '@/app/onboarding/how-heard-actions'
import { HOW_HEARD_OPTIONS } from '@/lib/onboarding/how-heard-options'

// One optional question on the welcome page: how they found NextChapter and
// who recommended it. Hidden once the source is known from an invite link,
// the CRM, or an earlier answer.
export function HowHeardCard() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-sm">
        <p className="font-medium">One quick question: how did you hear about NextChapter?</p>
        <form action={submitHowHeard} className="flex flex-wrap items-center gap-2">
          <select
            name="howHeard" required defaultValue="" aria-label="How did you hear about NextChapter"
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="" disabled>Choose one</option>
            {HOW_HEARD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            name="whoRecommended" maxLength={120} placeholder="Who recommended it? (optional)"
            aria-label="Who recommended NextChapter to you"
            className="h-9 w-64 rounded-md border border-input bg-transparent px-2 text-sm"
          />
          <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">Save</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
