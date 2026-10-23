// The one-line version of the member's market (market-size.ts), for Home and the top of the board: how many
// advertised roles fit, which way it is moving, and the one next step that fits what the number says.
// Pure: src/test/market-line.test.ts.
//
// The count is advertised roles only. Many senior roles are filled through search firms and people before
// they are ever posted, so the line says "advertised" instead of implying it is everything there is.

import type { MarketPrompt } from './market-size'

export type MarketStepKind = 'expand' | 'learn' | 'network' | 'narrow'

export interface MarketLineInput {
  open: number
  growth: number | null
  prompt: MarketPrompt
  /** The member is at VP / executive level, where unadvertised roles are a large share. */
  senior: boolean
}

export interface MarketLine {
  text: string
  why: string
  step: { kind: MarketStepKind; label: string; href: string }
}

const pct = (g: number) => `${Math.round(Math.abs(g) * 100)}%`

export function marketLine(i: MarketLineInput): MarketLine {
  const n = i.open.toLocaleString('en-US')
  const trend = i.growth === null || Math.abs(i.growth) < 0.1 ? null : i.growth > 0 ? `growing ${pct(i.growth)} faster than the rest of the market` : `shrinking, ${pct(i.growth)} slower than the rest of the market`
  const base = `About ${n} advertised role${i.open === 1 ? '' : 's'} fit${i.open === 1 ? 's' : ''} you${trend ? `, ${trend}` : ''}.`

  if (i.prompt === 'too_few') {
    return i.senior
      ? {
          text: base,
          why: 'There are few roles at your level in any field, and many are filled before they are advertised. Your next move is people: recruiters and introductions.',
          step: { kind: 'network', label: 'Reach the people who fill these roles', href: '/dashboard/network' },
        }
      : {
          text: base,
          why: 'That is few enough that one or two rejections stall your search. Widening the search is the fastest fix.',
          step: { kind: 'expand', label: 'See where to widen your search', href: '/dashboard/market' },
        }
  }
  if (i.prompt === 'shrinking') {
    return {
      text: base,
      why: 'This kind of work is losing roles against the rest of the market. The skills these jobs are moving toward are the way through.',
      step: { kind: 'learn', label: 'See the skills to add', href: '/dashboard/skills-assessments' },
    }
  }
  if (i.prompt === 'too_many') {
    return {
      text: base,
      why: 'More than anyone can work through. Narrowing to the roles you would win gets you further than applying to more.',
      step: { kind: 'narrow', label: 'Narrow to your best fits', href: '/dashboard/find-my-job#job-recommendations' },
    }
  }
  return {
    text: base,
    why: i.senior ? 'Introductions fill most roles at your level, so the number matters less than who you know at those companies.' : 'Most of these fill through someone who knows someone. Warm introductions beat cold applications.',
    step: { kind: 'network', label: 'See who to contact at these jobs', href: '/dashboard/find-my-job#job-recommendations' },
  }
}
