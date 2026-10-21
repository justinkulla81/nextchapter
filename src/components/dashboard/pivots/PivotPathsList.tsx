'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Users, UserRound, Shuffle, TrendingUp } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { demandLine, type PivotSuggestion } from '@/lib/pivots/scoring'
import { setPivotPathHidden } from '@/app/dashboard/pivot-paths/actions'
import { pivotJobsHref } from '@/lib/pivots/pivot-map'
import { ExpansionToggle } from '@/components/dashboard/ExpansionToggle'
import { OnetAttribution } from '@/components/OnetAttribution'

const PEOPLE_TAG: Record<PivotSuggestion['people'], { label: string; icon: typeof Users }> = {
  HIGH: { label: 'People-facing', icon: Users },
  MIXED: { label: 'Mix of people and focused work', icon: Shuffle },
  LOW: { label: 'Mostly focused work', icon: UserRound },
}

const FIT_STYLE: Record<PivotSuggestion['fitLabel'], string> = {
  'Strong fit': 'bg-success/15 text-success',
  'Good fit': 'bg-brand/10 text-brand',
  'Worth exploring': 'bg-muted text-muted-foreground',
}

export function PivotPathsList({
  suggestions,
  more = [],
  inSearch = [],
  hidden,
  sourceFunction,
  sourceRole,
  contracting,
  marketReady,
  surface,
  details = {},
}: {
  suggestions: PivotSuggestion[]
  // Every other path from the starting role, shown on request.
  more?: PivotSuggestion[]
  // Pivot roles already added to their job search (searchExpansion.roles).
  inSearch?: string[]
  hidden: { key: string; label: string }[]
  sourceFunction: string | null
  sourceRole: string | null
  contracting: boolean
  marketReady: boolean
  surface: 'pivot_paths_page' | 'search_strategy'
  // Server-rendered "what it takes" (O*NET skills, local pay, training) per path, keyed by target.
  details?: Record<string, { socCode: string; node: ReactNode }>
}) {
  const [hiddenNow, setHiddenNow] = useState<string[]>([])
  const [restored, setRestored] = useState<string[]>([])
  const [note, setNote] = useState<{ text: string; undo?: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const [showAll, setShowAll] = useState(false)
  const viewed = useRef(false)

  useEffect(() => {
    if (viewed.current) return
    viewed.current = true
    posthog.capture('pivot_paths_viewed', {
      count: suggestions.length,
      sourceFunction,
      sourceRole,
      contracting,
      marketReady,
      targets: suggestions.map((s) => s.target),
      surface,
    })
  }, [suggestions, sourceFunction, sourceRole, contracting, marketReady, surface])

  function hide(s: PivotSuggestion, rank: number) {
    setHiddenNow((h) => [...h, s.target])
    setNote({ text: `Hidden: ${s.label}.`, undo: s.target })
    posthog.capture('pivot_path_dismissed', { target: s.target, rank, sourceRole, surface })
    startTransition(async () => {
      const saved = await setPivotPathHidden(s.target, true)
      if (!saved.ok) {
        setHiddenNow((h) => h.filter((t) => t !== s.target))
        setNote({ text: saved.error })
      }
    })
  }

  function unhide(target: string, label: string) {
    setHiddenNow((h) => h.filter((t) => t !== target))
    setRestored((r) => [...r, target])
    setNote({ text: `${label} is back on your list.` })
    posthog.capture('pivot_path_restored', { target, sourceRole, surface })
    startTransition(async () => {
      const saved = await setPivotPathHidden(target, false)
      if (!saved.ok) setNote({ text: saved.error })
    })
  }

  const visible = [...suggestions, ...(showAll ? more : [])].filter((s) => !hiddenNow.includes(s.target))
  const stillHidden = hidden.filter((h) => !restored.includes(h.key))

  return (
    <div className={cn('space-y-4', pending && 'cursor-wait')}>
      {note && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {note.text}
          {note.undo && (
            <button
              type="button"
              className="text-primary underline underline-offset-4"
              onClick={() => {
                const s = suggestions.find((x) => x.target === note.undo)
                if (s) unhide(s.target, s.label)
              }}
            >
              Undo
            </button>
          )}
        </p>
      )}

      {visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          You have hidden every path we suggest for your background. Bring one back below, or update your current role on your profile to see different paths.
        </p>
      )}

      <ol className="space-y-4">
        {visible.map((s, i) => (
          <li key={s.target}>
            <PivotPathCard s={s} rank={i + 1} marketReady={marketReady} sourceRole={sourceRole} surface={surface} inSearch={inSearch.includes(s.target)} detail={details[s.target]} onHide={() => hide(s, i + 1)} />
          </li>
        ))}
      </ol>

      {more.length > 0 && !showAll && (
        <Button
          variant="outline"
          onClick={() => {
            setShowAll(true)
            posthog.capture('pivot_paths_show_all', { extra: more.length, sourceRole, surface })
          }}
        >
          Show all {suggestions.length + more.length} paths
        </Button>
      )}

      {visible.some((s) => s.onet || s.origin === 'onet') && <OnetAttribution withBls={false} />}

      {stillHidden.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <span>Hidden paths: </span>
          {stillHidden.map((h, i) => (
            <span key={h.key}>
              {i > 0 && ', '}
              <button type="button" className="text-primary underline underline-offset-4" onClick={() => unhide(h.key, h.label)} aria-label={`Show ${h.label} again`}>
                {h.label}
              </button>
            </span>
          ))}
          <span> (select one to show it again)</span>
        </div>
      )}
    </div>
  )
}

