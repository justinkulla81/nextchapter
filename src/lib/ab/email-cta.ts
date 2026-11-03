import { NAV_CTA_LABEL, type NavCtaVariant } from '@/lib/ab/nav-cta'

// The email arm of the assessment button label test (see nav-cta.ts for the web arm). An email
// cannot read the browser's saved arm, so the recipient's address picks it: the same address
// always gets the same arm, spread evenly over the four. Only the button text changes; the link
// is tagged utm_content=cta_<arm> so a visit shows which label brought it.
const ARMS: NavCtaVariant[] = ['control', 'hire_score', 'resume_score', 'join_free']

export function emailCtaVariant(email: string): NavCtaVariant {
  let h = 2166136261
  for (const ch of email.trim().toLowerCase()) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return ARMS[(h >>> 0) % ARMS.length]
}

/** The arm's label, or `control` (the email's own wording) for the control arm. */
export function emailCtaLabel(variant: NavCtaVariant | undefined, control: string): string {
  return variant && variant !== 'control' ? NAV_CTA_LABEL[variant] : control
}
