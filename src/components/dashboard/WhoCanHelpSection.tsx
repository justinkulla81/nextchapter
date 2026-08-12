import { CheckCircle2 } from 'lucide-react'
import { linkContactToJob, unlinkContactFromJob } from '@/app/dashboard/find-my-job/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { ContactQuickLink } from '@/components/dashboard/ContactQuickLink'

export interface HelpContact {
  id: string
  name: string
  email?: string | null
  linkedinUrl?: string | null
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
    <div className="space-y-2.5 rounded-md border border-border p-3.5 text-sm">
      <p className="font-medium text-foreground">Who can help with this one?</p>
      {linkedContacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {linkedContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-1.5 rounded-full border border-orange/30 bg-orange/10 py-1.5 pr-1.5 pl-3"
            >
              <CheckCircle2 className="size-3.5 shrink-0 text-orange" aria-hidden />
              <ContactQuickLink
                name={contact.name}
                email={contact.email}
                linkedinUrl={contact.linkedinUrl}
                className="text-sm text-orange"
              />
              <form action={unlinkContactFromJob.bind(null, jobId, contact.id)}>
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-orange"
                  title="Not who you meant? Remove"
                >
                  ✕
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
      {suggestedContacts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Works there:</span>
          {suggestedContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-1.5 rounded-full border border-border py-1.5 pr-1.5 pl-3"
            >
              <ContactQuickLink name={contact.name} email={contact.email} linkedinUrl={contact.linkedinUrl} className="text-sm" />
              <form action={linkContactToJob.bind(null, jobId, contact.id)}>
                <SubmitButton variant="secondary" size="sm" className="h-6 px-2 text-xs">
                  Confirm
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
