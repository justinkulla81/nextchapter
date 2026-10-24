import Link from 'next/link'
import type { RecruiterRow } from '@/lib/crm/ecosystem'
import { groupByFirm, type FirmGroup } from '@/lib/crm/recruiter-firms'
import { functionName, industryName } from '@/lib/crm/coverage'

const tags = (g: { states: string[]; industries: string[]; functions: string[] }) =>
  [g.states.slice(0, 6).join(', '), g.industries.slice(0, 3).map(industryName).join(', '), g.functions.slice(0, 3).map(functionName).join(', ')].filter(Boolean).join(' | ') || 'Not tagged yet'

const REP = 'candidate_rep'
const RepBadge = () => <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">Represents candidates</span>

function Person({ r }: { r: RecruiterRow }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 px-3 py-2">
      <div className="min-w-0">
        <Link href={`/support/admin/crm/people/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>{r.models.includes(REP) && <RepBadge />}
        <p className="text-muted-foreground">{r.title ?? 'No title on file'}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{tags(r)}</p>
      </div>
      <div className="text-right text-xs">
        {r.email ? <a href={`mailto:${r.email}`} className="text-brand hover:underline">{r.email}</a> : <span className="text-muted-foreground">No email yet</span>}
        {r.guessed && <span className="text-muted-foreground"> (guessed)</span>}
        {r.phone && <p className="text-muted-foreground">{r.phone}</p>}
      </div>
    </li>
  )
}

function Firm({ g, open }: { g: FirmGroup<RecruiterRow>; open: boolean }) {
  const reachable = g.people.filter((p) => p.email && !p.guessed).length
  const reps = g.people.filter((p) => p.models.includes(REP)).length
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-3 py-2 hover:bg-muted">
        <span className="min-w-0">
          <span className="font-medium">{g.orgId ? <Link href={`/support/admin/crm/organizations/${g.orgId}`} className="text-brand hover:underline">{g.name}</Link> : g.name}</span>
          <span className="ml-2 text-muted-foreground">{g.people.length} {g.people.length === 1 ? 'recruiter' : 'recruiters'}{reachable ? `, ${reachable} with email` : ''}</span>{reps > 0 && <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">{reps} represent candidates</span>}
          <span className="block text-xs text-muted-foreground">{tags(g)}</span>
        </span>
      </summary>
      <ul className="divide-y divide-border border-t border-border bg-muted/30 pl-4">{g.people.map((r) => <Person key={r.id} r={r} />)}</ul>
    </details>
  )
}

/** Recruiters grouped by firm, each firm expandable to its people. Shared by the Recruiters, Industries, Functions and Geography pages. */
export function RecruiterTable({ rows, total, empty, openFirst = 3, localState }: { rows: RecruiterRow[]; total: number; empty: string; openFirst?: number; localState?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  const firms = groupByFirm(rows, localState)
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{firms.filter((f) => f.orgId).length} firms, {rows.length} recruiters</p>
      <div className="divide-y divide-border rounded-lg border border-border text-sm">
        {firms.map((g, i) => <Firm key={g.key} g={g} open={i < openFirst} />)}
      </div>
      {total > rows.length && <p className="text-xs text-muted-foreground">Showing {rows.length} of {total} recruiters. Narrow with the filters above.</p>}
    </div>
  )
}
