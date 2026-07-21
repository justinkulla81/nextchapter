'use client'

import { useTransition } from 'react'
import { disconnectCoach, grantCoachDossierConsent } from '@/app/dashboard/privacy/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Surfaces the Prompt 54 consent gate outside onboarding — lets a
// candidate who chose "Not right now" turn it on later, and gives them a
// real way to revoke a coach's access entirely (the only place coachId is
// ever cleared once set).
export function CoachAccessSettings({
  coachName,
  hasConsented,
}: {
  coachName: string
  hasConsented: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <p className="text-sm text-foreground">
        Connected coach: <span className="font-medium">{coachName}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        {hasConsented
          ? `${coachName} can see your Executive Dossier and Coaching Notes in their client view — never downloadable or forwardable by them.`
          : `${coachName} does not have access to your Executive Dossier or Coaching Notes yet.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {!hasConsented && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => grantCoachDossierConsent())}
          >
            Share my Dossier &amp; Coaching Notes
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => disconnectCoach())}
        >
          Disconnect coach
        </Button>
      </div>
    </div>
  )
}
