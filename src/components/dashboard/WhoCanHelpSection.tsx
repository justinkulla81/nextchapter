import { linkContactToJob, unlinkContactFromJob } from '@/app/dashboard/find-my-job/actions'
import { SubmitButton } from '@/components/ui/submit-button'

export interface HelpContact {
  id: string
  name: string
}

// "Who can help with this one?" — linked contacts (manually confirmed) plus
// company-matched suggestions the candidate hasn't linked yet. Distinct
// from the Networking page's backchannel-match card: that one surfaces
// *new* matches across all applications; this one is per-job and lets the
// candidate confirm/dismiss which contact actually applies here.
export function WhoCanHelpSection({
  jobId,
  linkedContacts,
  suggestedContacts,
}: {
  jobId: string
  linkedContacts: HelpContact[]
  suggestedContacts: HelpContact[]
}) {
  if (linkedContacts.length === 0 && suggestedContacts.length === 0) return null

  return (
    <div className="space-y-1.5 rounded-md border border-border p-3 text-xs">
      <p className="font-medium text-foreground">Who can help with this one?</p>
      {linkedContacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {linkedContacts.map((contact) => (
            <form key={contact.id} action={unlinkContactFromJob.bind(null, jobId, contact.id)}>
              <SubmitButton
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                title="Not who you meant? Remove"
              >
                {contact.name} ✕
              </SubmitButton>
            </form>
          ))}
        </div>
      )}
      {suggestedContacts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">Works there:</span>
          {suggestedContacts.map((contact) => (
            <form key={contact.id} action={linkContactToJob.bind(null, jobId, contact.id)}>
              <SubmitButton variant="ghost" size="sm" className="h-6 px-2 text-xs">
                + {contact.name}
              </SubmitButton>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}
