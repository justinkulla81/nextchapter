import 'server-only'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getAnthropicClient, logCacheUsage } from '@/lib/anthropic'
import type { ResumeDocumentData } from '@/lib/resume/export/document-data'
import { fitToLimits } from '@/lib/resume/studio/document'
import { checkCompleteness, type FidelityReport } from '@/lib/resume/studio/fidelity'

/**
 * Builds a studio document from the text of an uploaded resume. The upload is the source of truth:
 * the model is asked to copy, not to write, and the result is checked against the source text. If the
 * check finds anything lost or added, the model gets one more try with the exact differences. Whatever
 * is still different after that is reported to the person, never hidden.
 */

// Plain strings and arrays only (an empty string means "not on the resume"): the structured-output
// schema has a cap on nullable and union-typed fields, and this shape is large.
const roleSchema = z.object({
  company: z.string(),
  location: z.string(),
  title: z.string(),
  dates: z.string(),
  extraRoles: z.array(z.object({ title: z.string(), dates: z.string() })),
  bullets: z.array(z.string()),
})

export const importSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  contactLocation: z.string(),
  linkedinUrl: z.string(),
  titleUnderName: z.string(),
  summary: z.string(),
  experience: z.array(roleSchema),
  education: z.array(z.object({ school: z.string(), degree: z.string(), dates: z.string() })),
  skillsHeading: z.string(),
  skills: z.array(z.string()),
  certifications: z.array(z.string()),
  otherSections: z.array(
    z.object({
      heading: z.string(),
      items: z.array(z.object({ title: z.string(), subtitle: z.string(), dates: z.string(), bullets: z.array(z.string()) })),
    })
  ),
})
export type ImportedResume = z.infer<typeof importSchema>

const orNull = (s: string) => (s.trim() ? s.trim() : null)

/** Maps what the model copied onto the studio's document. Nothing is added here: empty means empty. */
export function toDocument(r: ImportedResume): ResumeDocumentData {
  return {
    name: r.name.trim() || 'Your Name',
    contact: { email: orNull(r.email), phone: orNull(r.phone), location: orNull(r.contactLocation), linkedinUrl: orNull(r.linkedinUrl) },
    targetTitle: orNull(r.titleUnderName),
    summary: orNull(r.summary),
    workHistory: r.experience.map((e) => ({
      companyName: e.company.trim(),
      roleTitle: e.title.trim(),
      dateRangeLabel: e.dates.trim(),
      bullets: e.bullets.map((b) => b.trim()).filter(Boolean),
      location: orNull(e.location),
      extraRoles: e.extraRoles.map((x) => ({ roleTitle: x.title.trim(), dateRangeLabel: x.dates.trim() })).filter((x) => x.roleTitle || x.dateRangeLabel),
    })),
    education: r.education.map((e) => ({ schoolName: e.school.trim(), degreeLabel: orNull(e.degree), dateLabel: orNull(e.dates) })),
    skills: r.skills.map((s) => s.trim()).filter(Boolean),
    certifications: r.certifications.map((c) => c.trim()).filter(Boolean),
    skillsHeading: orNull(r.skillsHeading),
    sections: r.otherSections
      .map((s) => ({
        heading: s.heading.trim(),
        items: s.items.map((i) => ({ title: i.title.trim(), subtitle: orNull(i.subtitle), dateLabel: orNull(i.dates), bullets: i.bullets.map((b) => b.trim()).filter(Boolean) })),
      }))
      .filter((s) => s.heading && s.items.length > 0),
  }
}

const SYSTEM = `You copy a resume into a structured form. You are a transcriber, not a writer.

Rules, in order of importance:
1. Copy text exactly as written: same words, same numbers, same punctuation, same capitalization. Never shorten, summarize, merge, reword, correct, or improve anything. Spelling and grammar mistakes stay as they are.
2. Never add anything that is not in the text: no titles, dates, months, companies, skills, locations or links. If a field is not on the resume, return an empty string or empty array.
3. Dates are copied as written. "2011" stays "2011". "2007, 2008" stays "2007, 2008". Never add a month or "Present".
4. Every bullet is kept, in full, each as its own entry, with its figures. If two bullets share one line, split them; do not change their words.
5. If an employer lists several titles, put the first in "title" with its "dates", and the rest in "extraRoles" with their own dates, in the order written.
6. "location" is the place printed next to a job. "contactLocation" is the address or city in the header, as written.
7. A line under the contact details with no section heading (a headline or tagline) goes in "summary", unless it is clearly just a job title, which goes in "titleUnderName".
8. Education: one entry per school or degree as listed, with the degree text and dates exactly as written.
9. The skills list keeps the resume's own heading in "skillsHeading" (for example "CORE COMPETENCIES") and one entry per skill, split on the separators the resume uses.
10. Anything else with its own heading (Extracurricular, Publications, Board service, Awards, Languages...) goes in "otherSections", in order, with the heading as written. Items keep their own title, subtitle, dates and bullets.
11. Every line of the resume must land somewhere. Section headings that are standard (Experience, Education, Skills) need no copy.`

type Attempt = (text: string, feedback: string | null) => Promise<ImportedResume>

async function callModel(text: string, feedback: string | null): Promise<ImportedResume> {
  const stream = getAnthropicClient().messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(importSchema) },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Resume text:\n\n${text}`, cache_control: { type: 'ephemeral' as const } },
          ...(feedback ? [{ type: 'text' as const, text: feedback }] : []),
        ],
      },
    ],
  })
  const message = await stream.finalMessage()
  logCacheUsage('resume-import', message.usage)
  if (!message.parsed_output) throw new Error('The resume could not be read into sections.')
  return message.parsed_output
}

function feedbackFor(report: FidelityReport): string {
  const parts = ['Your last copy was checked against the resume text and was not exact. Copy it again, fixing only this:']
  if (report.missing.length > 0) parts.push(`Words or figures in the resume that your copy left out: ${report.missing.slice(0, 60).join(', ')}.`)
  if (report.unplacedLines.length > 0) parts.push(`Lines of the resume that hold them (make sure each is fully copied):\n${report.unplacedLines.slice(0, 25).join('\n')}`)
  if (report.added.length > 0) parts.push(`Words or figures in your copy that are not in the resume (remove them): ${report.added.slice(0, 60).join(', ')}.`)
  return parts.join('\n\n')
}

export interface ImportResult {
  document: ResumeDocumentData
  report: FidelityReport
  attempts: number
}

/**
 * Reads the resume text into a document and checks it. `attempt` is the model call; it is a parameter so
 * the retry and checking logic can be tested without one.
 */
export async function importDocumentFromText(text: string, attempt: Attempt = callModel): Promise<ImportResult> {
  let best: { document: ResumeDocumentData; report: FidelityReport } | null = null
  let feedback: string | null = null
  const maxAttempts = 2
  for (let n = 1; n <= maxAttempts; n++) {
    const copied = await attempt(text, feedback)
    // Fit to the limits after checking would hide a cut, so check the document as it will be stored.
    const document = fitToLimits(toDocument(copied))
    const report = checkCompleteness(text, document)
    if (!best || report.coverage - report.added.length * 0.01 > best.report.coverage - best.report.added.length * 0.01) best = { document, report }
    if (report.ok) return { ...best, attempts: n }
    feedback = feedbackFor(report)
  }
  return { ...best!, attempts: maxAttempts }
}
