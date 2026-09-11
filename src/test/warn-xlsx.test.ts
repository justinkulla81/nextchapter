import { describe, it, expect } from 'vitest'
import { columnIndex } from '@/lib/warn/xlsx'

describe('columnIndex', () => {
  it.each([['A1', 0], ['B2', 1], ['Z9', 25], ['AA1', 26], ['AB1', 27], ['BA1', 52]])(
    '%s -> %i', (ref, expected) => expect(columnIndex(ref)).toBe(expected)
  )
})

describe('excelSerialToDate', () => {
  it('converts the serial numbers a real WARN report contains', async () => {
    const { excelSerialToDate } = await import('@/lib/warn/xlsx')
    // 46203 is what CA's file holds where the value reads 2026-06-30.
    expect(excelSerialToDate(46203)?.toISOString().slice(0, 10)).toBe('2026-06-30')
    expect(excelSerialToDate('46264')?.toISOString().slice(0, 10)).toBe('2026-08-30')
  })
  it('accepts ISO text, since not every state publishes serials', async () => {
    const { excelSerialToDate } = await import('@/lib/warn/xlsx')
    expect(excelSerialToDate('2026-03-01')?.toISOString().slice(0, 10)).toBe('2026-03-01')
  })
  it('rejects values that are not dates rather than inventing one', async () => {
    const { excelSerialToDate } = await import('@/lib/warn/xlsx')
    expect(excelSerialToDate('')).toBeNull()
    expect(excelSerialToDate(null)).toBeNull()
    expect(excelSerialToDate(12)).toBeNull()       // a duration, not a date
    expect(excelSerialToDate('Unspecified')).toBeNull()
  })
})

describe('isKnowledgeSector', () => {
  it('accepts the sectors our candidates actually work in', async () => {
    const { isKnowledgeSector } = await import('@/lib/warn/sources')
    expect(isKnowledgeSector('51 Information')).toBe(true)
    expect(isKnowledgeSector('54 Professional Scientific and Technical Services')).toBe(true)
    expect(isKnowledgeSector('52 Finance and Insurance')).toBe(true)
  })
  it('rejects sectors that produce real layoffs but not our candidates', async () => {
    const { isKnowledgeSector } = await import('@/lib/warn/sources')
    // A food-plant closure is a real layoff and a bad lead for this product.
    expect(isKnowledgeSector('72 Accommodation and Food Services')).toBe(false)
    expect(isKnowledgeSector('31-33 Manufacturing')).toBe(false)
    expect(isKnowledgeSector('48-49 Transportation and Warehousing')).toBe(false)
    expect(isKnowledgeSector(null)).toBe(false)
  })
})

describe('sectors excluded on evidence', () => {
  it('excludes health care and admin support', async () => {
    const { isKnowledgeSector } = await import('@/lib/warn/sources')
    // Both were in the list until a real filing set showed what they hold:
    // home care and post-acute rehab; sanitation and packaging.
    expect(isKnowledgeSector('62 Healthcare and Social Assistance')).toBe(false)
    expect(isKnowledgeSector('56 Administrative and Support')).toBe(false)
  })
})
