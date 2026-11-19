import { makeUnsubscribeToken, readUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'

// The "Open my account" link in a follow-up email (owner decision 2026-11-18: an account before onboarding). The link signs
// someone in, so unlike an unsubscribe link it must expire: the token is the signed address plus an "acct:<issued>" stamp in
// the token's second field, and it is good for 30 days. An unsubscribe or lead-cookie token (no stamp, or a newsletter
// edition id) is never accepted here.

const PREFIX = 'acct:'
export const ACCOUNT_LINK_DAYS = 30
const DAY_MS = 86_400_000

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'

export function makeAccountToken(email: string, now = Date.now(), key?: string): string {
  return makeUnsubscribeToken(email, `${PREFIX}${Math.floor(now / DAY_MS)}`, key)
}

/** The address an account token was issued to, or null when it is not one, was tampered with, or is older than 30 days. */
export function readAccountToken(token: string | null | undefined, now = Date.now(), key?: string): string | null {
  if (!token) return null
  let read: ReturnType<typeof readUnsubscribeToken> = null
  try {
    read = readUnsubscribeToken(token, key)
  } catch {
    return null
  }
  if (!read?.editionId?.startsWith(PREFIX)) return null
  const issuedDay = Number(read.editionId.slice(PREFIX.length))
  if (!Number.isInteger(issuedDay)) return null
  const age = Math.floor(now / DAY_MS) - issuedDay
  return age >= 0 && age <= ACCOUNT_LINK_DAYS ? read.email : null
}

/** The page the email's "Open my account" button opens (on the candidate host; /onboarding moves there). */
export function accountLink(email: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams({ t: makeAccountToken(email), ...params })
  return `${appUrl()}/onboarding/account-ready?${q}`
}
