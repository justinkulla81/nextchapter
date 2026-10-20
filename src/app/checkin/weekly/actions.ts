'use server'

import { captureServerEvent } from '@/lib/posthog/server'
import { readCheckIn } from '@/lib/activity-log/weekly-checkin'
import { candidatePlusProgress, logWeeklyCheckIn } from '@/lib/activity-log/log'

export type WeeklyCheckInResult =
  | { ok: true; kind: 'applications' | 'outreach'; reported: number; alreadyLogged: number; added: number; progress: string; unlocked: boolean }
  | { ok: false; reason: 'invalid' | 'expired' | 'error' }

/**
 * Logs one weekly check-in tap. The signed link is the credential (no sign-in needed);
 * the page calls this from the browser, so a mail scanner that only fetches the link
 * logs nothing. Idempotent per week: entries are keyed weekly_checkin:<week>:<kind>:<n>.
 */
export async function recordWeeklyCheckIn(params: Record<string, string | undefined>): Promise<WeeklyCheckInResult> {
  const parsed = readCheckIn(params)
  if (!parsed.ok) return { ok: false, reason: parsed.reason }
  const p = parsed.payload
  try {
    const r = await logWeeklyCheckIn(p)
    const progress = await candidatePlusProgress(p.candidateId, p.kind)
    captureServerEvent(p.candidateId, 'weekly_checkin_logged', { kind: p.kind, bucket: p.bucket, added: r.added, alreadyLogged: r.alreadyLogged, weekKey: p.weekKey })
    return { ok: true, kind: p.kind, ...r, progress: progress.line, unlocked: progress.unlocked }
  } catch (error) {
    console.error('Weekly check-in failed:', error)
    return { ok: false, reason: 'error' }
  }
}
