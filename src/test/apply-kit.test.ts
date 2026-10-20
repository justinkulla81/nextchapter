import { describe, it, expect } from 'vitest'
import { buildApplyKit, pickResume, profileSummary, workAuthAnswer, type ApplyKitProfile } from '@/lib/jobs/apply-kit'
import { applicationMessage, cleanShortAnswers, nativePosterOf } from '@/lib/jobs/native-apply'

const base: ApplyKitProfile = {
  firstName: 'Dana',
  primaryFunction: 'Finance',
  targetFunction: null,
  yearsExperience: 15,
  topStrengths: ['calm_under_pressure', 'people_manager'],
  positioningStatementText: null,
  targetCompMin: 180000,
  compFlexible: false,
  currentJobStatus: 'LAID_OFF',
  workAuthorization: 'us_citizen',
  visaStatus: null,
  openToRelocation: false,
  relocationNotes: null,
  travelWillingness: true,
  currentCity: 'Louisville',
  currentState: 'KY',
}
const job = { title: 'VP Finance', companyName: 'Acme', confidential: false, location: 'Remote' }
const field = (p: ApplyKitProfile, f: string, j = job) => buildApplyKit(p, j).find((a) => a.field === f)!

describe('buildApplyKit', () => {
  it('answers every standard question, from the profile', () => {
    const kit = buildApplyKit(base, job)
    expect(kit.map((a) => a.field)).toEqual(['why_company', 'years', 'pay', 'start_date', 'work_auth', 'relocation', 'travel'])
    expect(field(base, 'years').text).toBe('15')
    expect(field(base, 'pay').text).toContain('$180k')
    expect(field(base, 'start_date').text).toMatch(/immediately/)
    expect(field(base, 'work_auth').text).toMatch(/citizen/)
    expect(field(base, 'relocation').text).toContain('Louisville, KY')
    expect(field(base, 'travel').text).toMatch(/^Yes/)
    expect(field(base, 'why_company').text).toContain('Acme')
    expect(field(base, 'why_company').text).toContain('staying calm under pressure and managing people well')
  })

  it('gives notice for employed members and never names a confidential company', () => {
    expect(field({ ...base, currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE' }, 'start_date').text).toMatch(/two weeks/)
    const why = field(base, 'why_company', { ...job, confidential: true })
    expect(why.text).not.toContain('Acme')
    expect(why.label).toBe('Why this company?')
  })

  it('leaves blanks with a fix-it hint when the profile is missing data', () => {
    const p = { ...base, yearsExperience: null, workAuthorization: null, targetCompMin: null }
    expect(field(p, 'years').text).toBe('')
    expect(field(p, 'years').hint).toMatch(/Add your years/)
    expect(field(p, 'work_auth').text).toBe('')
    expect(field(p, 'pay').text).not.toMatch(/\$/)
  })
})

describe('profileSummary / workAuthAnswer', () => {
  it('prefers the approved positioning statement', () => {
    expect(profileSummary({ ...base, positioningStatementText: 'I fix broken finance teams.' })).toBe('I fix broken finance teams.')
    expect(profileSummary(base)).toBe('15 years in finance, known for staying calm under pressure and managing people well.')
  })
  it('names the visa when sponsorship is needed', () => {
    expect(workAuthAnswer({ workAuthorization: 'need_sponsorship', visaStatus: 'h1b' })).toContain('H-1B')
    expect(workAuthAnswer({ workAuthorization: null, visaStatus: null })).toBeNull()
  })
})

describe('pickResume', () => {
  const r = (id: string, label: string | null, days: number) => ({ id, label, fileName: `${id}.pdf`, description: null, uploadedAt: new Date(Date.UTC(2026, 9, days)) })
  it('picks the version named for the role, else the newest', () => {
    expect(pickResume([], 'VP Finance')).toBeNull()
    expect(pickResume([r('a', 'General', 1), r('b', 'Finance leadership', 2), r('c', 'Operations', 3)], 'VP Finance')!.resume.id).toBe('b')
    expect(pickResume([r('a', 'General', 1), r('c', 'Marketing', 3)], 'VP Finance')!.resume.id).toBe('c')
  })
})

describe('native apply', () => {
  it('is only for jobs an employer or recruiter posted on NextChapter', () => {
    expect(nativePosterOf({ source: 'employer', submittedByEmployerId: 'e1', submittedByRecruiterId: null })).toEqual({ kind: 'employer', id: 'e1' })
    expect(nativePosterOf({ source: 'recruiter', submittedByEmployerId: null, submittedByRecruiterId: 'r1' })).toEqual({ kind: 'recruiter', id: 'r1' })
    expect(nativePosterOf({ source: 'ncrawl', submittedByEmployerId: null, submittedByRecruiterId: null })).toBeNull()
    expect(nativePosterOf({ source: 'employer', submittedByEmployerId: null, submittedByRecruiterId: null })).toBeNull()
  })

  it('drops blank short answers and caps their length and count', () => {
    const out = cleanShortAnswers([
      { question: 'Q1', answer: '  ' },
      { question: 'Q2', answer: 'x'.repeat(900) },
      { question: 'Q3', answer: 'third' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].answer).toHaveLength(600)
  })

  it('sends only the reviewed fields', () => {
    const body = applicationMessage({
      jobTitle: 'VP Finance',
      companyLabel: '',
      name: 'Dana Smith',
      email: 'dana@example.com',
      phone: null,
      linkedInUrl: null,
      location: 'Louisville, KY',
      summary: 'Fifteen years in finance.',
      workAuthorization: 'Yes.',
      resume: { id: 'r', name: 'Finance CV' },
      answers: [{ question: 'Why?', answer: 'Because.' }],
    })
    expect(body).toContain('Name: Dana Smith')
    expect(body).not.toContain('Phone:')
    expect(body).toContain('Résumé: Finance CV')
    expect(body).toContain('Because.')
    expect(body).not.toMatch(/\n{3,}/)
  })
})
