// Shared consumer/ATS domain set — a match here means "this email address
// tells us nothing about where the person works," so callers should not
// guess a company (or, by extension, treat the domain as a real employer).
export const NON_COMPANY_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'greenhouse.io', 'lever.co', 'myworkday.com', 'ashbyhq.com', 'smartrecruiters.com',
  'linkedin.com', 'indeed.com', 'workablemail.com',
])

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

// Best-effort guess at a contact's employer or school from their email
// domain alone — used where we have no other signal (a calendar attendee we
// never emailed). ".edu" is the only school signal reliable enough to guess
// automatically; anything else non-consumer is treated as a company guess,
// never both. Never overwrites a candidate-confirmed value — callers store
// this only in the inferredCompany/inferredSchool hint fields.
export function inferOrgFromEmailDomain(email: string): { inferredCompany: string | null; inferredSchool: string | null } {
  const match = email.toLowerCase().match(/@([a-z0-9.-]+)$/)
  if (!match) return { inferredCompany: null, inferredSchool: null }
  const domain = match[1]
  const root = domain.split('.').slice(-2).join('.')

  if (domain.endsWith('.edu')) {
    const name = domain.split('.').slice(0, -1).join(' ')
    return { inferredCompany: null, inferredSchool: capitalize(name) }
  }

  if (NON_COMPANY_DOMAINS.has(root)) return { inferredCompany: null, inferredSchool: null }

  const name = domain.split('.')[0]
  return { inferredCompany: capitalize(name), inferredSchool: null }
}
