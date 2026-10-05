'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { IntakeTag } from '@prisma/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TalentFormState } from '@/app/recruiters/(app)/talent/actions'
import { INTAKE_TAG_LABELS } from '@/lib/recruiter/intake/constants'

// Generic wrapper for Talent's server-action forms: busy cursor while
// pending, plain-language error or confirmation under the button, input
// preserved on error (uncontrolled fields keep their values).
export function TalentActionForm({
  action,
  submitLabel,
  pendingLabel,
  children,
  className,
}: {
  action: (prev: TalentFormState, formData: FormData) => Promise<TalentFormState>
  submitLabel: string
  pendingLabel?: string
  children: React.ReactNode
  className?: string
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  return (
    <form action={formAction} className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress', className)}>
      {children}
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.success && <p className="text-sm text-success">{state.success}</p>}
      <SubmitButton pendingLabel={pendingLabel ?? 'Saving…'}>{submitLabel}</SubmitButton>
    </form>
  )
}

export function TagButtons({
  current,
  onChange,
}: {
  current: IntakeTag | null
  onChange: (tag: IntakeTag) => Promise<void>
}) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <div role="group" aria-label="Change tag" className={cn('flex flex-wrap gap-2', pending && 'cursor-progress')}>
      {(['FIT', 'NICHE', 'OUTSIDE'] as const).map((tag) => (
        <Button
          key={tag}
          type="button"
          size="sm"
          variant={current === tag ? 'default' : 'outline'}
          aria-pressed={current === tag}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await onChange(tag)
              router.refresh()
            })
          }
        >
          {INTAKE_TAG_LABELS[tag]}
        </Button>
      ))}
    </div>
  )
}

export function AssignControl({
  recruiters,
  currentId,
  suggestedId,
  myId,
  canAssignAnyone,
  onAssign,
}: {
  recruiters: { id: string; name: string }[]
  currentId: string | null
  suggestedId: string | null
  myId: string
  canAssignAnyone: boolean
  onAssign: (recruiterId: string | null) => Promise<void>
}) {
  const [pending, start] = useTransition()
  const [choice, setChoice] = useState(currentId ?? suggestedId ?? '')
  const router = useRouter()
  const run = (id: string | null) =>
    start(async () => {
      await onAssign(id)
      router.refresh()
    })
  const suggested = recruiters.find((r) => r.id === suggestedId)

  return (
    <div className={cn('space-y-3', pending && 'cursor-progress')}>
      {suggested && !currentId && (canAssignAnyone || suggestedId === myId) && (
        <Button type="button" size="sm" disabled={pending} onClick={() => run(suggested.id)}>
          {suggestedId === myId ? 'Accept this candidate' : `Confirm ${suggested.name}`}
        </Button>
      )}
      {canAssignAnyone && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm">
            <span className="block text-muted-foreground">Assign to</span>
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">General hopper</option>
              {recruiters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || choice === (currentId ?? '')}
            title={choice === (currentId ?? '') ? 'Pick someone different to reassign' : undefined}
            onClick={() => run(choice || null)}
          >
            {pending ? 'Saving…' : 'Reassign'}
          </Button>
        </div>
      )}
      {!canAssignAnyone && currentId === myId && (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(null)}>
          Return to the general hopper
        </Button>
      )}
    </div>
  )
}

export function OpenResumeButton({ getUrl }: { getUrl: () => Promise<string | null> }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className={cn('inline-flex items-center gap-2', pending && 'cursor-progress')}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            const url = await getUrl()
            if (url) window.open(url, '_blank', 'noopener')
            else setError('Could not open the file. Refresh and try again.')
          })
        }
      >
        {pending ? 'Opening…' : 'Open resume'}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </span>
  )
}

export function ConfirmingActionButton({
  label,
  confirmText,
  pendingLabel,
  onAction,
  variant = 'outline',
}: {
  label: string
  confirmText?: string
  pendingLabel?: string
  onAction: () => Promise<unknown>
  variant?: 'outline' | 'default' | 'ghost' | 'destructive'
}) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      className={cn(pending && 'cursor-progress')}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return
        start(async () => {
          await onAction()
          router.refresh()
        })
      }}
    >
      {pending ? (pendingLabel ?? 'Saving…') : label}
    </Button>
  )
}
