import { WEEKLY_ENGINE_LABEL } from '@/lib/scoring/grade'
import type { WeeklyEngine } from '@/lib/scoring/grade'

// Shared between SuccessSprintCard and UnlockAListCallout — both need to
// show which of the four weekly engines still need real work.
export function WeeklyEngineChecklist({
  engines,
  laggingEngines,
}: {
  engines: WeeklyEngine[]
  laggingEngines: WeeklyEngine['key'][]
}) {
  return (
    <ul className="space-y-1.5 text-sm">
      {engines.map((e) => (
        <li key={e.key} className="flex items-center gap-2">
          <span>{laggingEngines.includes(e.key) ? '☐' : '☑'}</span>
          <span className="text-foreground">{WEEKLY_ENGINE_LABEL[e.key]}</span>
          {laggingEngines.includes(e.key) && (
            <span className="text-xs text-muted-foreground">needs real work this week</span>
          )}
        </li>
      ))}
    </ul>
  )
}
