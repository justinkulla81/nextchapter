'use client'

import { PreviewShell } from '@/components/candidate/PreviewShell'

// "Your CRO feed": Network > Industry and function, for a member whose résumé title or target role is a leadership role.
// Sample data (companies and firms are made up; the shows are real). Page contract (docs/candidate-redesign.md): one headline,
// one primary action, three sections on the first view, every item says why it is here, no row carries more than a title, one
// fact and two actions.
//
// What it removes: for a member with a role, this replaces the generic "Join a community" body of Industry and function
// (the function and industry community lists). Those communities stay one link away under "Other communities". It adds no
// new menu entry, no new strip on Home and no second recruiter list: it takes the place of the recruiter shortlist on the
// Recruiters part for this member too (that part links here).

const more = 'text-sm font-medium text-brand underline underline-offset-4'
const primary = 'inline-flex h-12 items-center rounded-full bg-action px-8 text-base font-semibold text-action-foreground hover:brightness-95'

interface Row { title: string; fact: string; why: string; actions: string[] }

const THIS_WEEK: Row[] = [
  { title: 'Orchard Software named a new CRO', fact: 'Filed with the SEC on Nov 2. The previous CRO left in September.', why: 'A new CRO often rebuilds the sales leadership team in the first 90 days.', actions: ['See the filing', 'See their open jobs'] },
  { title: 'Harbor Freight Systems: CRO leaving', fact: 'Filed Oct 29. No successor named yet.', why: 'A seat with no successor is the earliest sign of a search.', actions: ['See the filing', 'Follow this company'] },
  { title: 'Revenue Summit, Austin', fact: 'Mar 11 to 13. Passes from $1,495. Speaker applications close Dec 15.', why: 'It is tagged for sales leaders at the C-suite and VP level.', actions: ['Save it', 'Add to calendar'] },
]

const RECRUITERS: Row[] = [
  { title: 'Cedar Ridge Partners', fact: '14 live searches for sales leaders at your level.', why: 'Counted from its own public job postings.', actions: ['Express interest', 'See its searches'] },
  { title: 'Lakeshore Executive Search', fact: '9 live searches, 6 of them at the C-suite level.', why: 'Counted from its own public job postings.', actions: ['Express interest', 'See its searches'] },
  { title: 'Northgate Talent', fact: '5 live searches, mostly software companies.', why: 'Counted from its own public job postings.', actions: ['Express interest', 'See its searches'] },
]

const ALSO = [
  { label: 'Podcasts and newsletters', items: 'Revenue Leadership Podcast, Pavilion, and 2 more' },
  { label: 'Training', items: '6 sales and AI courses, 3 of them free' },
]

function RowList({ rows }: { rows: Row[] }) {
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {rows.map((r) => (
        <li key={r.title} className="grid gap-x-6 gap-y-1 p-4 md:grid-cols-[1fr_auto]">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-ink">{r.title}</h3>
            <p className="text-base text-ink">{r.fact}</p>
            <p className="text-sm text-muted-foreground"><span className="font-semibold">Why:</span> {r.why}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:flex-col md:items-start md:justify-center">
            {r.actions.map((a) => <a key={a} href="#" className={more}>{a}</a>)}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function RoleFeed() {
  return (
    <PreviewShell place="network" entry="circles" part="industry">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">Your CRO feed</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          You are in the CRO network because your résumé title is Chief Revenue Officer. A short email comes each Monday.{' '}
          <a href="#" className={more}>Unsubscribe</a>
        </p>
      </header>

      <section aria-labelledby="week" className="space-y-3 rounded-2xl border border-border bg-white p-5">
        <h2 id="week" className="font-display text-2xl leading-tight font-semibold text-ink text-balance">2 CRO seats changed hands this week.</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> Companies that change their CRO usually hire around the new one. These two are the nearest to your background.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="#" className={primary}>See jobs at these companies</a>
          <a href="#" className={more}>Mute turnover news</a>
        </div>
      </section>

      <section aria-labelledby="new" className="space-y-3">
        <h2 id="new" className="font-display text-xl font-semibold text-ink">New this week</h2>
        <RowList rows={THIS_WEEK} />
      </section>

      <section aria-labelledby="recruiters" className="space-y-3">
        <h2 id="recruiters" className="font-display text-xl font-semibold text-ink">Recruiters who place CROs</h2>
        <RowList rows={RECRUITERS} />
        <a href="#" className={more}>See all 23 firms</a>
      </section>

      <details className="rounded-2xl bg-muted/50 px-5 py-3 text-sm text-ink">
        <summary className="cursor-pointer font-semibold">More for CROs</summary>
        <ul className="mt-3 space-y-2">
          {ALSO.map((a) => (
            <li key={a.label}><span className="font-semibold">{a.label}:</span> {a.items}. <a href="#" className={more}>Open</a></li>
          ))}
        </ul>
        <p className="mt-3 text-muted-foreground">Looking for other communities, like Sales or Software? <a href="#" className={more}>Other communities</a></p>
      </details>
    </PreviewShell>
  )
}

/** A quiet week: nothing new, so the page says so and shows the standing lists. */
export function RoleFeedQuiet() {
  return (
    <PreviewShell place="network" entry="circles" part="industry">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">Your CRO feed</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          You are in the CRO network because your target role is Chief Revenue Officer. A short email comes each Monday.{' '}
          <a href="#" className={more}>Unsubscribe</a>
        </p>
      </header>

      <section aria-labelledby="week" className="space-y-3 rounded-2xl border border-border bg-white p-5">
        <h2 id="week" className="font-display text-2xl leading-tight font-semibold text-ink text-balance">No CRO seats changed hands this week.</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> We check SEC filings daily. The last CRO change was 19 days ago, at Orchard Software.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="#" className={primary}>See 412 open CRO jobs</a>
        </div>
      </section>

      <section aria-labelledby="recruiters" className="space-y-3">
        <h2 id="recruiters" className="font-display text-xl font-semibold text-ink">Recruiters who place CROs</h2>
        <RowList rows={RECRUITERS.slice(0, 2)} />
        <a href="#" className={more}>See all 23 firms</a>
      </section>
    </PreviewShell>
  )
}
