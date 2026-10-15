// "Are you already doing consulting, expert-network, fractional or part-time
// work — now or before?" The candidate's own answer is the source of truth;
// email and logged work history only pre-fill it so they confirm rather than
// start from blank. Pure (no DB, no I/O) so the inference is unit-tested.

import type { EngagementType } from '@prisma/client'
import type { PlatformCategory } from '@/lib/platforms/directory'
import type { PlatformStageKey } from '@/lib/platforms/stages'

export const INDEPENDENT_WORK_TYPES = [
  { key: 'consulting', label: 'Consulting or freelance projects' },
  { key: 'expert_network', label: 'Expert network calls and research' },
  { key: 'fractional', label: 'Fractional or interim roles' },
  { key: 'part_time', label: 'Part-time work' },
] as const

export type IndependentWorkType = (typeof INDEPENDENT_WORK_TYPES)[number]['key']

export const INDEPENDENT_WORK_STATUS_OPTIONS = [
  { value: 'now', label: 'Doing it now' },
  { value: 'past', label: "I've done it" },
  { value: 'never', label: 'Not yet' },
] as const

export type IndependentWorkStatus = (typeof INDEPENDENT_WORK_STATUS_OPTIONS)[number]['value']

export type IndependentWorkExperience = Partial<Record<IndependentWorkType, IndependentWorkStatus>>

export interface IndependentWorkSuggestion {
  status: Exclude<IndependentWorkStatus, 'never'>
  // What we saw, in plain words — "GLG, Upwork" or "a logged consulting role".
  evidence: string[]
}

export type IndependentWorkSuggestions = Partial<Record<IndependentWorkType, IndependentWorkSuggestion>>

const DAY = 24 * 60 * 60 * 1000
// A platform that last showed work this recently counts as "doing it now".
const ACTIVE_WITHIN_DAYS = 60

const CATEGORY_TO_TYPE: Partial<Record<PlatformCategory, IndependentWorkType>> = {
  FREELANCE: 'consulting',
  EXPERT_NETWORK: 'expert_network',
  AI_TRAINING: 'expert_network',
  FRACTIONAL: 'fractional',
  RETURN_TO_WORK: 'part_time',
}

const ENGAGEMENT_TO_TYPE: Partial<Record<EngagementType, IndependentWorkType>> = {
  CONSULTING: 'consulting',
  FRACTIONAL: 'fractional',
  INTERIM: 'fractional',
}

// Only a platform's own "working" or "earning" email proves they did the work;
// signing up or being accepted doesn't.
const PROVES_WORK: ReadonlySet<PlatformStageKey> = new Set(['WORKING', 'EARNING'])

export interface PlatformEvidence {
  name: string
  category: PlatformCategory
  stage: PlatformStageKey
  lastProgressAt: Date | null
  dismissed: boolean
}

export interface WorkHistoryEvidence {
  engagementType: EngagementType
  isCurrent: boolean
  companyName: string
}

export function suggestIndependentWork(
  platforms: PlatformEvidence[],
  workHistory: WorkHistoryEvidence[],
  now: Date = new Date()
): IndependentWorkSuggestions {
  const out: IndependentWorkSuggestions = {}

  function note(type: IndependentWorkType, status: 'now' | 'past', evidence: string) {
    const existing = out[type]
    if (!existing) {
      out[type] = { status, evidence: [evidence] }
      return
    }
    // "now" wins over "past" when signals disagree.
    if (status === 'now') existing.status = 'now'
    if (!existing.evidence.includes(evidence)) existing.evidence.push(evidence)
  }

  for (const p of platforms) {
    const type = CATEGORY_TO_TYPE[p.category]
    if (!type || p.dismissed || !PROVES_WORK.has(p.stage)) continue
    const recent = p.lastProgressAt && now.getTime() - p.lastProgressAt.getTime() <= ACTIVE_WITHIN_DAYS * DAY
    note(type, recent ? 'now' : 'past', p.name)
  }

  for (const w of workHistory) {
    const type = ENGAGEMENT_TO_TYPE[w.engagementType]
    if (!type) continue
    note(type, w.isCurrent ? 'now' : 'past', w.companyName)
  }

  return out
}

export function parseIndependentWorkExperience(raw: unknown): IndependentWorkExperience {
  const out: IndependentWorkExperience = {}
  if (!raw || typeof raw !== 'object') return out
  const record = raw as Record<string, unknown>
  for (const { key } of INDEPENDENT_WORK_TYPES) {
    const v = record[key]
    if (v === 'now' || v === 'past' || v === 'never') out[key] = v
  }
  return out
}

export function isIndependentWorkAnswered(answers: IndependentWorkExperience): boolean {
  return INDEPENDENT_WORK_TYPES.every(({ key }) => answers[key] !== undefined)
}

// Keeps the older single yes/no (read by the checklist and sprint scoring)
// in step with the richer answer.
export function hasAnyIndependentWork(answers: IndependentWorkExperience): boolean {
  return INDEPENDENT_WORK_TYPES.some(({ key }) => answers[key] === 'now' || answers[key] === 'past')
}
