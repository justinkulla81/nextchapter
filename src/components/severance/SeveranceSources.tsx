import { formatContentDate } from '@/components/seo/AuthorByline'
import { H2 } from '@/components/seo/SeoPage'
import { SEVERANCE_RULES_AS_OF, SEVERANCE_SOURCE_BLOCKS } from '@/lib/severance/rules'

/** Every source behind the figures on the severance pages and the calculator, with the date each was read. */
export function SeveranceSources({ id = 'sources' }: { id?: string }) {
  return (
    <section aria-labelledby={`${id}-h`} className="mt-12" id={id}>
      <h2 id={`${id}-h`} className={H2}>Sources</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Every rule and figure on this page was read from the sources below on {formatContentDate(SEVERANCE_RULES_AS_OF)}. How each state treats severance for unemployment comes from
        the Department of Labor’s comparison of state laws and each state agency, with the source shown on every state’s page. Tax and employment rules change, so check the linked pages for
        the current version before you decide.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {SEVERANCE_SOURCE_BLOCKS.map((g) => (
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
