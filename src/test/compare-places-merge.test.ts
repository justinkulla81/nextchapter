import { describe, expect, it } from 'vitest'
import { compareHref } from '@/lib/workforce/metro-compare'

describe('compare places lives on Your move plan', () => {
  it('builds addresses on the move plan page with the compare tab', () => {
    expect(compareHref([], 'job')).toBe('/dashboard/move-plan?tab=compare')
    expect(compareHref(['12060', '19100'], 'life')).toBe('/dashboard/move-plan?tab=compare&m=12060%2C19100&lens=life')
  })
})
