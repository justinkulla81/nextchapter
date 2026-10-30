'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { createWorkforceDemo, type DemoFormState } from '@/app/demo/workforce/actions'

const TYPES = [
  { key: 'WORKFORCE_BOARD', label: 'Workforce board' },
  { key: 'ECONOMIC_DEVELOPMENT', label: 'Economic development' },
  { key: 'CHAMBER', label: 'Chamber of commerce' },
  { key: 'COMMUNITY_ORG', label: 'Community organization' },
]

export function WorkforceDemoForm({ defaults }: { defaults?: { name: string; city: string; state: string; from: string } }) {
  const [state, action] = useActionState<DemoFormState, FormData>(createWorkforceDemo, undefined)
  // After an error the visitor's own entries come back; before the first submit, the link's prefill is used.
  const v = state?.values ?? { name: defaults?.name ?? '', anchorCity: defaults?.city ?? '', anchorState: defaults?.state ?? '' }
  const [type, setType] = useState(v.orgType || 'ECONOMIC_DEVELOPMENT')
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="from" value={defaults?.from ?? ''} />
      <div className="space-y-1.5">
        <Label htmlFor="d-name">Your organization</Label>
        <Input id="d-name" name="name" required maxLength={80} defaultValue={v.name} placeholder="One Louisville" />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">What kind of organization</legend>
        <input type="hidden" name="orgType" value={type} />
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <Button key={t.key} type="button" variant={type === t.key ? 'default' : 'outline'} aria-pressed={type === t.key} onClick={() => setType(t.key)}>
              {t.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="d-city">Main city</Label>
          <Input id="d-city" name="anchorCity" required maxLength={60} defaultValue={v.anchorCity} placeholder="Louisville" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-state">State</Label>
          <Input id="d-state" name="anchorState" required maxLength={2} defaultValue={v.anchorState} placeholder="KY" className="uppercase" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-radius">Miles around it</Label>
          <Input id="d-radius" name="radiusMiles" type="number" min={10} max={100} defaultValue={v.radiusMiles || '40'} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-email">Your work email</Label>
        <Input id="d-email" name="email" type="email" required defaultValue={v.email} />
        <p className="text-xs text-muted-foreground">We don&apos;t email you anything from the demo. We may follow up once to see if it was useful.</p>
      </div>
      <SubmitButton size="lg" pendingLabel="Building your demo (about 20 seconds)…">
        Build my demo
      </SubmitButton>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}
