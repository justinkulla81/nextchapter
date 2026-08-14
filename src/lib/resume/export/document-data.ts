import 'server-only'
import { prisma } from '@/lib/prisma'

// Shared, renderer-agnostic source of truth for resume export (Master
// Build Script §13.2). Both the docx builder and the @react-pdf/renderer
// component tree consume this exact shape — neither renderer re-queries
// the DB, and neither is a conversion of the other's output. Every field
// here maps to a real column on CandidateProfile / WorkHistoryEntry /
// EducationEntry; nothing is invented to fill out a "typical resume"
// shape (e.g. there is no bullets array per role because the schema only
// has one `keyAchievement` string per WorkHistoryEntry today — the guided
// walkthrough's "five guided bullets" per §13.1 isn't schema-backed yet).
export interface ResumeDocumentData {
  name: string
  contact: {
    email: string | null
    phone: string | null
    location: string | null // "City, State"
    linkedinUrl: string | null
  }
  // The most recent/aspirational role title, shown under the name. Prefers
  // the candidate's stated target (targetRoleType) over the resume-derived
  // current title, since this document is being exported to go apply
  // somewhere — it should lead with where they're going, not just where
  // they've been.
  targetTitle: string | null
  // Executive Dossier Positioning Statement — only ever populated once the
  // candidate has explicitly approved it (positioningStatementText, never
  // the *Draft column), same rule the Dossier itself follows.
  summary: string | null
  workHistory: ResumeWorkHistoryItem[]
  education: ResumeEducationItem[]
  skills: string[]
  certifications: string[]
}

export interface ResumeWorkHistoryItem {
  companyName: string
  roleTitle: string
  dateRangeLabel: string // "Jan 2020 – Present", already formatted, right-aligned via tab stop by the renderer
  bullets: string[]
}

export interface ResumeEducationItem {
  schoolName: string
  degreeLabel: string | null // "MBA, Finance" style, degree + fieldOfStudy joined
  dateLabel: string | null // graduation year, already formatted
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatDateRange(startDate: Date, endDate: Date | null, isCurrent: boolean): string {
  const start = formatMonthYear(startDate)
  const end = isCurrent || !endDate ? 'Present' : formatMonthYear(endDate)
  return `${start} – ${end}`
}

function formatDegreeLabel(degree: string | null, fieldOfStudy: string | null): string | null {
  if (degree && fieldOfStudy) return `${degree}, ${fieldOfStudy}`
  return degree ?? fieldOfStudy ?? null
}

function formatLocation(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`
  return city ?? state ?? null
}

export async function buildResumeDocumentData(candidateId: string): Promise<ResumeDocumentData> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      workHistory: { orderBy: { startDate: 'desc' } },
      educationHistory: { orderBy: [{ isPrimary: 'desc' }, { graduationDate: 'desc' }] },
    },
  })

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()

  const workHistory: ResumeWorkHistoryItem[] = profile.workHistory.map((entry) => ({
    companyName: entry.companyName,
    roleTitle: entry.roleTitle,
    dateRangeLabel: formatDateRange(entry.startDate, entry.endDate, entry.isCurrent),
    bullets: entry.keyAchievement ? [entry.keyAchievement] : [],
  }))

  const education: ResumeEducationItem[] = profile.educationHistory.map((entry) => ({
    schoolName: entry.schoolName,
    degreeLabel: formatDegreeLabel(entry.degree, entry.fieldOfStudy),
    dateLabel: entry.graduationDate ? formatMonthYear(entry.graduationDate).split(' ')[1] : null,
  }))

  return {
    name: name || 'Your Name',
    contact: {
      email: profile.email,
      phone: profile.phone,
      location: formatLocation(profile.currentCity, profile.currentState),
      linkedinUrl: profile.linkedInUrl,
    },
    targetTitle: profile.targetRoleType ?? profile.resumeLatestJobTitle,
    summary: profile.positioningStatementText,
    workHistory,
    education,
    skills: profile.resumeKeywords,
    certifications: profile.certifications,
  }
}
