import { z } from 'zod'
import type { ResumeDocumentData } from '@/lib/resume/export/document-data'

/**
 * The editable resume document: the same shape the PDF and Word templates render.
 * Everything from the browser is parsed through this before it is saved or exported,
 * so a draft can never hold more than the templates are built to lay out.
 */
// Limits, with messages that name the field and say what to do. These are what a person sees.
// They are generous on purpose: a real resume has long bullets and long headers, and an upload
// must never be cut to fit a limit the person never chose.
export const LIMITS = {
  name: 100,
  email: 200,
  phone: 40,
  location: 160,
  linkedin: 300,
  title: 250,
  summary: 2500,
  company: 150,
  role: 200,
  dates: 60,
  bullet: 900,
  bulletsPerRole: 15,
  roles: 30,
  extraRoles: 6,
  school: 150,
  degree: 200,
  year: 40,
  schools: 10,
  skill: 80,
  skills: 80,
  skillsHeading: 60,
  certification: 120,
  certifications: 30,
  sections: 6,
  sectionHeading: 60,
  sectionItems: 12,
  itemTitle: 200,
  itemSubtitle: 200,
} as const

const t = (max: number, field: string) => z.string().trim().max(max, `${field} can be up to ${max} characters. Shorten it and try again.`)
const optional = (max: number, field: string) => t(max, field).nullable()
const optionalKey = (max: number, field: string) => t(max, field).nullable().optional()

const customItemSchema = z.object({
  title: t(LIMITS.itemTitle, 'An item title'),
  subtitle: optional(LIMITS.itemSubtitle, 'An item subtitle'),
  dateLabel: optional(LIMITS.dates, 'A date'),
  bullets: z.array(t(LIMITS.bullet, 'A bullet')).max(LIMITS.bulletsPerRole, `An item can have up to ${LIMITS.bulletsPerRole} bullets. Remove or combine some.`),
})

const documentSchema = z.object({
  name: t(LIMITS.name, 'Your name').min(1, 'Add your name at the top.'),
  contact: z.object({
    email: optional(LIMITS.email, 'Your email'),
    phone: optional(LIMITS.phone, 'Your phone number'),
    location: optional(LIMITS.location, 'Your location'),
    linkedinUrl: optional(LIMITS.linkedin, 'Your LinkedIn address'),
  }),
  targetTitle: optional(LIMITS.title, 'The title under your name'),
  summary: optional(LIMITS.summary, 'Your summary'),
  workHistory: z
    .array(
      z.object({
        companyName: t(LIMITS.company, 'A company name'),
        roleTitle: t(LIMITS.role, 'A job title'),
        dateRangeLabel: t(LIMITS.dates, 'A date range'),
        bullets: z.array(t(LIMITS.bullet, 'A bullet')).max(LIMITS.bulletsPerRole, `A role can have up to ${LIMITS.bulletsPerRole} bullets. Remove or combine some.`),
        location: optionalKey(LIMITS.location, 'A job location'),
        extraRoles: z
          .array(z.object({ roleTitle: t(LIMITS.role, 'A job title'), dateRangeLabel: t(LIMITS.dates, 'A date range') }))
          .max(LIMITS.extraRoles, `A job can list up to ${LIMITS.extraRoles} extra titles.`)
          .optional(),
      })
    )
    .max(LIMITS.roles, `You can list up to ${LIMITS.roles} roles. Remove the oldest ones you do not need.`),
  education: z
    .array(z.object({ schoolName: t(LIMITS.school, 'A school name'), degreeLabel: optional(LIMITS.degree, 'A degree'), dateLabel: optional(LIMITS.year, 'A graduation year') }))
    .max(LIMITS.schools, `You can list up to ${LIMITS.schools} schools. Remove one you do not need.`),
  skills: z.array(t(LIMITS.skill, 'A skill')).max(LIMITS.skills, `You can list up to ${LIMITS.skills} skills. Keep the ones that matter most.`),
  certifications: z.array(t(LIMITS.certification, 'A certification')).max(LIMITS.certifications, `You can list up to ${LIMITS.certifications} certifications.`),
  skillsHeading: optionalKey(LIMITS.skillsHeading, 'The skills heading'),
  sections: z
    .array(
      z.object({
        heading: t(LIMITS.sectionHeading, 'A section heading'),
        items: z.array(customItemSchema).max(LIMITS.sectionItems, `A section can have up to ${LIMITS.sectionItems} items.`),
      })
    )
    .max(LIMITS.sections, `You can add up to ${LIMITS.sections} extra sections.`)
    .optional(),
})

/**
 * Trims a document to the limits instead of rejecting it. Used when a draft is built from profile
 * data, which was never held to these limits, so a long note or a long list does not leave a draft
 * that cannot be opened. Anything cut is the tail of a list or the end of a string.
 */
