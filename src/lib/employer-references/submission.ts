import 'server-only'

export interface EmployerRegistrationInput {
  submitterName: string
  submitterTitle: string | null
  submitterCompany: string
  submitterEmail: string
  employeeName: string
  employeeEmail: string
}

// Same trust-gate philosophy as the NC Job Board's employer/recruiter
// self-submissions (validateJobBoardSubmission in job-board-submission.ts):
// no real company-email-domain verification exists anywhere in this app,
// so a named, real-looking contact is the trust gate instead — required
// fields, not a domain check. Flagged to the user rather than building a
// second, parallel verification system (Prompt 65's own instruction).
export function validateEmployerRegistration(input: EmployerRegistrationInput): string | null {
  if (!input.submitterName.trim()) return 'Your name is required.'
  if (!input.submitterCompany.trim()) return 'Your company is required.'
  if (!input.submitterEmail.trim() || !input.submitterEmail.includes('@')) {
    return 'A valid work email is required.'
  }
  if (!input.employeeName.trim()) return "The departing employee's name is required."
  if (!input.employeeEmail.trim() || !input.employeeEmail.includes('@')) {
    return "A valid email for the departing employee is required."
  }
  return null
}
