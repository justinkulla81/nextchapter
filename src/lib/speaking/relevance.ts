/**
 * How well a conference fits NextChapter's CEO as a speaker. Conservative on
 * purpose: this only decides which conference calls for speakers get put in
 * front of Justin, so it errs toward showing fewer, better ones.
 *
 * Returns null when the event has nothing to do with workforce, talent, higher
 * ed, academia, MBA programs, government, non-profits, edtech, AI-and-work or
 * career transition. (Widened 2026-10-27, Justin: academic, MBA, government,
 * non-profit and edtech conferences count.)
 */
const CORE = /\b(workforce|future of work|talent|human resources|\bhr\b|people analytics|outplacement|reskill|upskill|career|job seeker|hiring|recruit|learning (and|&) development|\bl&d\b|economic mobility)\b/i
const EDU = /\b(higher ed|higher education|university|college|career services|alumni|student success|academic|academia|faculty|mba|business school|management education)\b/i
const GOV = /\b(government|public sector|public policy|state agenc|federal|workforce board|economic development|civic|municipal)/i
const NONPROFIT = /\b(non-?profit|philanthropy|foundation|social impact|community college|social enterprise)/i
const EDTECH = /\b(ed ?tech|learning technology|learning innovation|digital learning|online learning)\b/i
const AI = /\b(artificial intelligence|\bai\b|generative|machine learning|automation)\b/i
const STARTUP = /\b(startup|founder|venture|saas|ed ?tech|hr ?tech|workforce tech)\b/i

export interface RelevanceInput {
  name: string
  whyAttend?: string | null
  industries?: string[]
  functions?: string[]
  segments?: string[]
  roles?: string[]
  importance?: number
}

export function speakerFit(e: RelevanceInput): { fit: 1 | 2 | 3; why: string } | null {
  const text = [e.name, e.whyAttend, ...(e.industries ?? []), ...(e.functions ?? []), ...(e.segments ?? []), ...(e.roles ?? [])]
    .filter(Boolean).join(' ')
  const core = CORE.test(text)
  const edu = EDU.test(text)
  const ai = AI.test(text)
  const startup = STARTUP.test(text)
  const gov = GOV.test(text)
  const nonprofit = NONPROFIT.test(text)
  const edtech = EDTECH.test(text)
  const hits = [core, edu, ai, startup, gov, nonprofit, edtech].filter(Boolean).length
  // AI or startups alone is not enough; one audience theme is.
  if (!core && !edu && !gov && !nonprofit && !edtech) return null
  const themes = [
    core && 'workforce and talent', edu && 'higher ed and academia', gov && 'government', nonprofit && 'non-profits',
    edtech && 'edtech', ai && 'AI and work', startup && 'startups',
  ].filter(Boolean)
  const fit = (e.importance === 1 && hits >= 2) || hits >= 3 ? 1 : hits >= 2 || e.importance === 1 ? 2 : 3
  return { fit: fit as 1 | 2 | 3, why: `Audience overlaps NextChapter on ${themes.join(' and ')}.` }
}
