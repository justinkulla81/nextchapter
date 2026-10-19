import { describe, expect, it } from 'vitest'
import type { Course } from '@prisma/client'
import { aiGapCourseItems } from '@/lib/redesign/learn-ai-gap'
import { pickLearnCourses } from '@/lib/redesign/learn-picks'

const course = (id: string, title: string, url: string) => ({ id, title, url, description: 'd', sponsor: null, provider: 'coursera', free: true, logoUrl: null }) as unknown as Course
// Real tagged URLs (ai-course-tags.ts): Claude Code in Action covers 'AI coding assistants'; LLMOps covers 'MLOps'.
const catalog = [
  course('1', 'Claude Code in Action', 'https://anthropic.skilljar.com/claude-code-in-action'),
  course('2', 'LLMOps', 'https://www.deeplearning.ai/courses/llmops'),
]
const row = (term: string, employers: number, over: Partial<{ ai: boolean; have: boolean }> = {}) => ({ term, employers, ai: true, have: false, ...over })

describe('aiGapCourseItems', () => {
  it('turns a qualifying AI gap into a course with the reason, most-asked first', () => {
    const items = aiGapCourseItems([row('MLOps', 4), row('AI coding assistants', 9)], 20, catalog)
    expect(items.map((i) => i.title)).toEqual(['Claude Code in Action', 'LLMOps'])
    expect(items[0].rationale).toContain('9 of 20 employers')
    expect(items[0].rationale).toContain('“AI coding assistants”')
  })
  it('ignores skills the member has, non-AI skills and thin signals', () => {
    expect(aiGapCourseItems([row('MLOps', 9, { have: true }), row('AI coding assistants', 9, { ai: false }), row('MLOps', 2)], 20, catalog)).toEqual([])
  })
  it('skips a gap no catalog course covers', () => {
    expect(aiGapCourseItems([row('Leading AI teams', 8)], 20, catalog)).toEqual([])
  })
  it('lets the picker feature the most-asked AI gap course', () => {
    const items = aiGapCourseItems([row('AI coding assistants', 9)], 20, catalog)
    const general = { title: 'General', rationale: null, alreadyHeld: false }
    expect(pickLearnCourses([general, ...items], new Set(), new Set()).featured?.title).toBe('Claude Code in Action')
  })
})
