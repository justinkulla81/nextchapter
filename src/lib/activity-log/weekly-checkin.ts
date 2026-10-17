import { signLink, verifyLink } from '@/lib/email/signed-links'
import type { LogKind } from '@/lib/activity-log/progress'

// The weekly check-in in Job Search Daily: "Applied or reached out anywhere this week?
// Tap: 0 · 1–2 · 3–5 · 6+", once for applications and once for outreach. Each tap is a
// signed link; the landing page logs the low end of the range (max 6) as self-reported
// entries keyed per week, so a second tap never double-logs. Links expire after 14 days.

export const CHECKIN_BUCKETS = ['0', '1-2', '3-5', '6+'] as const
export type CheckInBucket = (typeof CHECKIN_BUCKETS)[number]

export const CHECKIN_BUCKET_LABEL: Record<CheckInBucket, string> = { '0': '0', '1-2': '1–2', '3-5': '3–5', '6+': '6+' }
const BUCKET_LOW: Record<CheckInBucket, number> = { '0': 0, '1-2': 1, '3-5': 3, '6+': 6 }

export const CHECKIN_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000
const PURPOSE = 'weekly-checkin-v1'

export function isCheckInBucket(v: unknown): v is CheckInBucket {
  return typeof v === 'string' && (CHECKIN_BUCKETS as readonly string[]).includes(v)
}
export function isLogKind(v: unknown): v is LogKind {
  return v === 'applications' || v === 'outreach'
}

/** The low end of the range, never more than 6. */
export function bucketLow(bucket: CheckInBucket): number {
  return Math.min(6, BUCKET_LOW[bucket])
}

/** The week a check-in belongs to: its Monday (UTC), as YYYY-MM-DD. */
export function checkInWeekKey(weekMonday: Date): string {
  return weekMonday.toISOString().slice(0, 10)
}

/**
 * How many new entries a tap adds: the reported number less what is already on file for
 * that stretch (from Gmail, the board or an earlier prompt), so nothing counts twice.
 */
export function entriesToLog(reported: number, alreadyLogged: number): number {
  return Math.max(0, Math.min(6, reported) - Math.max(0, alreadyLogged))
}

/** One idempotency key per entry: n entries are always keys 1..n for that week and kind. */
export function selfReportKeys(weekKey: string, kind: LogKind, count: number): string[] {
  return Array.from({ length: Math.max(0, Math.min(6, count)) }, (_, i) => `weekly_checkin:${weekKey}:${kind}:${i + 1}`)
}

export interface CheckInPayload {
  candidateId: string
  kind: LogKind
  bucket: CheckInBucket
  weekKey: string
  issuedAt: number // ms
}

function subject(p: CheckInPayload): string[] {
  return [p.candidateId, p.kind, p.bucket, p.weekKey, String(p.issuedAt)]
}

export function checkInQuery(p: CheckInPayload): string {
  const q = new URLSearchParams({ c: p.candidateId, k: p.kind, b: p.bucket, w: p.weekKey, i: String(p.issuedAt), sig: signLink(PURPOSE, ...subject(p)) })
  return q.toString()
}

export function checkInUrl(appUrl: string, p: CheckInPayload): string {
  return `${appUrl}/checkin/weekly?${checkInQuery(p)}`
}

export type CheckInParse = { ok: true; payload: CheckInPayload } | { ok: false; reason: 'invalid' | 'expired' }

/** Reads and verifies a check-in link. Expired after 14 days, even with a good signature. */
export function readCheckIn(params: Record<string, string | undefined>, now: Date = new Date()): CheckInParse {
  const { c, k, b, w, i, sig } = params
  const issuedAt = Number(i)
  if (!c || !isLogKind(k) || !isCheckInBucket(b) || !w || !/^\d{4}-\d{2}-\d{2}$/.test(w) || !Number.isFinite(issuedAt)) return { ok: false, reason: 'invalid' }
  const payload: CheckInPayload = { candidateId: c, kind: k, bucket: b, weekKey: w, issuedAt }
  if (!verifyLink(sig, PURPOSE, ...subject(payload))) return { ok: false, reason: 'invalid' }
  if (now.getTime() - issuedAt > CHECKIN_LINK_TTL_MS || issuedAt - now.getTime() > 60 * 60 * 1000) return { ok: false, reason: 'expired' }
  return { ok: true, payload }
}
