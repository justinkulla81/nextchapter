import { describe, expect, it } from 'vitest'
import { isGenericTitle, roleForPosting, roleForTitle, titleVariants } from '@/lib/pivots/pivot-map'

describe('placing a job in the pivot map', () => {
  it('reads the part after a comma or dash', () => {
    expect(titleVariants('Director, Finance')).toContain('director of finance')
    expect(roleForTitle('Director, Finance')).toBe('finance_accounting')
    expect(roleForTitle('Senior Manager - Product Marketing')).toBe('product_marketing')
  })
  it('falls back to the board function, then the description for a bare title', () => {
    expect(roleForPosting('Senior Analyst, AML', null, 'Finance')).toBe('finance_accounting')
    expect(isGenericTitle('Senior Director')).toBe(true)
    expect(isGenericTitle('Director of Finance')).toBe(false)
    const desc = 'We need a data analyst. The data analyst builds dashboards. As our data analyst you will write SQL.'
    expect(['data_analyst', 'data_analytics']).toContain(roleForPosting('Director', desc, null))
    expect(roleForPosting('Director', 'Join a great team of veterans and partners.', null)).toBeNull()
  })
})
