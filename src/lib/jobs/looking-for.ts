import { WORK_TYPES, type WorkType } from '@/lib/jobs/work-type'

/**
 * The one question the Jobs view asks first (owner, 2026-11-17): full-time, fractional and independent work, or both.
 * It stands for the board's kinds of work (work-type.ts): fractional is part-time, contract and advisory together.
 */
export type LookingFor = 'full_time' | 'fractional' | 'both'

export const LOOKING_FOR: readonly LookingFor[] = ['full_time', 'fractional', 'both']

export const LOOKING_FOR_LABEL: Record<LookingFor, string> = {
  full_time: 'Full-time',
  fractional: 'Fractional & independent',
  both: 'Both',
}

const FRACTIONAL: readonly WorkType[] = ['part_time', 'contract', 'advisory']

/** The kinds of work a choice shows, in board order. */
export function workTypesFor(choice: LookingFor): WorkType[] {
  if (choice === 'full_time') return ['full_time']
  if (choice === 'fractional') return WORK_TYPES.filter((t) => FRACTIONAL.includes(t))
  return [...WORK_TYPES]
}

/** The choice a set of kinds of work amounts to. */
export function lookingForOf(types: readonly WorkType[]): LookingFor {
  const full = types.includes('full_time')
  const fractional = types.some((t) => FRACTIONAL.includes(t))
  if (full && fractional) return 'both'
  return fractional ? 'fractional' : 'full_time'
}

/** True when the choice includes fractional and independent work. */
export const showsFractional = (types: readonly WorkType[]) => lookingForOf(types) !== 'full_time'
