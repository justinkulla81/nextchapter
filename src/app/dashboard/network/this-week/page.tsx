import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { getWeeklyOutreachPlan } from '@/lib/network/weekly-outreach'
import { PLAYBOOK_PURPOSES, ASK_SIZES } from '@/lib/network/playbook'
import { Card, CardContent } from '@/components/ui/card'
import { isRedesignOn } from '@/lib/redesign/flag'
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
  if (isRedesignOn(profile.email)) {
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/dashboard/network"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to Network
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">This week&apos;s outreach</h1>
        <p className="text-sm text-muted-foreground">
          The people most worth writing to right now, why, and a draft ready to edit. Five messages a week beats a
          hundred you never send.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-6 text-sm">
            <p className="font-medium text-foreground">Nobody to suggest yet.</p>
            <p className="text-muted-foreground">
              We pick people from your contact list. Import your LinkedIn connections or add a few contacts, and
              this page will tell you who to write to first.
            </p>
            <Link
              href="/dashboard/network/contacts?buildList=1#import"
              className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
            >
              Import your LinkedIn connections
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {items.map((item, i) => {
            const params = new URLSearchParams({ purpose: item.purpose, ask: item.askSize, hook: item.hook, from: 'this-week' })
            if (item.roleTitle) params.set('role', item.roleTitle)
            const purposeLabel = PLAYBOOK_PURPOSES.find((p) => p.purpose === item.purpose)?.label
            const askLabel = ASK_SIZES.find((a) => a.size === item.askSize)?.label
            return (
              <li key={item.contactId}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {i + 1}. {item.name}
                        {item.company ? <span className="font-normal text-muted-foreground"> · {item.company}</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Suggested: {purposeLabel}, {askLabel?.toLowerCase()} ask
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/network/contacts/${item.contactId}?${params.toString()}#outreach-coach`}
                      className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
                    >
                      Draft message
                    </Link>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
