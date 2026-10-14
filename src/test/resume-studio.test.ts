import { describe, expect, it } from 'vitest'
import { blankResumeDocument, parseResumeDocument, resumeToPlainText } from '@/lib/resume/studio/document'
import { checkBullet, summarizeDocument } from '@/lib/resume/studio/writing-checks'
import { keywordCoverage } from '@/lib/resume/studio/keyword-coverage'
import type { ResumeDocumentData } from '@/lib/resume/export/document-data'

const base = (): ResumeDocumentData => ({
  ...blankResumeDocument('Pat Lee'),
  contact: { email: 'pat@example.com', phone: null, location: 'Boston, MA', linkedinUrl: null },
  targetTitle: 'Finance Director',
  summary: 'Finance leader.',
  workHistory: [
    { companyName: 'Acme', roleTitle: 'Controller', dateRangeLabel: 'Jan 2020 – Present', bullets: ['Cut month-end close from 9 days to 5 across 4 entities.', 'Responsible for the budget process.'] },
  ],
  education: [{ schoolName: 'State U', degreeLabel: 'MBA', dateLabel: '2012' }],
  skills: ['Excel', 'NetSuite'],
  certifications: [],
})

describe('parseResumeDocument', () => {
  it('accepts a good document and drops empty bullets, rows, and blank fields', () => {
    const doc = base()
    doc.workHistory[0].bullets.push('   ')
    doc.workHistory.push({ companyName: '', roleTitle: '', dateRangeLabel: '', bullets: [''] })
    doc.contact.phone = '   '
    doc.skills = ['Excel', 'Excel', '']
    const r = parseResumeDocument(doc)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.workHistory).toHaveLength(1)
    expect(r.data.workHistory[0].bullets).toHaveLength(2)
    expect(r.data.contact.phone).toBeNull()
    expect(r.data.skills).toEqual(['Excel'])
  })

  it('asks for a name rather than dropping it', () => {
    const doc = base()
    doc.name = '  '
    const r = parseResumeDocument(doc)
    expect(r).toEqual({ ok: false, error: 'Add your name at the top.' })
  })

  it('rejects oversized or malformed input with a readable message', () => {
    const doc = base()
    doc.workHistory[0].bullets = Array.from({ length: 13 }, (_, i) => `Bullet number ${i} with 5 words`)
    const tooMany = parseResumeDocument(doc)
    expect(tooMany.ok).toBe(false)
    expect(parseResumeDocument({ name: 5 }).ok).toBe(false)
    expect(parseResumeDocument(null).ok).toBe(false)
  })
})

describe('resumeToPlainText', () => {
  it('lists sections in reading order', () => {
    const text = resumeToPlainText(base())
    expect(text.split('\n')[0]).toBe('Pat Lee')
    expect(text.indexOf('SUMMARY')).toBeLessThan(text.indexOf('EXPERIENCE'))
    expect(text.indexOf('EXPERIENCE')).toBeLessThan(text.indexOf('EDUCATION'))
    expect(text).toContain('- Cut month-end close from 9 days to 5 across 4 entities.')
    expect(text).toContain('SKILLS\nExcel, NetSuite')
    expect(text).not.toContain('CERTIFICATIONS')
  })
})

describe('writing checks', () => {
  it('flags a weak opener and a missing number', () => {
    const codes = checkBullet('Responsible for the budget process across the company').map((n) => n.code)
    expect(codes).toContain('WEAK_OPENER')
    expect(codes).toContain('NO_NUMBER')
  })

  it('leaves a strong, quantified bullet alone', () => {
    expect(checkBullet('Cut month-end close from 9 days to 5 across 4 entities.')).toEqual([])
  })

  it('flags first person, very long and very short bullets', () => {
    expect(checkBullet('I managed the team of engineers for 3 years').map((n) => n.code)).toContain('FIRST_PERSON')
    expect(checkBullet(`Led ${'a '.repeat(150)}to 5 goals`).map((n) => n.code)).toContain('TOO_LONG')
    expect(checkBullet('Ran payroll').map((n) => n.code)).toContain('TOO_SHORT')
  })

  it('ignores empty bullets and does not demand numbers from short ones', () => {
    expect(checkBullet('   ')).toEqual([])
    expect(checkBullet('Managed vendor contracts well').map((n) => n.code)).not.toContain('NO_NUMBER')
  })

  it('summarizes the document', () => {
    const doc = base()
    doc.workHistory.push({ companyName: 'Beta', roleTitle: 'Analyst', dateRangeLabel: '', bullets: [] })
    const s = summarizeDocument(doc)
    expect(s.bulletCount).toBe(2)
    expect(s.quantifiedCount).toBe(1)
    expect(s.notedBullets).toBe(1)
    expect(s.rolesWithoutBullets).toEqual(['Analyst, Beta'])
  })
})

describe('keywordCoverage', () => {
  it('separates what the posting names into found and missing', () => {
    const jd = 'We need a controller with strong Excel, NetSuite and SOX experience. Hyperion a plus.'
    const { found, missing } = keywordCoverage(jd, base())
    expect(found).toEqual(expect.arrayContaining(['excel', 'netsuite']))
    expect(missing).toEqual(expect.arrayContaining(['sox', 'hyperion']))
    expect(found).not.toContain('sox')
  })

  it('returns nothing for text with no known terms', () => {
    expect(keywordCoverage('We are a friendly team.', base())).toEqual({ found: [], missing: [] })
  })
})
