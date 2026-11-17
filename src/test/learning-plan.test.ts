import { describe, expect, it } from 'vitest'
import { MAX_PLAN, addBlocked, cleanTitle, cleanUrl, isPlanStatus, planOrder, skillsForTitle } from '@/lib/learning/plan'

describe('learning plan', () => {
  it('reads the skills a course title names', () => {
    expect(skillsForTitle('Learn supply chain analytics')).toContain('Supply chain and logistics')
    expect(skillsForTitle('Python for operations')).toContain('Python')
    expect(skillsForTitle('Lean Six Sigma green belt')).toContain('Process improvement (Lean, Six Sigma)')
    expect(skillsForTitle('Presenting to a board')).toEqual([])
  })
  it('caps the plan and says what to do, but never errors on a repeat', () => {
    expect(addBlocked(MAX_PLAN - 1, false)).toBeNull()
    expect(addBlocked(MAX_PLAN, false)).toMatch(/Remove one/)
    expect(addBlocked(MAX_PLAN, true)).toBeNull()
  })
  it('knows the three statuses', () => {
    expect(isPlanStatus('STARTED')).toBe(true)
    expect(isPlanStatus('FINISHED')).toBe(false)
  })
  it('cleans the title and only accepts web links', () => {
    expect(cleanTitle('  a\n  b ')).toBe('a b')
    expect(cleanTitle('x'.repeat(300))).toHaveLength(160)
    expect(cleanUrl('https://www.coursera.org/learn/x')).toBe('https://www.coursera.org/learn/x')
    expect(cleanUrl('javascript:alert(1)')).toBeNull()
    expect(cleanUrl('not a link')).toBeNull()
  })
  it('puts started first, then planned, done last', () => {
    const d = (n: number) => new Date(2026, 10, n)
    const rows = [
      { id: 'a', status: 'DONE', createdAt: d(1) },
      { id: 'b', status: 'PLANNED', createdAt: d(2) },
      { id: 'c', status: 'STARTED', createdAt: d(3) },
      { id: 'd', status: 'PLANNED', createdAt: d(4) },
    ]
    expect(planOrder(rows).map((r) => r.id)).toEqual(['c', 'd', 'b', 'a'])
  })
})
