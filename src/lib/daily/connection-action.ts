// A rotating daily nudge toward relationship-building and visibility habits
// — separate from getTodaysPrimaryAction (the job-search task pulled from the
// action plan). The search is isolating by default; this exists to push back
// on staying home alone and to reward the small habits (commenting, tagging)
// that compound the same way posting does, but get skipped because they
// don't feel like "real" progress.

export interface ConnectionAction {
  label: string
  detail: string
}

const CONNECTION_ACTIONS: ConnectionAction[] = [
  {
    label: 'Reach out to one person',
    detail: 'Message someone in your network just to reconnect — no ask needed yet.',
  },
  {
    label: 'Schedule a coffee or lunch',
    detail: 'Put a real date on the calendar with someone you know, this week if you can.',
  },
  {
    label: 'Ask an old boss or mentor to catch up',
    detail: 'A short "thinking of you, would love to catch up" goes further than you\'d expect.',
  },
  {
    label: 'Comment on 3 posts',
    detail: 'Thoughtful comments on your network\'s posts keep you visible without posting yourself.',
  },
  {
    label: 'Tag someone in a relevant conversation',
    detail: 'If a post reminds you of someone, tag them — it puts you in front of both your networks.',
  },
  {
    label: 'Offer to help someone else',
    detail: 'Introduce two people who should know each other, or pass a lead to someone else searching.',
  },
  {
    label: 'Get out of the house today',
    detail: 'Work from a coffee shop, library, or coworking space — isolation makes everything else harder.',
  },
  {
    label: 'Call instead of text',
    detail: 'Pick one person you\'ve only been texting and actually call them.',
  },
]

function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// Deterministic per candidate per day — same suggestion all day, a different
// one tomorrow, no state to track or button to wire up.
export function getTodaysConnectionAction(candidateId: string, date: Date = new Date()): ConnectionAction {
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const index = hashSeed(`${candidateId}-${dayKey}`) % CONNECTION_ACTIONS.length
  return CONNECTION_ACTIONS[index]
}
