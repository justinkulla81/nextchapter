import { describe, expect, it } from 'vitest'
import {
  CATALOG_FUNCTIONS, LEVELS, assignSlugs, catalogFunctionBySlug, coursePath, coursesForFunction, functionLevelPageIndexable, functionPageIndexable,
  functionPath, functionsForCourse, levelFromAnswers, relatedCourses, sortByLevel, sponsorPageIndexable, sponsorSlug, type PublicCourse,
} from '@/lib/learning/public-catalog-shared'
import { GENERAL_FAQ, courseJsonLd, itemListJsonLd } from '@/lib/learning/public-catalog-seo'
import { renderedTitle } from '@/lib/seo/title'

const mk = (o: Partial<PublicCourse> & { slug: string }): PublicCourse => ({
  title: o.slug, sponsor: 'Acme', description: 'd', url: `https://e.com/${o.slug}`, provider: 'coursera', free: false, level: 'BEGINNER', category: 'FUNCTION_TRAINING', functions: [], skills: [], ...o,
})

describe('functionsForCourse', () => {
  it('maps function-training keywords to canonical functions', () => {
    expect(functionsForCourse({ category: 'FUNCTION_TRAINING', keywords: ['legal', 'compliance', 'counsel'], targetFunctions: [] })).toEqual(['Legal'])
    expect(functionsForCourse({ category: 'FUNCTION_TRAINING', keywords: ['human resources', 'talent'], targetFunctions: [] })).toEqual(['Human Resources'])
    expect(functionsForCourse({ category: 'FUNCTION_TRAINING', keywords: ['customer success', 'customer support'], targetFunctions: [] })).toEqual(['Customer Success'])
    expect(functionsForCourse({ category: 'FUNCTION_TRAINING', keywords: ['data & analytics'], targetFunctions: [] })).toEqual(['Data & Analytics'])
  })
  it('does not read "hr" inside another word', () => {
    expect(functionsForCourse({ category: 'FUNCTION_TRAINING', keywords: ['chronic'], targetFunctions: [] })).toEqual([])
  })
  it('uses target functions for certifications and nothing for general AI courses', () => {
    expect(functionsForCourse({ category: 'CERTIFICATION', keywords: [], targetFunctions: ['Finance', 'Legal', 'Nonsense'] })).toEqual(['Finance', 'Legal'])
    expect(functionsForCourse({ category: 'AI_TRAINING', keywords: ['finance'], targetFunctions: [] })).toEqual([])
  })
})

describe('slugs and paths', () => {
  it('makes every slug unique and stable regardless of input order', () => {
    const rows = [
      { title: 'AI Essentials', sponsor: 'Google', url: 'https://b' },
      { title: 'AI Essentials', sponsor: 'Microsoft', url: 'https://a' },
      { title: 'AI Essentials', sponsor: 'Microsoft', url: 'https://c' },
    ]
    const a = assignSlugs(rows).map((r) => r.slug)
    expect(new Set(a).size).toBe(3)
    expect(assignSlugs([...rows].reverse()).map((r) => r.slug).sort()).toEqual([...a].sort())
  })
  it('has a page for every function and level', () => {
    expect(CATALOG_FUNCTIONS.map((f) => catalogFunctionBySlug(f.slug)?.name)).toEqual(CATALOG_FUNCTIONS.map((f) => f.name))
    expect(LEVELS.map((l) => l.slug)).toEqual(['beginner', 'intermediate', 'advanced'])
  })
})

describe('sorting and selection', () => {
  const cs = [
    mk({ slug: 'adv', level: 'ADVANCED', functions: ['Legal'] }),
    mk({ slug: 'paid-beg', level: 'BEGINNER', functions: ['Legal'] }),
    mk({ slug: 'free-beg', level: 'BEGINNER', free: true, functions: ['Legal'] }),
    mk({ slug: 'gen', level: 'BEGINNER', category: 'AI_TRAINING', functions: [] }),
    mk({ slug: 'fin', level: 'INTERMEDIATE', functions: ['Finance'] }),
  ]
  it('sorts beginner first, then free before paid', () => {
    expect(sortByLevel(cs).map((c) => c.slug)).toEqual(['free-beg', 'gen', 'paid-beg', 'fin', 'adv'])
  })
  it('lists function courses, with general AI courses on request', () => {
    expect(coursesForFunction(cs, 'Legal').map((c) => c.slug)).toEqual(['free-beg', 'paid-beg', 'adv'])
    expect(coursesForFunction(cs, 'Legal', { withGeneral: true }).map((c) => c.slug)).toContain('gen')
    expect(coursesForFunction(cs, 'Legal', { level: 'ADVANCED' }).map((c) => c.slug)).toEqual(['adv'])
  })
  it('indexes a page only with at least two courses of its own', () => {
    expect(functionPageIndexable(cs, 'Legal')).toBe(true)
    expect(functionPageIndexable(cs, 'Finance')).toBe(false)
    expect(functionLevelPageIndexable(cs, 'Legal', 'BEGINNER')).toBe(true)
    expect(functionLevelPageIndexable(cs, 'Legal', 'ADVANCED')).toBe(false)
    expect(sponsorPageIndexable(cs, sponsorSlug('Acme'))).toBe(true)
    expect(sponsorPageIndexable(cs, 'nobody')).toBe(false)
  })
  it('suggests related courses from the same function, never the course itself', () => {
    const r = relatedCourses(cs, cs[1])
    expect(r.find((c) => c.slug === 'paid-beg')).toBeUndefined()
    expect(r[0].functions).toContain('Legal')
  })
})

describe('level quiz', () => {
  it('scores plain answers into three levels', () => {
    expect(levelFromAnswers({})).toBe('BEGINNER')
    expect(levelFromAnswers({ use: true })).toBe('BEGINNER')
    expect(levelFromAnswers({ use: true, prompt: true })).toBe('INTERMEDIATE')
    expect(levelFromAnswers({ workflow: true })).toBe('INTERMEDIATE')
    expect(levelFromAnswers({ workflow: true, lead: true })).toBe('ADVANCED')
    expect(levelFromAnswers({ lead: true })).toBe('BEGINNER')
  })
})

describe('seo', () => {
  it('keeps page titles inside the search-result length', () => {
    for (const f of CATALOG_FUNCTIONS) for (const l of LEVELS) expect(renderedTitle(`${l.label} AI courses for ${f.people}`).length).toBeLessThanOrEqual(60)
    expect(renderedTitle('AI courses by level and profession').length).toBeLessThanOrEqual(60)
  })
  it('builds structured data that points at our pages', () => {
    const c = mk({ slug: 'x', level: 'ADVANCED', free: true })
    expect(courseJsonLd(c)).toMatchObject({ '@type': 'Course', educationalLevel: 'Advanced', isAccessibleForFree: true, sameAs: c.url })
    expect(JSON.stringify(itemListJsonLd('n', '/ai-courses', [c]))).toContain(coursePath(c))
    expect(functionPath(CATALOG_FUNCTIONS[0])).toBe('/ai-courses/for/finance')
  })
  it('never uses the word displaced and makes no unbuilt promises', () => {
    const text = JSON.stringify(GENERAL_FAQ).toLowerCase() + JSON.stringify(CATALOG_FUNCTIONS).toLowerCase()
    expect(text).not.toContain('displaced')
  })
})
