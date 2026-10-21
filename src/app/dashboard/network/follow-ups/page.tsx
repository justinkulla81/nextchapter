import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getUnifiedFollowUps } from '@/lib/dashboard/unified-follow-ups'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { followUpActionLabel, followUpWhy, followUpsIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { ShowMore } from '@/components/candidate/ShowMore'

export const metadata: Metadata = { title: 'Follow-ups' }

export default async function FollowUpsPage() {
  const profile = await getDashboardProfile()
  const items = await getUnifiedFollowUps(profile.id)

  // The redesign (docs/candidate-redesign.md): the first five, each with one reason and one action. The rest sit behind Show more.
  captureServerEvent(profile.id, 'follow_ups_viewed', { items: items.length })
  const VISIBLE = 5
  const row = (item: (typeof items)[number]) => (
    <ListRow
      key={`${item.kind}-${item.id}`}
      name={item.title}
      title={item.title}
      why={followUpWhy(item.kind)}
      fact={[item.subtitle, item.date ? formatRelativeTime(item.date) : null].filter(Boolean).join(' · ')}
      actions={
        <TrackedAction
          variant="secondary"
          href={item.href}
          external={item.href.startsWith('http')}
          event="follow_up_opened"
          properties={{ kind: item.kind, itemId: item.id, source: 'follow_ups_page' }}
        >
          {followUpActionLabel(item.kind)}
        </TrackedAction>
      }
    />
  )
  const first = items[0]
  return (
    <div className="space-y-8">
      <PageHeader
        title="Follow-ups"
        intro={followUpsIntro(items.length)}
        action={
          first ? (
            <TrackedAction
              variant="primary"
              href={first.href}
              external={first.href.startsWith('http')}
              event="follow_up_opened"
              properties={{ kind: first.kind, itemId: first.id, source: 'follow_ups_primary' }}
            >
              {followUpActionLabel(first.kind)}: {first.title}
            </TrackedAction>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyCard
          title="You are all caught up"
          why="Nothing needs a reply right now. When someone writes back or a conversation goes quiet, it shows up here with a reason."
          action={
            <TrackedAction variant="secondary" href="/dashboard/network/this-week" event="this_week_opened" properties={{ source: 'follow_ups_empty' }}>
              See who to write to this week
            </TrackedAction>
          }
        />
      ) : (
        <>
          <RowList label="Waiting on a reply from you">{items.slice(0, VISIBLE).map(row)}</RowList>
          {items.length > VISIBLE && (
            <ShowMore page="follow_ups" label={`Show ${items.length - VISIBLE} more`}>
              <RowList label="More follow-ups">{items.slice(VISIBLE).map(row)}</RowList>
            </ShowMore>
          )}
        </>
      )}
    </div>
  )
}
