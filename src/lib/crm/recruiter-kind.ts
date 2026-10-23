/**
 * Who a person tagged as a recruiter really is, from their title and firm. The CRM's recruiter role also picked up
 * HR leaders and in-house talent-acquisition staff from the LinkedIn import; only search and agency recruiters
 * can place a laid-off candidate at another company, so only they belong in the layoff alert. Pure.
 */
export type RecruiterKind = 'recruiter' | 'in_house' | 'hr' | 'support' | 'unclear'

export const RECRUITER_KINDS: RecruiterKind[] = ['recruiter', 'in_house', 'hr', 'support', 'unclear']
export const KIND_LABEL: Record<RecruiterKind, string> = {
  recruiter: 'Search and agency recruiters', in_house: 'In-house talent acquisition', hr: 'HR staff and leaders', support: 'Support staff', unclear: 'Unclear',
}

/** Assistants and back-office staff. "Office contact" is a franchise owner in the Sanford Rose directory, not support. */
const SUPPORT = /\b(assistant|coordinator|administrator|admin|office manager|receptionist|researcher|research (associate|analyst|director)|paralegal|bookkeep\w*|accounting|accountant|controller|payroll|billing|marketing|graphic|web ?developer|it (manager|director|support)|technology officer|operations (manager|director|associate)|business development|client services|executive assistant)\b/i
/** A person who runs searches or places candidates, whatever the firm calls them. */
const PLACES = /\b(recruit\w*|executive search|search (consultant|partner|associate|advisor|professional|principal|director)|talent (acquisition|partner|sourc\w*)|sourc(er|ing)|headhunt\w*|placement|practice (leader|head|lead)|managing (director|partner|principal)|(senior |managing )?(partner|principal)|consultant|associate)\b/i
const IN_HOUSE_TA = /\b(talent acquisition|recruit\w*|sourc(er|ing)|talent partner)\b/i
const HR = /\b(human resources|\bhr\b|chro|chief (people|human|talent)|people (operations|partner|team|&|and culture)|total rewards|compensation|benefits|employee relations|labor relations|learning|organizational development|talent management|diversity)\b/i

export interface KindInput {
  title: string | null
  /** A SearchFirm row exists, the name reads like a search/staffing firm, or the person came from the researched firm lists. */
  atSearchFirm: boolean
}

export function classifyRecruiter({ title, atSearchFirm }: KindInput): RecruiterKind {
  const t = (title ?? '').trim()
  if (/office contact/i.test(t)) return 'recruiter'
  if (SUPPORT.test(t) && !/recruit|search (consultant|partner)|executive search|talent acquisition/i.test(t)) return 'support'
  if (atSearchFirm) return !t || PLACES.test(t) || /\b(director|vice president|\bvp\b|principal|owner|founder|president|ceo)\b/i.test(t) ? 'recruiter' : HR.test(t) ? 'hr' : 'unclear'
  if (IN_HOUSE_TA.test(t) && !/human resources officer|chro/i.test(t)) return 'in_house'
  if (HR.test(t)) return 'hr'
  return 'unclear'
}
