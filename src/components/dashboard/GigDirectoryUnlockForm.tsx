'use client'

import { useState, useTransition } from 'react'
import { submitGigDirectoryUnlock } from '@/app/dashboard/interim-work/actions'
import { UnlockAnnouncementDialog } from '@/components/dashboard/UnlockAnnouncementDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// This form only ever renders pre-unlock (complete-profile/page.tsx gates
// it on isIncomplete('GIG_DIRECTORY_UNLOCK')), so every successful submit
// is genuinely a first-time unlock — no separate "was this the first
// time" signal needed from the server action.
export function GigDirectoryUnlockForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showUnlockDialog, setShowUnlockDialog] = useState(false)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await submitGigDirectoryUnlock(undefined, formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setShowUnlockDialog(true)
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Set your target rate</p>
        <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
          +5 pts, one time
        </span>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Interim and fractional work fills an employment gap while you search — a gap you can
          explain in your own words is a controllable lever, unlike a gap that just sits there
          unexplained.
        </p>
        <p>
          Set expectations before you browse: fractional/interim rates typically land well below a
          full-time equivalent salary once you annualize the hours, and consulting-marketplace work
          is inconsistent — treat it as a bridge, not a replacement income.
        </p>
      </div>
      <form action={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="answer">
            What&apos;s your target rate or day-rate range for interim work, so this feels realistic?
          </Label>
          <Textarea id="answer" name="answer" required rows={2} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={isPending} className={isPending ? 'cursor-progress' : ''}>
          {isPending ? 'Saving…' : 'See the directory'}
        </Button>
      </form>

      <UnlockAnnouncementDialog
        open={showUnlockDialog}
        onOpenChange={setShowUnlockDialog}
        introText="Setting your target rate just unlocked:"
        analyticsKey="gig_directory"
        items={[
          {
            href: '/dashboard/interim-work',
            icon: 'compass',
            label: 'Find Interim Work',
            description: 'Browse the interim/fractional directory with your target rate in mind.',
          },
        ]}
      />
    </div>
  )
}
