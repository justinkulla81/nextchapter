import { requireAdmin } from '@/lib/admin/auth'
import { isSuppressedCell } from '@/lib/admin/cell-suppression'
import { loadEducationOutcomes, type Dimension, type EducationOutcomes } from '@/lib/analytics/education-outcomes'

export const maxDuration = 60

const TITLES: Record<Dimension, string> = {
  school: 'By college',
  degreeLevel: 'By degree level',
  level: 'By seniority',
  function: 'By function',
  industry: 'By industry',
}

function Table({ rows }: { rows: EducationOutcomes['byDimension'][Dimension] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Group</th>
            <th className="px-3 py-2 font-medium">Members</th>
            <th className="px-3 py-2 font-medium">Applied</th>
            <th className="px-3 py-2 font-medium">Interviewed (of applied)</th>
            <th className="px-3 py-2 font-medium">Between jobs</th>
            <th className="px-3 py-2 font-medium">Active, 30d</th>
            <th className="px-3 py-2 font-medium">Outreach, 30d</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) =>
            isSuppressedCell(r) ? (
              <tr key={r.label}>
                <td className="px-3 py-2 text-muted-foreground">{r.label}</td>
                <td className="px-3 py-2 text-muted-foreground" colSpan={6}>
                  Fewer than 5 members — not shown
                </td>
              </tr>
            ) : (
              <tr key={r.group}>
                <td className="px-3 py-2 font-medium text-foreground">{r.group}</td>
                <td className="px-3 py-2 tabular-nums">{r.members}</td>
                <td className="px-3 py-2 tabular-nums">{r.appliedPct}%</td>
                <td className="px-3 py-2 tabular-nums">{r.interviewPct === null ? '—' : `${r.interviewPct}%`}</td>
                <td className="px-3 py-2 tabular-nums">{r.betweenJobsPct}%</td>
                <td className="px-3 py-2 tabular-nums">{r.activePct}%</td>
                <td className="px-3 py-2 tabular-nums">{r.outreachPct}%</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

export default async function EducationOutcomesPage() {
  await requireAdmin()
  const data = await loadEducationOutcomes()
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Outcomes by college and background</h1>
        <p className="text-muted-foreground">
          NextChapter research. {data.members.toLocaleString()} members (Confidential Search Mode excluded). Groups under 5
          are hidden.
        </p>
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          Read with care. This is <strong className="text-foreground">not an unemployment rate</strong>: people join
          NextChapter because they are in a search, so these figures describe who joined, not a college&apos;s graduates.
          &ldquo;Between jobs&rdquo; is self-reported. The activity columns are observable behaviour, aggregated — they are
          not a judgement of anyone&apos;s character, and are never shown to members, recruiters or employers.
        </p>
      </div>
      {(Object.keys(TITLES) as Dimension[]).map((d) => (
        <section key={d} className="space-y-2">
          <h2 className="text-lg font-semibold">{TITLES[d]}</h2>
          <Table rows={data.byDimension[d]} />
        </section>
      ))}
    </div>
  )
}
