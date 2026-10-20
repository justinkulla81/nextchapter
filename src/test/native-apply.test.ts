import { describe, expect, it } from 'vitest'
import { applicationMessage, candidatePlusMarkFor, type ApplicationSnapshot } from '@/lib/jobs/native-apply'

const base: ApplicationSnapshot = {
  jobTitle: 'CFO',
  companyLabel: 'Acme',
  name: 'Pat Doe',
  email: 'pat@example.com',
  phone: null,
  linkedInUrl: null,
  location: null,
  summary: '',
  workAuthorization: null,
  resume: null,
  answers: [],
}

describe('candidatePlusMarkFor', () => {
  it('shows the mark only when the member has Candidate+ and is not in confidential mode', () => {
    expect(candidatePlusMarkFor(true, false)).toBe(true)
    expect(candidatePlusMarkFor(true, true)).toBe(false)
    expect(candidatePlusMarkFor(false, false)).toBe(false)
  })
})

describe('applicationMessage dossier and Candidate+', () => {
  it('has no dossier link and no mark by default', () => {
    const m = applicationMessage(base)
    expect(m).not.toMatch(/Dossier/)
    expect(m).not.toMatch(/Candidate\+/)
  })
  it('includes the dossier link only when attached', () => {
    expect(applicationMessage({ ...base, dossierUrl: 'https://x.test/share/abc' })).toContain('Dossier (attached by the candidate): https://x.test/share/abc')
  })
  it('includes the Candidate+ line when signaled', () => {
    expect(applicationMessage({ ...base, candidatePlus: true })).toContain('Candidate+ member')
  })
})
