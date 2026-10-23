import { describe, expect, it } from 'vitest'
import { pickLearnCourses } from '@/lib/redesign/learn-picks'

const c = (title: string, rationale: string | null = null, alreadyHeld = false) => ({ title, rationale, alreadyHeld })

describe('pickLearnCourses', () => {
  it('puts a course with a reason ahead of a general one', () => {
    const r = pickLearnCourses([c('General'), c('Gap', 'Asked for in 18 jobs')], new Set(), new Set())
    expect(r.featured?.title).toBe('Gap')
    expect(r.more.map((m) => m.title)).toEqual(['General'])
  })
  it('skips completed, already-held and repeated courses', () => {
    const r = pickLearnCourses([c('Done'), c('Held', null, true), c('A'), c('A'), c('B')], new Set(['Done']), new Set())
    expect([r.featured?.title, ...r.more.map((m) => m.title)]).toEqual(['A', 'B'])
  })
  it('puts a started course ahead of an unstarted one in the same group', () => {
    const r = pickLearnCourses([c('New', 'why'), c('Started', 'why')], new Set(), new Set(['Started']))
    expect(r.featured?.title).toBe('Started')
  })
  it('returns nothing when there is nothing left to learn', () => {
    expect(pickLearnCourses([c('Done')], new Set(['Done']), new Set())).toEqual({ featured: null, more: [] })
  })
  it('limits the list behind the featured course', () => {
    const r = pickLearnCourses(['a', 'b', 'c', 'd', 'e', 'f'].map((t) => c(t)), new Set(), new Set())
    expect(r.more).toHaveLength(3)
  })
})

describe('pickLearnCourses with AI exposure', () => {
  const ai = (t: string) => t.startsWith('AI')
  const items = [c('Gap', 'Asked for in 18 jobs'), c('AI basics'), c('Other')]
  it('features an AI course first when the need is build_now', () => {
    const r = pickLearnCourses(items, new Set(), new Set(), 3, { need: 'build_now', isAiCourse: (i) => ai(i.title) })
    expect(r.featured?.title).toBe('AI basics')
    expect(r.more.map((m) => m.title)).toEqual(['Gap', 'Other'])
  })
  it('keeps a started AI course ahead of an unstarted one', () => {
    const r = pickLearnCourses([c('AI one'), c('AI two')], new Set(), new Set(['AI two']), 3, { need: 'build_now', isAiCourse: (i) => ai(i.title) })
    expect(r.featured?.title).toBe('AI two')
  })
  it('keeps today’s order when no AI course is open', () => {
    const r = pickLearnCourses(items, new Set(['AI basics']), new Set(), 3, { need: 'build_now', isAiCourse: (i) => ai(i.title) })
    expect(r.featured?.title).toBe('Gap')
  })
  it.each(['build_alongside', 'optional', 'unknown'] as const)('keeps today’s order for %s', (need) => {
    const r = pickLearnCourses(items, new Set(), new Set(), 3, { need, isAiCourse: (i) => ai(i.title) })
    expect(r.featured?.title).toBe('Gap')
  })
})
