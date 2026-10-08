import type { MailingMemberStatus } from '@prisma/client'

/**
 * The never-re-add rule, in one place.
 *
 * - An address that complained (marked list mail as spam) is never added to
 *   any list again. A hard bounce is treated the same way: that address is
 *   never mailed again.
 * - Someone marked "Do not email" on their CRM record is never added or
 *   mailed, until that's switched off.
 * - On a list where the address is UNSUBSCRIBED or COMPLAINED, it stays that
 *   way; only the person themselves can change it.
 * - Already ACTIVE: nothing to do.
 */
export type SuppressionReason = 'BOUNCED' | 'COMPLAINED' | 'DO_NOT_EMAIL'

export type AddVerdict =
  | { ok: true; action: 'create' | 'reactivate' }
  | { ok: false; reason: 'already_active' | 'unsubscribed' | 'complained' | 'bounced' | 'do_not_email' }

export function canAddToList(
  existingStatus: MailingMemberStatus | null,
  suppression: SuppressionReason | null,
): AddVerdict {
  if (suppression === 'DO_NOT_EMAIL') return { ok: false, reason: 'do_not_email' }
  if (suppression === 'COMPLAINED') return { ok: false, reason: 'complained' }
  if (suppression === 'BOUNCED') return { ok: false, reason: 'bounced' }
  if (existingStatus === 'ACTIVE') return { ok: false, reason: 'already_active' }
  if (existingStatus === 'UNSUBSCRIBED') return { ok: false, reason: 'unsubscribed' }
  if (existingStatus === 'COMPLAINED') return { ok: false, reason: 'complained' }
  if (existingStatus === 'BOUNCED') return { ok: false, reason: 'bounced' }
  return { ok: true, action: 'create' }
}

export const ADD_BLOCKED_MESSAGE: Record<Exclude<AddVerdict, { ok: true }>['reason'], string> = {
  already_active: 'already on this list',
  unsubscribed: 'unsubscribed from this list — only they can rejoin',
  complained: 'marked one of your emails as spam — never mailed again',
  bounced: 'address bounced — never mailed again',
  do_not_email: 'marked Do not email on their CRM record',
}

/** Lowercased, trimmed, or null when it isn't an address at all. */
export function normalizeListEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? '').trim().toLowerCase()
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e) ? e : null
}
