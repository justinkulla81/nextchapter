import { CAREER_ROLES } from '@/lib/careers/roles'

/** The value of the "not listed" choice in the role dropdown. */
export const OTHER_ROLE = 'other'

/** Roles a person can apply to: jobs, not the platform listings (coaches and recruiters join through their own pages). */
export const APPLY_ROLES = CAREER_ROLES.filter((r) => r.kind !== 'platform')

export type ApplicationInput = { email: string; roleSlug: string; note: string }

export type ValidApplication = {
  email: string
  roleSlug: string | null
  roleTitle: string
  note: string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Checks the text fields of an application. The file is checked separately, on the server. */
export function validateApplication(input: ApplicationInput): { error: string } | { ok: ValidApplication } {
  const email = input.email.trim()
  const note = input.note.trim()
  if (!EMAIL.test(email)) return { error: 'Enter a valid email.' }
  if (input.roleSlug === OTHER_ROLE) {
    if (!note) return { error: 'Tell us what you would do at NextChapter.' }
    if (note.length > 1000) return { error: 'Shorten your note to 1,000 characters or fewer.' }
    return { ok: { email, roleSlug: null, roleTitle: 'Not listed', note } }
  }
  const role = APPLY_ROLES.find((r) => r.slug === input.roleSlug)
  if (!role) return { error: 'Choose the role you are applying for.' }
  return { ok: { email, roleSlug: role.slug, roleTitle: role.title, note: null } }
}
