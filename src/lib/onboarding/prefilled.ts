// "We filled in 9 answers for you": the answers the résumé already gave, as plain labels. Pure.

export interface PrefilledProfile {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  resumeLatestJobTitle?: string | null
  primaryFunction?: string | null
  yearsExperience?: number | null
  industryContext?: string | null
  currentCity?: string | null
  currentState?: string | null
  highestEducationLevel?: string | null
  resumeKeywords?: readonly string[] | null
  licensesHeld?: readonly string[] | null
  clearanceLevel?: string | null
  workAuthorization?: string | null
}

const has = (v: unknown) => (typeof v === 'string' ? v.trim() !== '' : typeof v === 'number' ? true : Array.isArray(v) ? v.length > 0 : false)

/** The labels of what the résumé filled in, in the order a person would say them. */
export function prefilledAnswers(p: PrefilledProfile): string[] {
  const out: string[] = []
  if (has(p.firstName) || has(p.lastName)) out.push('Your name')
  if (has(p.email)) out.push('Your email')
  if (has(p.resumeLatestJobTitle)) out.push('Your latest job title')
  if (has(p.primaryFunction)) out.push('Your job function')
  if (has(p.yearsExperience)) out.push('Years of experience')
  if (has(p.industryContext)) out.push('Your industry')
  if (has(p.currentCity) || has(p.currentState)) out.push('Where you live')
  if (has(p.highestEducationLevel)) out.push('Your education')
  if (has(p.resumeKeywords)) out.push('Your skills and tools')
  if (has(p.licensesHeld)) out.push('Your licenses')
  if (has(p.clearanceLevel)) out.push('Your clearance')
  if (has(p.workAuthorization)) out.push('Your work authorization')
  return out
}
