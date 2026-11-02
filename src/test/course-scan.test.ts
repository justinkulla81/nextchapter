import { describe, expect, it } from 'vitest'
import { classifyCourse } from '@/lib/learning/course-scan/classify'
import { extractLinks, pageFacts } from '@/lib/learning/course-scan/extract'
import { linkedinCoursePost, xCoursePost } from '@/lib/learning/course-scan/posts'
import { AI_LEARNING_PATHS, aiSkillsForCourse } from '@/lib/learning/ai-course-tags'

describe('classifyCourse', () => {
  it('puts a Gemini NDA course in Legal at beginner level', () => {
    const g = classifyCourse({ url: 'u', title: 'Draft NDA Documents with Gemini', description: '' })
    expect(g.functions).toContain('Legal')
    expect(g.category).toBe('FUNCTION_TRAINING')
    expect(g.aiRelated).toBe(true)
  })
  it('finds finance from bond and credit wording', () => {
    expect(classifyCourse({ url: 'u', title: 'Uncover Credit Market Opportunities with Gemini', description: '' }).functions).toEqual(['Finance'])
  })
  it('uses the provider level over the title', () => {
    expect(classifyCourse({ url: 'u', title: 'Introduction to Copilot agents', description: '', providerLevel: 'advanced' }).skillLevel).toBe('ADVANCED')
  })
  it('keeps a generic AI course in AI Training and ignores non-AI courses', () => {
    expect(classifyCourse({ url: 'u', title: 'Claude 101', description: '' }).category).toBe('AI_TRAINING')
    expect(classifyCourse({ url: 'u', title: 'Take your first steps with F#', description: 'A programming language' }).aiRelated).toBe(false)
  })
  it('does not read "law" inside another word', () => {
    expect(classifyCourse({ url: 'u', title: 'Spot a flaw in AI output', description: '' }).functions).not.toContain('Legal')
  })
})

describe('extract', () => {
  it('returns absolute links without query or trailing slash', () => {
    const l = extractLinks('<a href="/courses/x/?utm=1">X <b>course</b></a>', 'https://e.com/courses/')
    expect(l).toEqual([{ url: 'https://e.com/courses/x', text: 'X course' }])
  })
  it('reads title and description', () => {
    const f = pageFacts('<title>Bond course | Google Skills</title><meta property="og:description" content="Learn &amp; do">')
    expect(f.description).toBe('Learn & do')
  })
})

describe('posts', () => {
  const c = { title: 'Draft NDA Documents with Gemini', sponsor: 'Google Cloud', url: 'https://www.skills.google/course_templates/1949', free: true, skillLevel: 'BEGINNER' as const, functions: ['Legal'] }
  it('keeps X inside 280 characters with the link counted as 23', () => {
    const t = xCoursePost({ ...c, title: 'A'.repeat(400) })
    expect(t.length - c.url.length + 23).toBeLessThanOrEqual(280)
    expect(xCoursePost(c)).toContain(c.url)
  })
  it('never says displaced and names the level', () => {
    expect(linkedinCoursePost(c)).toMatch(/beginner level/)
    expect(linkedinCoursePost(c).toLowerCase()).not.toContain('displaced')
  })
})

describe('Google finance and legal courses', () => {
  const google = AI_LEARNING_PATHS.filter((p) => p.provider === 'googleSkills')
  it('adds all nine, free, function-targeted, and tagged to AI skills', () => {
    expect(google).toHaveLength(9)
    for (const p of google) {
      expect(p.free).toBe(true)
      expect(p.category).toBe('FUNCTION_TRAINING')
      expect(p.keywords?.length).toBeGreaterThan(0)
      expect(aiSkillsForCourse(p.url).length).toBeGreaterThan(0)
    }
    expect(google.filter((p) => p.keywords?.includes('legal'))).toHaveLength(5)
  })
})
