import type { ReferenceBreakdown } from '@/lib/coach/reference-breakdown'

// Every completed reference's answers, pooled by category — deliberately
// never grouped by reviewer or naming who said what, so a coach gets the
// full picture without any answer being traceable back to a specific
// referee. Only rendered once there's at least one completed reference —
// see notes.referenceBreakdown in CoachingNotesPanel.
export function ReferenceBreakdownSection({ breakdown }: { breakdown: ReferenceBreakdown }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">
        Full reference breakdown ({breakdown.completedCount} completed)
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pooled by category, not by reviewer — no answer here is attributable to a specific reference.
      </p>

      <div className="mt-3 space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Performance</p>
          <dl className="mt-1 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{breakdown.overallRating.label}</dt>
              <dd className="text-foreground tabular-nums">
                {breakdown.overallRating.mean !== null ? `${breakdown.overallRating.mean} (n=${breakdown.overallRating.n})` : '—'}
              </dd>
            </div>
            {breakdown.performance.map((p) => (
              <div key={p.label}>
                <dt className="text-xs text-muted-foreground">{p.label}</dt>
                <dd className="text-foreground tabular-nums">{p.mean !== null ? `${p.mean} (n=${p.n})` : '—'}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Working style (BARS)</p>
          <dl className="mt-1 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {breakdown.workingStyle.map((d) => (
              <div key={d.label}>
                <dt className="text-xs text-muted-foreground">{d.label}</dt>
                <dd className="text-foreground tabular-nums">{d.mean !== null ? `${d.mean} (n=${d.n})` : '—'}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Comparative standing</p>
          <dl className="mt-2 space-y-2 text-sm">
            {breakdown.comparative
              .filter((c) => c.answeredCount > 0)
              .map((c) => (
                <div key={c.label}>
                  <dt className="text-xs text-muted-foreground">
                    {c.label} ({c.answeredCount} answered)
                  </dt>
                  <dd className="text-foreground">
                    {c.counts
                      .filter((o) => o.count > 0)
                      .map((o) => `${o.optionLabel}: ${o.count}`)
                      .join(' · ')}
                  </dd>
                </div>
              ))}
          </dl>
        </div>

        {breakdown.traits.some((t) => t.n > 0) && (
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Traits</p>
            <dl className="mt-2 space-y-2 text-sm">
              {breakdown.traits
                .filter((t) => t.n > 0)
                .map((t) => (
                  <div key={t.label}>
                    <dt className="text-xs text-muted-foreground">
                      {t.label}: <span className="tabular-nums">{t.mean}/5</span> (n={t.n})
                    </dt>
                    {t.examples.length > 0 && (
                      <dd className="mt-1 space-y-1">
                        {t.examples.map((ex, i) => (
                          <p key={i} className="rounded-md border border-border p-2 text-foreground">
                            &quot;{ex}&quot;
                          </p>
                        ))}
                      </dd>
                    )}
                  </div>
                ))}
            </dl>
          </div>
        )}

        {(breakdown.strengths.length > 0 || breakdown.growthAreas.length > 0) && (
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Strengths &amp; growth areas</p>
            {breakdown.strengths.length > 0 && (
              <div className="mt-2">
                <dt className="text-xs text-muted-foreground">What they&apos;re especially good at</dt>
                <ul className="mt-1 space-y-1 text-sm text-foreground">
                  {breakdown.strengths.map((s, i) => (
                    <li key={i} className="rounded-md border border-border p-2">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {breakdown.growthAreas.length > 0 && (
              <div className="mt-2">
                <dt className="text-xs text-muted-foreground">Where they could grow</dt>
                <ul className="mt-1 space-y-1 text-sm text-foreground">
                  {breakdown.growthAreas.map((s, i) => (
                    <li key={i} className="rounded-md border border-border p-2">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {breakdown.writtenResponses.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Written responses</p>
            <div className="mt-2 space-y-3">
              {breakdown.writtenResponses.map((wq, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-foreground">{wq.question}</p>
                  <ul className="mt-1 space-y-1 text-sm text-foreground">
                    {wq.answers.map((a, j) => (
                      <li key={j} className="rounded-md border border-border p-2">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {breakdown.otherStories.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">In their own words</p>
            <div className="mt-2 space-y-3">
              {breakdown.otherStories.map((s, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                  <ul className="mt-1 space-y-1 text-sm text-foreground">
                    {s.texts.map((t, j) => (
                      <li key={j} className="rounded-md border border-border p-2">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {breakdown.verification.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Verification notes</p>
            <dl className="mt-2 space-y-2 text-sm">
              {breakdown.verification.map((v) => (
                <div key={v.label}>
                  <dt className="text-xs text-muted-foreground">
                    {v.label}: {v.confirmedCount} confirmed, {v.flaggedCount} flagged
                  </dt>
                  {v.corrections.length > 0 && (
                    <dd className="mt-1 space-y-1">
                      {v.corrections.map((c, i) => (
                        <p key={i} className="rounded-md border border-border p-2 text-foreground">
                          {c}
                        </p>
                      ))}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
