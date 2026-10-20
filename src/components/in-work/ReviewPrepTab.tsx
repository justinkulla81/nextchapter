'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { savePrep } from '@/app/dashboard/in-work/actions'
import { PREP_CHECKLIST, PREP_QUESTION_STARTERS } from '@/lib/in-work/constants'
import { buildReviewSummary, prepCompletion } from '@/lib/in-work/templates'
import { parseDateOnly } from '@/lib/in-work/types'
import type { WorkspaceData } from '@/lib/in-work/workspace-data'
import { ActionButton as Button, Field, NoticeLine, Section, formatDate, useRunner, useType } from './shared'

export function ReviewPrepTab({ data }: { data: WorkspaceData }) {
  const cycleKey = data.prepCycleKey
  const prep = data.prep
  const [checklist, setChecklist] = useState<Record<string, boolean>>(prep?.checklist ?? {})
  const [wins, setWins] = useState(prep?.wins ?? '')
  const [goals, setGoals] = useState(prep?.goals ?? '')
  const [theAsk, setTheAsk] = useState(prep?.theAsk ?? '')
  const [evidence, setEvidence] = useState(prep?.evidence ?? '')
  const [questions, setQuestions] = useState<string[]>(() => {
    const q = prep?.managerQuestions ?? []
    return [q[0] ?? '', q[1] ?? '', q[2] ?? '']
  })
  const { pending, notice, run } = useRunner()
  const t = useType()

  const keys = PREP_CHECKLIST.map((c) => c.key)
  const completion = prepCompletion(checklist, keys)

  const fromLog = useMemo(() => {
    const since = data.summarySince ? parseDateOnly(data.summarySince) : null
    const s = buildReviewSummary(
      data.wins.map((w) => ({ ...w, occurredOn: parseDateOnly(w.occurredOn)! })),
      { from: since },
    )
    return [...s.quantified, ...s.other].slice(0, 5).map((l) => `- ${l}`).join('\n')
  }, [data.wins, data.summarySince])

  if (!cycleKey || !data.nextCycle) {
    return (
      <Section title="Review prep">
        <p className={cn('text-muted-foreground', t.body)}>
          Set your review month on the Overview tab and the prep worksheet will be ready for your next cycle.
        </p>
      </Section>
    )
  }

  return (
    <div className="space-y-6">
      <Section
        title={`Prep for your review: ${data.nextCycle.label}`}
        intro={`${completion.done} of ${completion.total} steps done.${prep?.completedAt ? ' You finished this prep.' : ''}`}
      >
        {(data.carry.recap || data.carry.openFollowUps.length > 0 || data.carry.lastGoals) && (
          <div className={cn('space-y-2', t.body, t.redesign ? 'max-w-2xl rounded-2xl border border-border p-5' : 'rounded-lg border border-border bg-off-white p-3')}>
            <p className="font-medium text-foreground">Starting from last time</p>
            {data.carry.recap && <p className={t.redesign ? 'text-ink' : 'text-foreground/80'}>{data.carry.recap}</p>}
            {data.carry.lastGoals && (
              <p className={t.redesign ? 'text-ink' : 'text-foreground/80'}>
                <span className="font-medium">Goals you set last time:</span> {data.carry.lastGoals}
              </p>
            )}
            {data.carry.openFollowUps.length > 0 && (
              <div>
                <p className="font-medium">Follow-ups still open</p>
                <ul className={cn('list-disc pl-5', t.redesign ? 'text-ink' : 'text-foreground/80')}>
                  {data.carry.openFollowUps.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <ul className="space-y-2">
          {PREP_CHECKLIST.map((c) => (
            <li key={c.key}>
              <label className={cn('flex items-start gap-2', t.body)}>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checklist[c.key] === true}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                />
                <span className={cn(checklist[c.key] && 'text-muted-foreground line-through')}>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Worksheet">
        <div className={cn('space-y-4', pending && 'cursor-wait')}>
          <Field label="Your wins this period" hint="The top results you want your manager to remember.">
            <Textarea rows={4} maxLength={2000} value={wins} onChange={(e) => setWins(e.target.value)} />
          </Field>
          {fromLog && !wins.trim() && (
            <Button variant="outline" size="sm" onClick={() => setWins(fromLog)}>
              Fill from my impact log
            </Button>
          )}
          <Field label="Goals for the next period" hint="Two or three, each with a result you can measure.">
            <Textarea rows={3} maxLength={2000} value={goals} onChange={(e) => setGoals(e.target.value)} />
          </Field>
          <Field label="Your ask" hint="Raise, promotion, scope or title. Be specific. Salary numbers go in the Salary and raise tab.">
            <Textarea rows={3} maxLength={2000} value={theAsk} onChange={(e) => setTheAsk(e.target.value)} />
          </Field>
          <Field label="Evidence you already work at the next level" hint="Three examples. Say what you did and what changed.">
            <Textarea rows={4} maxLength={2000} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          </Field>
          <div className="space-y-2">
            <p className={cn('font-medium', t.redesign ? 'text-base text-ink' : 'text-sm text-foreground')}>Three questions for your manager</p>
            {questions.map((q, i) => (
              <Input
                key={i}
                value={q}
                maxLength={300}
                placeholder={PREP_QUESTION_STARTERS[i]}
                aria-label={`Question ${i + 1}`}
                onChange={(e) => setQuestions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
            <p className={cn('text-muted-foreground', t.hint)}>The grey text is a starting point. Replace it with your own.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => savePrep({ cycleKey, checklist, wins, goals, theAsk, evidence, managerQuestions: questions }),
                  'Prep saved.',
                )
              }
            >
              {pending ? 'Saving…' : 'Save prep'}
            </Button>
            <NoticeLine notice={notice} />
          </div>
          <p className={cn('text-muted-foreground', t.hint)}>Review window opens {formatDate(data.nextCycle.windowStart)}.</p>
        </div>
      </Section>
    </div>
  )
}
