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
