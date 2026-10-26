import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
const update = vi.fn()
const findUnique = vi.fn()
const capture = vi.fn()

vi.mock('@/lib/prisma', () => ({ prisma: { homepageLead: { findUnique: (...a: unknown[]) => findUnique(...a), create: (...a: unknown[]) => create(...a), update: (...a: unknown[]) => update(...a) } } }))
vi.mock('@/lib/http/client-ip', () => ({ getClientIp: async () => '203.0.113.9' }))
vi.mock('@/lib/security/rate-limit', () => ({ allowByIp: async () => true, allowByTarget: async () => true, HOUR_MS: 3_600_000, DAY_MS: 86_400_000 }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: (...a: unknown[]) => capture(...a) }))

import { emailResumeCheck, runResumeCheck } from '@/lib/tools/resume-check-actions'

const RESUME = `Pat Lee
pat.lee@example.com | 502-555-0100

Experience
Manager, Acme Corp
2018 – Present
- Responsible for managing the daily duties of the team
- Worked on many different projects with the group
- Helped with customer questions and assisted with training new staff
- Led a project that cut costs by 12% across 3 sites
Education
B.A. Economics, State University, 2016
Skills
Excel, SQL, forecasting, vendor management and team leadership across several functions`

function form(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  findUnique.mockResolvedValue(null)
  create.mockResolvedValue({ id: 'lead1', unsubscribeToken: 'tok123' })
  update.mockResolvedValue({ id: 'lead1', unsubscribeToken: 'tok123' })
})

describe('runResumeCheck', () => {
  it('asks for more text when the résumé is too short', async () => {
    const r = await runResumeCheck(undefined, form({ resume: 'too short' }))
    expect(r.error).toBeTruthy()
    expect(r.teaser).toBeUndefined()
  })

  it('returns the score and counts but none of the fixes, and saves nothing', async () => {
    const r = await runResumeCheck(undefined, form({ resume: RESUME }))
    expect(r.teaser?.score).toBeGreaterThan(0)
    expect(r.teaser?.issueCount).toBeGreaterThan(0)
    expect(r.findings).toBeUndefined()
    expect(JSON.stringify(r)).not.toContain('responsible for')
    expect(create).not.toHaveBeenCalled()
    expect(capture).toHaveBeenCalledWith(expect.stringMatching(/^resume-check-/), 'resume_check_run', expect.objectContaining({ band: expect.any(String) }))
  })
})

describe('emailResumeCheck', () => {
  it('rejects a bad address and unlocks nothing', async () => {
    const r = await emailResumeCheck(undefined, form({ resume: RESUME, email: 'nope' }))
    expect(r.error).toBeTruthy()
    expect(r.findings).toBeUndefined()
    expect(create).not.toHaveBeenCalled()
  })

  it('unlocks the findings, keeps only the email and score band, and never the résumé text', async () => {
    const r = await emailResumeCheck(undefined, form({ resume: RESUME, email: 'Pat@Example.com' }))
    expect(r.findings?.length).toBe(11)
    expect(r.token).toBe('tok123')
    const data = create.mock.calls[0][0].data
    expect(data).toMatchObject({ email: 'pat@example.com', kind: 'resume_check', source: 'resume_check' })
    expect(['strong', 'solid', 'needs_work', 'rework']).toContain(data.followup)
    expect(JSON.stringify(create.mock.calls)).not.toContain('Acme Corp')
    expect(capture).toHaveBeenCalledWith('pat@example.com', 'lead_captured', expect.objectContaining({ kind: 'resume_check', returning: false }))
  })

  it('updates a returning address without re-subscribing it', async () => {
    findUnique.mockResolvedValue({ id: 'lead1', unsubscribeToken: 'tok123' })
    await emailResumeCheck(undefined, form({ resume: RESUME, email: 'pat@example.com' }))
    expect(create).not.toHaveBeenCalled()
    expect(update.mock.calls[0][0].data).not.toHaveProperty('unsubscribedAt')
  })

  it('answers a filled honeypot with nothing saved and nothing unlocked', async () => {
    const r = await emailResumeCheck(undefined, form({ resume: RESUME, email: 'bot@example.com', website: 'http://spam' }))
    expect(r.findings).toBeUndefined()
    expect(create).not.toHaveBeenCalled()
  })
})
