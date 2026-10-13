'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { updateSituation } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { SITUATION_SESSION_KEY, SITUATION_TO_JOURNEY, type SituationKey } from '@/lib/constants/onboarding'
import { JOURNEY_CARDS } from './journey-cards'
import { cn } from '@/lib/utils'

const SITUATIONS = JOURNEY_CARDS

export function SituationForm({ initialSituation = null }: { initialSituation?: SituationKey | null }) {
  const [state, formAction, pending] = useActionState(updateSituation, undefined)
  const [selected, setSelected] = useState<SituationKey | null>(initialSituation)
  const [checking, setChecking] = useState(true)
  const [, startTransition] = useTransition()
  const autoSubmitted = useRef(false)

  // A homepage/marketing persona click already answered this — skip the
  // step entirely rather than asking again. Except 'just_graduated', which
  // still needs an email typed in here — pre-select it instead of
  // auto-submitting, so the email field is visible before anything's sent.
  useEffect(() => {
    const stored = sessionStorage.getItem(SITUATION_SESSION_KEY) as SituationKey | null
    sessionStorage.removeItem(SITUATION_SESSION_KEY)
    if (stored && stored in SITUATION_TO_JOURNEY && !autoSubmitted.current) {
      autoSubmitted.current = true
      const formData = new FormData()
      formData.set('situation', stored)
      startTransition(() => {
        formAction(formData)
      })
      return
    }
    setChecking(false)
    // Only ever runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (checking) return null

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <input type="hidden" name="situation" value={selected ?? ''} />
      <div className="grid gap-3 sm:grid-cols-2">
        {SITUATIONS.map(({ situation, icon: Icon, label, description }) => {
          const isSelected = selected === situation
          return (
            <button
              key={situation}
              type="button"
              onClick={() => setSelected(situation)}
              aria-pressed={isSelected}
              className={cn(
                'flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors',
                isSelected ? 'border-brand bg-brand/5' : 'border-border bg-white hover:border-brand/40'
              )}
            >
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-lg',
                  isSelected ? 'bg-brand text-white' : 'bg-brand/10 text-brand'
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block font-semibold', isSelected ? 'text-brand' : 'text-navy')}>
                  {label}
                </span>
                <span className="block text-sm text-muted-foreground">{description}</span>
              </span>
            </button>
          )
        })}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || !selected} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  )
}
