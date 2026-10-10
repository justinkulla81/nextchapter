import { describe, it, expect } from 'vitest'
import { SCHOOL_SEEDS } from '@/lib/education/school-seeds'
import { buildSchoolIndex, inferDegreeLevel, resolveSchool, schoolKey, type SchoolRecord } from '@/lib/education/school-match'

const records: SchoolRecord[] = SCHOOL_SEEDS.map((s, i) => ({ id: `s${i}`, name: s.name, canonicalKey: schoolKey(s.name), aliases: s.aliases }))
const index = buildSchoolIndex(records)
const idOf = (name: string) => records.find((r) => r.name === name)!.id
const resolve = (raw: string) => resolveSchool(raw, index)

describe('the same institution under different spellings', () => {
  it('collapses the three MIT spellings from production to one school', () => {
    const mit = idOf('Massachusetts Institute of Technology')
    for (const raw of ['mit', 'MIT', 'M.I.T.', 'Massachusetts Institute of Technology', 'mit sloan school of management', 'MIT Sloan', 'Mass. Institute of Technology']) {
      const m = resolve(raw)
      expect(m.kind === 'exact' || m.kind === 'division', raw).toBe(true)
      expect((m as { schoolId: string }).schoolId, raw).toBe(mit)
    }
  })

  it('handles abbreviations and campus suffixes', () => {
    expect(resolve('UCLA')).toMatchObject({ kind: 'exact', schoolId: idOf('University of California, Los Angeles') })
    expect(resolve('Univ. of Michigan - Ann Arbor')).toMatchObject({ kind: 'exact', schoolId: idOf('University of Michigan') })
    expect(resolve('The Wharton School')).toMatchObject({ kind: 'exact', schoolId: idOf('University of Pennsylvania') })
    expect(resolve('NYU')).toMatchObject({ schoolId: idOf('New York University') })
  })

  it('reads a program within an institution as that institution', () => {
    expect(resolve('Harvard Extension School')).toMatchObject({ schoolId: idOf('Harvard University') })
    expect(resolve('Boston University School of Law')).toMatchObject({ kind: 'division', schoolId: idOf('Boston University') })
    expect(resolve('Duke University Graduate School')).toMatchObject({ kind: 'division', schoolId: idOf('Duke University') })
  })
})

describe('different institutions are never merged', () => {
  it('keeps look-alike names apart', () => {
    const mi = idOf('University of Michigan')
    const msu = idOf('Michigan State University')
    expect(resolve('Michigan State University')).toMatchObject({ schoolId: msu })
    expect(resolve('University of Michigan')).toMatchObject({ schoolId: mi })
    expect(resolve('Washington University in St. Louis')).toMatchObject({ schoolId: idOf('Washington University in St. Louis') })
    expect(resolve('University of Washington')).toMatchObject({ schoolId: idOf('University of Washington') })
  })

  it('does not match a short alias inside another name', () => {
    expect(resolve('Smith College').kind).not.toBe('exact')
    expect(resolve('Smith College').kind).not.toBe('division')
    expect(resolve('Cambridge Rindge and Latin').kind).toBe('none')
  })

  it('sends a near-miss to review rather than linking it', () => {
    const m = resolve('University of Michigan Dearborn Campus Online')
    expect(['close', 'none', 'division']).toContain(m.kind)
    if (m.kind === 'division') expect(m.schoolId).toBe(idOf('University of Michigan'))
  })

  it('treats an unknown school as unknown', () => {
    expect(resolve('Fundação Getulio Vargas').kind).toBe('none')
    expect(resolve('').kind).toBe('none')
  })
})

describe('inferDegreeLevel', () => {
  it('normalises the degree text', () => {
    expect(inferDegreeLevel('B.S. Computer Science')).toBe('BACHELORS')
    expect(inferDegreeLevel('Bachelor of Arts')).toBe('BACHELORS')
    expect(inferDegreeLevel('MBA')).toBe('MBA')
    expect(inferDegreeLevel('Executive MBA')).toBe('MBA')
    expect(inferDegreeLevel('M.S. in Finance')).toBe('MASTERS')
    expect(inferDegreeLevel('Master of Public Policy')).toBe('MASTERS')
    expect(inferDegreeLevel('Ph.D.')).toBe('DOCTORATE')
    expect(inferDegreeLevel('Juris Doctor')).toBe('PROFESSIONAL')
    expect(inferDegreeLevel('Associate of Science')).toBe('ASSOCIATE')
    expect(inferDegreeLevel(null)).toBeNull()
    expect(inferDegreeLevel('Certificate in Data Analytics')).toBe('OTHER')
  })
})
