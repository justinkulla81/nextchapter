// The AI / Non-AI / All choice members make on the job board, the skills gap and the Learning
// page's skills section. A job "asks for AI" when the crawler found at least one of the 24 AI
// skill items in its full text (ExclusiveJobPosting.aiSkillGroups non-empty; src/lib/skills/
// ai-skills.ts). A skill is an AI skill when it is one of those 24 items. Pure, client-safe.

import { aiSkillIdForLabel } from '@/lib/skills/ai-skills'

export type AiView = 'all' | 'ai' | 'other'

/** Button order: AI, Non-AI, All (All is the default). */
export const AI_VIEWS: AiView[] = ['ai', 'other', 'all']

/** Labels for jobs (the board). */
export const AI_VIEW_JOB_LABEL: Record<AiView, string> = { ai: 'AI', other: 'Non-AI', all: 'All' }
/** Labels for skills (skills gap, Learning). */
export const AI_VIEW_SKILL_LABEL: Record<AiView, string> = { ai: 'AI skills', other: 'Other skills', all: 'All' }

export const AI_VIEW_JOB_HINT: Record<AiView, string> = {
  ai: 'Jobs that ask for a specific AI skill',
  other: 'Jobs that ask for no specific AI skill',
  all: 'Every job',
}

/** The `ai` URL parameter: 'ai' or 'other'; anything else is All. */
export function parseAiView(v: string | string[] | null | undefined): AiView {
  const s = Array.isArray(v) ? v[0] : v
  return s === 'ai' || s === 'other' ? s : 'all'
}

/** Does a job with these AI skill groups belong in the view? */
export function jobInAiView(view: AiView, aiSkillGroups: readonly string[] | null | undefined): boolean {
  if (view === 'all') return true
  const isAi = (aiSkillGroups?.length ?? 0) > 0
  return view === 'ai' ? isAi : !isAi
}

/** Is this skill label one of the 24 AI skill items? */
export function isAiSkillLabel(label: string): boolean {
  return aiSkillIdForLabel(label) !== null
}

/** Does a skill belong in the view? */
export function skillInAiView(view: AiView, label: string): boolean {
  if (view === 'all') return true
  return isAiSkillLabel(label) === (view === 'ai')
}
