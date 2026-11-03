// One colour per ranking family, so the hub and the cards read as a set instead of one grey list. Tints only: the single
// accent colour stays reserved for actions.
export const FAMILY_TONE: Record<string, { card: string; label: string }> = {
  'Entry-level': { card: 'bg-tint-mint', label: 'text-tint-mint-ink' },
  Levels: { card: 'bg-tint-plum', label: 'text-tint-plum-ink' },
  AI: { card: 'bg-tint-sky', label: 'text-navy' },
  'AI skills': { card: 'bg-tint-sky', label: 'text-navy' },
  Pay: { card: 'bg-tint-sun', label: 'text-tint-sun-ink' },
  'Work style': { card: 'bg-tint-plum', label: 'text-tint-plum-ink' },
  'Job families': { card: 'bg-tint-mint', label: 'text-tint-mint-ink' },
  Markets: { card: 'bg-tint-sky', label: 'text-navy' },
  Industries: { card: 'bg-tint-plum', label: 'text-tint-plum-ink' },
  'Industry markets': { card: 'bg-tint-plum', label: 'text-tint-plum-ink' },
  'Best overall': { card: 'bg-tint-sun', label: 'text-tint-sun-ink' },
  Growth: { card: 'bg-tint-sun', label: 'text-tint-sun-ink' },
}
export const toneOf = (family: string) => FAMILY_TONE[family] ?? { card: 'bg-tint-sky', label: 'text-navy' }

/** Month chips cycle through the four tints. */
export const MONTH_TINTS = ['bg-tint-sky', 'bg-tint-sun', 'bg-tint-mint', 'bg-tint-plum'] as const
