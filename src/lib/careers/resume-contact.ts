// Contact details read from resume text, so an application asks for nothing but the resume.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/

/** The first email address in the text (a resume lists the applicant's own first), lower-cased; null when none. */
export function findEmailInResumeText(text: string | null | undefined): string | null {
  const match = text?.match(EMAIL)
  return match ? match[0].toLowerCase() : null
}

/** What to tell the applicant when the resume does not show a name, an email address, or either. */
export function missingContactMessage(found: { name: string | null; email: string | null }): string | null {
  if (found.name && found.email) return null
  if (!found.name && !found.email) {
    return 'We couldn’t find your name and email address on this resume. Upload a version with them at the top.'
  }
  return found.name
    ? 'We couldn’t find your email address on this resume. Upload a version with your email address on it.'
    : 'We couldn’t find your name on this resume. Upload a version with your name at the top.'
}

/** Shown when no readable text comes out of the file (a scan or an empty document). */
export const UNREADABLE_RESUME_MESSAGE =
  'We couldn’t read any text in that file. Upload a PDF or Word resume that is not a scan.'

/** Resume text shorter than this is treated as unreadable. */
export const MIN_RESUME_TEXT_LENGTH = 40
