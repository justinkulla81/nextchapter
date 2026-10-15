import { describe, expect, it } from 'vitest'
import { choiceForMember, earlyCareerAudience, featureVisible, targetRolePlaceholder, yearsForChoice, type AudienceFeature } from '@/lib/early-career/audience'
import { checklistRows, EARLY_GROWTH_CHECKLIST, FIRST_JOB_CHECKLIST, nextItem } from '@/lib/early-career/checklist'
import { MAJORS, majorForFieldOfStudy } from '@/lib/early-career/major-roles'
import { pickEarlyPay, type PayRow } from '@/lib/early-career/pay'
import { parseEducationForm } from '@/lib/early-career/education-form'
import { journeyPlanItems, shapePlan } from '@/lib/journey/plan'
import { defaultWorkTypes } from '@/lib/jobs/work-type'
import { PLACES, visibleTabs } from '@/lib/nav/places'

describe('earlyCareerAudience', () => {
  it('reads the student journey as a new grad, or early career with 2+ years', () => {
    expect(earlyCareerAudience({ journey: 'STUDENT_NEW_GRAD' })).toBe('NEW_GRAD')
    expect(earlyCareerAudience({ journey: 'STUDENT_NEW_GRAD', yearsExperience: 1 })).toBe('NEW_GRAD')
    expect(earlyCareerAudience({ journey: 'STUDENT_NEW_GRAD', yearsExperience: 3 })).toBe('EARLY_CAREER')
    // Never mid-level on the student journey, whatever the years say.
    expect(earlyCareerAudience({ journey: 'STUDENT_NEW_GRAD', yearsExperience: 7 })).toBe('EARLY_CAREER')
  })
  it('reads members from before journeys by their old job status', () => {
    expect(earlyCareerAudience({ currentJobStatus: 'NEW_GRADUATE_FIRST_JOB' })).toBe('NEW_GRAD')
  })
  it('places other journeys on the career ladder by years', () => {
    expect(earlyCareerAudience({ journey: 'READY_TO_MOVE', highestLevelReached: 'IC', yearsExperience: 1 })).toBe('NEW_GRAD')
    expect(earlyCareerAudience({ journey: 'PROMOTION', highestLevelReached: 'IC', yearsExperience: 3 })).toBe('EARLY_CAREER')
    expect(earlyCareerAudience({ journey: 'LAID_OFF', yearsExperience: 4 })).toBe('EARLY_CAREER')
  })
  it('leaves mid-career, senior and unknown members alone', () => {
    expect(earlyCareerAudience({ journey: 'READY_TO_MOVE', highestLevelReached: 'IC', yearsExperience: 6 })).toBeNull()
    expect(earlyCareerAudience({ journey: 'NEXT_ACT', highestLevelReached: 'VP', yearsExperience: 25 })).toBeNull()
    expect(earlyCareerAudience({ journey: 'READY_TO_MOVE', highestLevelReached: 'Director', yearsExperience: 3 })).toBeNull()
    expect(earlyCareerAudience({})).toBeNull()
  })
})

describe('featureVisible', () => {
  const senior: AudienceFeature[] = ['board_advisory', 'interim_launch_plan', 'executive_upsells']
  it('hides executive-only features from new grads and early-career members', () => {
    for (const f of senior) {
      expect(featureVisible(f, 'NEW_GRAD')).toBe(false)
      expect(featureVisible(f, 'EARLY_CAREER')).toBe(false)
      expect(featureVisible(f, null)).toBe(true)
    }
  })
  it('shows early-career features only to the early-career audience', () => {
    expect(featureVisible('early_career_plan', 'NEW_GRAD')).toBe(true)
    expect(featureVisible('early_career_plan', 'EARLY_CAREER')).toBe(true)
    expect(featureVisible('early_career_plan', null)).toBe(false)
    expect(featureVisible('major_role_picker', 'NEW_GRAD')).toBe(true)
    expect(featureVisible('major_role_picker', 'EARLY_CAREER')).toBe(false)
    expect(featureVisible('early_promotion_path', 'EARLY_CAREER')).toBe(true)
    expect(featureVisible('early_promotion_path', 'NEW_GRAD')).toBe(false)
    expect(featureVisible('grad_school_guide', null)).toBe(false)
  })
  it('never shows a senior example to a new grad', () => {
    expect(targetRolePlaceholder('NEW_GRAD')).not.toMatch(/VP|director|chief/i)
    expect(targetRolePlaceholder(null)).toBe('e.g. VP of Operations')
  })
})

