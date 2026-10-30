import { ownText, classifyReply, REFERRAL, POSITIVE } from './reply-class'

/** What a person writes, in their own words, when they want to be left alone. A bare "yes" is never one: it could answer the call ask. */
const OPT_OUT = /\bunsubscribe\b|remove (me|us)\b|remove (my|our) (e-?mail|address|name)|take (me|us) off|stop (e-?mailing|sending|contacting|writing)|do(n'?t| not) (contact|e-?mail|write)|please stop|\bnot interested\b|no,? thanks|no,? thank you/
/** The whole reply is just the word: "No", "Stop.", "Remove". */
const BARE = /^(please\s+)?(no|stop|remove|unsubscribe|opt out)(\s+(me|please|thanks|thank you))?[\s.!]*$/

/**
 * True only for a short, plain request to stop: the reply is a clear no (see classifyReply), says so in one of the phrases above, and does
 * not hand the sender to someone else, ask a question or show interest. Anything murkier is left alone for a person to read.
 */
export function isOptOutReply(subject: string | null | undefined, body: string | null | undefined): boolean {
  const own = ownText(subject, body)
  const typed = own.split('\n').slice(1).join(' ').replace(/\s+/g, ' ').trim()
  if (typed.length > 400) return false
  if (BARE.test(typed)) return true
  if (!OPT_OUT.test(own)) return false
  return classifyReply(subject, body) === 'no' && !REFERRAL.test(own) && !POSITIVE.test(own.replace(OPT_OUT, '')) && !typed.includes('?')
}
