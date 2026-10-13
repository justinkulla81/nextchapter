import { BarChart3 } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { getOutcomesByBucket } from '@/lib/higher-ed/views'
import { buildInstitutionOutcomes } from '@/lib/outcomes/institution-outcomes'
import { usableBenchmarks } from '@/lib/outcomes/uplift'
import { MIN_CELL_SIZE } from '@/lib/outcomes/small-cell'
import type { DurationBucket } from '@/lib/outcomes/duration-bucket'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from './StatTile'

// Career Services "Outcomes" tab. Aggregates only, consent-applied in SQL
// (private.v_outcomes_by_bucket), small cells suppressed, and re-employment is
// compared with public benchmarks for people at the SAME stage of a search, so
// a cohort of long-searchers is never judged against a population average.

const pctFmt = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`)
const retentionFmt = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}% of prior pay`)

export async function OutcomesScreen({ ctx }: { ctx: WorkspaceContext }) {
  const [rows, benchmarkRows] = await Promise.all([
    getOutcomesByBucket(ctx),
    prisma.durationBenchmark.findMany({
      where: { group: 'all' },
      select: { bucket: true, weeklyReemploymentRate: true, confidence: true },
    }),
  ])
  const summary = buildInstitutionOutcomes(
    rows,
    usableBenchmarks(benchmarkRows).map((b) => ({ bucket: b.bucket as DurationBucket, weeklyReemploymentRate: b.weeklyReemploymentRate })),
  )

  if (summary.allSuppressed) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Outcomes appear once enough alumni have joined"
        description={`To protect privacy we show a stage of search only when ${MIN_CELL_SIZE} or more alumni who share outcomes are in it. Invite more alumni, and ask them to add their last day worked.`}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Alumni in view" value={summary.totalMembers} note="Only alumni who share outcomes and added a last day worked" />
        <StatTile
          label="Re-employment vs. expected"
          value={summary.pooledUplift === null ? 'Pending' : `${summary.pooledUplift.toFixed(1)}x`}
          note="Compared with people at the same stage of a search. Observational, not proof of cause."
        />
        <StatTile label="Privacy floor" value={`${MIN_CELL_SIZE}+`} note="Smaller groups are hidden" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Outcomes by how long alumni had been out of work when they joined</caption>
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              {['Weeks out of work', 'Alumni', 'Re-employed', 'Expected', 'Vs. expected', 'Via introductions', 'Interim or fractional', 'Median pay kept', 'Took a pay cut'].map((h) => (
                <th key={h} scope="col" className="px-4 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {summary.rows.map((r) => (
              <tr key={r.bucket}>
                <th scope="row" className="px-4 py-2 font-medium">
                  {r.label}
                </th>
                {r.suppressed ? (
                  <td colSpan={8} className="px-4 py-2 text-xs text-muted-foreground">
                    Hidden: fewer than {MIN_CELL_SIZE} alumni
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2 tabular-nums">{r.members}</td>
                    <td className="px-4 py-2 tabular-nums">{r.reemployed}</td>
                    <td className="px-4 py-2 tabular-nums">{r.expected === null ? (r.benchmarkPending ? 'Benchmark pending' : '–') : r.expected.toFixed(1)}</td>
                    <td className="px-4 py-2 tabular-nums">{r.uplift === null ? '–' : `${r.uplift.toFixed(1)}x`}</td>
                    <td className="px-4 py-2 tabular-nums">{pctFmt(r.warmShare)}</td>
                    <td className="px-4 py-2 tabular-nums">{r.interimHires ?? '–'}</td>
                    <td className="px-4 py-2 tabular-nums">{retentionFmt(r.medianPayRetention)}</td>
                    <td className="px-4 py-2 tabular-nums">{pctFmt(r.tookCutShare)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          Alumni are grouped by how long they had been out of work when they joined, and compared only with public figures for that same
          stage, so a group of long searches is not judged against everyone. Where we do not yet have a sourced public benchmark for a
          stage, it says &ldquo;Benchmark pending&rdquo; instead of showing a number.
        </p>
        <p>
          This is observational: alumni choose to join and to report, so these figures show association, not that NextChapter caused the
          result. Pay figures are optional and self-reported. Interim and fractional work is counted separately and is never treated as
          a permanent hire.
        </p>
      </div>
    </div>
  )
}
