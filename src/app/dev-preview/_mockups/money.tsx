import { Check } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip, Meter, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'

const Fine = () => <p className="text-xs text-muted-foreground">General information, not financial or legal advice. Only you see this page.</p>

export function MoneyRunway() {
  return (
    <PreviewShell place="money" entry="runway">
      <PageHeader title="Your runway" intro="What you have, how long it lasts, and what would stretch it. Private to you." action={<PrimaryButton>Check your next deadline</PrimaryButton>} />
      <section className="space-y-5 rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">About</p><p className="font-display text-5xl font-semibold text-ink">6.5 months</p><p className="text-base text-ink">of cushion at your current spending</p></div><TextLink>Update my numbers</TextLink></div>
        <Meter pct={54} label="Months of cushion" />
        <dl className="grid gap-3 sm:grid-cols-4 text-center">{[['$18,400', 'Savings'], ['$9,000', 'Severance'], ['$1,800 a month', 'Unemployment, 12 weeks left'], ['$5,000 a month', 'What you need']].map(([v, l]) => <div key={l} className="rounded-xl bg-muted/60 px-2 py-3"><dd className="text-base font-semibold text-ink">{v}</dd><dt className="text-xs text-muted-foreground">{l}</dt></div>)}</dl>
      </section>
      <Section id="stretch" title="What would stretch it">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Bring in $2,000 a month of interim or part-time work', 'About 2 more months', 'Look at interim work'], ['Trim $400 a month for now', 'About half a month more', 'See where it could come from'], ['Certify every week without a gap', 'Keeps $1,800 a month coming', 'Set a weekly reminder']].map(([t, g, a]) => <li key={t} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-muted-foreground">{g}</p></div><SecondaryButton>{a}</SecondaryButton></li>)}
        </ul>
      </Section>
      <p className="text-sm text-ink"><span className="font-semibold">Want to talk it through with your partner?</span> <TextLink>Share a calm summary</TextLink></p>
      <Fine />
    </PreviewShell>
  )
}

export function MoneyDeadlines() {
  const rows: [string, string, string, string, boolean][] = [
    ['Choose your health coverage', 'By Nov 14 · 28 days', 'Your employer plan ends Oct 31. You can keep it with COBRA or compare marketplace plans. Both have a deadline.', 'Compare your options', false],
    ['Review your severance before you sign', 'By Nov 3 · 17 days', 'Terms and a release often can be negotiated. A short review now is worth it.', 'See what to check', false],
    ['Claim unemployment', 'Do it this week', 'Benefits usually start from the day you file, not the day you were let go.', 'Open your state’s site', true],
    ['Certify each week', 'Every Sunday', 'Missing a weekly certification can pause your payments.', 'Remind me', false],
    ['Decide what to do with your 401(k)', 'No rush', 'You can leave it, roll it, or move it later.', 'Learn the options', false],
  ]
  return (
    <PreviewShell place="money" entry="deadlines">
      <PageHeader title="Benefits and deadlines" intro="The paperwork that has a date on it, in the order it matters." />
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {rows.map(([t, d, w, a, done], i) => (
          <li key={t} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex min-w-0 flex-1 gap-4"><span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${done ? 'bg-success text-white' : 'bg-muted text-ink'} text-sm font-semibold`}>{done ? <Check className="size-4" aria-hidden /> : i + 1}</span><div className="space-y-0.5"><p className="text-base font-semibold text-ink">{t} <Chip tone={done ? 'good' : i < 2 ? 'warm' : 'muted'}>{done ? 'Done' : d}</Chip></p><p className="text-sm text-muted-foreground">{w}</p></div></div>
            {i === 0 ? <PrimaryButton>{a}</PrimaryButton> : <SecondaryButton>{a}</SecondaryButton>}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">Dates are worked out from your last day, Oct 31, and your state. Rules differ by state. <TextLink>Check your state</TextLink></p>
      <Fine />
    </PreviewShell>
  )
}

export function MoneyEntrepreneur() {
  return (
    <PreviewShell place="money" entry="runway">
      <PageHeader title="Your runway" intro="Your own money and your business’s, side by side, with a date to decide." action={<PrimaryButton>Set your go or no-go date</PrimaryButton>} />
      <div className="grid gap-4 sm:grid-cols-2">
        {[['Personal', '8 months', 'Savings of $42,000 at $5,200 a month', 62], ['The business', '3 months', 'Cash of $9,000 at $3,000 a month, $4,500 owed to you', 28]].map(([t, m, d, p]) => (
          <section key={t as string} className="space-y-3 rounded-2xl border border-border p-6"><h2 className="font-display text-xl font-semibold text-ink">{t}</h2><p className="font-display text-4xl font-semibold text-ink">{m}</p><Meter pct={p as number} label={`${t} runway`} /><p className="text-sm text-muted-foreground">{d}</p></section>
        ))}
      </div>
      <Section id="next" title="Coming up">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Quarterly estimated taxes', 'Jan 15, 3 months away', 'Set aside about 25% of what you have billed.'], ['Two invoices are overdue', '$4,500', 'A short reminder is drafted for each.'], ['Health insurance renews', 'Dec 31', 'Compare self-employed plans before then.']].map(([t, d, w]) => <li key={t} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-base font-semibold text-ink">{t} <Chip>{d}</Chip></p><p className="text-sm text-muted-foreground">{w}</p></div><TextLink>Open</TextLink></li>)}
        </ul>
      </Section>
      <p className="rounded-2xl bg-muted/60 p-4 text-sm text-ink"><span className="font-semibold">A go or no-go date helps.</span> Pick a date to look at the numbers and decide, so it is a choice and not a drift. If it is no-go, your job search is ready to start.</p>
      <Fine />
    </PreviewShell>
  )
}
