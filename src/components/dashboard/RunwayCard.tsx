'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cushionMonths, RUNWAY_FACTS, uiWeeksLeft } from '@/lib/outcomes/runway'

export interface RunwayStateFacts {
  stateCode: string
  agencyName: string | null
  fileUrl: string | null
  maxWeeks: number | null
  maxWeeklyBenefit: number | null
  durationVaries: boolean | null
  severanceNote: string | null
  asOf: string | null
}

const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/[$,\s]/g, '')))

// Savings numbers are computed here in the browser and never sent or stored.
export function RunwayCard({ facts, weeksSinceLastJob }: { facts: RunwayStateFacts | null; weeksSinceLastJob: number | null }) {
  const [savings, setSavings] = useState('')
  const [expenses, setExpenses] = useState('')
  const [income, setIncome] = useState('')
  const [calculated, setCalculated] = useState(false)

  const ui = uiWeeksLeft({ maxWeeks: facts?.maxWeeks ?? null, durationVaries: facts?.durationVaries ?? null, weeksSinceLastJob })
  const cushion = cushionMonths({ savingsUsd: num(savings), monthlyExpensesUsd: num(expenses), monthlyIncomeUsd: num(income) })

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your runway</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A rough picture of how long you can plan on, so you can decide what to do first. These are estimates, not advice.
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Unemployment insurance</p>
          {facts ? (
            <>
              <p className="text-sm text-foreground">
                {facts.agencyName ?? facts.stateCode}: up to {facts.maxWeeks ?? 'an unconfirmed number of'} weeks
                {facts.maxWeeklyBenefit ? `, up to $${facts.maxWeeklyBenefit} a week` : ''}.
                {ui.known && ui.weeksLeft !== null && (
                  <> About <strong>{ui.weeksLeft} weeks</strong> may remain{ui.exhausted ? ' (the regular weeks may be used up)' : ''}.</>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{ui.note}</p>
              {facts.severanceNote && <p className="text-xs text-muted-foreground">Severance: {facts.severanceNote}</p>}
              {facts.fileUrl && (
                <a href={facts.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                  File or check your claim with your state agency
                </a>
              )}
              {facts.asOf && <p className="text-xs text-muted-foreground">State figures as of {facts.asOf}.</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Add your state in your profile to see your state&apos;s weeks and weekly amount.</p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Savings cushion</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="runway-savings">Savings you can use</Label>
              <Input id="runway-savings" inputMode="numeric" value={savings} onChange={(e) => { setSavings(e.target.value); setCalculated(false) }} placeholder="30000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="runway-expenses">Monthly expenses</Label>
              <Input id="runway-expenses" inputMode="numeric" value={expenses} onChange={(e) => { setExpenses(e.target.value); setCalculated(false) }} placeholder="6000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="runway-income">Monthly money coming in</Label>
              <Input id="runway-income" inputMode="numeric" value={income} onChange={(e) => { setIncome(e.target.value); setCalculated(false) }} placeholder="Benefits, severance, partner" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCalculated(true)
              posthog.capture('runway_calculated', { stateCode: facts?.stateCode ?? null, weeksLeft: ui.weeksLeft, hasCushion: cushion.months !== null })
            }}
            className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90"
          >
            Estimate my runway
          </button>
          {calculated && (
            <p className="text-sm text-foreground" role="status">
              {cushion.coveredByIncome
                ? 'Your monthly income covers your expenses, so your savings are not being drawn down.'
                : cushion.months === null
                  ? 'Enter savings and monthly expenses to see your cushion.'
                  : `Your savings cover about ${cushion.months.toFixed(1)} months at this pace.`}
            </p>
          )}
          <p className="text-xs text-muted-foreground">These numbers stay on this page and are not saved.</p>
        </div>

        <ul className="space-y-2 border-t border-border pt-4">
          {RUNWAY_FACTS.map((f) => (
            <li key={f.text}>
              <p className="text-sm text-foreground">{f.text}</p>
              <p className="text-xs text-muted-foreground">Source: {f.source}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
