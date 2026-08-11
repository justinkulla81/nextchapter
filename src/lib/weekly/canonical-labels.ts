// Single source of truth for "what is this Search Action called right now,"
// independent of when it was completed. CommittedAction rows (see
// sprint.ts) persist whatever `text` was passed in at the moment an action
// was logged — a JSON snapshot, never rewritten. So a copy edit to a
// catalog label (here, task-menu.ts, or profile-checklist-types.ts) only
// ever changes what NOT-yet-done rows say; every already-completed row
// keeps showing its original wording forever unless something looks this
// map up live instead of trusting the stored text. See
// SuccessSprintCard.tsx's realActions mapping for the one place that does.
import { CANONICAL_TASK_MENU } from '@/lib/weekly/task-menu'
import { PROFILE_CHECKLIST_LABEL_BY_TYPE } from '@/lib/weekly/profile-checklist-types'

export const CANONICAL_ACTION_LABEL: Partial<Record<string, string>> = {
  ...Object.fromEntries(CANONICAL_TASK_MENU.map((t) => [t.actionType, t.text])),
  ...PROFILE_CHECKLIST_LABEL_BY_TYPE,
  // Recurring weekly check-ins with their own dedicated completion call
  // sites (dashboard/actions.ts) rather than a task-menu/checklist entry.
  MOOD_CHECKIN: "Check in on how you're feeling",
  VISIBILITY_COMFORT_CHECKIN: "Answer this week's visibility comfort check-in",
}
