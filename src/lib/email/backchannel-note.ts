export interface BackchannelContact {
  name: string
  title: string | null
  email: string | null
  warmth: 'HOT' | 'WARM' | 'COLD'
  employmentStatusAtCompany: 'CURRENT' | 'FORMER' | null
}

const WARMTH_RANK = { HOT: 0, WARM: 1, COLD: 2 } as const

// Drops contacts the candidate has confirmed no longer work there (telling
// someone "you know a person at X" about a person who left is a false claim),
// then orders the rest by who is easiest to actually reach: confirmed
// current employees first, then ones with an email on file, then warmest.
export function rankBackchannelContacts<T extends BackchannelContact>(contacts: T[]): T[] {
  return contacts
    .filter((c) => c.employmentStatusAtCompany !== 'FORMER')
    .sort((a, b) => {
      const confirmed = Number(b.employmentStatusAtCompany === 'CURRENT') - Number(a.employmentStatusAtCompany === 'CURRENT')
      if (confirmed !== 0) return confirmed
      const reachable = Number(Boolean(b.email)) - Number(Boolean(a.email))
      if (reachable !== 0) return reachable
      return WARMTH_RANK[a.warmth] - WARMTH_RANK[b.warmth]
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
  const roleText = params.role ?? 'a role'
  const subject = params.role ? `Quick favor: ${params.role} at ${params.companyName}` : `Quick favor: ${params.companyName}`
  const lines = [
    `Hi ${firstNameOf(params.contactName)},`,
    '',
    `Hope you're doing well. I just applied for ${roleText} at ${params.companyName} and saw you're there.`,
    '',
    'Would you be open to mentioning my name to the hiring manager, or pointing me to the right person? Happy to send a short summary of my background so it takes you two minutes.',
    '',
    'Thanks either way,',
    params.senderFirstName ?? '',
  ]
  return { subject, body: lines.join('\n').trimEnd() }
}
