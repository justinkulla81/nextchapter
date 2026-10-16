// One unlock ladder for the whole product. It does not add rules: it reads the
// states the existing gates already compute (module gates, dossier ladder
// tier, Candidate+ status) and presents them as five rungs in one order, so
// Home, Progress and every locked page say the same thing.

import {
  DOSSIER_UNLOCK_APPLICATION_TARGET,
  DOSSIER_UNLOCK_OUTREACH_TARGET,
  DOSSIER_UNLOCK_REFERENCE_TARGET,
} from '@/lib/scoring/dossier-targets'
import type { DossierCompleteness, DossierLadderTier, DossierUnlockStatus, ModuleGateStatus } from '@/lib/scoring/dossier-unlock'

export type RungKey = 'jobDetail' | 'taking_shape' | 'candidatePlus' | 'recruiterIntros' | 'unposted'
export type RungState = 'open' | 'next' | 'locked'

export interface Rung {
  key: RungKey
  label: string
  state: RungState
  // What opens, in plain words, lowercase so it reads inside a sentence.
  opens: string[]
  // What is still missing, plain words. Empty when open.
  needs: string[]
}

export interface LadderInput {
  gates: ModuleGateStatus[]
  tier: DossierLadderTier
  completeness: DossierCompleteness
  status: DossierUnlockStatus
}

const TIER_ORDER: DossierLadderTier[] = ['LOCKED', 'PREVIEW', 'COMPLETE', 'RECRUITER_INTROS', 'UNPOSTED_ROLES']
const atLeast = (tier: DossierLadderTier, min: DossierLadderTier) => TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min)

function plural(n: number, one: string, many: string) {
  return `${n} more ${n === 1 ? one : many}`
}

export type CandidatePlusStepKey = 'minutes' | 'references' | 'assessment' | 'outreach' | 'applications'

/**
 * What is still missing for Candidate+, one step per gate, in the ladder's order, with
 * where to do it. The ladder's Candidate+ "needs" are these steps' `need` text.
 */
export function candidatePlusSteps(status: DossierUnlockStatus): { key: CandidatePlusStepKey; need: string; href: string; action: string }[] {
  if (status.unlocked) return []
  const steps: { key: CandidatePlusStepKey; need: string; href: string; action: string }[] = []
  if (!status.minutesMet) {
    steps.push({ key: 'minutes', need: `${plural(Math.max(0, status.effortTarget - status.effortMinutes), 'minute', 'minutes')} of search effort`, href: '/dashboard/sprint', action: "Open this week's plan" })
  }
  if (!status.referencesMet) {
    steps.push({ key: 'references', need: plural(Math.max(0, DOSSIER_UNLOCK_REFERENCE_TARGET - status.completedReferenceCount), 'reference', 'references'), href: '/dashboard/references', action: 'Request a reference' })
  }
  if (!status.evidenceMet) steps.push({ key: 'assessment', need: 'one assessment', href: '/dashboard/skills-assessments', action: 'Take an assessment' })
  if (!status.effortMet) {
    const m = Math.max(0, DOSSIER_UNLOCK_OUTREACH_TARGET - status.outreachCount)
    const a = Math.max(0, DOSSIER_UNLOCK_APPLICATION_TARGET - status.applicationCount)
    if (m) steps.push({ key: 'outreach', need: plural(m, 'message', 'messages'), href: '/dashboard/network', action: 'Send an outreach message' })
    if (a) steps.push({ key: 'applications', need: plural(a, 'application', 'applications'), href: '/dashboard/find-my-job', action: 'Find a job to apply to' })
  }
  return steps
}

export function buildUnlockLadder({ gates, tier, completeness, status }: LadderInput): Rung[] {
  const gate = (key: string) => gates.find((g) => g.key === key)

  const jobDetailOpen = gate('matchedJobsFullDetail')?.unlocked === true && gate('community')?.unlocked === true
  const shapeOpen = atLeast(tier, 'PREVIEW')
  const plusOpen = status.unlocked
  const introsOpen = atLeast(tier, 'RECRUITER_INTROS')
  const unpostedOpen = tier === 'UNPOSTED_ROLES'

  const plusNeeds = candidatePlusSteps(status).map((s) => s.need)

  const introNeeds = completeness.requirements.filter((r) => !r.met).map((r) => {
    if (r.key === 'profile') return `${r.target - r.current} more profile sections`
    return r.label.toLowerCase()
  })

  const raw: Array<Omit<Rung, 'state'> & { open: boolean }> = [
    {
      key: 'jobDetail',
      label: 'Full job detail and Community',
      open: jobDetailOpen,
      opens: ['matched jobs in full detail', 'Community'],
      needs: [
        ...(gate('matchedJobsFullDetail')?.unlocked ? [] : ['one reference request sent']),
        ...(gate('community')?.unlocked ? [] : ['one thing finished in your plan']),
      ],
    },
    {
      key: 'taking_shape',
      label: 'Dossier taking shape',
      open: shapeOpen,
      opens: ['a dossier you can share by link, marked still building'],
      needs: [
        ...(status.completedReferenceCount >= 2 ? [] : [plural(2 - status.completedReferenceCount, 'reference', 'references')]),
        ...(status.evidenceMet ? [] : ['one assessment']),
      ],
    },
    {
      key: 'candidatePlus',
      label: 'Candidate+',
      open: plusOpen,
      opens: ['your dossier marked complete', 'who to contact, the apply kit and explain-my-gaps on every job', 'a Candidate+ mark that recruiters and hiring managers can see', 'unlimited access to the recruiter network'],
      needs: plusNeeds,
    },
    {
      key: 'recruiterIntros',
      label: 'Recruiter introductions',
      open: introsOpen,
      opens: ['we send your dossier to recruiters with a fitting role'],
      needs: introNeeds,
    },
    {
      key: 'unposted',
      label: 'Unposted roles',
      open: unpostedOpen,
      opens: ['roles that are not advertised'],
      needs: introsOpen ? ['activity in the last two weeks'] : introNeeds,
    },
  ]

  // The first rung that is not open is "next"; every later one is locked.
  let nextSeen = false
  return raw.map(({ open, ...r }) => {
    if (open) return { ...r, needs: [], state: 'open' as const }
    if (!nextSeen) {
      nextSeen = true
      return { ...r, state: 'next' as const }
    }
    return { ...r, state: 'locked' as const }
  })
}

export function nextRung(ladder: Rung[]): Rung | null {
  return ladder.find((r) => r.state === 'next') ?? null
}
