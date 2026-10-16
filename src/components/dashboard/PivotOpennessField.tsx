'use client'

import { useState } from 'react'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { assessPivot, type BridgeRoute } from '@/lib/journey/feasibility'
import { HOURS_OPTIONS, isCommitted, type PivotTarget } from '@/lib/journey/pivot'

type Draft = { route: BridgeRoute | null; hours: string | null; commit: boolean; how: string }

const SKIP = new Set<string>(['General', 'Other', 'Executive Leadership'])

// "Are you open to other fields?" Each function you pick comes with an honest read
// of how big the change is. Small moves go straight into the search. Big ones need a
// route (informal learning or formal training), hours a week and a yes before we
// search for them; we remember it and put it in your weekly plan. The server reads
// pivotJson (src/lib/journey/pivot.ts).
export function PivotOpennessField({
  from,
  seniorLevel,
  initial,
  canSwitchJourney,
  switchDefault,
}: {
  from: string | null
  seniorLevel: boolean
  initial: PivotTarget[]
  canSwitchJourney: boolean
  switchDefault: boolean
}) {
  const [picked, setPicked] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(initial.map((t) => [t.function, { route: t.route ?? null, hours: t.hoursPerWeek ? String(t.hoursPerWeek) : null, commit: isCommitted(t), how: t.how ?? '' }])),
  )
  const options = PRIMARY_FUNCTION_OPTIONS.filter((f) => f !== from && !SKIP.has(f))
  const toggle = (fn: string) =>
    setPicked((cur) => {
      const next = { ...cur }
      if (next[fn]) delete next[fn]
      else next[fn] = { route: null, hours: null, commit: false, how: '' }
      return next
    })
  const patch = (fn: string, d: Partial<Draft>) => setPicked((cur) => ({ ...cur, [fn]: { ...cur[fn], ...d } }))
  const payload = Object.entries(picked).map(([fn, d]) => ({ function: fn, route: d.route, hoursPerWeek: d.hours ? Number(d.hours) : null, commit: d.commit, how: d.how }))
  const anyCommitted = Object.entries(picked).some(([fn, d]) => assessPivot(from, fn).needsCommitment && d.commit && d.route && d.hours)

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Are you open to work in other fields? Pick all that apply.</legend>
      <p className="text-xs text-muted-foreground">
        Only thinking about it? That is fine. Put it on your radar on <a href="/dashboard/pivot-paths" className="underline underline-offset-4">Pivot paths</a>, with no commitment. Pick it here when you are ready to plan it. Unticking something sets it aside; we keep the story.
      </p>
      <input type="hidden" name="pivotJson" value={JSON.stringify(payload)} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {options.map((fn) => (
          <label key={fn} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!picked[fn]} onChange={() => toggle(fn)} />
            {fn}
          </label>
        ))}
      </div>
      {Object.keys(picked).map((fn) => {
        const a = assessPivot(from, fn, { seniorLevel })
        const d = picked[fn]
        const route = d.route
        const ready = a.needsCommitment && !!d.route && !!d.hours
        return (
          <div key={fn} className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-semibold">
                {fn}: {a.headline}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{a.detail}</p>
              {a.months && a.needsCommitment && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Plan for roughly {a.months[0]} to {a.months[1]} months{a.stepDown ? ', and expect to start below your current level or pay' : ''}.
                </p>
              )}
            </div>
            {a.needsCommitment && a.education && (
              <>
                <div className="space-y-1.5">
                  <Label>How will you get there?</Label>
                  <ChoiceButtons
                    name={`pivotRoute-${fn}`}
                    options={[
                      { value: 'INFORMAL', label: 'Learn on my own', subtext: 'Courses, projects, a mentor' },
                      { value: 'FORMAL', label: 'Formal training', subtext: 'A certificate, bootcamp or degree' },
                    ]}
                    value={route}
                    onChange={(v) => patch(fn, { route: v as BridgeRoute })}
                    columns={2}
                    responsive
                  />
                  {route && (
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                      {a.education[route].map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Hours a week you can give it</Label>
                  <ChoiceButtons name={`pivotHours-${fn}`} options={HOURS_OPTIONS.map((h) => ({ value: String(h), label: `${h} hours` }))} value={d.hours} onChange={(v) => patch(fn, { hours: v })} columns={3} responsive />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`how-${fn}`}>What will you do first? (optional)</Label>
                  <Textarea id={`how-${fn}`} rows={2} value={d.how} onChange={(e) => patch(fn, { how: e.target.value })} />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={d.commit} disabled={!ready} onChange={(e) => patch(fn, { commit: e.target.checked })} />
                  <span>
                    I commit to this plan. We will search for {fn} roles and put your learning in your weekly plan.
                    {!ready && <span className="block text-muted-foreground">Pick how you will get there and your hours first.</span>}
                    {ready && !d.commit && <span className="block text-muted-foreground">Until you commit, {fn} stays on your list but we will not search for it.</span>}
                  </span>
                </label>
              </>
            )}
          </div>
        )
      })}
      {canSwitchJourney && anyCommitted && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="makeCareerChange" defaultChecked={switchDefault} className="mt-1" />
          <span>
            Make changing careers my main plan. Your progress, history and everything you have done stay. Your weekly plan switches to the career change plan.
          </span>
        </label>
      )}
    </fieldset>
  )
}
