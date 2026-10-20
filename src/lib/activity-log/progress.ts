import { DOSSIER_UNLOCK_APPLICATION_TARGET, DOSSIER_UNLOCK_OUTREACH_TARGET } from '@/lib/scoring/dossier-targets'

export type LogKind = 'applications' | 'outreach'

const NOUN: Record<LogKind, [string, string]> = {
  applications: ['application', 'applications'],
  outreach: ['outreach message', 'outreach messages'],
}

/**
 * The Candidate+ progress line shown right after a log: "2 of 5 applications — 3 to go".
 * Same targets the gate uses (dossier-targets.ts), so the line and the gate never disagree.
 */
export function candidatePlusProgressLine(kind: LogKind, count: number, unlocked: boolean): string {
  const target = kind === 'applications' ? DOSSIER_UNLOCK_APPLICATION_TARGET : DOSSIER_UNLOCK_OUTREACH_TARGET
  const [one, many] = NOUN[kind]
  if (unlocked) return `Candidate+ is on. ${count} ${count === 1 ? one : many} logged.`
  const left = Math.max(0, target - count)
  const shown = Math.min(count, target)
  if (left === 0) return `${shown} of ${target} ${many} — done for Candidate+.`
  return `${shown} of ${target} ${many} — ${left} to go for Candidate+.`
}
