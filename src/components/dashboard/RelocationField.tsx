'use client'

import { useState } from 'react'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { US_STATES } from '@/lib/constants/us-states'
import { RADIUS_OPTIONS, RELOCATION_SCOPES, type Relocation, type RelocationScope } from '@/lib/journey/relocation'

// How far will you go? Replaces the yes/no "open to relocating". The server
// reads relocationScope, relocationRadius and relocationStates (src/lib/journey/relocation.ts).
export function RelocationField({ initial, notes }: { initial: Relocation; notes: string | null }) {
  const [scope, setScope] = useState<RelocationScope>(initial.scope)
  const [radius, setRadius] = useState<string>(String(initial.radiusMiles ?? 50))
  const [states, setStates] = useState<string[]>(initial.states ?? [])
  const [filter, setFilter] = useState('')
  const shown = US_STATES.filter((s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.code.toLowerCase() === filter.toLowerCase())

  return (
    <div className="space-y-3">
      <Label>How far would you go for the right role?</Label>
      <ChoiceButtons name="relocationScope" options={RELOCATION_SCOPES.map((s) => ({ value: s.key, label: s.label, subtext: s.hint }))} value={scope} onChange={setScope} columns={4} responsive />
      {scope === 'RADIUS' && (
        <div className="space-y-1.5">
          <Label>Within about</Label>
          <ChoiceButtons name="relocationRadius" options={RADIUS_OPTIONS.map((r) => ({ value: String(r), label: `${r} miles` }))} value={radius} onChange={setRadius} columns={4} responsive />
          <p className="text-xs text-muted-foreground">Roles in your state are treated as in range. We can&apos;t measure distance across state lines yet; pick particular states for that.</p>
        </div>
      )}
      {scope === 'STATES' && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Which states would you move to?</legend>
          {states.map((s) => (
            <input key={s} type="hidden" name="relocationStates" value={s} />
          ))}
          <Input aria-label="Filter states" placeholder="Filter states" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="grid max-h-48 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-3">
            {shown.map((s) => (
              <label key={s.code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={states.includes(s.code)} onChange={(e) => setStates((cur) => (e.target.checked ? [...cur, s.code] : cur.filter((x) => x !== s.code)))} />
                {s.name}
              </label>
            ))}
            {shown.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No state matches &ldquo;{filter}&rdquo;.</p>}
          </div>
          <p className="text-xs text-muted-foreground">{states.length === 0 ? 'Pick at least one, or choose “Stay where I live”.' : `${states.length} selected: ${states.join(', ')}`}</p>
        </fieldset>
      )}
      {scope !== 'LOCAL' && <Textarea name="relocationNotes" placeholder="Anything we should know about a move (optional)" defaultValue={notes ?? ''} rows={2} />}
    </div>
  )
}
