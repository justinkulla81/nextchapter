import type { CareerRole } from '@/lib/careers/roles'

/**
 * A role as the plain-text job description the platform's own parsers read (skills, years of
 * experience, function, seniority). This is the text to use if the role is posted to the job
 * board, so these roles are matched to people the same way every other job is.
 */
export function roleDescriptionText(role: CareerRole): string {
  const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n')
  const parts = [
    role.matchTitle,
    `Seniority: ${role.seniority}`,
    `About the role: ${role.about}`,
    `What you will do:\n${list(role.responsibilities)}`,
    `Required qualifications:\n${list(role.required)}`,
  ]
  if (role.preferred.length) parts.push(`Preferred qualifications:\n${list(role.preferred)}`)
  if (role.skills.length) parts.push(`Skills and tools: ${role.skills.join(', ')}`)
  if (role.knowledge.length) parts.push(`Knowledge:\n${list(role.knowledge)}`)
  if (role.howYouWork.length) parts.push(`How you work:\n${list(role.howYouWork)}`)
  return parts.join('\n\n')
}
