// Why hire me: the proof marks that set top candidates apart, and where this person stands on them. Pure; the loader
// (why-hire-load.ts) gathers the inputs. Each mark is something a hiring manager can check, not a self-rating, and each
// one has a single step that earns it.

export type MarkKey = 'references' | 'results' | 'measured' | 'scale' | 'pitch'

export interface Mark {
  key: MarkKey
  label: string
  /** Why it counts, from the employer's side. */
  why: string
  /** The step that earns it. */
  step: string
  href: string
  done: boolean
}

export interface StandingInput {
  completedReferences: number
  /** Latest résumé's results score (0-100), null when there is no analysed résumé. */
  resumeResultsScore: number | null
  hasPerformance: boolean
  hasTrackRecord: boolean
  hasPitch: boolean
}

// In the order they move a candidate most: what others say about you outweighs anything you say yourself.
export function standingMarks(i: StandingInput): Mark[] {
  return [
    {
      key: 'references',
      label: 'Two people vouch for you',
      why: 'What others say about you counts more than anything you say yourself.',
      step: i.completedReferences === 1 ? 'Ask one more reference' : 'Ask two references',
      href: '/dashboard/references',
      done: i.completedReferences >= 2,
    },
    {
      key: 'results',
      label: 'Your résumé shows results in numbers',
      why: 'A hiring manager remembers “cut costs 18%”, not “responsible for costs”.',
      step: 'Put numbers on your results',
      href: '/dashboard/resume',
      done: (i.resumeResultsScore ?? 0) >= 70,
    },
    {
      key: 'measured',
      label: 'Your strengths are measured',
      why: 'How I Perform compares you with people in your field, so your strengths rest on more than your word.',
      step: 'Take How I Perform (10 minutes)',
      href: '/dashboard/how-i-perform',
      done: i.hasPerformance,
    },
    {
      key: 'scale',
      label: 'The scale you have worked at is on record',
      why: 'Team size, budget and the largest project you ran tell an employer what you can take on from day one.',
      step: 'Fill in Track Record (5 minutes)',
      href: '/dashboard/track-record',
      done: i.hasTrackRecord,
    },
    {
      key: 'pitch',
      label: 'You can say it in 30 seconds',
      why: 'Most jobs are found through people. They can only pass you on if they can repeat why you.',
      step: 'Write your pitch',
      href: '/dashboard/strengths?part=pitch',
      done: i.hasPitch,
    },
  ]
}

/** How many members have each number of marks (0..5), across a peer group. */
export type MarkDistribution = Record<number, number>

export interface PeerStanding {
  /** Who the comparison is against: "people in operations" or "NextChapter members". */
  group: string
  peers: number
  /** Share of peers with fewer marks than this person (0..1). */
  aheadOf: number
  /** Share of peers with every mark (0..1). */
  withAll: number
}

export const MIN_PEERS = 20

// `mine` is this person's count; the distribution includes them, so they are taken out of their own bucket first.
export function peerStanding(dist: MarkDistribution | null, mine: number, total: number, group: string): PeerStanding | null {
  if (!dist) return null
  const counts = { ...dist }
  if ((counts[mine] ?? 0) > 0) counts[mine] -= 1
  const peers = Object.values(counts).reduce((a, b) => a + b, 0)
  if (peers < MIN_PEERS) return null
  const fewer = Object.entries(counts).reduce((n, [k, v]) => (Number(k) < mine ? n + v : n), 0)
  return { group, peers, aheadOf: fewer / peers, withAll: (counts[total] ?? 0) / peers }
}

/** "1 in 25", "fewer than 1 in 100": a small share said the way people say it. */
export function oneIn(share: number): string {
  if (share <= 0) return 'almost no one'
  if (share < 0.01) return 'fewer than 1 in 100'
  const n = Math.round(1 / share)
  return n <= 1 ? 'most people' : `1 in ${n}`
}
