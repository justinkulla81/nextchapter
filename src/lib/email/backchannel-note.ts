export interface BackchannelContact {
  name: string
  title: string | null
  email: string | null
  warmth: 'HOT' | 'WARM' | 'COLD'
  employmentStatusAtCompany: 'CURRENT' | 'FORMER' | null
  relationshipTags?: string[]
}

const WARMTH_RANK = { HOT: 0, WARM: 1, COLD: 2 } as const

const TITLE_STOPWORDS = new Set(['senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff', 'associate', 'the', 'and', 'for', 'of', 'at', 'in'])

function titleWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w))
  )
}

// How useful this person is likely to be for this particular role: someone you
// tagged as the hiring manager or a recruiter, a recruiting/talent title, or a
// title that shares words with the role (a "Director of Product" for a product
// role). Higher is better; 0 means nothing points to them in particular.
export function titleApplicability(contact: Pick<BackchannelContact, 'title' | 'relationshipTags'>, role: string | null): number {
  const tags = contact.relationshipTags ?? []
  let base = 0
  if (tags.includes('HIRING_MANAGER')) base = 3
  else if (tags.includes('RECRUITER') || (contact.title && /recruit|talent|hiring/i.test(contact.title))) base = 2
  let overlap = 0
  if (role && contact.title) {
    const roleWords = titleWords(role)
    for (const w of titleWords(contact.title)) if (roleWords.has(w)) overlap += 1
  }
  return base + Math.min(overlap, 2)
}

// Drops contacts the candidate has confirmed no longer work there (telling
// someone "you know a person at X" about a person who left is a false claim),
// then orders the rest: has an email first (you can act on it right now), then
// warmest, then most applicable to this role, then confirmed-current.
export function rankBackchannelContacts<T extends BackchannelContact>(contacts: T[], role: string | null = null): T[] {
  return contacts
    .filter((c) => c.employmentStatusAtCompany !== 'FORMER')
    .sort((a, b) => {
      const reachable = Number(Boolean(b.email)) - Number(Boolean(a.email))
      if (reachable !== 0) return reachable
      const warmth = WARMTH_RANK[a.warmth] - WARMTH_RANK[b.warmth]
      if (warmth !== 0) return warmth
      const applicable = titleApplicability(b, role) - titleApplicability(a, role)
      if (applicable !== 0) return applicable
      return Number(b.employmentStatusAtCompany === 'CURRENT') - Number(a.employmentStatusAtCompany === 'CURRENT')
    })
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

// A note the candidate can send as-is — fully filled in, no [placeholders].
// The ask is deliberately small ("mention my name or point me to the right
// person"): easy to say yes to, and doesn't pressure the contact to vouch
// for someone they may not have worked with closely.
export function draftBackchannelNote(params: {
  contactName: string
  role: string | null
  companyName: string
  senderFirstName: string | null
}): { subject: string; body: string } {
  const appliedText = params.role ? `applied for ${params.role} at ${params.companyName}` : `applied to ${params.companyName}`
  const subject = params.role ? `Quick favor: ${params.role} at ${params.companyName}` : `Quick favor: ${params.companyName}`
  const lines = [
    `Hi ${firstNameOf(params.contactName)},`,
    '',
    `Hope you're doing well. I just ${appliedText} and saw you're there.`,
    '',
    'Would you be open to mentioning my name to the hiring manager, or pointing me to the right person? Happy to send a short summary of my background so it takes you two minutes.',
    '',
    'Thanks either way,',
    params.senderFirstName ?? '',
  ]
  return { subject, body: lines.join('\n').trimEnd() }
}
