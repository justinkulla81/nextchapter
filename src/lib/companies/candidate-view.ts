import type { Company } from '@prisma/client'

// What a candidate may see of a Company row.
//
// Company is the shared spine of public business facts, but a few columns on it
// are our own working notes: who we plan to approach there (priority) and the
// named HR contact we dug up for outreach (chro*). Those must never reach a
// candidate-facing page, however a future change happens to render the row.
// Pages that load a Company for a candidate pass it through here first, so the
// fields are gone before any component can touch them — the guarantee does not
// depend on every component remembering not to render them.
export const ADMIN_ONLY_COMPANY_FIELDS = ['priority', 'chroName', 'chroEmail', 'chroLinkedinUrl'] as const

export function toCandidateCompany(company: Company): Company {
  return { ...company, priority: null, chroName: null, chroEmail: null, chroLinkedinUrl: null }
}
