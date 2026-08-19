// Deliberately not a real institution logo — hotlinking or hosting a
// school/company's actual trademarked artwork without their permission
// isn't something to guess at, same call already made for the platform
// pills in LearningResourceCard (see PLATFORM_BADGE_STYLE's comment there).
// This gives each sponsor its own distinct color instead of every card
// showing identical plain uppercase text, without claiming to be their logo.
const PALETTE = ['#0F62FE', '#8A3FFC', '#B28600', '#DA1E28', '#198038', '#1192E8', '#EE538B', '#4589FF']

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function initials(sponsor: string): string {
  const words = sponsor.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0]! + words[1][0]!).toUpperCase()
}

export function SponsorBadge({ sponsor, size = 28 }: { sponsor: string; size?: number }) {
  const color = PALETTE[hashString(sponsor) % PALETTE.length]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-bold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(sponsor)}
    </span>
  )
}
