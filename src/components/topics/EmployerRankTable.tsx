import { TrackedLink } from '@/components/marketing/TrackedLink'
import type { AiLayoffEmployer, RankedEmployer } from '@/lib/seo/employer-rankings'

type Col = 'open' | 'entry' | 'noExp' | 'training' | 'aiSkill' | 'aiShare'

const HEAD: Record<Col, string> = {
  open: 'Open roles',
  entry: 'Entry-level',
  noExp: 'No experience needed',
  training: 'Training provided',
  aiSkill: 'Ask for AI skills',
  aiShare: 'Share asking for AI',
}

const cell = (e: RankedEmployer, c: Col) => (c === 'aiShare' ? `${Math.round(e.aiShare * 100)}%` : e[c].toLocaleString())

function EmployerName({ name, slug, list }: { name: string; slug: string | null; list: string }) {
  if (!slug) return <>{name}</>
  return (
    <TrackedLink href={`/employers/${slug}`} event="employer_ranking_link_clicked" properties={{ list, employer: slug }} className="text-brand underline underline-offset-4">
      {name}
    </TrackedLink>
  )
}

/** A ranked list of employers: rank, name, then the columns that list is about. */
export function EmployerRankTable({ rows, cols, list }: { rows: RankedEmployer[]; cols: Col[]; list: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing to rank yet. The board has no employers that meet this list’s bar today.</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{list.replace(/_/g, ' ')}</caption>
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3">#</th>
            <th scope="col" className="px-4 py-3">Employer</th>
            {cols.map((c) => <th key={c} scope="col" className="px-4 py-3 text-right">{HEAD[c]}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={`${e.name}-${i}`} className="border-b border-border last:border-0">
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-navy"><EmployerName name={e.name} slug={e.slug} list={list} /></td>
              {cols.map((c) => <td key={c} className="px-4 py-3 text-right tabular-nums">{cell(e, c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Employers whose recent layoff headlines name AI or automation, each with the latest headline and its source. */
export function AiLayoffTable({ rows }: { rows: AiLayoffEmployer[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No layoff headlines in the last 12 months name AI or automation yet.</p>
  return (
    <ol className="divide-y divide-border rounded-xl border border-border bg-white">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
          <span className="w-6 tabular-nums text-muted-foreground">{i + 1}</span>
          <span className="font-medium text-navy sm:w-56"><EmployerName name={r.name} slug={r.slug} list="ai_layoffs" /></span>
          <span className="flex-1 text-sm text-muted-foreground">
            <TrackedLink href={r.latest.url} event="employer_ranking_link_clicked" properties={{ list: 'ai_layoffs_source', employer: r.name }} rel="nofollow" className="underline underline-offset-4">
              {r.latest.headline}
            </TrackedLink>
            {r.latest.publisher ? ` (${r.latest.publisher})` : ''}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{r.outlets} {r.outlets === 1 ? 'outlet' : 'outlets'}</span>
        </li>
      ))}
    </ol>
  )
}
