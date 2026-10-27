import Link from 'next/link'
import { formatContentDate } from '@/components/seo/AuthorByline'
import { TREATMENT_LABEL, TREATMENT_SENTENCE } from '@/lib/severance/calc'
import type { StateSeverance } from '@/lib/severance/state-groups'

const LINK = 'text-brand underline underline-offset-4'

/**
 * The answer first, on a state's unemployment page: does severance affect unemployment here? One plain sentence for the kind of rule the
 * state has, then the state's own rule exactly as sourced. A state whose rule could not be confirmed says so and sends the reader to the agency.
 */
export function SeveranceVerdict({ row, agency }: { row: StateSeverance; agency: string }) {
  return (
    <section aria-labelledby="severance-answer" className="mt-8 rounded-xl border border-border bg-off-white p-6">
      <h2 id="severance-answer" className="text-xl font-semibold tracking-tight text-navy">
        Does severance affect unemployment in {row.name}?
      </h2>
      {row.treatment ? (
        <>
          <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-navy ring-1 ring-border">{TREATMENT_LABEL[row.treatment]}</p>
          <p className="mt-3 text-base leading-relaxed text-foreground">{TREATMENT_SENTENCE[row.treatment]}</p>
          {row.text && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {row.name}’s rule: {row.text}
              {row.source && (
                <a href={row.source} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs underline underline-offset-2 hover:text-foreground">
                  source{row.asOf ? `, ${formatContentDate(row.asOf)}` : ''}
                </a>
              )}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-base leading-relaxed text-foreground">
          Official sources disagree on how {row.name} counts severance, so we do not guess. Ask {agency} before you sign a severance agreement.
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Either way, file as soon as you are out of work and report any severance when asked: the agency decides how it counts. See{' '}
        <Link href="/unemployment-benefits#severance" className={LINK}>how all 50 states and DC treat severance</Link> and{' '}
        <Link href="/resources/severance-pay" className={LINK}>severance pay: taxes, negotiating and the agreement</Link>.
      </p>
    </section>
  )
}
