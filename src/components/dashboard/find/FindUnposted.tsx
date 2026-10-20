import { ActionLink } from '@/components/candidate/ActionLink'
import { ShowMore } from '@/components/candidate/ShowMore'
import { Avatar, Chip } from '@/components/candidate/ui'
import { FindPartMessage } from '@/components/dashboard/find/FindPartMessage'
import { splitFirstView, type UnpostedItem } from '@/lib/jobs/find-unposted'

// "Not posted yet" in the redesign (mockup: dev-preview/_mockups/jobs-more.tsx FindUnposted). Each opening says what
// happened and the fact it rests on (a public filing or a news report), who the member knows there, and one next step.
// One opening has the primary action. No claim about how many others know: only what the filing says.

function OpeningRow({ item }: { item: UnpostedItem }) {
  const external = item.action.kind === 'search'
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 flex-1 basis-80 gap-4">
        <Avatar name={item.companyName} />
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
            {item.companyName} <Chip tone="warm">{item.signalLabel}</Chip>
          </p>
          <p className="text-base text-ink">{item.summary}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-ink">Who you know:</span> {item.know}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.why && <>Shown because: {item.why}. </>}
            {item.sourceLine}{' '}
            <ActionLink
              kind="text"
              external
              href={item.filingUrl}
              event="likely_opening_filing_opened"
              props={{ likelyOpeningId: item.id, companyName: item.companyName, signalType: item.signalType, source: 'find_my_job' }}
              className="text-xs"
            >
              {item.filingLinkLabel}
            </ActionLink>
          </p>
        </div>
      </div>
      <ActionLink
        kind={item.primary ? 'primary' : 'secondary'}
        external={external}
        href={item.action.href}
        event="likely_opening_action_opened"
        props={{ likelyOpeningId: item.id, companyName: item.companyName, signalType: item.signalType, action: item.action.kind, contactId: item.action.contactId }}
      >
        {item.action.label}
      </ActionLink>
    </li>
  )
}

export function FindUnposted({
  items,
  fullTime,
  includeFullTimeHref,
  watchHref = '/dashboard/companies',
}: {
  items: UnpostedItem[]
  /** Openings come from filings about senior hires, so they are full-time only. */
  fullTime: boolean
  includeFullTimeHref: string
  watchHref?: string
}) {
  if (!fullTime) {
    return (
      <FindPartMessage
        title="Openings before they are posted are full-time roles"
        action={
          <ActionLink kind="primary" href={includeFullTimeHref} event="unposted_full_time_turned_on" props={{}}>
            Include full-time work
          </ActionLink>
        }
      >
        <p>Your search is set to leave out full-time work, and these filings are about full-time leadership hires.</p>
      </FindPartMessage>
    )
  }
  if (items.length === 0) {
    return (
      <FindPartMessage
        title="Nothing new for your background yet"
        action={
          <ActionLink kind="primary" href={watchHref} event="unposted_watch_company_opened" props={{}}>
            Watch a company
          </ActionLink>
        }
      >
        <p>We look at public filings and news for leadership changes and new funding. Openings at companies you watch come first, so watching two or three gives this page something to show.</p>
      </FindPartMessage>
    )
  }
  const { shown, more } = splitFirstView(items)
  return (
    <div className="space-y-6">
      <ul className="divide-y divide-border rounded-2xl border border-border" aria-label="Likely openings">
        {shown.map((i) => (
          <OpeningRow key={i.id} item={i} />
        ))}
      </ul>
      {more.length > 0 && (
        <ShowMore label={`Show ${more.length} more opening${more.length === 1 ? '' : 's'}`} event="find_more_options_opened" properties={{ part: 'unposted', section: 'more_openings', count: more.length }}>
          <ul className="divide-y divide-border rounded-2xl border border-border" aria-label="More likely openings">
            {more.map((i) => (
              <OpeningRow key={i.id} item={i} />
            ))}
          </ul>
        </ShowMore>
      )}
    </div>
  )
}
