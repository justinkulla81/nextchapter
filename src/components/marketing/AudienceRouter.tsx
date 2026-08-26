import Link from 'next/link'
import { cn } from '@/lib/utils'

// Partners Master Build Script §C3.1, section 7 — "audience router: clean
// cards: Employers · Coaches · Recruiters · Alumni." Each card's accent
// uses the same per-surface accent token the partner portals themselves
// use (§B5), so the color already means the same thing by the time
// someone reaches that portal.
const AUDIENCE_CARDS = [
  { label: 'Employers', href: '/outplacement', accent: 'bg-accent-employer', blurb: 'Outplacement that produces proof, not a portal.' },
  { label: 'Coaches', href: '/coaches', accent: 'bg-accent-coach', blurb: 'Stop rebuilding context before every session.' },
  { label: 'Recruiters', href: '/recruiters', accent: 'bg-accent-recruiter', blurb: 'Candidates who arrive with references already done.' },
  { label: 'Alumni', href: '/membership', accent: 'bg-accent-admin', blurb: 'Never start from zero again.' },
] as const

export function AudienceRouter() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {AUDIENCE_CARDS.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group flex flex-col rounded-xl border border-light-gray bg-white p-5 text-left shadow-sm transition-all hover:border-brand hover:shadow-md"
        >
          <span aria-hidden="true" className={cn('mb-3 h-1 w-8 rounded-full', card.accent)} />
          <p className="font-semibold text-navy">{card.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{card.blurb}</p>
          <span
            aria-hidden="true"
            className="mt-3 text-sm text-brand transition-transform group-hover:translate-x-0.5"
          >
            Learn more →
          </span>
        </Link>
      ))}
    </div>
  )
}
