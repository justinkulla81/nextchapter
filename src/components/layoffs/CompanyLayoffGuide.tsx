import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { guideDay, type Guide } from '@/lib/warn/layoff-guide'
import type { FilingFact, GuideProgram } from '@/lib/warn/layoff-guide-programs'

const LINK = 'text-brand underline underline-offset-4'
const H3 = 'text-lg font-semibold tracking-tight text-navy'
const CARD = 'rounded-xl border border-border bg-white p-4'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

/**
 * The guide on an employer's layoff page (src/lib/warn/layoff-guide.ts builds it from the record we hold). What the notices
 * show, the dates that follow, how to file in each state, what to settle before the last day, the agreements to read, scripts, the
 * programs that fit the state, county, employer and line of work, and a way to make it personal. Facts come from the filings and
 * announcements on the page and from official-source state data; the rest is plain guidance that applies to any layoff or buyout.
 */
export function CompanyLayoffGuide({ name, slug, guide, states, filing, programs }: { name: string; slug: string; guide: Guide; states: string[]; filing: FilingFact[]; programs: GuideProgram[] }) {
  const buyout = guide.kind === 'buyout'
  const track = (target: string) => ({ company: slug, target })
  return (
    <section aria-labelledby="guide" className="mt-12">
      <h2 id="guide" className="text-2xl font-bold tracking-tight text-navy">
        {buyout ? `If you were offered the ${name} buyout: what to ask and when` : `If you were affected by the ${name} layoffs: what to ask and when`}
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        {buyout
          ? 'A buyout is an offer you can answer, not a decision made for you. These are the questions to put in writing before you do.'
          : 'This page can say what was filed and announced. It cannot say who is affected, so confirm your own last day and terms with the employer.'}
      </p>
      <nav aria-label="In this guide" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {[['#guide-ask', 'Questions to ask'], ['#guide-scripts', 'What to say'], ['#guide-filing', 'File for benefits'], ['#guide-before', 'Before your last day'], ['#guide-agreements', 'Agreements'], ['#guide-programs', 'Programs near you']].map(([href, label]) => (
          <a key={href} href={href} className={LINK}>{label}</a>
        ))}
      </nav>

      {guide.facts.length > 0 && (
        <div className="mt-6">
          <h3 className={H3}>What the filings show</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {guide.facts.map((f) => <li key={f.text}>{f.text}</li>)}
          </ul>
        </div>
      )}

      {guide.steps.length > 0 && guide.stepsFrom && (
        <div className="mt-6">
          <h3 className={H3}>Dates to plan around</h3>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Counted from {guideDay(guide.stepsFrom)}, the effective date in the notice. If your last day is different, use the{' '}
            <Link href="/tools/layoff-deadlines" className={LINK}>layoff deadlines tool</Link> with your own. Confirm the exact dates on your paperwork.
          </p>
          <ol className="mt-3 space-y-3 text-sm">
            {guide.steps.map((s) => (
              <li key={s.id} className={CARD}>
                <p className="font-semibold text-navy">{guideDay(s.date)} · {s.title}</p>
                <p className="mt-1 text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {guide.stateNotes.length > 0 && (
        <div className="mt-6">
          <h3 className={H3}>Rules in your state</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {guide.stateNotes.map((n) => <li key={n.state}>{n.text}</li>)}
          </ul>
        </div>
      )}

      <div id="guide-ask" className="mt-6 scroll-mt-20">
        <h3 className={H3}>Questions to ask {name}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {guide.questions.map((g) => (
            <div key={g.heading} className={CARD}>
              <p className="text-sm font-semibold text-navy">{g.heading}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                {g.items.map((q) => <li key={q}>{q}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div id="guide-scripts" className="mt-6 scroll-mt-20">
        <h3 className={H3}>What to say</h3>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Fill in the brackets. Use your own words if they come easier.</p>
        <ul className="mt-3 space-y-3 text-sm">
          {guide.scripts.map((s) => (
            <li key={s.id} className={CARD}>
              <p className="font-semibold text-navy">{s.when}</p>
              <p className="mt-1">“{s.text}”</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{guide.reviewWindow}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Work out what a package is worth with the <Link href="/tools/severance-calculator" className={LINK}>severance calculator</Link>.
        </p>
      </div>

      {filing.length > 0 && (
        <div id="guide-filing" className="mt-6 scroll-mt-20">
          <h3 className={H3}>File for unemployment benefits</h3>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            File in the state where you worked, in your first week, even if you expect severance. Local help with filing is at the workforce boards listed on this page.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {filing.map((f) => (
              <div key={f.state} className={CARD}>
                <p className="text-sm font-semibold text-navy">{f.stateName}{f.agency ? `: ${f.agency}` : ''}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {f.maxWeekly != null && <li>Up to {usd(f.maxWeekly)} a week</li>}
                  {f.maxWeeks != null && <li>Up to {f.maxWeeks} weeks{f.durationVaries ? ', depending on the state unemployment rate' : ''}</li>}
                  {f.waitingWeek != null && <li>{f.waitingWeek ? 'There is a waiting week before benefits are paid' : 'No waiting week'}</li>}
                  {f.severance && <li>Severance pay: {f.severance}</li>}
                </ul>
                <p className="mt-2 text-sm">
                  {f.fileUrl && (
                    <TrackedLink href={f.fileUrl} event="layoff_guide_link_clicked" properties={{ ...track('state_filing'), state: f.state }} className={LINK}>File a claim with the state</TrackedLink>
                  )}
                  {f.fileUrl && ' · '}
                  <TrackedLink href={f.page} event="layoff_guide_link_clicked" properties={{ ...track('state_page'), state: f.state }} className={LINK}>How filing works in {f.stateName}</TrackedLink>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {guide.topics.map((g) => (
        <div key={g.id} id={g.id === 'before-last-day' ? 'guide-before' : g.id === 'agreements' ? 'guide-agreements' : undefined} className="mt-6 scroll-mt-20">
          <h3 className={H3}>{g.heading}</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
            {g.items.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </div>
      ))}

      <div id="guide-programs" className="mt-6 scroll-mt-20">
        <h3 className={H3}>Programs that may help</h3>
        {programs.length > 0 ? (
          <>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Verified programs for the state{states.length > 1 ? 's' : ''} in these notices, the county or city where we have it. Check eligibility on each program’s own page.
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {programs.map((p) => (
                <li key={p.id} className={CARD}>
                  <p className="text-sm font-semibold text-navy">
                    <TrackedLink href={p.url} event="layoff_guide_link_clicked" properties={{ ...track('program'), programId: p.id }} className={LINK} rel="nofollow">{p.name}</TrackedLink>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.where} · {p.help === 'support' ? 'Help while out of work' : 'Retraining'}{p.amount ? ` · ${p.amount}` : ''}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">We have no verified program on file for this location yet. A free account checks the full list against your situation.</p>
        )}
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Programs for veterans, people 50 and over, people with a disability, caregivers and other groups depend on who you are. The free account asks, and matches them to you.
        </p>
      </div>

      <div className="mt-6">
        <h3 className={H3}>More guides</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
          {[
            ['/topics/what-to-say-when-laid-off', 'What to say when you get laid off'],
            ...(buyout ? [['/topics/should-i-take-the-buyout', 'Should I take the buyout?']] : []),
            ['/topics/severance', 'Severance package: what it is and how to negotiate'],
            ['/topics/fired-vs-laid-off', 'Fired vs laid off: the difference and why it matters'],
            ['/topics/acquisition-layoffs', 'Layoffs after an acquisition: what to expect and ask'],
          ].map(([href, label]) => (
            <li key={href}>
              <TrackedLink href={href} event="layoff_guide_link_clicked" properties={track('related_guide')} className={LINK}>{label}</TrackedLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
