// Upgrade offers tied to what a member's own data says they need, not a calendar.
// Pure rules live here; src/lib/upgrade-offer/signals.ts reads the data.
//
// Cadence is deliberately light: members already get a weekday rotation, so an
// offer is one more email at most every three weeks, four in four months, and
// only when there is a real reason in their numbers.

export const OFFER_MIN_GAP_DAYS = 21
export const OFFER_MAX_PER_WINDOW = 4
export const OFFER_WINDOW_DAYS = 120
/** Nobody gets an offer in their first two weeks. */
export const OFFER_MIN_TENURE_DAYS = 14

const DAY = 86_400_000

export type OfferTrigger = 'narrow_market' | 'quiet_network' | 'long_search'

export type OfferSignals = {
  /** Open roles in their market; null when unknown. */
  openRoles: number | null
  roleLabel: string | null
  placeLabel: string | null
  /** Outreach entries (notes, calls, intros) logged in the last 14 days. */
  outreachLast14: number
  /** Saved network contacts. */
  contacts: number
  /** Days since registration finished. */
  tenureDays: number
  /** Opened NextChapter in the last 14 days. */
  activeRecently: boolean
}

export type OfferHistory = { sentAt: Date[] }

export function offerAllowed(history: OfferHistory, tenureDays: number, now: Date): boolean {
  if (tenureDays < OFFER_MIN_TENURE_DAYS) return false
  const sorted = [...history.sentAt].sort((a, b) => b.getTime() - a.getTime())
  if (sorted[0] && now.getTime() - sorted[0].getTime() < OFFER_MIN_GAP_DAYS * DAY) return false
  const inWindow = sorted.filter((d) => now.getTime() - d.getTime() < OFFER_WINDOW_DAYS * DAY).length
  return inWindow < OFFER_MAX_PER_WINDOW
}

/** Every trigger the member's data supports, in priority order. */
export function eligibleTriggers(s: OfferSignals): OfferTrigger[] {
  // Someone who has not opened the product in two weeks gets the win-back
  // sequence, not a sales email.
  if (!s.activeRecently) return []
  const out: OfferTrigger[] = []
  if (s.openRoles !== null && s.openRoles < 25 && s.roleLabel) out.push('narrow_market')
  if (s.outreachLast14 < 2) out.push('quiet_network')
  if (s.tenureDays >= 56) out.push('long_search')
  return out
}

/**
 * One trigger per send. Rotates by how many offers they have already had, so the
 * same reason never repeats back to back when another one applies.
 */
export function pickTrigger(eligible: OfferTrigger[], offersSent: number): OfferTrigger | null {
  if (eligible.length === 0) return null
  return eligible[offersSent % eligible.length]
}

export type OfferCopy = {
  subject: string
  preheader: string
  headline: string
  intro: string
  /** The number or phrase shown big in the hero card, with its caption. */
  hero: { value: string; caption: string }
  features: { title: string; body: string; tile: string }[]
}

export function offerCopy(trigger: OfferTrigger, s: OfferSignals, firstName: string | null): OfferCopy {
  const name = firstName ? `${firstName}, ` : ''
  const role = s.roleLabel?.toLowerCase() ?? 'your kind of'
  const place = s.placeLabel ?? 'your market'
  if (trigger === 'narrow_market') {
    return {
      subject: `${s.openRoles} open roles is not many`,
      preheader: 'A coach widens a small market. Here is how.',
      headline: `${name}your market is small, so each application counts more`,
      intro: `Right now there are about ${s.openRoles} open ${role} roles at your level in ${place}. With a pool that size, one or two rejections can stall a search. A coach helps you widen it without watering down what you want.`,
      hero: { value: String(s.openRoles), caption: `open ${role} roles in ${place}` },
      features: [
        { title: 'Widen the market, on purpose', body: 'Your coach reads your skills against adjacent roles and nearby markets and tells you which are worth pursuing.', tile: 'Wider pool' },
        { title: 'Make every application count', body: 'Resume review and per-job tailoring, so the few roles you apply to get your best shot.', tile: 'Tailored' },
        { title: 'Mock interviews with feedback', body: 'With fewer chances, you should not practice on a real one.', tile: 'Practice' },
      ],
    }
  }
  if (trigger === 'quiet_network') {
    return {
      subject: 'Most offers come through people. Yours is quiet.',
      preheader: 'Help working your network, from someone who does this daily.',
      headline: `${name}your network is where the next offer is most likely to come from`,
      intro: `You have ${s.contacts === 0 ? 'no contacts saved' : `${s.contacts} ${s.contacts === 1 ? 'contact' : 'contacts'} saved`} and ${s.outreachLast14 === 0 ? 'no outreach' : 'one outreach'} logged in the last two weeks. That is normal. Reaching out is the part most people put off. A coach makes it a weekly habit and writes the first message with you.`,
      hero: { value: String(s.outreachLast14), caption: 'conversations started in the last 14 days' },
      features: [
        { title: 'Know who to contact first', body: 'Your coach goes through your connections with you and picks the ones most likely to open a door.', tile: 'Warm intros' },
        { title: 'Messages that get answers', body: 'Short, specific notes that make a reply easy, drafted together and sent from your own account.', tile: 'Outreach' },
        { title: 'A weekly rhythm', body: 'A standing session keeps outreach going on the weeks you would rather skip it.', tile: 'Weekly' },
      ],
    }
  }
  return {
    subject: 'Eight weeks in. Want a second set of eyes?',
    preheader: 'When a search runs long, an outside view usually finds the stuck part.',
    headline: `${name}when a search runs long, something specific is usually stuck`,
    intro: 'You have been at this for two months. That is common, and it is also the point where an outside view pays off most: a coach looks at your resume, your pipeline and your outreach and names the one thing to change.',
    hero: { value: `${Math.floor(s.tenureDays / 7)} weeks`, caption: 'into your search' },
    features: [
      { title: 'A diagnosis, not a pep talk', body: 'Your coach reviews where applications stall: no replies, no interviews, or no offers. Each has a different fix.', tile: 'Diagnose' },
      { title: 'Interview reps with feedback', body: 'Recorded mock interviews, scored, so you can see what to tighten.', tile: 'Practice' },
      { title: 'Help through the offer', body: 'Negotiation support at offer stage, so you do not leave money on the table.', tile: 'Negotiate' },
    ],
  }
}
