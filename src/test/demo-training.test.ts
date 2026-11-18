import { describe, expect, it } from 'vitest'
import { demoTrainingOfferings } from '@/lib/workforce/demo-training'
import { ASSIGNMENTS, EXPERIENCE_BANDS, TRAINING_SOURCES } from '@/lib/workforce/training-rules'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

describe('demo training catalog', () => {
  const rows = demoTrainingOfferings('inst-1', 'Louisville')
  it('covers every source, both assignments and a NextChapter-built course', () => {
    for (const s of TRAINING_SOURCES) expect(rows.some((r) => r.source === s.key)).toBe(true)
    for (const a of ASSIGNMENTS) expect(rows.some((r) => r.assignment === a)).toBe(true)
    expect(rows.some((r) => r.ncCustom)).toBe(true)
  })
  it('uses only the values the Education Hub form allows', () => {
    for (const r of rows) {
      for (const l of r.levels) expect(EXPERIENCE_BANDS as readonly string[]).toContain(l)
      for (const i of r.industries) expect(INDUSTRY_BUCKET_NAMES as readonly string[]).toContain(i)
      for (const f of r.functions) expect(PRIMARY_FUNCTION_OPTIONS as readonly string[]).toContain(f)
    }
  })
  it('names no real provider: every provider is marked sample', () => {
    for (const r of rows) expect(r.provider).toMatch(/\(sample\)$/)
  })
})
