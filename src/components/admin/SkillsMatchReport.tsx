import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DIMENSIONS, PITCH_MIN_APPLICATIONS, PITCH_MIN_MEMBERS, pitchGapLine, type SegmentAggregate, type SkillMatchReport } from '@/lib/applications/skill-match-aggregate'

// The body of the admin skills-match report (support/admin/jobs/skills-match). Presentational, so the
// dev preview renders it with sample data (src/app/dev-preview/_mockups/admin-skills-match.tsx).

const SEGMENT_ROWS = 12

function SegmentTable({ segments }: { segments: SegmentAggregate[] }) {
  if (segments.length === 0) return <p className="text-sm text-muted-foreground">No applications in this window.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-normal">Segment</th>
            <th className="py-2 pr-4 text-right font-normal">Applications</th>
            <th className="py-2 pr-4 text-right font-normal">Members</th>
            <th className="py-2 pr-4 text-right font-normal">Match</th>
            <th className="py-2 font-normal">Top gaps (applications missing it)</th>
          </tr>
        </thead>
        <tbody>
          {segments.slice(0, SEGMENT_ROWS).map((s) => (
            <tr key={s.segment} className="border-t border-border/50 align-top">
              <td className="py-2 pr-4">
                {s.segment}
                {s.inferred > 0 && <span className="block text-xs text-muted-foreground">{s.fromPostings} posting · {s.inferred} inferred</span>}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{s.applications}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{s.members}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{s.matchPct == null ? '—' : `${s.matchPct}%`}</td>
              <td className="py-2">
                {s.topGaps.length === 0 ? (
                  <span className="text-muted-foreground">None</span>
                ) : (
                  <ol className="space-y-0.5">
                    {s.topGaps.map((g, i) => (
                      <li key={g.term}>
                        {i + 1}. {g.term} <span className="text-muted-foreground tabular-nums">({g.applications}, {g.sharePct}%)</span>
                      </li>
                    ))}
                  </ol>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {segments.length > SEGMENT_ROWS && <p className="mt-2 text-xs text-muted-foreground">{segments.length - SEGMENT_ROWS} smaller segments are in the CSV.</p>}
    </div>
  )
}

export function SkillsMatchReport({
  report: r,
  members,
  loadError = false,
}: {
  report: SkillMatchReport | null
  members: { candidateId: string; applications: number; matchPct: number | null; name: string }[]
  loadError?: boolean
}) {
  const pitchSegments = r ? [r.overall, ...r.byDimension.industry.slice(0, 4), ...r.byDimension.function.slice(0, 4)].filter((s) => s.segment !== 'Unknown') : []
  return (
    <>
      {loadError || !r ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Couldn&apos;t load the report right now. Reload in a minute; if it keeps failing, check the server logs for &ldquo;admin/skills-match&rdquo;.
          </CardContent>
        </Card>
      ) : r.overall.applications === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No application snapshots in this window. Snapshots are taken when an application is recorded or linked to a posting; run scripts/backfill-application-skill-snapshots.ts to catch up older ones.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Overall</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Applications</dt>
                  <dd className="text-lg font-medium tabular-nums">{r.overall.applications}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Members</dt>
                  <dd className="text-lg font-medium tabular-nums">{r.overall.members}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Match at apply</dt>
                  <dd className="text-lg font-medium tabular-nums">{r.overall.matchPct == null ? '—' : `${r.overall.matchPct}%`}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">From a posting / inferred</dt>
                  <dd className="text-lg font-medium tabular-nums">
                    {r.overall.fromPostings} / {r.overall.inferred}
                  </dd>
                </div>
              </dl>
              <SegmentTable segments={[r.overall]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trend, last 12 weeks</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-4 font-normal">Week of</th>
                    <th className="py-1.5 pr-4 text-right font-normal">Applications</th>
                    <th className="py-1.5 pr-4 text-right font-normal">Members</th>
                    <th className="py-1.5 font-normal">Match at apply</th>
                  </tr>
                </thead>
                <tbody>
                  {r.trend.map((t) => (
                    <tr key={t.weekStart} className="border-t border-border/50">
                      <td className="py-1.5 pr-4 tabular-nums">{t.weekStart}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{t.applications}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{t.members}</td>
                      <td className="py-1.5">
                        {t.matchPct == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="inline-block h-2 rounded-r bg-foreground/70" style={{ width: `${Math.max(2, t.matchPct)}px` }} aria-hidden />
                            <span className="tabular-nums">{t.matchPct}%</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {DIMENSIONS.filter((d) => d.key !== 'overall').map((d) => (
            <Card key={d.key}>
              <CardHeader>
                <CardTitle>By {d.label.toLowerCase()}</CardTitle>
              </CardHeader>
              <CardContent>
                <SegmentTable segments={r.byDimension[d.key as Exclude<typeof d.key, 'overall'>]} />
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>For the retraining pitch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Lines a B2B retraining deck can cite. A line is citable once it rests on {PITCH_MIN_APPLICATIONS}+ applications with skill data from {PITCH_MIN_MEMBERS}+ members. The pitch generator fills
                the {'{{appGapLine}}'} token in any slide rule with the deck region&apos;s line (or the overall one) once it is citable.
              </p>
              <ul className="space-y-2">
                {pitchSegments.map((s) => {
                  const line = pitchGapLine(s)
                  return (
                    <li key={`${s.dimension}-${s.segment}`}>
                      <span className={line.citable ? '' : 'text-muted-foreground'}>{line.text}</span>{' '}
                      {line.citable ? <span className="text-xs font-medium text-success">Citable</span> : <span className="text-xs text-muted-foreground">Not citable yet: {line.why}</span>}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Drill down to a member</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">Members with the most snapshots, all time. Each opens the candidate page, which shows their own match and gaps.</p>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-4 font-normal">Member</th>
                    <th className="py-1.5 pr-4 text-right font-normal">Applications</th>
                    <th className="py-1.5 text-right font-normal">Match at apply</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.candidateId} className="border-t border-border/50">
                      <td className="py-1.5 pr-4">
                        <Link href={`/support/admin/candidates/${m.candidateId}`} className="text-primary underline underline-offset-4">
                          {m.name}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{m.applications}</td>
                      <td className="py-1.5 text-right tabular-nums">{m.matchPct == null ? '—' : `${m.matchPct}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
