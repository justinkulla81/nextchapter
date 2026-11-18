import { describe, expect, it } from 'vitest'
import { audienceLine, audienceMatches, cleanSkills, coveredSkills, pick, reach, validateOffering, EXPERIENCE_BANDS } from '@/lib/workforce/training-rules'

const form = (o: Record<string, string | string[]>) => ({
  get: (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : null),
  getAll: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[]) : typeof o[k] === 'string' ? [o[k] as string] : []),
})
const allowed = { industries: ['Financial Services & Banking', 'Manufacturing & Industrial'], functions: ['Finance', 'Operations'] }
const who = (over: Partial<{ industry: string | null; function: string | null; level: string | null; years: number | null }> = {}) => ({ industry: 'Manufacturing & Industrial', function: 'Operations', level: 'Manager', years: 10, ...over })

describe('who a training is for', () => {
  it('an empty audience is everyone', () => {
    expect(audienceMatches({ industries: [], functions: [], levels: [] }, who())).toBe(true)
    expect(audienceMatches({ industries: [], functions: [], levels: [] }, who({ industry: null, function: null, level: null, years: null }))).toBe(true)
  })
  it('every named dimension must include the person', () => {
    const a = { industries: ['Manufacturing & Industrial'], functions: ['Operations'], levels: ['Manager'] }
    expect(audienceMatches(a, who())).toBe(true)
    expect(audienceMatches(a, who({ function: 'Finance' }))).toBe(false)
    expect(audienceMatches(a, who({ industry: 'Insurance' }))).toBe(false)
    expect(audienceMatches(a, who({ level: 'IC', years: 2 }))).toBe(false)
  })
  it('never guesses a person into a track they have no value for', () => {
    expect(audienceMatches({ industries: [], functions: ['Finance'], levels: [] }, who({ function: null }))).toBe(false)
  })
  it('reads experience from level, then years', () => {
    expect(audienceMatches({ industries: [], functions: [], levels: ['Director or above'] }, who({ level: 'VP' }))).toBe(true)
    expect(audienceMatches({ industries: [], functions: [], levels: ['Individual contributor'] }, who({ level: null, years: 3 }))).toBe(true)
  })
  it('says who it is for in words', () => {
    expect(audienceLine({ industries: [], functions: [], levels: [] })).toBe('For everyone in the group')
    expect(audienceLine({ industries: ['Insurance'], functions: ['Finance'], levels: ['Manager'] })).toBe('For Finance · Insurance · Manager')
  })
  it('hides a reach under five', () => {
    const many = Array.from({ length: 12 }, () => who())
    expect(reach(many, { industries: [], functions: ['Operations'], levels: [] })).toBe(12)
    expect(reach(many.slice(0, 3), { industries: [], functions: ['Operations'], levels: [] })).toBeNull()
    expect(reach(many, { industries: [], functions: ['Finance'], levels: [] })).toBe(0)
  })
})

describe('adding a training', () => {
  const ok = { source: 'LOCAL', title: 'AI for operations leaders', provider: 'NextChapter', url: 'https://example.org/c', skills: 'Process improvement, process improvement, AI', price: '250', hours: '12', ncCustom: 'on', functions: ['Operations', 'Nope'], levels: ['Manager', 'Manager'] }
  it('cleans and keeps what is valid', () => {
    const r = validateOffering(form(ok), allowed)
    expect('value' in r && r.value).toMatchObject({ source: 'LOCAL', title: 'AI for operations leaders', priceCents: 25000, hours: 12, ncCustom: true, functions: ['Operations'], levels: ['Manager'], skills: ['Process improvement', 'AI'] })
  })
  it('says what to fix, in plain words', () => {
    expect(validateOffering(form({ ...ok, source: 'X' }), allowed)).toMatchObject({ error: expect.stringMatching(/where this training comes from/) })
    expect(validateOffering(form({ ...ok, title: ' ' }), allowed)).toMatchObject({ error: expect.stringMatching(/name of the training/) })
    expect(validateOffering(form({ ...ok, url: 'javascript:alert(1)' }), allowed)).toMatchObject({ error: expect.stringMatching(/http/) })
    expect(validateOffering(form({ ...ok, hours: 'many' }), allowed)).toMatchObject({ error: expect.stringMatching(/Hours/) })
    expect(validateOffering(form({ ...ok, price: '-5' }), allowed)).toMatchObject({ error: expect.stringMatching(/price/) })
  })
  it('only region-offered training can be marked as built by NextChapter', () => {
    const r = validateOffering(form({ ...ok, source: 'THIRD_PARTY' }), allowed)
    expect('value' in r && r.value.ncCustom).toBe(false)
  })
  it('keeps allowed values in the list’s spelling, once', () => {
    expect(pick(['finance', 'FINANCE', 'x'], allowed.functions)).toEqual(['Finance'])
    expect(pick(['Manager'], EXPERIENCE_BANDS)).toEqual(['Manager'])
    expect(cleanSkills('a, b,\n a ,, ' + 'c'.repeat(80)).length).toBe(3)
  })
  it('counts what the catalog teaches', () => {
    const m = coveredSkills([{ skills: ['Excel', 'excel'] }, { skills: ['Excel', 'Budgeting'] }])
    expect(m.get('excel')).toBe(2)
    expect(m.get('budgeting')).toBe(1)
  })
})
