import { createHmac, timingSafeEqual } from 'node:crypto'

// HMAC-signed action links for emails: unsubscribe and the interim-role
// check-in. Before this, the only credential in these links was a database id
// (/api/unsubscribe/<candidateId>), so anyone who learned an id — from a
// forwarded email, a log, an analytics URL — could opt that person out or end
// their current job entry. The signature binds the link to its purpose and
// subject; there is no table, the signature is the proof.
//
// Unsigned links already sitting in inboxes keep working until the cutoffs
// below (see the routes), because refusing a real unsubscribe is worse than
// the nuisance the signature prevents.

function secret(): string {
  const s = process.env.LINK_SIGNING_SECRET || process.env.MAILING_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET
  if (!s) throw new Error('LINK_SIGNING_SECRET (or MAILING_UNSUBSCRIBE_SECRET / CRON_SECRET) must be set to sign email links')
  return s
}

function mac(parts: string[], key: string): string {
  return createHmac('sha256', key).update(parts.join('\u0000')).digest('base64url').slice(0, 27)
}

export function signLink(purpose: string, ...subject: string[]): string {
  return mac([purpose, ...subject], secret())
}

export function verifyLink(sig: string | null | undefined, purpose: string, ...subject: string[]): boolean {
  if (!sig) return false
  let expected: Buffer
  try {
    expected = Buffer.from(mac([purpose, ...subject], secret()))
  } catch {
    return false
  }
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** Opt-out of one candidate email stream (type: daily, weekly, jobSearchDaily, …). */
export function candidateUnsubscribeUrl(appUrl: string, candidateId: string, type?: string): string {
  const sig = signLink('unsub-candidate', candidateId, type ?? '')
  const q = new URLSearchParams()
  if (type) q.set('type', type)
  q.set('sig', sig)
  return `${appUrl}/api/unsubscribe/${candidateId}?${q.toString()}`
}

/** Opt-out of the market digest (or candidate alerts) for coach/recruiter/employer/candidate. */
export function audienceUnsubscribeUrl(appUrl: string, audience: string, id: string, type?: string): string {
  const sig = signLink('unsub-audience', audience, id)
  const q = new URLSearchParams()
  if (type) q.set('type', type)
  q.set('sig', sig)
  return `${appUrl}/api/unsubscribe/audience/${audience}/${id}?${q.toString()}`
}

export function interimCheckInUrl(appUrl: string, entryId: string, response: 'active' | 'ended'): string {
  const sig = signLink('interim-check-in', entryId, response)
  return `${appUrl}/api/interim-check-in/${entryId}?response=${response}&sig=${sig}`
}
