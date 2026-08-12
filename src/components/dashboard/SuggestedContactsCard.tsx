import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import type { SuggestedContact } from '@/lib/network/suggested-contacts'
import { addSuggestedContact, dismissSuggestedContact } from '@/app/dashboard/network/actions'

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Safety net for the silent auto-add in upsertContactFromSignal — see
// getSuggestedContactsToAdd for why someone can still land here (a meeting
// synced before the auto-add existed, a soft-deleted contact, etc). Server
// component with bound server actions, not a client list, since there's no
// local state to manage beyond the standard form-pending affordance.
export function SuggestedContactsCard({ suggestions }: { suggestions: SuggestedContact[] }) {
  if (suggestions.length === 0) return null

  return (
    <Card id="suggested-contacts" className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Suggested contacts to add</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Real people who&apos;ve met with you or emailed you but aren&apos;t on your list yet.
        </p>
      </CardHeader>
      <CardContent className="py-0">
        {suggestions.map((s, i) => (
          <div
            key={`${s.sourceKind}-${s.sourceId}`}
            className={cn(
              'flex items-center justify-between gap-3 py-2.5 text-sm',
              i !== suggestions.length - 1 && 'border-b border-border'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{s.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {s.email}
                {s.inferredCompany ? ` · ${s.inferredCompany}` : ''} ·{' '}
                {s.sourceKind === 'meeting' ? 'Met' : 'Emailed you'} {formatDate(s.connectedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <form
                action={addSuggestedContact.bind(null, {
                  name: s.name,
                  email: s.email,
                  connectedAt: s.connectedAt,
                  inferredCompany: s.inferredCompany,
                })}
              >
                <SubmitButton size="sm" pendingLabel="Adding…">
                  Add to Contact Book
                </SubmitButton>
              </form>
              <form action={dismissSuggestedContact.bind(null, s.sourceId, s.sourceKind)}>
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-medium text-muted-foreground"
                  title="Not a real contact — don't ask again"
                >
                  Not a contact
                </SubmitButton>
              </form>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