function PivotPathCard({
  s,
  rank,
  marketReady,
  sourceRole,
  surface,
  inSearch,
  detail,
  onHide,
}: {
  s: PivotSuggestion
  rank: number
  marketReady: boolean
  sourceRole: string | null
  surface: string
  inSearch: boolean
  detail?: { socCode: string; node: ReactNode }
  onHide: () => void
}) {
  const people = PEOPLE_TAG[s.people]
  const PeopleIcon = people.icon
  const have = [...s.brings, ...s.alreadyHave]
  return (
    <article className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby={`pivot-${s.target}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 id={`pivot-${s.target}`} className="text-base font-semibold text-foreground">
            {s.label}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn('rounded-full px-2 py-0.5 font-medium', FIT_STYLE[s.fitLabel])}>{s.fitLabel}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{s.timeLabel}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              <PeopleIcon className="size-3" aria-hidden />
              {people.label}
            </span>
            {s.origin === 'onet' && (
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">Listed as related by O*NET</span>
            )}
            {s.highRejectionHighUpside && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange/15 px-2 py-0.5 text-orange">
                <TrendingUp className="size-3" aria-hidden />
                High rejection, high upside
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-foreground">{s.why}</p>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Demand</dt>
          <dd className="text-foreground">
            {marketReady ? (
              <>
                {demandLine(s.demand)}
                {s.demand.localOpen !== null && <span className="text-muted-foreground"> · {s.demand.nationalOpen.toLocaleString()} nationally</span>}
                {s.demand.lowCompetitionShare !== null && s.demand.lowCompetitionShare >= 0.25 && (
                  <span className="block text-xs text-muted-foreground">Many of these draw few applicants.</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Live job counts are updating. Check back tomorrow.</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Pay</dt>
          <dd className="text-foreground">{s.pay.summary}</dd>
        </div>
      </dl>

      {s.outlook && (
        <div className="text-sm">
          <p className="text-xs font-medium text-muted-foreground">Long-term outlook (national)</p>
          <p className="text-foreground">
            {s.outlook.line}
            {s.outlook.medianWage && (
              <span className="text-muted-foreground">
                {' '}
                Median wage across all levels: ${s.outlook.medianWage.toLocaleString()}
                {s.outlook.wageYear ? ` (${s.outlook.wageYear})` : ''}.
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">Outlook: BLS projections for {s.outlook.occupation}.</p>
        </div>
      )}

      {s.personalityNote && <p className="text-xs text-muted-foreground">{s.personalityNote}</p>}
      {(s.likesLeaves || s.likesGains || s.likesStill) && (
        <div className="text-xs">
          {s.likesLeaves && <p className="text-success">{s.likesLeaves}</p>}
          {s.likesGains && <p className="text-success">{s.likesGains}</p>}
          {s.likesStill && <p className="text-warning">{s.likesStill}</p>}
        </div>
      )}
      {(s.strengthPlays || s.strengthExposes) && (
        <div className="text-xs">
          {s.strengthPlays && <p className="text-success">{s.strengthPlays}</p>}
          {s.strengthExposes && <p className="text-warning">{s.strengthExposes}</p>}
        </div>
      )}
      {(s.workFits.length > 0 || s.workClashes.length > 0) && (
        <div className="text-xs">
          {s.workFits.length > 0 && <p className="text-success">Fits how you work: {s.workFits.map((f) => f.toLowerCase()).join('; ')}.</p>}
          {s.workClashes.map((c) => (
            <p key={c} className="text-warning">
              {c}
            </p>
          ))}
        </div>
      )}
      {s.ai && (
        <div className="text-sm">
          <p className="text-xs font-medium text-muted-foreground">AI and this field</p>
          <p className="text-foreground">
            {s.ai.line}{' '}
            {s.ai.trend === 'shrinking' && <span>Jobs in this group fell {Math.abs(s.ai.employmentChangePct).toFixed(1)}% from 2022 to 2026.</span>}
          </p>
          {(s.ai.aiSkills === 'critical' || s.ai.aiSkills === 'important') && <p className="text-xs text-muted-foreground">What to learn: {s.ai.tools}.</p>}
        </div>
      )}
      {s.caution && <p className="text-xs text-warning">{s.caution}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Skills you already have</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-foreground">
            {have.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Skills to add</p>
          {s.gaps.length === 0 ? (
            <p className="mt-1 text-sm text-foreground">Nothing major. Lead with the skills you already have.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-foreground">
              {s.gaps.map((g) => (
                <li key={g.label}>
                  {g.label}
                  <span className="block text-xs text-muted-foreground">
                    {g.way}: {g.example}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {s.onet && (
            <div className="mt-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground">What O*NET lists for this work</p>
              {s.onet.skills.length > 0 && <p className="text-foreground">Leans more on: {s.onet.skills.join(', ')}.</p>}
              {s.onet.tools.length > 0 && <p className="text-foreground">Tools employers ask for: {s.onet.tools.join(', ')}.</p>}
              <p className="text-xs text-muted-foreground">
                O*NET: {s.onet.targetOccupation}
                {s.onet.sourceOccupation ? `, compared with ${s.onet.sourceOccupation}` : ''}.
              </p>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <details
          className="group rounded-lg border border-border"
          onToggle={(e) => {
            if (e.currentTarget.open) posthog.capture('pivot_path_detail_opened', { target: s.target, socCode: detail.socCode, rank, sourceRole, surface })
          }}
        >
          <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-medium text-primary">What it takes: skills, pay near you, training</summary>
          <div className="border-t border-border p-3">{detail.node}</div>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          nativeButton={false}
          render={
            <Link
              href={pivotJobsHref(s.target)}
              onClick={() => posthog.capture('pivot_path_jobs_clicked', { target: s.target, rank, sourceRole, surface, fitLabel: s.fitLabel })}
            />
          }
        >
          Show me these jobs
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
        <ExpansionToggle kind="role" value={s.target} on={inSearch} label={s.label} />
        <Button size="sm" variant="ghost" onClick={onHide} aria-label={`Not for me: hide ${s.label}`}>
          Not for me
        </Button>
      </div>
    </article>
  )
}
