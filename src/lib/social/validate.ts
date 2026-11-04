import { longestLink, type Fact } from '@/lib/social/facts'

export const LINK_TOKEN = '{LINK}'
/** Bluesky's limit; the tightest of the channels that count the whole link. */
export const MAX_POST = 300

const numbers = (s: string): string[] => (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((x) => x.replace(/,/g, '').replace(/\.0+$/, ''))

/** Filler about what is or is not known or reported: a claim the facts never made, and the number check cannot see it. */
export const FILLER = /\b(no|not|without|nothing)\b[^.]{0,40}\b(further|additional|more|other)\b[^.]{0,30}\b(detail|details|breakdown|information|info|specifics)\b|\b(has|have|had)\s+not\s+(yet\s+)?been\s+(reported|disclosed|confirmed|detailed|made public)|\bnot\s+(yet\s+)?(clear|known|disclosed|confirmed)\b|\bremains?\s+to\s+be\s+seen\b|\bas\s+reported\b|\bfigure\s+(is\s+)?as\s+(it\s+was\s+)?reported\b/i

export type DraftCheck = { ok: true } | { ok: false; reason: string }

/**
 * A draft is only posted if it keeps to the facts it was given: every number is one of the fact's numbers, the link appears once as
 * the placeholder, it fits every channel with the longest link, and it carries none of the tells of a machine-written post.
 */
export function checkDraft(body: string, fact: Fact): DraftCheck {
  if (body.split(LINK_TOKEN).length !== 2) return { ok: false, reason: `the link placeholder ${LINK_TOKEN} must appear exactly once` }
  if (/https?:\/\//i.test(body)) return { ok: false, reason: 'no web addresses, only the link placeholder' }
  const full = body.replace(LINK_TOKEN, longestLink(fact))
  if ([...full].length > MAX_POST) return { ok: false, reason: `too long: ${[...full].length} characters with the link, the limit is ${MAX_POST}` }
  if (body.replace(LINK_TOKEN, '').trim().length < 40) return { ok: false, reason: 'too short to say anything' }
  if (/[#—–]|\p{Extended_Pictographic}/u.test(body)) return { ok: false, reason: 'no hashtags, emojis or dashes' }
  if (/!/.test(body)) return { ok: false, reason: 'no exclamation marks' }
  if (FILLER.test(body)) return { ok: false, reason: 'do not say what has or has not been reported or detailed: say only what the facts say' }
  const allowed = new Set(numbers(fact.lines.join(' ')))
  const extra = numbers(body).filter((x) => !allowed.has(x))
  if (extra.length) return { ok: false, reason: `these numbers are not in the facts: ${[...new Set(extra)].join(', ')}` }
  return { ok: true }
}
