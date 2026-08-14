import type { Mood } from '@prisma/client'

interface ActionPlanItem {
  text: string
  actionType?: string
}

type RawActionPlanItem = string | ActionPlanItem

export interface ActionDay {
  day: number
  items: RawActionPlanItem[]
}

function normalizeItem(item: RawActionPlanItem): ActionPlanItem {
  return typeof item === 'string' ? { text: item } : item
}

// Maps an action item's actionType tag to the Search Action engine it
// mainly moves — a hint, not a computed point value (that granularity isn't
// tracked per-item yet).
const ACTION_TYPE_ENGINE_HINT: Record<string, string> = {
  NETWORKING_LIST: 'Connecting Engine',
  LINKEDIN_SETUP: 'Working Engine',
  LINKEDIN_POST_IDEA: 'Working Engine',
  INTERVIEW_PREP: 'Learning Engine',
  NEGOTIATION_ADVICE: 'Learning Engine',
  PROFILE_CONFIRM: 'Effort Engine',
  INDUSTRY_CONFIRM: 'Effort Engine',
  FUNCTION_CONFIRM: 'Effort Engine',
  SALARY_CONFIRM: 'Effort Engine',
  WORK_AUTHORIZATION: 'Effort Engine',
}

export interface TodaysPrimaryAction {
  dayNumber: number
  text: string
  engineHint: string | null
}

// The existing 7-day action plan is generated fresh with the Market Reality
// Report — this cycles through it by elapsed days since that generation
// rather than tracking arbitrary per-item completion (which isn't modeled
// for free-text plan items today).
export function getTodaysPrimaryAction(
  actionPlan: ActionDay[],
  reportGeneratedAt: Date
): TodaysPrimaryAction | null {
  if (actionPlan.length === 0) return null

  const daysSince = Math.floor((Date.now() - reportGeneratedAt.getTime()) / (1000 * 60 * 60 * 24))
  const dayNumber = (daysSince % 7) + 1
  const day = actionPlan.find((d) => d.day === dayNumber) ?? actionPlan[daysSince % actionPlan.length]
  const rawItem = day.items[0]
  if (!rawItem) return null
  const item = normalizeItem(rawItem)

  return {
    dayNumber: day.day,
    text: item.text,
    engineHint: item.actionType ? (ACTION_TYPE_ENGINE_HINT[item.actionType] ?? null) : null,
  }
}

// Templated mood-based reframing — deliberately not an LLM call on every
// dashboard load. Stuck gets permission to do less; fired up gets an
// invitation to do more.
const MOOD_FRAME: Record<Mood, (text: string) => string> = {
  STUCK: (text) => `If today is hard, just do the first concrete step of this: ${text}`,
  GETTING_THERE: (text) => text,
  MOVING: (text) => text,
  FIRED_UP: (text) => `${text} — feeling strong? Get a head start on tomorrow's move too.`,
}

export function frameActionForMood(text: string, mood: Mood | null): string {
  if (!mood) return text
  return MOOD_FRAME[mood](text)
}
