import { COBRA, FPL_SOURCES, MARKETPLACE, MEDICAID, PTC, PTC_RULE_SOURCES, RULES_AS_OF, STATE_TABLE_SOURCES, type Sourced } from '@/lib/cobra-aca/rules'
import { H2 } from '@/components/seo/SeoPage'
import { formatContentDate } from '@/components/seo/AuthorByline'

const GROUPS: { title: string; block: Sourced }[] = [
  { title: 'COBRA rules', block: COBRA },
  { title: 'Marketplace enrollment', block: MARKETPLACE },
  { title: 'Premium tax credit tables', block: { asOf: PTC[2026].asOf, sources: [...PTC[2026].sources, ...PTC[2027].sources] } },
  { title: 'Credit rules and income', block: PTC_RULE_SOURCES },
  { title: 'Federal poverty guidelines', block: FPL_SOURCES },
  { title: 'Medicaid', block: MEDICAID },
  { title: 'Marketplace types and premiums by state', block: STATE_TABLE_SOURCES },
]

/** Every source behind the numbers on the COBRA vs ACA pages, with the date each was read. */
export function SourcesList({ id = 'sources' }: { id?: string }) {
  return (
    <section aria-labelledby={`${id}-h`} className="mt-12" id={id}>
      <h2 id={`${id}-h`} className={H2}>Sources</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Every rule and figure on this page was read from the sources below on {formatContentDate(RULES_AS_OF)}. Insurance and tax rules change, so check the
        linked pages for the current version before you decide.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title} className="rounded-xl border border-border bg-white p-4">
            <h3 className="text-sm font-semibold text-navy">{g.title}</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {g.block.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="noopener" className="text-brand underline underline-offset-4">{s.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
