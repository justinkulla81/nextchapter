import Link from 'next/link'

export interface SkillTableRow {
  slug: string
  name: string
  /** Main figure, already formatted ("12%", "3,420 jobs"). */
  value: string
  /** Optional second figure, already formatted. */
  extra?: string
}

/** A ranked list of skills, each linking to its page. Used by every list on /skills so they read the same. */
export function SkillTable({ caption, valueHeading, extraHeading, rows }: { caption: string; valueHeading: string; extraHeading?: string; rows: SkillTableRow[] }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">Not enough postings yet to rank skills here. This fills in as the board grows.</p>
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-white">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-10 px-3 py-2 font-medium">#</th>
            <th scope="col" className="px-3 py-2 font-medium">Skill</th>
            <th scope="col" className="px-3 py-2 font-medium">{valueHeading}</th>
            {extraHeading && <th scope="col" className="px-3 py-2 font-medium">{extraHeading}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={r.slug}>
              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
              <th scope="row" className="px-3 py-2 font-medium">
                <Link href={`/skills/${r.slug}`} className="text-brand underline underline-offset-4">{r.name}</Link>
              </th>
              <td className="px-3 py-2">{r.value}</td>
              {extraHeading && <td className="px-3 py-2">{r.extra ?? '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
