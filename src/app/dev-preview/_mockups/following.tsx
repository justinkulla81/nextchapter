import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip, PrimaryButton, SecondaryButton, TextLink } from '@/components/candidate/ui'

// Sample data only. The real page reads CompanyWatchlistEntry, ConferenceInterest and the member's email subscriptions.

const SORTS = ['Needs attention first', 'Newest follow', 'A to Z']

type Row = { name: string; tone: 'warm' | 'good' | 'muted'; verdict: string; reason: string; fact: string; primary: string }

const QUIET: Row = { name: 'Trane Technologies', tone: 'muted', verdict: 'Nothing new', reason: 'No openings or news since Oct 2.', fact: 'Followed Sep 14.', primary: 'See the company' }

// Every suggestion says which of the member's own information it rests on, or it is not shown.
const SUGGESTED: { name: string; reason: string; fact: string }[] = [
  { name: 'Eaton', reason: 'Your résumé shows plant finance at a manufacturer, and you follow two others like it.', fact: '9 openings that fit, none of them on the big boards.' },
  { name: 'Parker Hannifin', reason: 'Your market report puts Ohio operations roles among your strongest matches.', fact: 'Hiring in Cleveland and Columbus.' },
  { name: 'Mettler Toledo', reason: 'You scored high on analytical work in your assessment, and they hire for it.', fact: '4 openings, pay $118k to $146k.' },
]

const ROWS: { group: string; rows: Row[] }[] = [
  {
    group: 'Needs your attention',
    rows: [
      { name: 'Schaeffler', tone: 'warm', verdict: 'Layoffs reported Nov 3', reason: 'Two publishers reported cuts. No state filing yet.', fact: 'You followed it today.', primary: 'See your plan' },
      { name: 'Intel', tone: 'warm', verdict: 'New WARN notice', reason: 'A notice was filed for Hillsboro, Oregon on Oct 28.', fact: '14 openings in your field.', primary: 'See your plan' },
    ],
  },
  {
    group: 'Hiring in your field',
    rows: [
      { name: 'JPMorgan Chase', tone: 'good', verdict: 'Good fit', reason: 'You have led finance at a company this size.', fact: '6 new openings since you last looked.', primary: 'See 6 openings' },
      { name: 'Cardinal Health', tone: 'good', verdict: 'Good fit', reason: 'Three roles match your operations background.', fact: '3 new openings.', primary: 'See 3 openings' },
    ],
  },
]

export function FollowingCompanies() {
  return (
    <PreviewShell place="jobs" entry="following" part="companies">
      <PageHeader title="What you follow" intro="Companies, events and emails in one place, with the ones that need you on top." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Sort companies" className="flex flex-wrap gap-2">
          {SORTS.map((s, i) => (
            <button key={s} type="button" aria-pressed={i === 0} className={i === 0 ? 'rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-ink' : 'rounded-lg border border-border px-3 py-2 text-sm text-ink hover:bg-muted'}>{s}</button>
          ))}
        </div>
        <PrimaryButton>Follow a company</PrimaryButton>
      </div>
      {ROWS.map((g) => (
        <section key={g.group} aria-label={g.group} className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{g.group}</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {g.rows.map((r) => (
              <li key={r.name} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-base font-semibold text-ink">{r.name} <Chip tone={r.tone}>{r.verdict}</Chip></p>
                  <p className="text-sm text-ink">{r.reason}</p>
                  <p className="text-sm text-muted-foreground">{r.fact}</p>
                </div>
                <div className="flex items-center gap-4">
                  <SecondaryButton>{r.primary}</SecondaryButton>
                  <TextLink>Unfollow</TextLink>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <details className="rounded-2xl border border-border">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-ink">Quiet for now (1)</summary>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-4">
          <div className="space-y-0.5"><p className="text-base font-semibold text-ink">{QUIET.name} <Chip tone={QUIET.tone}>{QUIET.verdict}</Chip></p><p className="text-sm text-ink">{QUIET.reason}</p><p className="text-sm text-muted-foreground">{QUIET.fact}</p></div>
          <div className="flex items-center gap-4"><SecondaryButton>{QUIET.primary}</SecondaryButton><TextLink>Unfollow</TextLink></div>
        </div>
      </details>
      <section aria-label="Companies we think fit you" className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">We think these fit you</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {SUGGESTED.map((r) => (
            <li key={r.name} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0 space-y-0.5">
                <p className="text-base font-semibold text-ink">{r.name}</p>
                <p className="text-sm text-ink"><span className="font-semibold">Why:</span> {r.reason}</p>
                <p className="text-sm text-muted-foreground">{r.fact}</p>
              </div>
              <div className="flex items-center gap-4"><SecondaryButton>Follow {r.name}</SecondaryButton><TextLink>Not for me</TextLink></div>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-muted-foreground">Followed because you said you were interested, from a layoff page or a company page. Unfollowing stops the alerts and keeps nothing.</p>
    </PreviewShell>
  )
}

export function FollowingEvents() {
  const rows: [string, string, string][] = [
    ['SHRM Annual Conference', 'Going · Jun 14, Orlando', 'Early pricing ends Dec 1.'],
    ['Finance Leaders Summit', 'Following · dates not announced', 'We will tell you when the next dates are set.'],
  ]
  return (
    <PreviewShell place="jobs" entry="following" part="events">
      <PageHeader title="What you follow" intro="Companies, events and emails in one place, with the ones that need you on top." />
      <div className="flex justify-end"><PrimaryButton>Find a conference</PrimaryButton></div>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {rows.map(([n, s, w]) => (
          <li key={n} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div><p className="text-base font-semibold text-ink">{n}</p><p className="text-sm text-ink">{s}</p><p className="text-sm text-muted-foreground">{w}</p></div>
            <div className="flex items-center gap-4"><SecondaryButton>Add to my calendar</SecondaryButton><TextLink>Stop following</TextLink></div>
          </li>
        ))}
      </ul>
    </PreviewShell>
  )
}

export function FollowingEmails() {
  const rows: [string, string, string][] = [
    ['Layoff alerts', 'When a company you follow has layoffs or a WARN notice.', 'On'],
    ['New openings', 'A short list when followed companies post roles that fit you.', 'On'],
    ['Weekly plan', 'Your week, every Monday.', 'On'],
  ]
  return (
    <PreviewShell place="jobs" entry="following" part="emails">
      <PageHeader title="What you follow" intro="Companies, events and emails in one place, with the ones that need you on top." />
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {rows.map(([n, d, s]) => (
          <li key={n} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div><p className="text-base font-semibold text-ink">{n}</p><p className="text-sm text-muted-foreground">{d}</p></div>
            <div className="flex items-center gap-3"><Chip tone="good">{s}</Chip><SecondaryButton>Turn off</SecondaryButton></div>
          </li>
        ))}
      </ul>
    </PreviewShell>
  )
}
