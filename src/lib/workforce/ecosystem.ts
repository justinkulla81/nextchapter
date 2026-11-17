// The ecosystem, pure parts: partner kinds, the claim status flow, what a partner can commit to, the email-domain check and the
// invitation text. No database and no email sending here: the steward copies the link or the message and sends it themselves.

export const ECO_KINDS = [
  { key: 'COLLEGE', label: 'College or university' },
  { key: 'EMPLOYER', label: 'Employer' },
  { key: 'PROVIDER', label: 'Training provider' },
  { key: 'COMMUNITY', label: 'Community group' },
  { key: 'OTHER', label: 'Other' },
] as const
export const ECO_KIND_KEYS: string[] = ECO_KINDS.map((k) => k.key)
export const ecoKindLabel = (k: string) => ECO_KINDS.find((x) => x.key === k)?.label ?? k

export const ECO_STATUSES = [
  { key: 'UNINVITED', label: 'Not invited' },
  { key: 'INVITED', label: 'Invited' },
  { key: 'CLAIMED', label: 'Asked to join' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'DECLINED', label: 'Declined' },
] as const
export const ecoStatusLabel = (k: string) => ECO_STATUSES.find((x) => x.key === k)?.label ?? k

/** What a partner can offer when it asks to join. */
export const COMMITMENTS = [
  { key: 'SEATS', label: 'Seats in programs or cohorts' },
  { key: 'MENTORS', label: 'Mentors or speakers' },
  { key: 'HIRING', label: 'Hiring local people first' },
  { key: 'OPENINGS', label: 'Sharing open jobs' },
  { key: 'MATCH', label: 'Funding or in-kind match' },
  { key: 'SPACE', label: 'Space or events' },
] as const
export const COMMITMENT_KEYS: string[] = COMMITMENTS.map((c) => c.key)
export const commitmentLabel = (k: string) => COMMITMENTS.find((c) => c.key === k)?.label ?? k
export const normalizeCommitments = (input: string[]) => COMMITMENT_KEYS.filter((k) => input.includes(k))

/** The status a partner can move to, and who moves it. Only the steward confirms or declines; an invitation link only ever asks. */
export function canInvite(status: string) {
  return status === 'UNINVITED' || status === 'INVITED' || status === 'DECLINED'
}
export function canClaim(status: string) {
  return status === 'INVITED' || status === 'CLAIMED'
}
export function canDecide(status: string) {
  return status === 'CLAIMED'
}

const host = (website: string | null | undefined): string | null => {
  if (!website) return null
  try {
    return new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}
const registrable = (h: string) => h.split('.').slice(-2).join('.')

/**
 * Does the claimer's email domain belong to the organization's website? null when we do not know the website. A match is a hint for
 * the steward, not proof: the steward decides.
 */
export function domainMatches(email: string, website: string | null | undefined): boolean | null {
  const h = host(website)
  if (!h) return null
  const d = email.split('@')[1]?.toLowerCase()
  if (!d) return false
  return d === h || d.endsWith(`.${h}`) || h.endsWith(`.${d}`) || registrable(d) === registrable(h)
}

/** The message the steward sends. They paste it into their own email or text; nothing is sent from here. */
export function inviteMessage(args: { partner: string; org: string; region: string | null; link: string; sender?: string }): string {
  const place = args.region ? ` for the ${args.region}` : ''
  return [
    `Hello,`,
    ``,
    `${args.org} is building a talent network${place}: employers, colleges and training providers working from one picture of the jobs and skills here. We would like ${args.partner} to be part of it.`,
    ``,
    `This page takes about two minutes. You tell us who you are and how you would like to take part (seats, mentors, hiring, openings, match). It does not publish anything and gives no one access to your systems:`,
    args.link,
    ``,
    `Thank you,`,
    args.sender ?? args.org,
  ].join('\n')
}

export const inviteUrl = (origin: string, slug: string, token: string) => `${origin}/i/${slug}/partner/${token}`

export const isPlausibleInviteToken = (t: string) => /^[A-Za-z0-9_-]{24,64}$/.test(t)
