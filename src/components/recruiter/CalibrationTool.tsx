'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { generateCalibrationMemo } from '@/app/recruiters/calibrate/[token]/actions'

export function CalibrationTool({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(generateCalibrationMemo.bind(null, token), undefined)

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className={cn('space-y-3', pending && 'cursor-progress [&_*]:cursor-progress')}
      >
        <Label htmlFor="brief">Paste your client brief</Label>
        <Textarea
          id="brief"
          name="brief"
          rows={10}
          placeholder="Paste the role brief, JD, or client notes here..."
          required
        />
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
          {pending ? 'Reading the brief…' : 'Generate calibration memo →'}
        </Button>
      </form>

      {state?.memo && (
        <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-medium text-foreground">Calibration memo</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{state.memo}</p>
        </div>
      )}
    </div>
  )
}
