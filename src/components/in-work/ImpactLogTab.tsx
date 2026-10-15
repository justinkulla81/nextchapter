'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { posthog } from '@/lib/posthog/client'
import { addWin, deleteWin } from '@/app/dashboard/in-work/actions'
import { buildReviewSummary } from '@/lib/in-work/templates'
import { parseDateOnly } from '@/lib/in-work/types'
import type { WorkspaceData } from '@/lib/in-work/workspace-data'
import { ChoiceButtons, ConfirmDelete, CopyBlock, Field, NoticeLine, Section, formatDate, today, useRunner } from './shared'

type Range = 'since' | 'six' | 'all'

export function ImpactLogTab({ data }: { data: WorkspaceData }) {
  const [what, setWhat] = useState('')
  const [result, setResult] = useState('')
  const [who, setWho] = useState('')
  const [date, setDate] = useState(today())
  const add = useRunner()
  const del = useRunner()
  const [range, setRange] = useState<Range>(data.summarySince ? 'since' : 'six')

  const summary = useMemo(() => {
    const wins = data.wins.map((w) => ({ ...w, occurredOn: parseDateOnly(w.occurredOn)! }))
    let from: Date | null = null
    if (range === 'since' && data.summarySince) from = parseDateOnly(data.summarySince)
    if (range === 'six') {
      const d = new Date()
      d.setUTCMonth(d.getUTCMonth() - 6)
      from = d
    }
    return buildReviewSummary(wins, { from })
  }, [data.wins, data.summarySince, range])

  const rangeOptions = [
    ...(data.summarySince ? [{ key: 'since' as const, label: 'Since my last review' }] : []),
    { key: 'six' as const, label: 'Last 6 months' },
    { key: 'all' as const, label: 'Everything' },
  ]

  return (
    <div className="space-y-6">
      <Section
        title="Log a win"
        intro="Write it down the week it happens. A result with a number is worth ten without one."
      >
        <div className={cn('space-y-3', add.pending && 'cursor-wait')}>
          <Field label="What did you do?">
            <Input value={what} maxLength={2000} onChange={(e) => setWhat(e.target.value)} placeholder="Rebuilt the onboarding flow for new customers" />
          </Field>
          <Field label="What changed because of it?" hint="Use numbers: time saved, money earned or saved, error rates, people served.">
            <Textarea value={result} maxLength={2000} rows={2} onChange={(e) => setResult(e.target.value)} placeholder="Cut setup time from 9 days to 3, and 40 accounts went live a month earlier" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Who benefited?" hint="Optional. A team, a customer group, your manager.">
              <Input value={who} maxLength={300} onChange={(e) => setWho(e.target.value)} placeholder="Customer success team" />
            </Field>
            <Field label="When?">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button
              disabled={add.pending || !what.trim() || !result.trim()}
              onClick={() =>
                add.run(
                  () => addWin({ what, result, whoBenefited: who || undefined, occurredOn: date }),
                  'Win logged.',
                  () => {
                    setWhat('')
                    setResult('')
                    setWho('')
                  },
                )
              }
            >
              {add.pending ? 'Saving…' : 'Log this win'}
            </Button>
            {(!what.trim() || !result.trim()) && <span className="text-xs text-muted-foreground">Add what you did and what changed to enable this.</span>}
            <NoticeLine notice={add.notice} />
          </div>
        </div>
      </Section>

      <Section title="Your one-page review summary" intro="Built from your log with a fixed template. Results with numbers come first. Cut it to the top five before you use it.">
        {data.wins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Log your first win above and the summary builds itself.</p>
        ) : (
          <>
            <ChoiceButtons value={range} options={rangeOptions} onChange={setRange} label="Summary period" />
            <CopyBlock
              text={summary.text}
              label="Copy summary"
              onCopy={() => posthog.capture('in_work_review_summary_copied', { winCount: summary.quantified.length + summary.other.length, range })}
            />
          </>
        )}
      </Section>

      <Section title={`Your log (${data.wins.length})`}>
        {data.wins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.wins.map((w) => (
              <li key={w.id} className="space-y-1 py-3 text-sm">
                <p className="font-medium text-foreground">{w.what}</p>
                <p className="text-foreground/80">{w.result}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDate(w.occurredOn)}</span>
                  {w.whoBenefited && <span>Helped {w.whoBenefited}</span>}
                  <ConfirmDelete what="win" pending={del.pending} onConfirm={() => del.run(() => deleteWin(w.id), 'Deleted.')} />
                </p>
              </li>
            ))}
          </ul>
        )}
        <NoticeLine notice={del.notice} />
      </Section>
    </div>
  )
}
