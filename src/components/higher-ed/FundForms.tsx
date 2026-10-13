'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { awardFund, saveFundSettings } from '@/app/i/[slug]/(portal)/development-actions'

type State = { error?: string; ok?: boolean; message?: string } | undefined

function Status({ state }: { state: State }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    )
  if (state?.message)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {state.message}
      </p>
    )
  return null
}

export function FundSettingsForm(props: { slug: string; defaults: { name: string; description: string; goal: string; raised: string } }) {
  const [state, action] = useActionState(saveFundSettings.bind(null, props.slug), undefined)
  // Controlled, so a failed save keeps what was typed.
  const [v, setV] = useState(props.defaults)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="fund-name">Fund name</Label>
        <Input id="fund-name" name="name" value={v.name} onChange={set('name')} placeholder="Alumni Resilience Fund" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="fund-desc">What it pays for (donors see this)</Label>
        <Input id="fund-desc" name="description" value={v.description} onChange={set('description')} placeholder="Coaching for alumni between jobs" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fund-goal">Goal ($)</Label>
        <Input id="fund-goal" name="goal" inputMode="decimal" value={v.goal} onChange={set('goal')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fund-raised">Raised so far ($)</Label>
        <Input id="fund-raised" name="raised" inputMode="decimal" value={v.raised} onChange={set('raised')} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">Save fund</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  )
}

export function AwardForm(props: {
  slug: string
  candidates: { id: string; name: string }[]
  types: { key: string; label: string; defaultCents: number }[]
}) {
  const [state, action] = useActionState(awardFund.bind(null, props.slug), undefined)
  const [memberId, setMemberId] = useState('')
  const [type, setType] = useState(props.types[0].key)
  const [value, setValue] = useState(String(props.types[0].defaultCents / 100))
  if (!props.candidates.length) return <p className="text-sm text-muted-foreground">No one is in transition right now. Awards go to alumni between jobs.</p>
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="award-member">Alum in transition</Label>
        <select id="award-member" name="memberId" value={memberId} onChange={(e) => setMemberId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Choose…</option>
          {props.candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Covers</legend>
        <input type="hidden" name="awardType" value={type} />
        <div className="flex gap-2">
          {props.types.map((t) => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={type === t.key ? 'default' : 'outline'}
              aria-pressed={type === t.key}
              onClick={() => {
                setType(t.key)
                setValue(String(t.defaultCents / 100))
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="award-value">Value ($)</Label>
        <Input id="award-value" name="value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <SubmitButton pendingLabel="Awarding…">Award from the fund</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  )
}
