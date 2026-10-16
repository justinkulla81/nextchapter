import { describe, expect, it } from 'vitest'
import { getAiToolsForFunction } from '@/lib/constants/ai-tools-by-function'
import { PLACES, lockReasonFor, statusLockedTabs, tabSituation, visibleTabs } from '@/lib/nav/places'

const jobs = PLACES.find((p) => p.key === 'jobs')!
const tab = (label: string) => jobs.tabs.find((t) => t.label === label)!
const open = { hasEmailConnection: true, skillsAssessmentCompleted: true }

describe('place tabs follow the member situation', () => {
  it('shows everything when the situation is unknown', () => {
    expect(visibleTabs(jobs, { employed: true, earlyCareer: true }).length).toBe(jobs.tabs.length)
  })
  it('locks job search while managing a career, with a reason that points to the status box', () => {
    expect(tabSituation(tab('Find a job'), 'STAYING')).toBe('locked')
    expect(lockReasonFor('/dashboard/find-my-job', { ...open, mode: 'STAYING' }, tab('Find a job'))).toMatch(/Turn on more tools/)
    expect(statusLockedTabs(jobs, { employed: true, mode: 'STAYING' })).toContain('Find a job')
  })
  it('shows the career-case tab only while managing a career', () => {
    expect(tabSituation(tab('Build your case'), 'STAYING')).toBe('show')
    expect(tabSituation(tab('Build your case'), 'ACTIVE')).toBe('hide')
  })
  it('a tab with no rule always shows', () => {
    expect(tabSituation(tab('Know your worth'), 'LANDED')).toBe('show')
  })
})

describe('Learn is open before the skills assessment', () => {
  const learn = PLACES.find((p) => p.key === 'learn')!
  const unassessed = { hasEmailConnection: true, skillsAssessmentCompleted: false }
  it('does not lock any Learn tab on the assessment', () => {
    for (const t of learn.tabs) expect(lockReasonFor(t.href, unassessed, t)).toBeNull()
  })
  it('still locks Gmail-gated pages without a connection', () => {
    expect(lockReasonFor('/dashboard/network', { hasEmailConnection: false, skillsAssessmentCompleted: false })).toMatch(/Gmail/)
  })
  it('has default tools to preview when no function is known', () => {
    expect(getAiToolsForFunction(null).length).toBeGreaterThan(0)
  })
})
