import { TrackedLink } from '@/components/marketing/TrackedLink'
import type { RankedEmployer } from '@/lib/seo/employer-rankings'

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