export function fitToLimits(doc: ResumeDocumentData): ResumeDocumentData {
  const cut = (s: string, n: number) => s.trim().slice(0, n)
  const cutNull = (s: string | null | undefined, n: number) => (s ? cut(s, n) : null)
  return {
    name: cut(doc.name, LIMITS.name) || 'Your Name',
    contact: {
      email: cutNull(doc.contact.email, LIMITS.email),
      phone: cutNull(doc.contact.phone, LIMITS.phone),
      location: cutNull(doc.contact.location, LIMITS.location),
      linkedinUrl: cutNull(doc.contact.linkedinUrl, LIMITS.linkedin),
    },
    targetTitle: cutNull(doc.targetTitle, LIMITS.title),
    summary: cutNull(doc.summary, LIMITS.summary),
    workHistory: doc.workHistory.slice(0, LIMITS.roles).map((w) => ({
      companyName: cut(w.companyName, LIMITS.company),
      roleTitle: cut(w.roleTitle, LIMITS.role),
      dateRangeLabel: cut(w.dateRangeLabel, LIMITS.dates),
      bullets: w.bullets.slice(0, LIMITS.bulletsPerRole).map((b) => cut(b, LIMITS.bullet)),
      location: cutNull(w.location, LIMITS.location),
      extraRoles: (w.extraRoles ?? []).slice(0, LIMITS.extraRoles).map((r) => ({ roleTitle: cut(r.roleTitle, LIMITS.role), dateRangeLabel: cut(r.dateRangeLabel, LIMITS.dates) })),
    })),
    education: doc.education.slice(0, LIMITS.schools).map((e) => ({
      schoolName: cut(e.schoolName, LIMITS.school),
      degreeLabel: cutNull(e.degreeLabel, LIMITS.degree),
      dateLabel: cutNull(e.dateLabel, LIMITS.year),
    })),
    skills: doc.skills.slice(0, LIMITS.skills).map((x) => cut(x, LIMITS.skill)),
    certifications: doc.certifications.slice(0, LIMITS.certifications).map((x) => cut(x, LIMITS.certification)),
    skillsHeading: cutNull(doc.skillsHeading, LIMITS.skillsHeading),
    sections: (doc.sections ?? []).slice(0, LIMITS.sections).map((s) => ({
      heading: cut(s.heading, LIMITS.sectionHeading),
      items: s.items.slice(0, LIMITS.sectionItems).map((i) => ({
        title: cut(i.title, LIMITS.itemTitle),
        subtitle: cutNull(i.subtitle, LIMITS.itemSubtitle),
        dateLabel: cutNull(i.dateLabel, LIMITS.dates),
        bullets: i.bullets.slice(0, LIMITS.bulletsPerRole).map((b) => cut(b, LIMITS.bullet)),
      })),
    })),
  }
}

const blankToNull = (v: string | null | undefined) => (v && v.length > 0 ? v : null)

export type ParsedDocument = { ok: true; data: ResumeDocumentData } | { ok: false; error: string }

/** Validates a document from the browser and tidies it: empty bullets, rows and fields are dropped. */
export function parseResumeDocument(raw: unknown): ParsedDocument {
  const parsed = documentSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Something in the resume is not valid. Check it and try again.' }
  }
  const d = parsed.data
  const sections = (d.sections ?? [])
    .map((s) => ({
      heading: s.heading,
      items: s.items
        .map((i) => ({ title: i.title, subtitle: blankToNull(i.subtitle), dateLabel: blankToNull(i.dateLabel), bullets: i.bullets.filter(Boolean) }))
        .filter((i) => i.title || i.subtitle || i.bullets.length > 0),
    }))
    .filter((s) => s.heading && s.items.length > 0)
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
        .map((w) => ({
          companyName: w.companyName,
          roleTitle: w.roleTitle,
          dateRangeLabel: w.dateRangeLabel,
          bullets: w.bullets.filter(Boolean),
          location: blankToNull(w.location),
          extraRoles: (w.extraRoles ?? []).filter((r) => r.roleTitle || r.dateRangeLabel),
        }))
        .filter((w) => w.companyName || w.roleTitle || w.bullets.length > 0),
      education: d.education
        .map((e) => ({ schoolName: e.schoolName, degreeLabel: blankToNull(e.degreeLabel), dateLabel: blankToNull(e.dateLabel) }))
        .filter((e) => e.schoolName || e.degreeLabel),
      skills: [...new Set(d.skills.filter(Boolean))],
      certifications: d.certifications.filter(Boolean),
      skillsHeading: blankToNull(d.skillsHeading),
      sections,
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
      lines.push([w.roleTitle, w.companyName].filter(Boolean).join(', ') + (w.location ? `, ${w.location}` : '') + (w.dateRangeLabel ? `  ${w.dateRangeLabel}` : ''))
      for (const r of w.extraRoles ?? []) lines.push(r.roleTitle + (r.dateRangeLabel ? `  ${r.dateRangeLabel}` : ''))
      for (const b of w.bullets) lines.push(`- ${b}`)
    }
  }
  if (doc.education.length > 0) {
    lines.push('', 'EDUCATION')
    for (const e of doc.education) lines.push([e.degreeLabel, e.schoolName].filter(Boolean).join(', ') + (e.dateLabel ? `  ${e.dateLabel}` : ''))
  }
  for (const s of doc.sections ?? []) {
    lines.push('', s.heading.toUpperCase())
    for (const i of s.items) {
      lines.push([i.title, i.subtitle].filter(Boolean).join(', ') + (i.dateLabel ? `  ${i.dateLabel}` : ''))
      for (const b of i.bullets) lines.push(`- ${b}`)
    }
  }
  if (doc.skills.length > 0) lines.push('', (doc.skillsHeading || 'Skills').toUpperCase(), doc.skills.join(', '))
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
