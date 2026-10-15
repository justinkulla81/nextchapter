import { extractTopSkills } from '@/lib/companies/skills-extraction'
import { resumeToPlainText } from '@/lib/resume/studio/document'
import type { ResumeDocumentData } from '@/lib/resume/export/document-data'

export interface KeywordCoverage {
  /** Skills and tools the posting names that the resume also contains. */
  found: string[]
  /** Skills and tools the posting names that the resume does not mention. */
  missing: string[]
}

function mentions(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(haystack)
}

/**
 * Which of the skills and tools a job posting names also appear in the resume.
 * Uses the fixed skill vocabulary the job-board code already scans postings with
 * (no AI, no cost), so it only knows terms in that list; a posting that asks for
 * something outside it will not show up here. Mentioning a term is not the same
 * as having the skill, so the editor words this as a prompt to check, not a score.
 */
export function keywordCoverage(jobDescription: string, doc: ResumeDocumentData): KeywordCoverage {
  const wanted = extractTopSkills([jobDescription], 40).map((s) => s.term)
  const resumeText = resumeToPlainText(doc).toLowerCase()
  const found: string[] = []
  const missing: string[] = []
  for (const term of wanted) (mentions(resumeText, term) ? found : missing).push(term)
  return { found, missing }
}
