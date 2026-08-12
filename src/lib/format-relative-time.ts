// "1 day ago", "3 weeks ago" — coarse, human-scale recency for list rows
// where an exact timestamp would be noise (follow-up reminders, activity
// feeds). Not for anything requiring precision to the minute/hour.
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`

  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks === 1) return '1 week ago'
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths <= 1) return '1 month ago'
  return `${diffMonths} months ago`
}
