import Link from 'next/link'
import { SubmitButton } from '@/components/ui/submit-button'
import { addFirmAsNewOrg, linkFirmToSuggestedOrg } from '@/app/support/admin/(portal)/crm/search-firms/actions'

/**
 * A search firm whose name is close to, but not the same as, an organization
 * already in the CRM. A person decides: the same firm (link it) or a
 * different one (add it as its own organization). Never merged on a guess.
 */
export function SearchFirmReviewRow({
  firmId, firmName, orgId, orgName, reason, compact = false,
}: {
  firmId: string
  firmName: string
  orgId: string
  orgName: string
  reason: string | null
  compact?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className={compact ? 'text-xs' : 'text-sm'}>
        {compact ? null : <span className="font-medium">{firmName}</span>}
        {compact ? 'Same as ' : ' — same as '}
        <Link href={`/support/admin/crm/organizations/${orgId}`} className="underline">{orgName}</Link>?
        {reason && <span className="block text-xs text-muted-foreground">{reason}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <form action={linkFirmToSuggestedOrg.bind(null, firmId)}>
          <SubmitButton size="sm" variant="outline" pendingLabel="Linking…">Same firm — link</SubmitButton>
        </form>
        <form action={addFirmAsNewOrg.bind(null, firmId)}>
          <SubmitButton size="sm" variant="outline" pendingLabel="Adding…">Different — add as new</SubmitButton>
        </form>
      </div>
    </div>
  )
}
