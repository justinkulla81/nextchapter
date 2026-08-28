import type { OutreachChannel } from '@prisma/client'

// A meeting or email a candidate logs themselves in OutreachLog can also get
// auto-detected and land in Networking Stats' own tiles — with nothing
// reconciling the two, the same real touchpoint could silently count twice
// across the Network page's two outreach numbers. This resolves each
// self-logged row against the auto-detected touchpoint contacts already
// computed for Networking Stats: a same-contact hit within MATCH_WINDOW_DAYS
// means it's already represented there, so it's dropped rather than
// re-added; anything left over (no contact link, an unresolvable email, or
// genuinely nothing auto-detected — a phone call, a LinkedIn message, no
// Gmail connected) is a real touchpoint Networking Stats has no way to see.
const MATCH_WINDOW_MS = 24 * 60 * 60 * 1000

export interface TouchpointContact {
  email: string // already lowercased
  date: Date
}

export interface SelfLoggedOutreach {
  id: string
  loggedAt: Date
  channel: OutreachChannel
  contact: { name: string | null; email: string | null; emails: string[] } | null
}

export interface UnmatchedSelfLoggedOutreach {
  id: string
  channel: OutreachChannel
  loggedAt: Date
  contactName: string | null
}

export interface SelfLoggedOutreachResolution {
  unmatched: UnmatchedSelfLoggedOutreach[]
  matchedCount: number
}

export function resolveSelfLoggedOutreach(
  outreachLogs: SelfLoggedOutreach[],
  touchpointContacts: TouchpointContact[]
): SelfLoggedOutreachResolution {
  const unmatched: UnmatchedSelfLoggedOutreach[] = []
  let matchedCount = 0

  for (const log of outreachLogs) {
    // Checks both the contact's primary email AND its up-to-3 alternate
    // emails — same OR pattern as upsertContactFromSignal, since a
    // touchpoint's real address may not be whichever one is "primary."
    const contactEmails = log.contact
      ? [log.contact.email, ...log.contact.emails].filter((e): e is string => !!e).map((e) => e.toLowerCase())
      : []

    const hasMatch =
      contactEmails.length > 0 &&
      touchpointContacts.some(
        (t) => contactEmails.includes(t.email) && Math.abs(t.date.getTime() - log.loggedAt.getTime()) <= MATCH_WINDOW_MS
      )

    if (hasMatch) {
      matchedCount++
    } else {
      unmatched.push({
        id: log.id,
        channel: log.channel,
        loggedAt: log.loggedAt,
        contactName: log.contact?.name ?? null,
      })
    }
  }

  return { unmatched, matchedCount }
}
