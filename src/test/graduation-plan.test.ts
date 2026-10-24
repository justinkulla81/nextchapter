import { describe, expect, it } from 'vitest'
import { GRAD_PHASE_LABEL, SCHOOL_HELP, STUDENT_NOTE_STARTER, gradPhase, gradPlanItems, gradSteps, gradStepsByTrack, monthsToGraduation } from '@/lib/early-career/graduation-plan'

const now = new Date('2026-10-23T12:00:00Z')
const inMonths = (m: number) => new Date(now.getTime() + m * 30.44 * 86_400_000)

describe('where a student is on the way to graduation', () => {
  it('reads the phase from the graduation date', () => {
    expect(gradPhase(inMonths(18), now)).toBe('far')
    expect(gradPhase(inMonths(9), now)).toBe('building')
    expect(gradPhase(inMonths(3), now)).toBe('launch')
    expect(gradPhase(inMonths(-2), now)).toBe('graduated')
    expect(gradPhase(inMonths(-20), now)).toBe('graduated')
    expect(gradPhase(null, now)).toBe('building')
    expect(monthsToGraduation(null, now)).toBeNull()
    expect(Object.keys(GRAD_PHASE_LABEL)).toHaveLength(4)
  })
})

describe('the plan: position, use the school’s network, build proof', () => {
  it('has all three tracks in every phase before the search starts, each step with a reason and a place to go', () => {
    for (const p of ['far', 'building', 'launch', 'graduated'] as const) {
      const tracks = gradStepsByTrack(p).map((g) => g.track)
      expect(tracks).toEqual(expect.arrayContaining(['position', 'school', 'proof']))
      for (const s of gradSteps(p)) {
        expect(s.why.length).toBeGreaterThan(20)
        expect(s.href).toMatch(/^\/dashboard\//)
      }
    }
  })
  it('uses the alma mater in every phase: alumni, career center, professors and clubs', () => {
    const text = (p: 'far' | 'building' | 'launch' | 'graduated') => gradSteps(p).filter((s) => s.track === 'school').map((s) => s.text).join(' ').toLowerCase()
    expect(text('far')).toMatch(/career center/)
    expect(text('building')).toMatch(/alumni/)
    expect(text('building')).toMatch(/professor/)
    expect(text('launch')).toMatch(/career fair|recruiting/)
    expect(text('graduated')).toMatch(/career center and alumni office/)
  })
  it('covers a student with no job: class projects, clubs and campus jobs count as experience', () => {
    const proof = [...gradSteps('far'), ...gradSteps('building'), ...gradSteps('launch')].filter((s) => s.track === 'proof').map((s) => s.text.toLowerCase()).join(' ')
    expect(proof).toMatch(/club|class project/)
    expect(SCHOOL_HELP.map((h) => h.who).join(' ')).toMatch(/Clubs/)
    expect(SCHOOL_HELP.map((h) => h.who).join(' ')).toMatch(/Class projects/)
    expect(SCHOOL_HELP.map((h) => h.who).join(' ')).toMatch(/Career center/)
  })
  it('starts a note to an alum from a template, never sending it', () => {
    expect(STUDENT_NOTE_STARTER).toMatch(/\[name\]/)
    expect(STUDENT_NOTE_STARTER).toMatch(/student|studying/)
  })
  it('gives the weekly plan one lead step and one proof step, rotating, and only a lead step when applying', () => {
    const a = gradPlanItems(inMonths(9), 1, now)
    const b = gradPlanItems(inMonths(9), 2, now)
    expect(a).toHaveLength(2)
    expect(a[0].text).not.toBe(b[0].text)
    expect(gradPlanItems(inMonths(3), 1, now)).toHaveLength(1)
    expect(gradPlanItems(null, 1, now).length).toBeGreaterThan(0)
  })
})
