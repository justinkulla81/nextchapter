// ATS and job-board platforms send bulk automated notifications (job-posting
// performance tips, listing-expiration reminders, application-status pings)
// under their own domain — never a real individual writing to the
// candidate. Role-mention matchers (recruiter/hiring-manager/coach) exist to
// catch a real person's title, so mail from these domains should never set
// those flags no matter what boilerplate copy the notification contains.
export const ATS_AND_JOB_BOARD_DOMAINS = new Set([
  'greenhouse.io', 'lever.co', 'myworkday.com', 'ashbyhq.com', 'smartrecruiters.com',
  'linkedin.com', 'indeed.com', 'workablemail.com',
])

// Shared consumer/ATS domain set — a match here means "this email address
// tells us nothing about where the person works," so callers should not
// guess a company (or, by extension, treat the domain as a real employer).
export const NON_COMPANY_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  ...ATS_AND_JOB_BOARD_DOMAINS,
])

// Every transactional/admin email NextChapter itself sends — recruiter
// digests, candidate nudges, offer-bonus notices, etc. A candidate whose
// connected inbox also receives one of these (e.g. their Gmail is also a
// recruiter account's work email) must never have it misread as an actual
// recruiter/hiring-manager/coach contacting them, no matter what the
// boilerplate copy inside says ("...unlocked visibility in the Recruiter
// Database" trivially matches a bare \brecruiter\b pattern).
export const NEXTCHAPTER_SENDING_DOMAINS = new Set(['launchyournextchapter.com'])

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
