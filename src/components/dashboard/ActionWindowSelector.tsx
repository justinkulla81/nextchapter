import type { ActionWindow } from '@prisma/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { setActionWindow } from '@/app/dashboard/actions'

const ACTION_WINDOW_LABEL: Record<ActionWindow, string> = {
  MORNING: 'Plan and act in the morning',
  NIGHT_PLAN_MORNING_ACT: 'Plan at night, act in the morning',
  MIDDAY: 'Midday',
  EVENING: 'Evening',
  VARIABLE: 'It varies for me',
}

const ACTION_WINDOW_ORDER: ActionWindow[] = [
  'MORNING',
  'NIGHT_PLAN_MORNING_ACT',
  'MIDDAY',
  'EVENING',
  'VARIABLE',
]

export function ActionWindowSelector({ current }: { current: ActionWindow }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">When are you most ready to take action?</p>
      <p className="text-sm text-muted-foreground">
        Vic&apos;s daily action email arrives in this window.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {ACTION_WINDOW_ORDER.map((window) => (
          <form key={window} action={setActionWindow.bind(null, window)}>
            <SubmitButton variant={current === window ? 'default' : 'outline'} size="sm">
              {ACTION_WINDOW_LABEL[window]}
            </SubmitButton>
          </form>
        ))}
      </div>
    </div>
  )
}
