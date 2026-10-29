import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { formatContentDate } from '@/components/seo/AuthorByline'
import { APPEAL_DEADLINES, appealDaysLabel } from '@/lib/data/state-ui-appeals'
import type { StateUI } from '@/lib/data/state-ui-types'

const LINK = 'text-brand underline underline-offset-4'
const H2 = 'text-2xl font-bold tracking-tight text-navy'

const DOL_APPEALS = 'https://oui.doleta.gov/unemploy/pdf/uilawcompar/2023/appeals.pdf'
export const DOL_FILING_HELP = 'https://www.careeronestop.org/LocalHelp/UnemploymentBenefits/find-unemployment-benefits.aspx'

/** What every state's claim form asks for. Stated as what to gather, not as a promise about one agency's form. */
export const READY_LIST = [
  'Your Social Security number',
  'A driver’s license or state ID',
  'Names, addresses and dates of work for your recent employers (many states ask for the last 18 months; your agency says how far back)',
  'The reason each job ended, and your last day worked',
  'Bank account and routing numbers if you want direct deposit',
  'If you are not a U.S. citizen, your work authorization number',
]

/** The appeal deadline sentence used on the page and in its FAQ, or null when we have no figure for the state. */
export function appealSentence(code: string, name: string): string | null {
  const a = APPEAL_DEADLINES[code]
  if (!a) return null
  return `In ${name} you have ${appealDaysLabel(a)} from ${a.from} to appeal a denial${a.extra ? ` (${a.extra})` : ''}. The deadline printed on your own notice controls.`
}

/**
 * Numbered steps for filing, what to have ready, and the appeal deadline, for one state. Every state-specific
 * value comes from the sourced STATE_UI and APPEAL_DEADLINES tables; where a value is missing the text tells the reader to ask the agency.
 */
export function StateFilingGuide({ name, code, ui, agency }: { name: string; code: string; ui: StateUI; agency: string }) {
  const appeal = APPEAL_DEADLINES[code]
  const fileUrl = ui.fileUrl.value
  return (
    <>
      <section aria-labelledby="how-to-file" className="mt-12">
        <h2 id="how-to-file" className={H2}>How to file for unemployment in {name}, step by step</h2>
        <ol className="mt-4 max-w-3xl list-decimal space-y-3 pl-5 text-base leading-relaxed">
          <li>
            <span className="font-semibold text-navy">Gather what you need</span> (the list below) before you start, so the form does not time out.
          </li>
          <li>
            <span className="font-semibold text-navy">File an initial claim with {agency}.</span> File the first week you are out of work; most states pay only from the week you file.{' '}
            {fileUrl ? (
              <TrackedLink href={fileUrl} event="benefits_file_claim_clicked" properties={{ state: code, placement: 'steps' }} className={LINK}>
                Open {name}’s filing page
              </TrackedLink>
            ) : (
              <a href={DOL_FILING_HELP} target="_blank" rel="noopener noreferrer" className={LINK}>Find your state’s filing page on CareerOneStop</a>
            )}
          </li>
          <li>
            <span className="font-semibold text-navy">
              {ui.waitingWeek.value === true
                ? 'Expect one unpaid waiting week.'
                : ui.waitingWeek.value === false
                  ? 'No unpaid waiting week.'
                  : 'Ask about the waiting week.'}
            </span>{' '}
            {ui.waitingWeek.value === true
              ? `${name} does not pay the first eligible week, so filing early starts that week sooner.`
              : ui.waitingWeek.value === false
                ? `${name} has no unpaid waiting week, so payment can start with your first eligible week.`
                : `Ask ${agency} whether the first week is unpaid.`}
          </li>
          <li>
            <span className="font-semibold text-navy">Request payment every week or every two weeks.</span> Filing the claim does not pay you. You report that you are still out of work and looking, on the schedule {agency} gives you, or that week is not paid.
          </li>
          <li>
            <span className="font-semibold text-navy">Meet the work-search rule.</span>{' '}
            {ui.workSearch.value ? `${ui.workSearch.value}` : `Ask ${agency} what work search it requires.`}
          </li>
          <li>
            <span className="font-semibold text-navy">Read every notice that arrives.</span> The agency’s decision on your claim comes by mail or online, and the appeal clock starts on it (below).
          </li>
        </ol>
      </section>

      <section aria-labelledby="ready" className="mt-12">
        <h2 id="ready" className={H2}>What to have ready before you file in {name}</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-1.5 pl-5 text-base leading-relaxed">
          {READY_LIST.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          The form is {agency}’s own; this list is what state claim forms commonly ask. See also CareerOneStop’s{' '}
          <a href={DOL_FILING_HELP} target="_blank" rel="noopener noreferrer" className={LINK}>unemployment benefits finder</a>.
        </p>
      </section>

      <section aria-labelledby="appeal" className="mt-12">
        <h2 id="appeal" className={H2}>If your {name} claim is denied: the appeal deadline</h2>
        {appeal ? (
          <div className="mt-4 max-w-3xl space-y-3 leading-relaxed">
            <p className="text-lg">
              <span className="font-semibold text-navy">{appealDaysLabel(appeal)}</span> from {appeal.from}
              {appeal.extra ? ` (${appeal.extra})` : ''}.
            </p>
            <p>
              That is the published figure for a claimant’s first appeal. The date printed on your own notice controls, so use it if it differs, and file on the first day you can: a late appeal is usually refused.
              Most agencies say to keep requesting payment every week while an appeal is pending; ask {agency}.
            </p>
            <p className="text-xs text-muted-foreground">
              {appeal.source === DOL_APPEALS ? 'Source: U.S. Department of Labor, Comparison of State Unemployment Insurance Laws, Table 7-2, state law as of ' : `Source: the state’s own published rule or page, checked `}{formatContentDate(appeal.asOf)}.{' '}
              <a href={appeal.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">source</a>.
            </p>
          </div>
        ) : (
          <p className="mt-4 max-w-3xl">The appeal deadline is printed on your denial notice. Ask {agency} if you cannot find it.</p>
        )}
        <p className="mt-3 text-sm">
          <Link href="/resources/unemployed" className={LINK}>After you file: what actually works in a job search</Link>
        </p>
      </section>
    </>
  )
}

/** One line for pages about a place or an organization in a state: where to file there. */
export function StateFilingLink({ name, slug, className = '' }: { name: string; slug: string; className?: string }) {
  return (
    <p className={`text-sm ${className}`}>
      Laid off in {name}?{' '}
      <Link href={`/unemployment-benefits/${slug}#how-to-file`} className={LINK}>
        How to file for unemployment in {name}
      </Link>{' '}
      <span className="text-muted-foreground">(steps, weekly amount and the appeal deadline).</span>
    </p>
  )
}
