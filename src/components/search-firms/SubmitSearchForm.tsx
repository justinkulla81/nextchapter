'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { SEARCH_LEVELS } from '@/lib/search-firms/search-request'
import type { SubmitSearchState } from '@/app/submit-search/actions'
import { cn } from '@/lib/utils'

const CONFIDENTIAL_OPTIONS = [
  { value: 'no' as const, label: 'Client can be named' },
  { value: 'yes' as const, label: 'Confidential search' },
]
const LEVEL_OPTIONS = SEARCH_LEVELS.map((l) => ({ value: l, label: l }))

export function SubmitSearchForm({
  action,
  refCode,
}: {
  action: (prev: SubmitSearchState, formData: FormData) => Promise<SubmitSearchState>
  refCode: string | null
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const v = state?.values
  const [confidential, setConfidential] = useState<'yes' | 'no' | null>((v?.confidential as 'yes' | 'no' | undefined) ?? 'no')
  // Controlled: a form reset after a failed submit would otherwise drop the choice.
  const [fn, setFn] = useState(v?.function ?? '')
  const [level, setLevel] = useState<(typeof SEARCH_LEVELS)[number] | null>((v?.level as (typeof SEARCH_LEVELS)[number] | undefined) || null)

  if (state?.sent) {
    return (
      <div role="status" className="rounded-lg border border-brand/30 bg-brand/5 p-4 text-sm text-foreground">
        Got it. A person on our team will review the search and send you a screened shortlist of members, usually
        within a few business days. Nothing is shared with members until we have checked it.
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-5 rounded-lg border border-border p-5', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <input type="hidden" name="ref" value={refCode ?? v?.ref ?? ''} />
      {/* Hidden from people; bots fill it. */}
      <div aria-hidden className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="roleTitle">Role you are hiring for</Label>
        <Input id="roleTitle" name="roleTitle" required placeholder="VP Finance, Chief Operating Officer…" defaultValue={v?.roleTitle ?? ''} />
      </div>

      <div className="space-y-2">
        <Label>Can we name the client to members?</Label>
        <ChoiceButtons name="confidential" options={CONFIDENTIAL_OPTIONS} value={confidential} onChange={setConfidential} responsive />
      </div>

      <div className="space-y-2">
        <Label htmlFor="clientName">
          Client {confidential === 'yes' ? '(optional, never shown to members)' : '(optional)'}
        </Label>
        <Input id="clientName" name="clientName" defaultValue={v?.clientName ?? ''} />
        {confidential === 'yes' && (
          <p className="text-sm text-muted-foreground">
            Telling us lets us leave out the client&apos;s own employees. Members see only the role, level and location.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Level</Label>
        <ChoiceButtons name="level" options={LEVEL_OPTIONS} value={level} onChange={setLevel} responsive />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="function">Function</Label>
          <select
            id="function"
            name="function"
            value={fn}
            onChange={(e) => setFn(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Choose a function</option>
            {PRIMARY_FUNCTION_OPTIONS.map((fn) => (
              <option key={fn} value={fn}>{fn}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="Chicago, hybrid" defaultValue={v?.location ?? ''} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="compensation">Compensation (optional)</Label>
        <Input id="compensation" name="compensation" placeholder="$220k–260k base + bonus" defaultValue={v?.compensation ?? ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">What matters most (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          placeholder="Must-haves, a link to the spec, who would not be a fit"
          defaultValue={v?.description ?? ''}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactName">Your name</Label>
          <Input id="contactName" name="contactName" required autoComplete="name" defaultValue={v?.contactName ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="firmName">Firm or company</Label>
          <Input id="firmName" name="firmName" required autoComplete="organization" defaultValue={v?.firmName ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Work email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" required autoComplete="email" defaultValue={v?.contactEmail ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone">Phone (optional)</Label>
          <Input id="contactPhone" name="contactPhone" type="tel" autoComplete="tel" defaultValue={v?.contactPhone ?? ''} />
        </div>
      </div>

      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Sending…">Send this search</SubmitButton>
    </form>
  )
}
