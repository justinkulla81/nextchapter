import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { NotJobRelatedPicker } from '@/components/dashboard/NotJobRelatedPicker'
import type { SuggestedContact } from '@/lib/network/suggested-contacts'
import { addSuggestedContact } from '@/app/dashboard/network/actions'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { Section } from '@/components/candidate/ui'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Safety net for the silent auto-add in upsertContactFromSignal — see
// getSuggestedContactsToAdd for why someone can still land here (a meeting
// synced before the auto-add existed, a soft-deleted contact, etc). Server
// component with bound server actions, not a client list, since there's no
// local state to manage beyond the standard form-pending affordance.
export function SuggestedContactsCard({ suggestions, redesign = false }: { suggestions: SuggestedContact[]; redesign?: boolean }) {
  if (suggestions.length === 0) return null

  // The redesign: the same people and the same two actions, as rows with the reason they are here.
  if (redesign) {
    return (
      <div id="suggested-contacts" className="scroll-mt-4">
        <Section id="suggested-title" title="People to add">
          <RowList label="People to add to your contacts">
            {suggestions.map((s) => (
              <ListRow
                key={`${s.sourceKind}-${s.sourceId}`}
                name={s.name}
                title={s.name}
                why={`${s.sourceKind === 'meeting' ? 'You met' : 'They emailed you'} on ${formatDate(s.connectedAt)}, and they are not on your list yet.`}
                fact={[s.email, s.inferredCompany].filter(Boolean).join(' · ')}
                actions={
                  <>
                    <form
                      action={addSuggestedContact.bind(null, {
                        name: s.name,
                        email: s.email,
                        connectedAt: s.connectedAt,
                        inferredCompany: s.inferredCompany,
                      })}
                    >
                      <ActionSubmit variant="secondary" pendingLabel="Adding…" event="suggested_contact_added" props={{ sourceKind: s.sourceKind, sourceId: s.sourceId }}>
                        Add to my contacts
                      </ActionSubmit>
                    </form>
                    <NotJobRelatedPicker sourceId={s.sourceId} sourceKind={s.sourceKind === 'meeting' ? 'meeting' : 'email'} senderLabel={s.name} redesign />
                  </>
                }
              />
            ))}
          </RowList>
        </Section>
      </div>
    )
  }

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
              <NotJobRelatedPicker
                sourceId={s.sourceId}
                sourceKind={s.sourceKind === 'meeting' ? 'meeting' : 'email'}
                senderLabel={s.name}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
