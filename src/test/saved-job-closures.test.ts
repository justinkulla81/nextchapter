import { describe, expect, it } from 'vitest'
import { CLOSURE_REASONS, closureDigestEmail, groupByJob, groupByMember, ownerReason, type Closure } from '@/lib/jobs/saved-job-closure-format'

const row = (over: Partial<Closure>): Closure => ({
  candidateId: 'c1', jobId: 'j1', title: 'Chief Financial Officer', companyName: 'Acme', closeReason: 'expired', archivedAt: new Date('2026-11-03T09:00:00Z'),
  disclosure: 'OPEN', level: 'C_SUITE', targetFunction: 'Finance', locationState: 'NY', workArrangement: null, ...over,
})
const member = (id: string) => ({ id, name: id === 'c1' ? 'Dana Reyes' : null, email: `${id}@example.com` })

describe('closure reasons', () => {
  it('counts every way a job comes down except a duplicate (still listed elsewhere)', () => {
    expect([...CLOSURE_REASONS].sort()).toEqual(['aged_out', 'expired', 'expired_checked', 'manual', 'removed'])
    expect(CLOSURE_REASONS as readonly string[]).not.toContain('duplicate')
  })
  it('says each in plain words for the owner', () => {
    expect(ownerReason('expired')).toMatch(/not reconfirmed/)
    expect(ownerReason('removed')).toMatch(/employer/)
    expect(ownerReason('something_new')).toBe('something_new')
  })
})

describe('grouping', () => {
  const rows = [row({}), row({ candidateId: 'c2' }), row({ candidateId: 'c1', jobId: 'j2', title: 'VP Finance', closeReason: 'removed' })]
  it('groups savers under each job, most saved first', () => {
    const jobs = groupByJob(rows, member)
    expect(jobs.map((j) => [j.title, j.savers.length])).toEqual([['Chief Financial Officer', 2], ['VP Finance', 1]])
  })
  it('hides the company of a confidential search', () => {
    expect(groupByJob([row({ disclosure: 'CONFIDENTIAL' })], member)[0].company).toBe('Confidential search')
  })
  it('groups jobs under each member', () => {
    const m = groupByMember(rows)
    expect(m.get('c1')?.length).toBe(2)
    expect(m.get('c2')?.length).toBe(1)
  })
})

describe('owner digest', () => {
  const jobs = groupByJob([row({}), row({ candidateId: 'c2' })], member)
  it('names the job, the reason and who saved it', () => {
    const m = closureDigestEmail({ jobs, memberCount: 2, memberEmails: { mode: 'sent', sent: 2 }, adminUrl: 'https://admin.example/members' })
    expect(m.subject).toBe('1 saved job was taken down: 2 members saved it')
    expect(m.text).toContain('Chief Financial Officer at Acme')
    expect(m.text).toContain('Saved by Dana Reyes <c1@example.com>')
    expect(m.text).toContain('Emails sent to 2 members')
  })
  it('says when member emails are off and how many would have gone', () => {
    const m = closureDigestEmail({ jobs, memberCount: 2, memberEmails: { mode: 'off', wouldSend: 2 }, adminUrl: 'https://admin.example/members' })
    expect(m.text).toContain('Member emails are off')
    expect(m.text).toContain('2 members would have been emailed')
  })
  it('escapes names and titles in the html', () => {
    const m = closureDigestEmail({ jobs: groupByJob([row({ title: '<b>x</b>' })], member), memberCount: 1, memberEmails: { mode: 'sent', sent: 0 }, adminUrl: 'https://admin.example/members' })
    expect(m.html).not.toContain('<b>x</b>')
  })
})
