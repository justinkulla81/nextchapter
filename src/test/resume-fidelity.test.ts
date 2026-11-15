import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkCompleteness, tokenize } from '@/lib/resume/studio/fidelity'
import { blankResumeDocument, parseResumeDocument, resumeToPlainText } from '@/lib/resume/studio/document'
import { sampleDocument } from './fixtures/resume-sample-document'

const source = readFileSync(join(__dirname, 'fixtures/resume-executive-sample.txt'), 'utf8')

const faithful = sampleDocument

describe('checkCompleteness', () => {
  it('passes a faithful import of the sample', () => {
    const r = checkCompleteness(source, faithful())
    expect(r.missing).toEqual([])
    expect(r.added).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.coverage).toBeGreaterThan(0.99)
  })

  it('survives the editor round trip (validation keeps every field)', () => {
    const parsed = parseResumeDocument(faithful())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(checkCompleteness(source, parsed.data).ok).toBe(true)
    expect(parsed.data.sections?.[0].items).toHaveLength(2)
    expect(parsed.data.workHistory[1].extraRoles).toHaveLength(1)
  })

  it('does not care how the same words are laid out', () => {
    const doc = faithful()
    doc.summary = 'AI native technology investor and operator utilizing artificial intelligence to modernize and grow businesses'
    expect(checkCompleteness(source, doc).ok).toBe(true)
  })

  it('catches the old studio failure: bullets dropped, months invented, a title made up, a section gone', () => {
    const lossy = faithful()
    lossy.targetTitle = 'CFO'
    lossy.summary = 'Investor and operator'
    lossy.sections = []
    lossy.education = lossy.education.slice(0, 1)
    for (const w of lossy.workHistory) {
      w.bullets = []
      w.location = null
      w.extraRoles = []
      w.dateRangeLabel = `Jan ${w.dateRangeLabel.slice(0, 4)} – Present`
    }
    const r = checkCompleteness(source, lossy)
    expect(r.ok).toBe(false)
    expect(r.coverage).toBeLessThan(0.7)
    expect(r.missing).toEqual(expect.arrayContaining(['2.9x', '26', '1b', '500k', '40']))
    expect(r.added).toEqual(expect.arrayContaining(['jan', 'cfo']))
    expect(r.unplacedLines.some((l) => l.includes('returning 2.9x invested capital and 26% IRR'))).toBe(true)
  })

  it('flags a changed figure even when the sentence is otherwise intact', () => {
    const doc = faithful()
    doc.workHistory[4].bullets[0] = doc.workHistory[4].bullets[0].replace('2.9x', '3.9x')
    const r = checkCompleteness(source, doc)
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('2.9x')
    expect(r.added).toContain('3.9x')
  })

  it('holds repeated dates to their count', () => {
    const doc = faithful()
    doc.workHistory[0].dateRangeLabel = 'present'
    const r = checkCompleteness(source, doc)
    expect(r.missing).toContain('2023')
  })
})

describe('tokenize', () => {
  it('normalizes figures, dashes and quotes', () => {
    expect(tokenize('$1,000 AI-first “quote” 2023–2024')).toEqual(['1000', 'ai', 'first', 'quote', '2023', '2024'])
  })
})

describe('resumeToPlainText with the richer document', () => {
  it('keeps locations, extra titles, custom sections and the skills heading in reading order', () => {
    const text = resumeToPlainText(faithful())
    expect(text).toContain('Partner, Harbor Impact - Growth Equity and Buyout  2020-2023')
    expect(text).toContain('EXTRACURRICULAR')
    expect(text).toContain('CORE COMPETENCIES')
    expect(text.indexOf('EDUCATION')).toBeLessThan(text.indexOf('EXTRACURRICULAR'))
    expect(blankResumeDocument().sections).toBeUndefined()
  })
})
