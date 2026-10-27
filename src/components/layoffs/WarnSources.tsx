import { H2 } from '@/components/seo/SeoPage'
import { formatContentDate } from '@/components/seo/AuthorByline'
import { WARN_GUIDE_AS_OF, WARN_SOURCES, usedSources, type WarnSourceKey } from '@/lib/warn-guide/rules'

/** Source links for one rule, as small numbered references. */
export function SourceRefs({ keys }: { keys: readonly WarnSourceKey[] }) {
  return (
    <span className="ml-1 text-xs text-muted-foreground">
      (
      {keys.map((k, i) => (
        <span key={k}>
          {i > 0 && ', '}
          <a href={WARN_SOURCES[k].url} rel="noopener" className="underline underline-offset-2 hover:text-foreground">
            {WARN_SOURCES[k].label.split(' (')[0]}
          </a>
        </span>
      ))}
      )
    </span>
  )
}

/** Every source behind the rules on a layoff-rights page, with the date each was read. */
export function WarnSources({ id = 'sources', only }: { id?: string; only?: readonly WarnSourceKey[] }) {
  const keys = only ?? usedSources()
  return (
    <section aria-labelledby={`${id}-h`} className="mt-12" id={id}>
      <h2 id={`${id}-h`} className={H2}>Sources</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Every rule on this page was read from the sources below on {formatContentDate(WARN_GUIDE_AS_OF)}. The federal text is the Legal Information Institute’s copy of the
        official law and regulations. Laws change and a short summary leaves things out, so read the linked text, or ask your state labor department or a lawyer, before you rely on it for a decision.
      </p>
      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        {keys.map((k) => (
          <li key={k} className="rounded-lg border border-border bg-white px-3 py-2">
            <a href={WARN_SOURCES[k].url} rel="noopener" className="text-brand underline underline-offset-4">{WARN_SOURCES[k].label}</a>
            <span className="block text-xs text-muted-foreground">Used for: {WARN_SOURCES[k].for}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
