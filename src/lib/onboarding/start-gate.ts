// The email capture that opens when someone clicks "Get my Market Reality Assessment" (or any button that starts
// registration) on a public page. Owner decision 2026-11-05: a call to action opens a small email box in place, with the
// payoff for giving it, instead of a new page; the registration path that follows then restates a bigger payoff. Pure.

/** Set (readable by script, 30 days) once an address has been given, so the same visitor is never asked twice. */
export const START_COOKIE = 'nc_started'
export const START_COOKIE_MAX_AGE = 30 * 24 * 60 * 60
export const START_EVENT = 'nc:start-gate'

export interface StartGateDetail {
  /** Where the click would have gone: always an /onboarding/ path. */
  href: string
  /** Which button on which page: becomes `from=` on the way in and the source on the lead. */
  source: string
  /** The situation the page already knows (a journey page), for the headline. */
  situation?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isEmail = (v: string) => EMAIL_PATTERN.test(v.trim())

/** Adds `from=<source>` to the destination unless it already names one. Only /onboarding/ paths are ever followed. */
export function startDestination(href: string, source: string): string {
  const path = href.startsWith('/onboarding/') ? href : '/onboarding/desire'
  if (/[?&]from=/.test(path)) return path
  const joiner = path.includes('?') ? '&' : '?'
  return `${path}${joiner}from=${encodeURIComponent(source.slice(0, 60))}`
}

/** What they get, in the order the product delivers it. Each line rests on something the onboarding really produces (payoff.ts). */
export const START_PAYOFF = [
  'The open jobs that fit you, with the reason each one fits',
  'A first-week plan written for your situation',
  'A starting grade, if you add a résumé',
] as const

export const START_COPY = {
  eyebrow: 'Free · about 5 minutes',
  headline: 'See where you stand in today’s job market',
  intro: 'Your Market Reality Assessment shows:',
  emailLabel: 'Your email',
  emailHelp: 'We save your place so you can pick up where you left off.',
  action: 'Start my assessment',
  skip: 'Continue without saving',
} as const
