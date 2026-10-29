import { describe, expect, it } from 'vitest'
import { followUpKind, matchesFollowUpFilter } from '@/lib/crm/followup-kind'

describe('followUpKind', () => {
  it('reads the system notes and treats the rest as yours', () => {
    expect(followUpKind('P0 rapid response — layoff news: HSBC plans cuts')).toMatchObject({ type: 'layoffs', automated: true })
    expect(followUpKind('Claimed the Acme page. Reply today.')).toMatchObject({ type: 'claim', automated: true })
    expect(followUpKind('Asked to activate the Acme page. Reply today.')).toMatchObject({ type: 'claim', automated: true })
    expect(followUpKind('Replied to cold outreach (interested). Answer today.')).toMatchObject({ type: 'reply', automated: true })
    expect(followUpKind('Mon 10/12: send Kelly the monthly report')).toMatchObject({ type: 'yours', automated: false })
    expect(followUpKind(null).automated).toBe(false)
  })
  it('filters', () => {
    const layoffs = followUpKind('P0 rapid response — x')
    const mine = followUpKind('call back')
    expect(matchesFollowUpFilter(layoffs, 'layoffs')).toBe(true)
    expect(matchesFollowUpFilter(mine, 'layoffs')).toBe(false)
    expect(matchesFollowUpFilter(layoffs, 'yours')).toBe(false)
    expect(matchesFollowUpFilter(mine, 'yours')).toBe(true)
    expect(matchesFollowUpFilter(layoffs, 'automated')).toBe(true)
    expect(matchesFollowUpFilter(mine, 'all')).toBe(true)
  })
})
