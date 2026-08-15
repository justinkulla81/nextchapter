'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Shield, DoorOpen, Briefcase, RefreshCw, type LucideIcon } from 'lucide-react'
import { updateSituation } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { SITUATION_SESSION_KEY, type SituationKey } from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'

// Same 4 personas as the homepage's SituationalButtons / /start pages — kept
// in sync manually since the marketing copy (icon + description) differs
// slightly from what reads well inside the assessment.
const SITUATIONS: { situation: SituationKey; icon: LucideIcon; label: string; description: string }[] = [
  {
    situation: 'worried_let_go',
    icon: Shield,
    label: "I'm worried I'll be let go",
    description: 'Get ready and start building proof before you need it.',
  },
  {
    situation: 'just_resigned',
    icon: DoorOpen,
    label: 'I just resigned',
    description: 'Land on your feet — get your baseline grade now.',
  },
  {
    situation: 'just_laid_off',
    icon: Briefcase,
    label: 'I was laid off',
    description: 'Start your search with a plan, not a guessing game.',
  },
  {
    situation: 'reentering_workforce',
    icon: RefreshCw,
    label: "I'm re-entering the workforce",
    description: 'Close the gap with proof, not explanations.',
  },
]

export function SituationForm({ initialSituation = null }: { initialSituation?: SituationKey | null }) {
  const [state, formAction, pending] = useActionState(updateSituation, undefined)
  const [selected, setSelected] = useState<SituationKey | null>(initialSituation)
  const [checking, setChecking] = useState(true)
  const [, startTransition] = useTransition()
  const autoSubmitted = useRef(false)

  // A homepage/marketing persona click already answered this — skip the
  // step entirely rather than asking again.
  useEffect(() => {
    const stored = sessionStorage.getItem(SITUATION_SESSION_KEY) as SituationKey | null
    sessionStorage.removeItem(SITUATION_SESSION_KEY)
    if (stored && SITUATIONS.some((s) => s.situation === stored) && !autoSubmitted.current) {
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
