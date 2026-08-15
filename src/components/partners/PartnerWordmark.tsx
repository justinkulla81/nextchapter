import { cn } from '@/lib/utils'

// Partners Master Build Script §B3.2 — "NextChapter · Coaches": bold
// "Next", regular "Chapter" (the candidate-side wordmark, unchanged —
// see Logo.tsx), then a qualifier in Inter regular at 70% opacity and
// 0.7x the wordmark size, separated by a thin vertical rule. Partner-only
// — the candidate side keeps the bare wordmark.
//
// Qualifier labels match the existing "NextChapter for X" copy already
// used across each portal's own login/signup pages (grep confirmed):
// "NextChapter for Coaches" / "for Recruiters" / "for Employers". Talent's
// product identity is out of scope for this phase (see route README /
// build script boundary) — "Employers" is the dominant existing label
// there (4 of 5 occurrences), not a new naming decision.
const QUALIFIER_LABEL = {
  coach: 'Coaches',
  recruiter: 'Recruiters',
  employer: 'Employers',
  admin: 'Admin',
  hiring: 'Hiring',
} as const

export type PartnerSurface = keyof typeof QUALIFIER_LABEL

// Partners Master Build Script §B5 — the per-surface accent shows up in
// exactly two places: this vertical rule (part of "the wordmark qualifier
// area") and the left-nav accent rule in each *Nav sidebar. Never in
// buttons, charts, or data viz.
const SURFACE_ACCENT_RULE: Record<PartnerSurface, string> = {
  coach: 'bg-accent-coach',
  recruiter: 'bg-accent-recruiter',
  employer: 'bg-accent-employer',
  admin: 'bg-accent-admin',
  hiring: 'bg-accent-hiring',
}

export function PartnerWordmark({
  surface,
  className,
}: {
  surface: PartnerSurface
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-2 text-white', className)}>
      <span className="font-bold tracking-tight">
        Next<span className="font-normal">Chapter</span>
      </span>
      <span aria-hidden="true" className={cn('h-[0.8em] w-px self-center', SURFACE_ACCENT_RULE[surface])} />
      <span className="text-[0.7em] font-normal text-white/70">{QUALIFIER_LABEL[surface]}</span>
    </span>
  )
}
