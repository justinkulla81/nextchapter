import { CAREER_ROLES } from '@/lib/careers/roles'

/** The value of the "not listed" choice in the role dropdown. */
export const OTHER_ROLE = 'other'

/** Roles a person can apply to: jobs, not the platform listings (coaches and recruiters join through their own pages). */
export const APPLY_ROLES = CAREER_ROLES.filter((r) => r.kind !== 'platform')

export type ApplicationInput = { roleSlug: string; note: string }

export type ValidApplication = {
  roleSlug: string | null
  roleTitle: string
  note: string | null
}

/** Checks the role (and the note for "not listed"). The resume is checked separately, on the server. */
export function validateApplication(input: ApplicationInput): { error: string } | { ok: ValidApplication } {
  const note = input.note.trim()
  if (input.roleSlug === OTHER_ROLE) {
    if (!note) return { error: 'Tell us what you would do at NextChapter.' }
    if (note.length > 1000) return { error: 'Shorten your note to 1,000 characters or fewer.' }
    return { ok: { roleSlug: null, roleTitle: 'Not listed', note } }
  }
  const role = APPLY_ROLES.find((r) => r.slug === input.roleSlug)
  if (!role) return { error: 'Choose the role you are applying for.' }
  return { ok: { roleSlug: role.slug, roleTitle: role.title, note: null } }
}
