'use client'

import { useEffect, useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'

// "Your applications: match and gaps" on Search Strategy. Presentational: the data is worked out on the
// server (ApplicationMatchSection, src/lib/applications/). The dev preview renders the same component
// with sample data (src/app/dev-preview/_mockups/application-match.tsx), so what was approved is what ships.

export interface ApplicationMatchGap {
  term: string
  /** Applications that asked for it. */
  applications: number
  /** Of those, in the last 30 days. */
  recent: number
  /** Only similar jobs (the title's occupation) asked, never a posting we read. */
  inferredOnly: boolean
  course: { title: string; url: string } | null
}

export interface ApplicationMatchRecommendation {
  term: string
  reason: string
  course: { title: string; url: string } | null
}

export interface ApplicationMatchData {
  applications: number
  fromPostings: number
  inferred: number
  matchPct: number | null
  matchPctAtApply: number | null
  trend: { weekStart: string; applications: number; matchPct: number | null }[]
  gaps: ApplicationMatchGap[]
  bestLine: string | null
  recommendations: ApplicationMatchRecommendation[]
}

const titleCase = (t: string) => (/[A-Z]/.test(t) ? t : t.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bFp&a\b/, 'FP&A').replace(/\bM&a\b/, 'M&A').replace(/\b(Sql|Crm|Sap|Seo|Erp|Sox)\b/g, (m) => m.toUpperCase()))
const courseSearch = (term: string) => `https://www.coursera.org/search?query=${encodeURIComponent(term)}`
const weekLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function ApplicationMatchView({
  data,
  onConfirm,
}: {
  data: ApplicationMatchData
  /** The "I have this" action; the dev preview passes a stub. */
  onConfirm: (skill: string) => Promise<{ ok: boolean; error?: string }>
}) {
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pendingSkill, setPendingSkill] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    posthog.capture('application_gap_viewed', {
      applications: data.applications,
      fromPostings: data.fromPostings,
      inferred: data.inferred,
      matchPct: data.matchPct,
      gaps: data.gaps.map((g) => g.term),
      recommendations: data.recommendations.map((r) => r.term),
    })
    // Once per view of this data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.applications, data.matchPct])

  const confirm = (skill: string) => {
    setError(null)
    setPendingSkill(skill)
    posthog.capture('application_skill_confirmed', { skill })
    startTransition(async () => {
      const res = await onConfirm(skill)
      setPendingSkill(null)
      if (res.ok) setAdded((s) => new Set(s).add(skill))
      else setError(res.error ?? 'That skill could not be added. Try again in a minute.')
    })
  }

  const n = data.applications
  const max = Math.max(1, ...data.trend.map((t) => t.matchPct ?? 0))
  const withData = data.trend.filter((t) => t.matchPct != null)
  const first = withData[0]
  const last = withData[withData.length - 1]
  const trendText =
    withData.length >= 2 && first && last
      ? last.matchPct! > first.matchPct!
        ? `Up from ${first.matchPct}% in the week of ${weekLabel(first.weekStart)}.`
        : last.matchPct! < first.matchPct!
          ? `Down from ${first.matchPct}% in the week of ${weekLabel(first.weekStart)}.`
          : 'Steady over these weeks.'
      : withData.length === 1
        ? 'Only one week with applications so far.'
        : 'No applications in the last 8 weeks.'

  return (
    <section aria-labelledby="app-match-title" className="space-y-5 rounded-2xl border border-border bg-white p-6 text-ink">
      <div className="space-y-1">
        <h2 id="app-match-title" className="font-display text-xl font-semibold">
          Your applications: match and gaps
        </h2>
        <p className="text-sm text-muted-foreground">
          What the {n === 1 ? 'job' : `${n} jobs`} you applied to asked for, against the skills on your profile.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="font-display text-4xl font-semibold tabular-nums">{data.matchPct == null ? '—' : `${data.matchPct}%`}</p>
          <p className="text-sm text-muted-foreground">
            of what they asked for is on your profile
            {data.matchPctAtApply != null && data.matchPct != null && data.matchPct !== data.matchPctAtApply && ` (${data.matchPctAtApply}% when you applied)`}
          </p>
        </div>
        <div className="min-w-48 flex-1">
          <div className="flex h-12 items-end gap-1" aria-hidden>
            {data.trend.map((t) => (
              <div
                key={t.weekStart}
                title={t.matchPct == null ? `Week of ${weekLabel(t.weekStart)}: no applications` : `Week of ${weekLabel(t.weekStart)}: ${t.matchPct}% match, ${t.applications} application${t.applications === 1 ? '' : 's'}`}
                className="flex h-full flex-1 items-end"
              >
                <div
                  className={cn('w-full rounded-t', t.matchPct == null ? 'h-0.5 bg-border' : 'bg-ink')}
                  style={t.matchPct == null ? undefined : { height: `${Math.max(6, (100 * t.matchPct) / max)}%` }}
                />
              </div>
            ))}
          </div>
          <ul className="sr-only">
            {data.trend.map((t) => (
              <li key={t.weekStart}>
                Week of {weekLabel(t.weekStart)}: {t.matchPct == null ? 'no applications' : `${t.matchPct}% match across ${t.applications} applications`}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Last 8 weeks, match when you applied. {trendText}</p>
        </div>
      </div>

      {data.bestLine && <p className="text-base">{data.bestLine}</p>}

      {data.gaps.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Skills you keep being asked for and don&apos;t list yet</h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {data.gaps.map((g) => {
              const isAdded = added.has(g.term)
              const pending = pendingSkill === g.term
              return (
                <li key={g.term} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold">{titleCase(g.term)}</p>
                    <p className="text-sm text-muted-foreground">
                      {g.applications} of your {n} applications{g.recent > 0 ? `, ${g.recent} in the last month` : ''}
                      {g.inferredOnly ? '; read from similar jobs' : ''}.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isAdded ? (
                      <span className="text-sm font-medium text-success" role="status">
                        Added to your skills
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => confirm(g.term)}
                        disabled={pending}
                        aria-label={`I have ${g.term}: add it to my skills`}
                        className={cn('inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted', pending && 'cursor-wait opacity-70')}
                      >
                        {pending ? 'Adding…' : 'I have this'}
                      </button>
                    )}
                    <a
                      href={g.course?.url ?? courseSearch(g.term)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => posthog.capture('application_skill_learn_clicked', { skill: g.term, course: g.course?.title ?? null, source: 'gap' })}
                      aria-label={g.course ? `Learn ${g.term}: ${g.course.title}` : `Find a course for ${g.term}`}
                      className="text-sm font-medium text-brand underline underline-offset-4"
                    >
                      {g.course ? 'Learn it' : 'Find a course'}
                    </a>
                  </div>
                </li>
              )
            })}
          </ul>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {data.recommendations.length > 0 && (
        <details
          className="group"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) posthog.capture('application_skill_recommendations_opened', { skills: data.recommendations.map((r) => r.term) })
          }}
        >
          <summary className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4">What to build next</summary>
          <ol className="mt-3 space-y-3">
            {data.recommendations.map((r, i) => (
              <li key={r.term} className="space-y-0.5">
                <p className="text-base font-semibold">
                  {i + 1}. {titleCase(r.term)}
                </p>
                <p className="text-sm text-muted-foreground">{r.reason}</p>
                <a
                  href={r.course?.url ?? courseSearch(r.term)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => posthog.capture('application_skill_learn_clicked', { skill: r.term, course: r.course?.title ?? null, source: 'recommendation' })}
                  className="text-sm font-medium text-brand underline underline-offset-4"
                >
                  {r.course ? `Learn it: ${r.course.title}` : 'Find a course'}
                </a>
              </li>
            ))}
          </ol>
        </details>
      )}

      <p className="text-xs text-muted-foreground">
        {data.inferred > 0
          ? `${data.fromPostings} of ${n} read from the posting itself; ${data.inferred} inferred from the job title's occupation and the skills similar open jobs ask for, so they count half.`
          : `All ${n} read from the postings themselves.`}{' '}
        Occupations from{' '}
        <a href="https://www.onetcenter.org/license_db.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          O*NET (CC BY 4.0)
        </a>
        .
      </p>
    </section>
  )
}
