import { describe, expect, it } from 'vitest'
import { layoffGroupKey } from '@/lib/seo/employer-rankings'

describe('layoffGroupKey', () => {
  it('merges name variants of one employer', () => {
    expect(layoffGroupKey('barclays bank')).toBe(layoffGroupKey('barclays'))
    expect(layoffGroupKey('amex')).toBe(layoffGroupKey('american express'))
  })
  it('keeps different employers apart', () => {
    expect(layoffGroupKey('american express')).not.toBe(layoffGroupKey('american airlines'))
  })
})
