'use client'

import { useActionState, useState } from 'react'
import { updateCoachBranding } from '@/app/support/coach/settings/[token]/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { ACCENT_COLOR_OPTIONS } from '@/lib/constants/coach-branding'
import { cn } from '@/lib/utils'
import type { Coach } from '@prisma/client'

export function CoachBrandingForm({ token, coach }: { token: string; coach: Coach }) {
  const [state, formAction, pending] = useActionState(updateCoachBranding.bind(null, token), undefined)
  const [selectedColor, setSelectedColor] = useState(coach.accentColor ?? '')

  return (
    <form
      action={formAction}
      className={cn('space-y-5', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label htmlFor="firmName">Practice name</Label>
        <Input id="firmName" name="firmName" defaultValue={coach.firmName ?? ''} placeholder={coach.fullName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="logo">Logo</Label>
        {coach.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coach.logoUrl} alt="Current logo" className="h-12 w-auto rounded border border-border" />
        )}
        <Input id="logo" name="logo" type="file" accept="image/*" />
        <p className="text-xs text-muted-foreground">PNG or JPG, up to 2MB.</p>
      </div>

      <div className="space-y-2">
        <Label>Accent color</Label>
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLOR_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name="accentColor"
                value={option.value}
                checked={selectedColor === option.value}
                onChange={() => setSelectedColor(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                  selectedColor === option.value ? 'border-foreground' : 'border-border'
                )}
              >
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: option.value }}
                  aria-hidden="true"
                />
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Saving…">Save branding</SubmitButton>
    </form>
  )
}
