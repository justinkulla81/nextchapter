import { buttonVariants } from '@/components/ui/button'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { cn } from '@/lib/utils'

// The one next step after a signed-out email capture: start the free account with the same email.
// `from` names the form so the start of registration and PostHog know where the person came from.
export function JoinFreeAfterSave({ from, properties }: { from: string; properties?: Record<string, unknown> }) {
  return (
    <span className="mt-3 block">
      <span className="block text-muted-foreground">Create your free account with the same email.</span>
      <TrackedLink
        href={`/onboarding/desire?from=${from}`}
        event={`${from}_create_account_clicked`}
        properties={{ from, ...properties }}
        className={cn(buttonVariants({ size: 'lg' }), 'mt-3 h-12 w-full rounded-full bg-action text-action-foreground hover:brightness-95 sm:w-auto sm:px-6')}
      >
        Join free
      </TrackedLink>
    </span>
  )
}
