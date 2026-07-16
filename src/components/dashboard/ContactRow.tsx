import type { SupportNetworkContact } from '@prisma/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { updateContact, deleteContact, logOutreach, logMarketResponse } from '@/app/dashboard/network/actions'
import { getOutreachScript, type ScriptContext } from '@/lib/network/scripts'
import type { NetworkingAnxiety } from '@prisma/client'

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Uncategorized' },
  { value: 'FORMER_COLLEAGUE', label: 'Former colleague' },
  { value: 'HIRING_CONNECTION', label: 'Hiring connection' },
  { value: 'OWES_A_FAVOR', label: 'Owes a favor' },
  { value: 'RECENT_TRANSITION', label: 'Recent transition' },
  { value: 'COULD_HELP_IN_RETURN', label: 'Could help in return' },
]

export function ContactRow({
  contact,
  networkingConcerns,
  scriptContext,
}: {
  contact: SupportNetworkContact
  networkingConcerns: NetworkingAnxiety[]
  scriptContext: Omit<ScriptContext, 'contactName'>
}) {
  const script = getOutreachScript(contact.warmth, networkingConcerns, {
    ...scriptContext,
    contactName: contact.name,
  })

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{contact.name}</p>
          {(contact.title || contact.company) && (
            <p className="text-sm text-muted-foreground">
              {[contact.title, contact.company].filter(Boolean).join(' at ')}
            </p>
          )}
        </div>
        <form action={deleteContact.bind(null, contact.id)}>
          <SubmitButton variant="ghost" size="sm">
            Remove
          </SubmitButton>
        </form>
      </div>

      <form action={updateContact.bind(null, contact.id)} className="flex flex-wrap items-center gap-2">
        <select
          name="category"
          defaultValue={contact.category ?? ''}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          name="warmth"
          defaultValue={contact.warmth}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          <option value="HOT">Hot</option>
          <option value="WARM">Warm</option>
          <option value="COLD">Cold</option>
        </select>
        <SubmitButton variant="outline" size="sm">
          Save
        </SubmitButton>
      </form>

      <div className="flex flex-wrap gap-2 pt-1">
        <form action={logOutreach.bind(null, contact.id, 'LINKEDIN')}>
          <SubmitButton variant="outline" size="sm">
            Log LinkedIn outreach
          </SubmitButton>
        </form>
        <form action={logOutreach.bind(null, contact.id, 'PHONE')}>
          <SubmitButton variant="outline" size="sm">
            Log call
          </SubmitButton>
        </form>
        <form action={logOutreach.bind(null, contact.id, 'TEXT')}>
          <SubmitButton variant="outline" size="sm">
            Log text
          </SubmitButton>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-2">
        <p className="w-full text-xs text-muted-foreground">Did this outreach get a response?</p>
        <form action={logMarketResponse.bind(null, 'REPLY')}>
          <SubmitButton variant="ghost" size="sm">
            They replied
          </SubmitButton>
        </form>
        <form action={logMarketResponse.bind(null, 'CONVERSATION')}>
          <SubmitButton variant="ghost" size="sm">
            We had a real conversation
          </SubmitButton>
        </form>
        <form action={logMarketResponse.bind(null, 'REFERRAL')}>
          <SubmitButton variant="ghost" size="sm">
            They referred me
          </SubmitButton>
        </form>
        <form action={logMarketResponse.bind(null, 'PAID_PROJECT_LEAD')}>
          <SubmitButton variant="ghost" size="sm">
            Paid-project lead
          </SubmitButton>
        </form>
      </div>

      <details className="pt-1 text-sm">
        <summary className="cursor-pointer font-medium text-primary">View outreach script</summary>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{script}</p>
      </details>
    </div>
  )
}
