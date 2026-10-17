// How much a supporter can see. The member picks, per person, and can change it any time.
// None of the levels ever shows names, companies, messages or setbacks.
export type ShareLevel = 'cheers' | 'weekly' | 'close'
export type Relationship = 'partner' | 'family' | 'friend' | 'coach'

export const RELATIONSHIPS: { key: Relationship; label: string; defaultLevel: ShareLevel }[] = [
  { key: 'partner', label: 'Partner', defaultLevel: 'close' },
  { key: 'family', label: 'Family', defaultLevel: 'weekly' },
  { key: 'friend', label: 'Friend', defaultLevel: 'weekly' },
  { key: 'coach', label: 'Coach', defaultLevel: 'weekly' },
]

export const LEVELS: { key: ShareLevel; label: string; sees: string }[] = [
  { key: 'cheers', label: 'Cheers only', sees: 'They can send you a cheer. They see nothing about your search.' },
  { key: 'weekly', label: 'Weekly update', sees: 'One short note a week: minutes, days active, actions done. Numbers only.' },
  { key: 'close', label: 'Close', sees: 'The weekly update, plus what you need today, ways to help, and wins you choose to share.' },
]

export const levelLabel = (l: ShareLevel) => LEVELS.find((x) => x.key === l)!.label
export const relationshipLabel = (r: Relationship) => RELATIONSHIPS.find((x) => x.key === r)!.label