describe('onboarding career-stage choice', () => {
  it('fills in years from the stage when none are typed', () => {
    expect(yearsForChoice('new_grad', undefined)).toBe(0)
    expect(yearsForChoice('early', undefined)).toBe(3)
    expect(yearsForChoice('experienced', undefined)).toBeUndefined()
    expect(yearsForChoice(null, undefined)).toBeUndefined()
  })
  it('keeps a typed number inside the stage, replaces one that contradicts it', () => {
    expect(yearsForChoice('new_grad', 1)).toBe(1)
    expect(yearsForChoice('early', 4)).toBe(4)
    expect(yearsForChoice('new_grad', 12)).toBe(0) // résumé-parsed 12 left in the box
    expect(yearsForChoice('early', 1)).toBe(3)
    expect(yearsForChoice('experienced', 2)).toBe(2)
  })
  it('the chosen stage round-trips to the same audience', () => {
    expect(earlyCareerAudience({ highestLevelReached: 'IC', yearsExperience: yearsForChoice('new_grad', undefined) })).toBe('NEW_GRAD')
    expect(earlyCareerAudience({ highestLevelReached: 'IC', yearsExperience: yearsForChoice('early', undefined) })).toBe('EARLY_CAREER')
    expect(choiceForMember({ highestLevelReached: 'IC', yearsExperience: 0 })).toBe('new_grad')
    expect(choiceForMember({ highestLevelReached: 'IC', yearsExperience: 3 })).toBe('early')
    expect(choiceForMember({ highestLevelReached: 'Director' })).toBe('experienced')
    expect(choiceForMember({})).toBeNull()
  })
})

describe('checklists', () => {
  const none = { hasEducation: false, hasResume: false, hasLinkedIn: false, hasTargetRole: false, trackedCompanies: 0 }
  it('gives new grads the first-job checklist and 2-5 years the growth checklist', () => {
    expect(checklistRows('NEW_GRAD', [], none).map((r) => r.id)).toEqual(FIRST_JOB_CHECKLIST.map((i) => i.id))
    expect(checklistRows('EARLY_CAREER', [], none).map((r) => r.id)).toEqual(EARLY_GROWTH_CHECKLIST.map((i) => i.id))
  })
  it('detects what the profile already proves and keeps what the member checked', () => {
    const rows = checklistRows('NEW_GRAD', ['skills'], { ...none, hasEducation: true, hasResume: true, trackedCompanies: 12 })
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
    expect(byId.education).toMatchObject({ done: true, auto: true })
    expect(byId.resume).toMatchObject({ done: true, auto: true })
    expect(byId.employers).toMatchObject({ done: true, auto: true })
    expect(byId.skills).toMatchObject({ done: true, auto: false })
    expect(byId.linkedin.done).toBe(false)
    expect(nextItem(rows)?.id).toBe('target_roles')
  })
  it('every item links to a dashboard page, and ids are unique per list', () => {
    for (const list of [FIRST_JOB_CHECKLIST, EARLY_GROWTH_CHECKLIST]) {
      expect(new Set(list.map((i) => i.id)).size).toBe(list.length)
      for (const i of list) expect(i.href.startsWith('/dashboard/')).toBe(true)
    }
  })
})

describe('major → roles', () => {
  it('reads majors as written on a résumé', () => {
    expect(majorForFieldOfStudy('B.S. Mechanical Engineering')?.key).toBe('mechanical_engineering')
    expect(majorForFieldOfStudy('Biomedical Engineering')?.key).toBe('chemistry_bio')
    expect(majorForFieldOfStudy('Economics')?.key).toBe('finance')
    expect(majorForFieldOfStudy('Computer Science')?.key).toBe('computer_science')
    expect(majorForFieldOfStudy('Marketing')?.key).toBe('marketing')
    expect(majorForFieldOfStudy('Business Economics')?.key).toBe('finance')
    expect(majorForFieldOfStudy('Business Administration')?.key).toBe('business')
    expect(majorForFieldOfStudy('Underwater basket weaving')).toBeNull()
    expect(majorForFieldOfStudy(null)).toBeNull()
  })
  it('has well-formed O*NET-SOC codes and 3+ roles per major', () => {
    for (const m of MAJORS) {
      expect(m.roles.length).toBeGreaterThanOrEqual(3)
      for (const r of m.roles) if (r.soc) expect(r.soc).toMatch(/^\d{2}-\d{4}\.\d{2}$/)
    }
  })
})

describe('starting pay', () => {
  const row = (fn: string, seniorityGroup: string, p50: number): PayRow => ({ fn, seniorityGroup, p25: p50 - 10_000, p50, p75: p50 + 10_000, sampleSize: 40 })
  it('never falls back to senior pay', () => {
    expect(pickEarlyPay([row('Engineering', 'SENIOR_IC', 190_000), row('*', 'MANAGER', 145_000)], 'NEW_GRAD', 'Engineering')).toBeNull()
  })
  it('prefers the member’s own level and function, then all functions', () => {
    const rows = [row('*', 'ENTRY_LEVEL', 62_000), row('Finance', 'ENTRY_LEVEL', 70_000), row('Finance', 'EARLY_CAREER', 85_000)]
    expect(pickEarlyPay(rows, 'NEW_GRAD', 'Finance')).toMatchObject({ p50: 70_000, group: 'ENTRY_LEVEL', allFunctions: false })
    expect(pickEarlyPay(rows, 'NEW_GRAD', 'Sales')).toMatchObject({ p50: 62_000, allFunctions: true })
    expect(pickEarlyPay(rows, 'EARLY_CAREER', 'Finance')).toMatchObject({ p50: 85_000, group: 'EARLY_CAREER' })
  })
  it('labels a level-up fallback as a ceiling', () => {
    const p = pickEarlyPay([row('*', 'MID_LEVEL', 110_000)], 'EARLY_CAREER', null)
    expect(p?.group).toBe('MID_LEVEL')
    expect(p?.note).toMatch(/ceiling/)
    expect(pickEarlyPay([row('*', 'MID_LEVEL', 110_000)], 'NEW_GRAD', null)).toBeNull()
  })
})

