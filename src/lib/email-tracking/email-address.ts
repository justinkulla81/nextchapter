// Gmail's From/To header is almost always "Display Name <email@domain>", not
// a bare address — shared by classify-email.ts and ats-patterns.ts so both
// extract the same way instead of drifting.
export function extractEmailAddress(header: string): string {
  const angleMatch = header.match(/<([^>]+)>/)
  return angleMatch ? angleMatch[1] : header.trim()
}

export function extractDomain(header: string): string | null {
  const match = extractEmailAddress(header).match(/@([a-z0-9.-]+)$/i)
  return match ? match[1].toLowerCase() : null
}

// The bit before "<email>", quotes stripped — falls back to the address's
// local-part when the header is a bare address with no display name.
export function extractDisplayName(header: string): string {
  const namePart = header.replace(/<[^>]+>/, '').trim().replace(/^["']|["']$/g, '')
  if (namePart) return namePart
  return extractEmailAddress(header).split('@')[0]
}

// Gmail (and most providers) ignore anything after "+" in the local part —
// "justin.kulla+cc@gmail.com" and "justin.kulla@gmail.com" are the same
// mailbox. Used to recognize when the candidate's own connected mailbox
// emailed itself (a personal digest/planner tool sending "from" the account
// it was granted access to, a "+tag" alias, etc.) so that mail is never
// mistaken for a real recruiter, ATS, or hiring-manager correspondence.
export function normalizeMailboxIdentity(header: string): string {
  const [localPart, domain] = extractEmailAddress(header).toLowerCase().split('@')
  if (!domain) return localPart
  return `${localPart.split('+')[0]}@${domain}`
}
