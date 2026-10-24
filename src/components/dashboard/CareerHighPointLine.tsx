'use client'

import { useState, useTransition } from 'react'
import type { CompanySizeBand } from '@prisma/client'
import { saveCareerHighPoint } from '@/app/dashboard/search-strategy/career-high-point-actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CAREER_LEVELS,
  SIZE_BANDS,
  SIZE_CHOICE_LABEL,
  careerHighPointLine,
  effectiveCareerHighPoint,
  type CareerHighPoint,
  type CareerHighPointStore,
} from '@/lib/profile/career-high-point'

// One line under "Seniority — highest level reached": where their career peaked, scaled
// by the employer (career-high-point.ts), and a way to correct it. Adds no section.
export function CareerHighPointLine({ store, fallbackLevel }: { store: CareerHighPointStore | undefined; fallbackLevel: string | null }) {
  const [point, setPoint] = useState<CareerHighPoint | null>(effectiveCareerHighPoint(store))
  const [editing, setEditing] = useState(false)
  const [level, setLevel] = useState<string>(point?.level ?? fallbackLevel ?? 'VP')
  const [sizeBand, setSizeBand] = useState<string>(point?.sizeBand ?? 'unknown')
  const [startup, setStartup] = useState(point?.startup ?? false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!point && !editing && !fallbackLevel) return null

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await saveCareerHighPoint({ level, sizeBand: sizeBand === 'unknown' ? null : sizeBand, startup })
      if (res.error) {
        setError(res.error)
        return
      }
      setPoint({
        level: level as CareerHighPoint['level'],
        sizeBand: sizeBand === 'unknown' ? null : (sizeBand as CompanySizeBand),
        startup,
        source: 'member',
        at: new Date().toISOString(),
      })
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <p className="text-xs text-muted-foreground">
        Career high point: {point ? careerHighPointLine(point) : 'not worked out yet'}{' '}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => setEditing(true)}
          aria-label="Correct your career high point"
        >
          {point ? 'Correct it' : 'Add it'}
        </button>
      </p>
    )
  }

  return (
    <div className={`space-y-2 rounded-md bg-muted/40 p-3 ${pending ? 'cursor-wait' : ''}`}>
      <p className="text-xs text-muted-foreground">Your highest level, and the size of the employer where you held it.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="chp-level" className="text-xs">Level</Label>
          <Select value={level} onValueChange={(v) => v && setLevel(v)}>
            <SelectTrigger id="chp-level" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAREER_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="chp-size" className="text-xs">Employer size</Label>
          <Select value={sizeBand} onValueChange={(v) => v && setSizeBand(v)}>
            <SelectTrigger id="chp-size" className="w-full">
              <SelectValue>{(v: string | null) => (v && v !== 'unknown' ? SIZE_CHOICE_LABEL[v as CompanySizeBand] : 'Not sure')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">Not sure</SelectItem>
              {SIZE_BANDS.map((b) => (
                <SelectItem key={b} value={b}>
                  {SIZE_CHOICE_LABEL[b]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="chp-startup" checked={startup} onCheckedChange={(v) => setStartup(v === true)} />
        <Label htmlFor="chp-startup" className="text-xs font-normal">It was a funded startup</Label>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={pending} className={pending ? 'cursor-wait' : ''}>
          {pending ? 'Saving…' : 'Save career high point'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