describe('weekly plan by career stage', () => {
  it('adds the early-career steps to any journey', () => {
    const texts = journeyPlanItems('READY_TO_MOVE', 'PREPARING', 1, 'EARLY_CAREER').map((i) => i.text)
    expect(texts).toContain('Write down three wins with numbers')
    expect(texts).toContain('Find a mentor or sponsor two levels up')
  })
  it('does not repeat what the promotion plan already asks', () => {
    const texts = journeyPlanItems('PROMOTION', 'PREPARING', 1, 'EARLY_CAREER').map((i) => i.text)
    expect(texts).not.toContain('Write down three wins with numbers')
    expect(texts).toContain('Write down three wins from this quarter')
    expect(texts).toContain('Find a mentor or sponsor two levels up')
  })
  it('gives a new grad the first-job plan', () => {
    const items = journeyPlanItems('STUDENT_NEW_GRAD', 'PREPARING', 1, 'NEW_GRAD')
    expect(items.map((i) => i.text)).toContain('Pick two or three target roles from your major')
    expect(items.some((i) => i.actionType === 'LINKEDIN_SETUP')).toBe(true)
  })
  it('drops interim, fractional and board steps for early-career members only', () => {
    const general = [{ text: 'Explore an interim job', actionType: 'INTERIM_PROFILE_CREATED' }, { text: 'Apply to a new job', actionType: 'JOB_APPLICATION_SUBMITTED' }, { text: 'Use the job board' }]
    const early = shapePlan('RETURNING', 'APPLYING', 1, general, 'NEW_GRAD')
    expect(early.some((i) => i.actionType === 'INTERIM_PROFILE_CREATED')).toBe(false)
    expect(early.some((i) => i.text === 'Use the job board')).toBe(true) // "job board" is not a board seat
    const senior = shapePlan('RETURNING', 'APPLYING', 1, general)
    expect(senior.some((i) => i.actionType === 'INTERIM_PROFILE_CREATED')).toBe(true)
  })
  it('frames a new grad’s offer as a first salary', () => {
    expect(journeyPlanItems('STUDENT_NEW_GRAD', 'OFFER', 3, 'NEW_GRAD')[0].text).toMatch(/starting pay/)
  })
})

describe('job board and nav personalization', () => {
  it('turns internships (contract) on by default for students only', () => {
    expect(defaultWorkTypes({ journey: 'STUDENT_NEW_GRAD' })).toEqual(['full_time', 'contract'])
    expect(defaultWorkTypes({ journey: 'READY_TO_MOVE' })).toEqual(['full_time'])
    expect(defaultWorkTypes({ journey: 'STUDENT_NEW_GRAD', jobBoardWorkTypes: ['full_time'] })).toEqual(['full_time'])
  })
  it('shows the Early career plan tab only to early-career members', () => {
    const jobs = PLACES.find((p) => p.key === 'jobs')!
    expect(visibleTabs(jobs, { employed: false, earlyCareer: true }).some((t) => t.href === '/dashboard/early-career')).toBe(true)
    expect(visibleTabs(jobs, { employed: false }).some((t) => t.href === '/dashboard/early-career')).toBe(false)
  })
})

describe('school form', () => {
  const fd = (o: Record<string, string>) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(o)) f.set(k, v)
    return f
  }
  it('requires a school and a sane graduation year, and keeps the rest optional', () => {
    expect(parseEducationForm(fd({ schoolName: '' })).error).toMatch(/school/)
    expect(parseEducationForm(fd({ schoolName: 'Ohio State', graduationYear: '20' })).error).toMatch(/four digits/)
    expect(parseEducationForm(fd({ schoolName: 'Ohio State', degree: "Bachelor's", fieldOfStudy: 'Economics', graduationYear: '2026' })).value).toEqual({
      schoolName: 'Ohio State',
      degree: "Bachelor's",
      fieldOfStudy: 'Economics',
      graduationYear: 2026,
    })
    expect(parseEducationForm(fd({ schoolName: 'Ohio State', degree: 'Other' })).value?.degree).toBeNull()
  })
})
