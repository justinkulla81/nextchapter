import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import { workSimilarity } from '@/lib/profile/people-like-you'
import { workProfile } from '@/lib/profile/work-profile'

const p = (social: number, risk: number, setting: number) => workProfile({ workStyleAnswers: { social: { value: social }, risk: { value: risk }, setting: { value: setting } } })

describe('work similarity', () => {
  it('identical answers are 1, opposite answers 0', () => {
    expect(workSimilarity(p(2, 2, 2), p(2, 2, 2))).toBe(1)
    expect(workSimilarity(p(2, 2, 2), p(-2, -2, -2))).toBe(0)
  })
  it('needs at least three shared dimensions', () => {
    expect(workSimilarity(workProfile({ workStyleAnswers: { social: { value: 2 } } }), p(2, 2, 2))).toBeNull()
  })
})
