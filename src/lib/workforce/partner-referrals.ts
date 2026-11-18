// Workforce Hub referrals, pure parts: a referral to a partner is about a need, not a named person. Who may send one, how a group's size
// is shown without pointing at anyone, and what the partner answers. No database here.

import { MIN_GROUP } from './skills-intel'

export const REFERRAL_STATUSES = [
  { key: 'SENT', label: 'Sent' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'DONE', label: 'Done' },
  { key: 'WITHDRAWN', label: 'Withdrawn' },
] as const
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number]['key']
export const referralStatusLabel = (k: string) => REFERRAL_STATUSES.find((s) => s.key === k)?.label ?? k

/** What each side may do next. The sender closes or withdraws; the partner answers once, while it is still SENT. */
export const canAnswer = (status: string) => status === 'SENT'
export const canWithdraw = (status: string) => status === 'SENT' || status === 'ACCEPTED'
export const canFinish = (status: string) => status === 'ACCEPTED'

export function canSendReferral(limit: number | null, existing: number): { allowed: boolean; message: string | null } {
  if (limit === null || existing < limit) return { allowed: true, message: null }
  return { allowed: false, message: `The free plan sends up to ${limit} referrals. Start your free trial, or ask us to switch on the paid plan, to send more.` }
}

/** A group's size for a referral: rounded to the nearest five, and nothing at all under five, so it never points at a person. */
export function roundedPeople(n: number | null): number | null {
  if (n === null || n < MIN_GROUP) return null
  return Math.round(n / 5) * 5
}

export type ReferralInput = { partnerId: string; title: string; message: string | null; cohortId: string | null; offeringId: string | null; dueDate: Date | null }

export function validateReferral(f: { get: (k: string) => string | null }, now: Date = new Date()): { error: string } | { value: ReferralInput } {
  const s = (k: string, max: number) => (f.get(k) ?? '').trim().slice(0, max)
  const partnerId = s('partnerId', 40)
  if (!partnerId) return { error: 'Choose the partner this is for.' }
  const title = s('title', 160)
  if (!title) return { error: 'Say what you are asking, such as “Take 40 operations managers into the Lean Six Sigma cohort”.' }
  const dueRaw = s('dueDate', 10)
  let dueDate: Date | null = null
  if (dueRaw) {
    dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? new Date(`${dueRaw}T00:00:00Z`) : null
    if (!dueDate || Number.isNaN(dueDate.getTime())) return { error: 'The date must look like 2026-12-15.' }
    if (dueDate.getTime() < now.getTime() - 86_400_000) return { error: 'The date has already passed. Pick a date from today on.' }
  }
  return { value: { partnerId, title, message: s('message', 1200) || null, cohortId: s('cohortId', 40) || null, offeringId: s('offeringId', 40) || null, dueDate } }
}

/** The partner's answer: accept or decline, with a note. A decline needs a reason so the sender can try someone else. */
export function validateAnswer(f: { get: (k: string) => string | null }): { error: string } | { value: { status: 'ACCEPTED' | 'DECLINED'; note: string | null } } {
  const decision = (f.get('decision') ?? '').trim()
  const note = (f.get('note') ?? '').trim().slice(0, 600)
  if (decision !== 'ACCEPTED' && decision !== 'DECLINED') return { error: 'Choose accept or decline.' }
  if (decision === 'DECLINED' && !note) return { error: 'Say why you cannot take this, so they can ask someone else.' }
  return { value: { status: decision, note: note || null } }
}

/** The message the sender can copy or open as an email; NextChapter sends nothing. */
export function referralText(args: { from: string; partner: string; title: string; people: number | null; cohort: string | null; offering: string | null; due: string | null; message: string | null }): string {
  const about = [args.people ? `about ${args.people} people` : null, args.cohort ? `in our ${args.cohort} group` : null, args.offering ? `for ${args.offering}` : null].filter(Boolean).join(', ')
  return `Hello ${args.partner},\n\n${args.from} would like to refer a need to you: ${args.title}${about ? ` (${about})` : ''}${args.due ? `, by ${args.due}` : ''}.${args.message ? `\n\n${args.message}` : ''}\n\nYou can accept or decline in your Partner Hub. No one is named in the referral.\n\nThank you.`
}
