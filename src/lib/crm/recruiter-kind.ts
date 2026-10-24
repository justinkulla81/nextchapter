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
  /**
   * The CRM labels the organization "Staffing / Recruiting" but nothing else says it is a search firm. That label is
   * also on some employers (the import tagged an employer's own recruiters that way), so it only counts for the
   * people who lead a firm, not for an employer's talent-acquisition staff.
   */
  labelledRecruitingFirm?: boolean
}

const FIRM_LEADER = /\b(managing (director|partner|principal)|partner|principal|founder|owner|president|ceo|chairman|chair|managing member)\b/i

/**
 * Anyone who works at a search or recruiting firm is a recruiter, except the firm's back office. At an employer,
 * only talent-acquisition staff are recruiters, and they are in-house.
 */
export function classifyRecruiter({ title, atSearchFirm, labelledRecruitingFirm }: KindInput): RecruiterKind {
  const t = (title ?? '').trim()
  if (/office contact/i.test(t)) return 'recruiter'
  if (SUPPORT.test(t) && !/recruit|search (consultant|partner)|executive search|talent acquisition/i.test(t)) return 'support'
  const firm = atSearchFirm || (!!labelledRecruitingFirm && FIRM_LEADER.test(t))
  if (firm) return HR.test(t) && !PLACES.test(t) ? 'support' : 'recruiter'
  if (IN_HOUSE_TA.test(t) && !/human resources officer|chro/i.test(t)) return 'in_house'
  if (HR.test(t)) return 'hr'
  return 'unclear'
}
