import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getWeeklyOutreachPlan } from '@/lib/network/weekly-outreach'
import { thisWeekIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { TrackedAction } from '@/components/candidate/TrackedAction'

export const metadata: Metadata = { title: "This week's outreach" }

export default async function ThisWeekPage() {
  const profile = await getDashboardProfile()
  const items = await getWeeklyOutreachPlan(profile.id)

  // The redesign (docs/candidate-redesign.md): one headline, one primary action (the first draft), a short list.
  captureServerEvent(profile.id, 'this_week_viewed', { people: items.length, firstContactId: items[0]?.contactId ?? null })
  const draftHref = (item: (typeof items)[number]) => {
    const params = new URLSearchParams({ purpose: item.purpose, ask: item.askSize, hook: item.hook, from: 'this-week' })
    if (item.roleTitle) params.set('role', item.roleTitle)
    return `/dashboard/network/contacts/${item.contactId}?${params.toString()}#outreach-coach`
  }
  const [first, ...rest] = items
  return (
    <div className="space-y-8">
      <PageHeader
        title="This week"
        intro={thisWeekIntro(items.length)}
        action={
          first ? (
            <TrackedAction variant="primary" href={draftHref(first)} event="outreach_draft_opened" properties={{ contactId: first.contactId, source: 'this_week_primary', purpose: first.purpose, askSize: first.askSize }}>
              Draft the first message
            </TrackedAction>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyCard
          title="Nobody to suggest yet"
          why="We pick people from your contact list. Import your LinkedIn connections or add a few contacts, and this page tells you who to write to first."
          action={
            <TrackedAction variant="secondary" href="/dashboard/network/contacts?buildList=1#import" event="contacts_import_opened" properties={{ source: 'this_week_empty' }}>
              Add people you know
            </TrackedAction>
          }
        />
      ) : (
        <RowList label="People to write to this week">
          {[first, ...rest].map((item) => (
            <ListRow
              key={item.contactId}
              name={item.name}
              title={`${item.name}${item.company ? ` · ${item.company}` : ''}`}
              why={item.reason}
              actions={
                <TrackedAction variant="secondary" href={draftHref(item)} event="outreach_draft_opened" properties={{ contactId: item.contactId, source: 'this_week_row', purpose: item.purpose, askSize: item.askSize }}>
                  See the draft
                </TrackedAction>
              }
            />
          ))}
        </RowList>
      )}
      <TrackedAction variant="text" href="/dashboard/network/follow-ups" event="follow_ups_opened" properties={{ source: 'this_week' }}>
        See who is waiting on a reply
      </TrackedAction>
    </div>
  )
}
