// Short handwritten asides for the personal emails. Each one is a plain reading of the numbers in the email, never a claim the email does not make.

/** Midweek check-in: how far along the week's points are. */
export function checkinNoteText(points: number, target: number): string {
  if (target <= 0) return 'one small thing is enough'
  if (points >= target) return 'you hit the mark this week'
  if (points * 2 >= target) return 'past the halfway mark'
  if (points > 0) return 'a start is a start'
  return 'one small thing is enough'
}

/** Weekly nudge: how big the gap to an A is. */
export function nudgeNoteText(pointsToGo: number, target: number): string {
  if (target <= 0 || pointsToGo <= 0) return 'nothing left to close'
  if (pointsToGo * 4 <= target) return 'a small gap, easy to close'
  if (pointsToGo * 2 <= target) return 'less than half to go'
  return 'a few good days will do it'
}
