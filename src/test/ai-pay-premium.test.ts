import { describe, expect, it } from 'vitest'
import { computeAiPayPremium, mentionsAiSkill, type PremiumPosting } from '@/lib/market/ai-pay-premium'

const post = (title: string, mid: number, ai: boolean): PremiumPosting => ({
  title,
  description: ai ? 'You will use generative AI tools daily.' : 'You will own the budget.',
  skills: [],
  salaryMin: mid - 10_000,
  salaryMax: mid + 10_000,
  salaryCurrency: 'USD',
})
const many = (n: number, title: string, mid: number, ai: boolean) => Array.from({ length: n }, () => post(title, mid, ai))

describe('mentionsAiSkill', () => {
  it('finds AI skill wording', () => {
    expect(mentionsAiSkill({ title: 'Director of Finance', description: 'Experience with machine learning', skills: [] })).toBe(true)
    expect(mentionsAiSkill({ title: 'Finance Manager', description: 'Use ChatGPT for variance memos', skills: [] })).toBe(true)
  })
  it('does not fire on look-alikes', () => {
    expect(mentionsAiSkill({ title: 'Marketing Manager', description: 'Maintain brand, retail, and email', skills: [] })).toBe(false)
    expect(mentionsAiSkill({ title: 'Chief Aide', description: 'Mountain trail program', skills: [] })).toBe(false)
  })
})

describe('computeAiPayPremium', () => {
  it('measures the difference within level', () => {
    const rows = computeAiPayPremium([
      ...many(6, 'Finance Manager', 132_000, true),
      ...many(6, 'Finance Manager', 120_000, false),
    ])
    const fin = rows.find((r) => r.function === 'Finance')
    expect(fin?.premiumPct).toBe(10)
  })

  it('is not fooled by AI postings simply being more senior', () => {
    const rows = computeAiPayPremium([
      ...many(6, 'Finance Director', 200_000, true),
      ...many(6, 'Finance Manager', 120_000, false),
      ...many(3, 'Finance Director', 200_000, false),
      ...many(3, 'Finance Manager', 120_000, true),
    ])
    expect(rows.find((r) => r.function === 'Finance')?.premiumPct).toBe(0)
  })

  it('shows no number when either side is thin', () => {
    const rows = computeAiPayPremium([...many(2, 'Finance Manager', 140_000, true), ...many(10, 'Finance Manager', 120_000, false)])
    expect(rows.find((r) => r.function === 'Finance')?.premiumPct).toBeNull()
  })

  it('ignores implausible and non-USD ranges', () => {
    const bad = { ...post('Finance Manager', 100, true), salaryCurrency: 'EUR' }
    expect(computeAiPayPremium(Array.from({ length: 10 }, () => bad))).toEqual([])
  })
})
