import { describe, expect, it } from 'vitest'
import { canStartCohort, cohortMatches, cohortStats, ruleLine, validateCohort, validateCohortPost } from '@/lib/workforce/talent-cohorts'
import { featureOn, institutionEntitlements } from '@/lib/plans/entitlements'
import type { Person } from '@/lib/workforce/skills-intel'

const person = (o: Partial<Person> = {}): Person => ({ function: 'Operations', industry: 'Manufacturing & Industrial', level: 'Manager', years: 10, weeksOut: 30, keywords: [], dossier: false, ...o })
const rule = (o: Partial<{ industries: string[]; functions: string[]; levels: string[]; minWeeksOut: number | null }> = {}) => ({ industries: [], functions: [], levels: [], minWeeksOut: null, ...o })
const form = (o: Record<string, string | string[]>) => ({ get: (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : null), getAll: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[]) : []) })
const allowed = { industries: ['Insurance'], functions: ['Operations', 'Finance'], levels: ['Manager', 'Individual contributor'] }

describe('who is in a cohort', () => {
  it('an empty rule is everyone', () => {
    expect(cohortMatches(rule(), person({ function: null, industry: null, level: null, years: null, weeksOut: null }))).toBe(true)
  })
  it('every named dimension must include the person', () => {
    const r = rule({ functions: ['Operations'], levels: ['Manager'] })
    expect(cohortMatches(r, person())).toBe(true)
    expect(cohortMatches(r, person({ function: 'Finance' }))).toBe(false)
    expect(cohortMatches(r, person({ level: 'IC', years: 2 }))).toBe(false)
  })
  it('never guesses a person into a cohort', () => {
    expect(cohortMatches(rule({ functions: ['Finance'] }), person({ function: null }))).toBe(false)
    expect(cohortMatches(rule({ minWeeksOut: 26 }), person({ weeksOut: null }))).toBe(false)
  })
  it('time out of work is a minimum', () => {
    expect(cohortMatches(rule({ minWeeksOut: 26 }), person({ weeksOut: 26 }))).toBe(true)
    expect(cohortMatches(rule({ minWeeksOut: 26 }), person({ weeksOut: 25 }))).toBe(false)
  })
  it('says the rule in words', () => {
    expect(ruleLine(rule())).toBe('Everyone in the group')
    expect(ruleLine(rule({ functions: ['Finance'], levels: ['Manager'], minWeeksOut: 26 }))).toBe('Finance · Manager · out of work 26 weeks or more')
  })
})

describe('what staff see', () => {
  it('hides a size under five, and the mix with it', () => {
    const few = Array.from({ length: 3 }, () => person())
    expect(cohortStats(few, rule())).toEqual({ size: null, byFunction: [], byBand: [] })
    expect(cohortStats([], rule()).size).toBe(0)
  })
  it('shows size and mix from five up', () => {
    const many = [...Array.from({ length: 6 }, () => person()), ...Array.from({ length: 5 }, () => person({ function: 'Finance' }))]
    const s = cohortStats(many, rule())
    expect(s.size).toBe(11)
    expect(s.byFunction[0]).toEqual({ label: 'Operations', n: 6 })
    expect(cohortStats(many, rule({ functions: ['Finance'] })).size).toBe(5)
  })
})

describe('starting a cohort', () => {
  it('a free organization runs one; paid and trial run as many as it likes, and only they post updates', () => {
    expect(canStartCohort(1, 0).allowed).toBe(true)
    expect(canStartCohort(1, 1)).toMatchObject({ allowed: false, message: expect.stringMatching(/one cohort/) })
    expect(canStartCohort(null, 30).allowed).toBe(true)
    expect(featureOn(institutionEntitlements({ plan: 'FREE' }), 'talentCohorts')).toBe(false)
    expect(featureOn(institutionEntitlements({ plan: 'PAID' }), 'talentCohorts')).toBe(true)
  })
  it('reads one as typed', () => {
    const r = validateCohort(form({ name: ' Ops managers ', purpose: '', minWeeksOut: '26', functions: ['operations', 'Nope'], levels: ['Manager'] }), allowed)
    expect('value' in r && r.value).toMatchObject({ name: 'Ops managers', purpose: null, minWeeksOut: 26, functions: ['Operations'], levels: ['Manager'], industries: [] })
  })
  it('says what to fix', () => {
    expect(validateCohort(form({ name: ' ' }), allowed)).toMatchObject({ error: expect.stringMatching(/name/) })
    expect(validateCohort(form({ name: 'x', minWeeksOut: 'many' }), allowed)).toMatchObject({ error: expect.stringMatching(/whole number/) })
    expect(validateCohortPost({ get: () => ' ' })).toMatchObject({ error: expect.stringMatching(/Write the update/) })
  })
})
