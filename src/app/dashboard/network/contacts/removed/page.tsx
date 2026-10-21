import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { restoreContact } from '@/app/dashboard/network/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { TrackedAction } from '@/components/candidate/TrackedAction'

export const metadata: Metadata = { title: 'Removed Contacts' }

export default async function RemovedContactsPage() {
  const profile = await getDashboardProfile()
  const contacts = await prisma.supportNetworkContact.findMany({
    where: { candidateId: profile.id, removedAt: { not: null } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, company: true, linkedinUrl: true },
    // No pagination UI on this page — bounded here since a real candidate
    // can have 27,000+ contacts (see the main Contact Directory's own
    // comment on this), and an unbounded list would ship every one of them
    // to the client on every visit.
    take: 500,
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Removed contacts"
        intro="People you took off your list. Restore someone and they are back. Importing a LinkedIn export again never brings them back on its own."
        action={
          <TrackedAction variant="secondary" href="/dashboard/network/contacts" event="contacts_opened" properties={{ source: 'removed_contacts' }}>
            Back to people you know
          </TrackedAction>
        }
      />
      {contacts.length === 0 ? (
        <EmptyCard title="Nobody has been removed" why="Everyone you have added is still on your list." />
      ) : (
        <RowList label="Removed contacts">
          {contacts.map((contact) => (
            <ListRow
              key={contact.id}
              name={contact.name}
              title={contact.name}
              fact={contact.company ?? undefined}
              actions={
                <form action={restoreContact.bind(null, contact.id)}>
                  <SubmitButton size="sm" variant="outline" pendingLabel="Restoring…">
                    Restore
                  </SubmitButton>
                </form>
              }
            />
          ))}
        </RowList>
      )}
    </div>
  )
}
