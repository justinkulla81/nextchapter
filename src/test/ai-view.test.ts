import { describe, expect, it } from 'vitest'
import { isAiSkillLabel, jobInAiView, parseAiView, skillInAiView } from '@/lib/jobs/ai-view'
import { boardHref } from '@/lib/jobs/board-url'
import { skillGapByKind, type JobSkillGap } from '@/lib/jobs/job-skill-gap'

describe('AI / Non-AI / All', () => {
  it('reads the URL parameter, defaulting to All', () => {
    expect(parseAiView('ai')).toBe('ai')
    expect(parseAiView('other')).toBe('other')
    expect(parseAiView(undefined)).toBe('all')
    expect(parseAiView('nonsense')).toBe('all')
    expect(parseAiView(['other'])).toBe('other')
  })
  it('splits jobs on whether they ask for a specific AI skill', () => {
    expect(jobInAiView('ai', ['applied'])).toBe(true)
    expect(jobInAiView('ai', [])).toBe(false)
    expect(jobInAiView('other', [])).toBe(true)
    expect(jobInAiView('other', null)).toBe(true)
    expect(jobInAiView('other', ['builder'])).toBe(false)
    expect(jobInAiView('all', ['builder'])).toBe(true)
  })
  it('splits skills on the 24 AI items', () => {
    expect(isAiSkillLabel('Prompt design')).toBe(true)
    expect(isAiSkillLabel('sql')).toBe(false)
    expect(skillInAiView('ai', 'RAG and vector search')).toBe(true)
    expect(skillInAiView('other', 'RAG and vector search')).toBe(false)
    expect(skillInAiView('other', 'excel')).toBe(true)
  })
  it('keeps the choice in the board URL, All written as nothing', () => {
    expect(boardHref('q=cfo&breadth=wide', { ai: 'ai' })).toBe('?q=cfo&breadth=wide&ai=ai')
    expect(boardHref('q=cfo&ai=ai', { ai: 'all' })).toBe('?q=cfo')
    expect(boardHref('ai=other', { breadth: 'narrow' })).toBe('?ai=other&breadth=narrow')
  })
})

describe('skillGapByKind', () => {
  const gap = (requested: string[], have: string[], aiAsked: string[] = []): JobSkillGap => ({
    basis: requested.length > 0 ? 'posting' : 'none',
    requested,
    have,
    missing: requested.filter((r) => !have.includes(r)),
    coveragePct: null,
    ai: { asked: aiAsked, have: [], missing: aiAsked },
  })
  it('counts each employer once, marks AI skills, gaps first', () => {
    const out = skillGapByKind(
      [
        { companyKey: 'a', gap: gap(['Prompt design', 'sql', 'excel'], ['excel'], ['Prompt design']) },
        { companyKey: 'a', gap: gap(['Prompt design', 'sql'], [], ['Prompt design']) },
        { companyKey: 'b', gap: gap(['Prompt design', 'sql', 'excel'], ['excel'], ['Prompt design']) },
        { companyKey: 'c', gap: gap(['sql', 'excel'], ['excel']) },
        { companyKey: 'd', gap: gap([], []) },
      ],
      isAiSkillLabel
    )
    expect(out.employersWithSkillData).toBe(3)
    expect(out.employersAskingAi).toBe(2)
    expect(out.rows).toEqual([
      { term: 'sql', employers: 3, have: false, ai: false },
      { term: 'Prompt design', employers: 2, have: false, ai: true },
      { term: 'excel', employers: 3, have: true, ai: false },
    ])
  })
})
