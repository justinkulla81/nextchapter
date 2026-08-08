'use client'

import { useActionState, useState } from 'react'
import { createProfileShare } from '@/app/dashboard/privacy/share-actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const RECIPIENT_OPTIONS = [
  { value: 'HIRING_MANAGER', label: 'Hiring manager' },
  { value: 'RECRUITER', label: 'Recruiter' },
  { value: 'COACH', label: 'Coach' },
] as const

const PROCESS_OPTIONS = [
  { value: 'false', label: 'Early-stage' },
  { value: 'true', label: 'Active process' },
] as const

const EXTRA_OPTIONS = [
  { value: 'RESUME', label: 'Resume' },
  { value: 'SALARY', label: 'Salary expectations' },
  { value: 'REFERENCES', label: 'Reference summaries' },
  { value: 'GAP_EXPLANATION', label: 'My gap explanation' },
] as const

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'never', label: 'No expiration' },
] as const

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[]
  value: string | null
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'border-brand bg-brand/5 text-brand'
              : 'border-border bg-white text-foreground hover:border-brand/40'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function CreateShareForm() {
  const [state, formAction, pending] = useActionState(createProfileShare, undefined)
  const [recipientType, setRecipientType] = useState<string | null>(null)
  const [activeProcess, setActiveProcess] = useState('false')
  const [expiryOption, setExpiryOption] = useState('30')

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label>Who is this link for?</Label>
        <input type="hidden" name="recipientType" value={recipientType ?? ''} />
        <ToggleGroup options={RECIPIENT_OPTIONS} value={recipientType} onChange={setRecipientType} />
      </div>

      {recipientType === 'HIRING_MANAGER' && (
        <div className="space-y-2">
          <Label>Where are you in the process with them?</Label>
          <input type="hidden" name="activeProcess" value={activeProcess} />
          <ToggleGroup options={PROCESS_OPTIONS} value={activeProcess} onChange={setActiveProcess} />
          <p className="text-xs text-muted-foreground">
            Early-stage shows your story, known-for, and work history. Active process adds your
            resume and reference summaries.
          </p>
        </div>
      )}

      {recipientType === 'RECRUITER' && (
        <div className="space-y-2">
          <Label>Anything extra to include?</Label>
          <div className="flex flex-wrap gap-4">
            {EXTRA_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox id={`extra-${opt.value}`} name="includeExtras" value={opt.value} />
                <Label htmlFor={`extra-${opt.value}`} className="font-normal">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Recruiters default to your target role, industries, seniority, and work history — these
            are optional add-ons. Gap explanation only sends if you&apos;ve also written one and
            opted in on your Portfolio page.
          </p>
        </div>
      )}

      {recipientType === 'COACH' && (
        <p className="text-xs text-muted-foreground">
          Coaches see your full profile, including your Current Market Reality and Search Action
          Grade. Your private
          conversations with Victoria are never included.
        </p>
      )}

      {recipientType && (
        <>
          <div className="space-y-2">
            <Label>Link expires after</Label>
            <input type="hidden" name="expiryOption" value={expiryOption} />
            <ToggleGroup options={EXPIRY_OPTIONS} value={expiryOption} onChange={setExpiryOption} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-label">Note for yourself (optional)</Label>
            <Input id="share-label" name="label" placeholder="e.g. For Sarah at Acme" maxLength={80} />
          </div>
        </>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button
        type="submit"
        disabled={pending || !recipientType}
        className={pending ? 'cursor-progress' : ''}
      >
        {pending ? 'Creating…' : 'Create share link'}
      </Button>
    </form>
  )
}
