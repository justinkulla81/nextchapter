import { SubmitButton } from '@/components/ui/submit-button'
import { logLinkedInMessage } from '@/app/support/admin/(portal)/crm/actions'

// LinkedIn exposes no API for DMs and its pages return a login wall to
// anything that isn't a signed-in browser, so this is the one channel that
// can never log itself. It gets the shortest possible manual path: one
// button, no modal.
export function CrmLogLinkedInButton({ personId }: { personId: string }) {
  const log = logLinkedInMessage.bind(null, personId)
  return (
    <form action={log}>
      <SubmitButton variant="outline" size="sm" pendingLabel="Logging…" savedLabel="Logged">
        Log LinkedIn message
      </SubmitButton>
    </form>
  )
}
