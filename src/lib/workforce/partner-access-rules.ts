// Partner accounts, pure parts: who may be given access, and how many on the free plan. No database here.
// Owner defaults (2026-11-17): free means see, paid means act on people. A free organization gives access to up to three partner
// contacts in all; a paid one has no limit. Access is only for a CONFIRMED partner, to the email the steward names.

import { planOf } from '@/lib/plans/entitlements'

export const FREE_PARTNER_CONTACTS = 3

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const cleanEmail = (raw: string) => raw.trim().toLowerCase()
export const validEmail = (raw: string) => EMAIL.test(cleanEmail(raw))

/** Why access cannot be given, or null. Re-sending to a contact who already has a row never counts against the cap. */
export function accessBlocked(args: { plan: string | null | undefined; partnerStatus: string; email: string; contactsInOrg: number; alreadyContact: boolean }): string | null {
  if (!validEmail(args.email)) return 'Add the person’s work email.'
  if (args.partnerStatus !== 'CONFIRMED') return 'Confirm this partner first. Access is only for confirmed partners.'
  if (!args.alreadyContact && planOf(args.plan) === 'FREE' && args.contactsInOrg >= FREE_PARTNER_CONTACTS) {
    return `A free workspace gives access to ${FREE_PARTNER_CONTACTS} partner contacts. Remove one, or ask NextChapter about the paid plan.`
  }
  return null
}

export const partnerAccessPath = (slug: string, token: string) => `/i/${slug}/partner-account/${token}`

/** The invite is for one email: the person who opens it must sign in with that address. */
export const emailMatches = (invited: string, signedIn: string | null | undefined) => !!signedIn && cleanEmail(invited) === cleanEmail(signedIn)
