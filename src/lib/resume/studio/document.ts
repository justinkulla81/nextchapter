import { z } from 'zod'
import type { ResumeDocumentData } from '@/lib/resume/export/document-data'

/**
 * The editable resume document: the same shape the PDF and Word templates render.
 * Everything from the browser is parsed through this before it is saved or exported,
 * so a draft can never hold more than the templates are built to lay out.
 */
const t = (max: number) => z.string().trim().max(max)
const optional = (max: number) => t(max).nullable()

const documentSchema = z.object({
  name: t(100).min(1, 'Add your name at the top.'),
  contact: z.object({
    email: optional(200),
    phone: optional(40),
    location: optional(120),
    linkedinUrl: optional(300),
  }),
  targetTitle: optional(150),
  summary: optional(1500),
  workHistory: z
    .array(
      z.object({
        companyName: t(150),
        roleTitle: t(150),
        dateRangeLabel: t(60),
        bullets: z.array(t(400)).max(12, 'A role can have up to 12 bullets.'),
      })
    )
    .max(25),
  education: z.array(z.object({ schoolName: t(150), degreeLabel: optional(150), dateLabel: optional(30) })).max(10),
  skills: z.array(t(60)).max(60),
  certifications: z.array(t(120)).max(30),
})

const blankToNull = (v: string | null) => (v && v.length > 0 ? v : null)

export type ParsedDocument = { ok: true; data: ResumeDocumentData } | { ok: false; error: string }

/** Validates a document from the browser and tidies it: empty bullets, rows and fields are dropped. */
export function parseResumeDocument(raw: unknown): ParsedDocument {
  const parsed = documentSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Something in the resume is not valid. Check it and try again.' }
  }
  const d = parsed.data
  return {
    ok: true,
    data: {
      name: d.name,
      contact: {
        email: blankToNull(d.contact.email),
        phone: blankToNull(d.contact.phone),
        location: blankToNull(d.contact.location),
        linkedinUrl: blankToNull(d.contact.linkedinUrl),
      },
      targetTitle: blankToNull(d.targetTitle),
      summary: blankToNull(d.summary),
      workHistory: d.workHistory
        .map((w) => ({ ...w, bullets: w.bullets.filter(Boolean) }))
        .filter((w) => w.companyName || w.roleTitle || w.bullets.length > 0),
      education: d.education
        .map((e) => ({ schoolName: e.schoolName, degreeLabel: blankToNull(e.degreeLabel), dateLabel: blankToNull(e.dateLabel) }))
        .filter((e) => e.schoolName || e.degreeLabel),
      skills: [...new Set(d.skills.filter(Boolean))],
      certifications: d.certifications.filter(Boolean),
    },
  }
}

/** How an applicant tracking system reads the resume: plain text, top to bottom, in the order it appears. */
export function resumeToPlainText(doc: ResumeDocumentData): string {
  const lines: string[] = [doc.name]
  const contact = [doc.contact.email, doc.contact.phone, doc.contact.location, doc.contact.linkedinUrl].filter(Boolean)
  if (contact.length > 0) lines.push(contact.join(' | '))
  if (doc.targetTitle) lines.push(doc.targetTitle)
  if (doc.summary) lines.push('', 'SUMMARY', doc.summary)
  if (doc.workHistory.length > 0) {
    lines.push('', 'EXPERIENCE')
    for (const w of doc.workHistory) {
      lines.push([w.roleTitle, w.companyName].filter(Boolean).join(', ') + (w.dateRangeLabel ? `  ${w.dateRangeLabel}` : ''))
      for (const b of w.bullets) lines.push(`- ${b}`)
    }
  }
  if (doc.education.length > 0) {
    lines.push('', 'EDUCATION')
    for (const e of doc.education) lines.push([e.degreeLabel, e.schoolName].filter(Boolean).join(', ') + (e.dateLabel ? `  ${e.dateLabel}` : ''))
  }
  if (doc.skills.length > 0) lines.push('', 'SKILLS', doc.skills.join(', '))
  if (doc.certifications.length > 0) lines.push('', 'CERTIFICATIONS', doc.certifications.join(', '))
  return lines.join('\n')
}

export function blankResumeDocument(name = ''): ResumeDocumentData {
  return {
    name,
    contact: { email: null, phone: null, location: null, linkedinUrl: null },
    targetTitle: null,
    summary: null,
    workHistory: [],
    education: [],
    skills: [],
    certifications: [],
  }
}
