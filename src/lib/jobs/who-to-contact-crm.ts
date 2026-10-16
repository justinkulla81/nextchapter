import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { contactStrength } from '@/lib/crm/contact-strength'
import { applyTemplate, learnPatterns } from '@/lib/crm/email-pattern'
import { isPersonalEmail } from '@/lib/workforce/college-score'

/**
 * The ONE place the member-facing "Who to contact" panel touches the CRM, listed with
 * its reason in src/test/company-wall.test.ts. What leaves this file is fixed by
 * MemberOrgSignal below and pinned by src/test/who-to-contact.test.ts:
 *
 *  - knownSomeone: a yes/no — NextChapter has a warm or hot relationship with someone
 *    currently at this employer. Never who, how many, their title, notes, emails or
 *    status. The member's only next step is "ask your coach for an intro", which
 *    reaches Justin, not the contact.
 *  - guessedEmail: for the posting's OWN named contact (public on the listing), built
 *    from the employer's email format learned from real CRM addresses at that domain
 *    (the daily digest's guessedEmail logic, src/lib/crm/email-pattern.ts). The format
 *    is an organisation fact; no CRM person's address is ever returned.
 *
 * Future: a "verified via Hunter" source would check guessedEmail here (Hunter's
 * email-verifier) before returning it. Not called — Hunter is metered and not yet
 * approved for member-facing use.
 */
export interface MemberOrgSignal {
  knownSomeone: boolean
  guessedEmail: string | null
}

export const MEMBER_ORG_SIGNAL_KEYS = ['knownSomeone', 'guessedEmail'] as const satisfies readonly (keyof MemberOrgSignal)[]

const PERSONAL_DOMAINS = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|msn|comcast)\./i
const domainOf = (email: string) => email.split('@')[1]?.toLowerCase().trim() ?? ''

/** Format examples needed at a domain before we guess from it. */
const MIN_FORMAT_EXAMPLES = 2

/** Reduces whatever was read to the member-safe shape; nothing else can pass. */
export function toMemberOrgSignal(raw: { knownSomeone?: unknown; guessedEmail?: unknown }): MemberOrgSignal {
  const email = typeof raw.guessedEmail === 'string' && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw.guessedEmail) ? raw.guessedEmail : null
  return { knownSomeone: raw.knownSomeone === true, guessedEmail: email && !PERSONAL_DOMAINS.test(domainOf(email)) ? email : null }
}

export async function loadMemberOrgSignal(input: {
  companyId: string | null
  companyName: string
  /** Only a real person's name (isPersonName) — a team name is never guessed for. */
  contactName: string | null
}): Promise<MemberOrgSignal> {
  const key = normalizeOrgName(input.companyName)
  const orgs = await prisma.crmOrganization.findMany({
    where: {
      OR: [...(input.companyId ? [{ companyId: input.companyId }] : []), ...(key ? [{ canonicalNameNormalized: key }] : [])],
    },
    select: {
      emailDomain: true,
      affiliations: {
        where: { isCurrent: true, person: { deletedAt: null, mergedIntoId: null } },
        select: {
          person: {
            select: {
              fullName: true, email: true, warmth: true, connectedAt: true, linkedinDegree: true,
              firstRepliedAt: true, lastTouchedAt: true, touchCount: true, notes: true,
            },
          },
        },
        take: 500,
      },
    },
    take: 5,
  })
  if (orgs.length === 0) return { knownSomeone: false, guessedEmail: null }

  const people = orgs.flatMap((o) => o.affiliations.map((a) => a.person))
  const knownSomeone = people.some((p) => {
    const s = contactStrength(p)
    return s === 'hot' || s === 'warm'
  })

  let guessedEmail: string | null = null
  if (input.contactName) {
    // The employer's domain: where most of its people's real addresses are, else the one kept on the org.
    const real = people.filter((p) => p.email && isPersonalEmail(p.email, p.fullName) && !PERSONAL_DOMAINS.test(domainOf(p.email)))
    const counts = new Map<string, number>()
    for (const p of real) counts.set(domainOf(p.email!), (counts.get(domainOf(p.email!)) ?? 0) + 1)
    const domain = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? orgs.find((o) => o.emailDomain)?.emailDomain ?? null
    if (domain) {
      const pattern = learnPatterns(real.filter((p) => domainOf(p.email!) === domain).map((p) => ({ name: p.fullName, email: p.email! }))).get(domain)
      if (pattern && pattern.examples >= MIN_FORMAT_EXAMPLES) guessedEmail = applyTemplate(pattern.template, input.contactName, domain)
    }
  }
  return toMemberOrgSignal({ knownSomeone, guessedEmail })
}
