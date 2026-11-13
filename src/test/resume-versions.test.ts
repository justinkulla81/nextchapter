import { describe, expect, it } from 'vitest'
import { cleanTargetLabel, defaultVersionName, isDraftKind } from '@/lib/resume/studio/versions'
import { importDocumentFromText, toDocument, type ImportedResume } from '@/lib/resume/studio/import'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sampleDocument } from './fixtures/resume-sample-document'

describe('versions', () => {
  it('only accepts known kinds', () => {
    expect(isDraftKind('COMPANY')).toBe(true)
    expect(isDraftKind('company')).toBe(false)
    expect(isDraftKind(undefined)).toBe(false)
  })
  it('cleans and caps a target label', () => {
    expect(cleanTargetLabel('  Fin   tech ')).toBe('Fin tech')
    expect(cleanTargetLabel('   ')).toBeNull()
    expect(cleanTargetLabel('x'.repeat(200))).toHaveLength(80)
  })
  it('names a version after what it is for', () => {
    expect(defaultVersionName('INDUSTRY', 'Fintech', 'Original — resume.pdf')).toBe('Fintech version')
    expect(defaultVersionName('GENERAL', null, 'Original — resume.pdf')).toBe('resume.pdf (version)')
  })
})

// The model call is replaced with a stub, so this checks the retry and checking logic around it.
const source = readFileSync(join(__dirname, 'fixtures/resume-executive-sample.txt'), 'utf8')

function asImported(doc = sampleDocument()): ImportedResume {
  return {
    name: doc.name,
    email: doc.contact.email ?? '',
    phone: doc.contact.phone ?? '',
    contactLocation: doc.contact.location ?? '',
    linkedinUrl: '',
    titleUnderName: '',
    summary: doc.summary ?? '',
    experience: doc.workHistory.map((w) => ({
      company: w.companyName,
      location: w.location ?? '',
      title: w.roleTitle,
      dates: w.dateRangeLabel,
      extraRoles: (w.extraRoles ?? []).map((x) => ({ title: x.roleTitle, dates: x.dateRangeLabel })),
      bullets: w.bullets,
    })),
    education: doc.education.map((e) => ({ school: e.schoolName, degree: e.degreeLabel ?? '', dates: e.dateLabel ?? '' })),
    skillsHeading: doc.skillsHeading ?? '',
    skills: doc.skills,
    certifications: [],
    otherSections: (doc.sections ?? []).map((s) => ({ heading: s.heading, items: s.items.map((i) => ({ title: i.title, subtitle: i.subtitle ?? '', dates: i.dateLabel ?? '', bullets: i.bullets })) })),
  }
}

describe('importDocumentFromText', () => {
  it('accepts a faithful copy on the first try', async () => {
    let calls = 0
    const r = await importDocumentFromText(source, async () => (calls++, asImported()))
    expect(calls).toBe(1)
    expect(r.report.ok).toBe(true)
    expect(r.document.sections?.[0].heading).toBe('EXTRACURRICULAR')
  })

  it('tells the model exactly what it dropped and keeps the better second copy', async () => {
    const lossy = asImported()
    lossy.experience[4].bullets = ['Sourced and exited Weld North Education.']
    let feedback: string | null = null
    let calls = 0
    const r = await importDocumentFromText(source, async (_t, fb) => {
      calls++
      if (calls === 1) return lossy
      feedback = fb
      return asImported()
    })
    expect(calls).toBe(2)
    expect(feedback).toContain('2.9x')
    expect(r.report.ok).toBe(true)
    expect(r.attempts).toBe(2)
  })

  it('reports, rather than hides, what is still different after the retry', async () => {
    const lossy = asImported()
    lossy.experience[4].bullets = ['Sourced and exited Weld North Education.']
    const r = await importDocumentFromText(source, async () => lossy)
    expect(r.attempts).toBe(2)
    expect(r.report.ok).toBe(false)
    expect(r.report.missing).toContain('2.9x')
    expect(r.report.unplacedLines.length).toBeGreaterThan(0)
  })

  it('adds nothing of its own when a field is empty', () => {
    const doc = toDocument({ ...asImported(), titleUnderName: '', summary: '' })
    expect(doc.targetTitle).toBeNull()
    expect(doc.summary).toBeNull()
  })
})
