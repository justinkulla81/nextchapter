import Link from 'next/link'
import { guideDay, type Guide } from '@/lib/warn/layoff-guide'
import { stateName, stateSlug } from '@/lib/seo/states'

const LINK = 'text-brand underline underline-offset-4'
const H3 = 'text-lg font-semibold tracking-tight text-navy'

/**
 * The guide on an employer's layoff page (src/lib/warn/layoff-guide.ts builds it from the record we hold). What the notices
 * show, the dates that follow from them, what to ask the employer, and what to say. Facts come from the filings and
 * announcements on the page; the rest is plain guidance that applies to any layoff or buyout.
 */
export function CompanyLayoffGuide({ name, guide, states }: { name: string; guide: Guide; states: string[] }) {
  const buyout = guide.kind === 'buyout'
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
              <li key={s.id} className="rounded-xl border border-border bg-white p-4">
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

      <div className="mt-6">
        <h3 className={H3}>Questions to ask {name}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {guide.questions.map((g) => (
            <div key={g.heading} className="rounded-xl border border-border bg-white p-4">
              <p className="text-sm font-semibold text-navy">{g.heading}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                {g.items.map((q) => <li key={q}>{q}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className={H3}>What to say</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
          {guide.say.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{guide.reviewWindow}</p>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Work out severance with the <Link href="/tools/severance-calculator" className={LINK}>severance calculator</Link>
          {states.length > 0 && (
            <>
              {' '}and file for benefits through your state:{' '}
              {states.map((s, i) => (
                <span key={s}>
                  {i > 0 && ', '}
                  <Link href={`/unemployment-benefits/${stateSlug(s)}`} className={LINK}>{stateName(s)}</Link>
                </span>
              ))}
            </>
          )}
          .
        </p>
      </div>
    </section>
  )
}
