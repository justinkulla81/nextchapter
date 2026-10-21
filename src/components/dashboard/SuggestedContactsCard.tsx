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
export function SuggestedContactsCard({ suggestions }: { suggestions: SuggestedContact[] }) {
  if (suggestions.length === 0) return null

  // The redesign: the same people and the same two actions, as rows with the reason they are here.
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
