import { describe, expect, it } from 'vitest'
import { MAJORS, collegeFamilyPath, fieldSupply, majorBySlug, majorPath, majorSlug } from '@/lib/rankings/majors'
import { fieldOf, OCCUPATIONS } from '@/lib/rankings/degrees-specs'

describe('majors', () => {
  it('loads the federal completions file with a unique address per major', () => {
    expect(MAJORS.length).toBeGreaterThan(300)
    const slugs = MAJORS.map(majorSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const m of MAJORS) expect(majorBySlug(majorSlug(m))?.cip).toBe(m.cip)
    expect(majorPath(MAJORS.find((m) => m.cip === '11.07')!)).toBe('/higher-education/majors/computer-science')
  })
  it('matches majors only to fields the occupation side also has', () => {
    const occFields = new Set(Object.entries(OCCUPATIONS).map(([c, o]) => fieldOf(c, o.e)).filter(Boolean))
    for (const f of fieldSupply().keys()) expect(occFields.has(f)).toBe(true)
    expect(MAJORS.find((m) => m.cip === '51.38')!.field).toBe('Nursing')
    expect(MAJORS.find((m) => m.cip === '23.01')!.field).toBeNull()
  })
  it('links a college page field of study to its family on the majors page', () => {
    expect(collegeFamilyPath('Computer & information sciences')).toBe('/higher-education/majors#fam-11')
    expect(collegeFamilyPath('Not a family')).toBeNull()
  })
})
