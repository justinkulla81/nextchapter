/** What a reply to a cold email is, from its own text. */
export type ReplyClass = 'positive' | 'referral' | 'question' | 'no' | 'auto' | 'other'

/** The part of a reply the person wrote, without the quoted message under it. */
export function ownText(subject: string | null | undefined, body: string | null | undefined): string {
  const raw = (body ?? '').replace(/&#39;/g, "'")
  const cut = raw.split(/\bOn\s.{4,140}?\bwrote:|-{2,}\s*Original Message|\bFrom:\s.{0,200}?\bSent:|^>.*$/im)[0]
  return `${subject ?? ''}\n${cut}`.toLowerCase()
}

const AUTO = /out of (the )?office|automatic reply|auto-?reply|autoreply|on (annual |parental |maternity )?leave|vacation|away from (my|the) (desk|office)|no longer (with|at) |undeliverable|delivery (status|failure)|mailer-daemon|postmaster|do not reply to this/
const NO = /\bunsubscribe\b|remove me|take me off|stop (emailing|sending|contacting)|do not (contact|email)|don'?t (contact|email)|not interested|no thanks|no,? thank you|please stop|\bnot a fit\b|not (looking|hiring|needed)|we('| a)re all set|already (have|use|working with)/
export const REFERRAL = /(forward(ed|ing)|cc'?(ing|ed)|looping in|copying) |you should (talk|speak|reach out) to|the right person|better (person|contact)|reach out to|please contact|pass(ing)? (this|you) (on|along)|owns (this|the transition)/
export const POSITIVE = /\binterested\b|sounds (good|great|interesting)|happy to|please send|send (me |us )?(the |a |over )?(one-?pager|overview|summary|details|more|info|demo|link|handout)|tell me more|let'?s (talk|chat|connect|set up|schedule)|set up a (call|time|meeting)|schedule|\bcalendar\b|book (a )?(call|time)|\bdemo\b|free (this|next|on)|would (love|like) to|yes[,.! ]|\byes\b/

/** Sorted in this order: automatic mail first, then a clear no, a hand-off to someone else, interest, a question, anything else. */
export function classifyReply(subject: string | null | undefined, body: string | null | undefined): ReplyClass {
  const t = ownText(subject, body)
  if (AUTO.test(t)) return 'auto'
  if (NO.test(t) && !POSITIVE.test(t.replace(NO, ''))) return 'no'
  if (REFERRAL.test(t)) return 'referral'
  if (POSITIVE.test(t)) return 'positive'
  if (t.includes('?')) return 'question'
  return 'other'
}

/** "Reply: positive" on the inbound activity's outcome, and how to read it back. */
export const replyOutcome = (c: ReplyClass) => `Reply: ${c}`
export function replyClassOf(outcome: string | null | undefined): ReplyClass | null {
  const m = /^Reply: (positive|referral|question|no|auto|other)/.exec(outcome ?? '')
  return (m?.[1] as ReplyClass | undefined) ?? null
}
