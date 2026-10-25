import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  orgWorkspace: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  organization: { findUnique: vi.fn(), update: vi.fn() },
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const capture = vi.hoisted(() => vi.fn())
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: capture }))

import { WORKSPACE_PLANS, effectivePlan, isWorkspacePlan, planLabel } from '@/lib/employer/plans'
import { setOrganizationEnterprise, setWorkspacePlan } from '@/lib/employer/section-plans'
import { readFileSync } from 'node:fs'

beforeEach(() => {
  vi.clearAllMocks()
  db.orgWorkspace.update.mockResolvedValue({})
  db.orgWorkspace.updateMany.mockResolvedValue({ count: 2 })
  db.organization.update.mockResolvedValue({})
})

describe('plans', () => {
  it('are labels, never amounts', () => {
    expect(WORKSPACE_PLANS.map((p) => p.key)).toEqual(['FREE', 'PAID', 'CONTRACT', 'ENTERPRISE'])
    for (const p of WORKSPACE_PLANS) expect(`${p.label} ${p.means}`).not.toMatch(/[$€£]|\d/)
    expect(isWorkspacePlan('PAID')).toBe(true)
    expect(isWorkspacePlan('GOLD')).toBe(false)
    expect(planLabel('CONTRACT')).toBe('Contract')
  })
  it('the enterprise package covers every section without changing the rows', () => {
    expect(effectivePlan('FREE', true)).toBe('ENTERPRISE')
    expect(effectivePlan('PAID', false)).toBe('PAID')
  })
  it('no price appears in the staff screen, the plan strings or the chooser copy', () => {
    for (const f of ['src/components/admin/EmployerSectionPlans.tsx', 'src/lib/employer/plans.ts', 'src/components/employer/SectionChooser.tsx', 'src/app/employer-home/page.tsx']) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
      const copy = [...src.matchAll(/['"`]([^'"`\n]{6,})['"`]/g)].map((m) => m[1]).join('\n')
      expect(copy).not.toMatch(/\$\s?\d|\bper (seat|month|year)\b|\bUSD\b/i)
    }
  })
})

describe('setWorkspacePlan', () => {
  const ws = (over = {}) => ({ id: 'w1', orgId: 'o1', type: 'EMPLOYEES', plan: 'FREE', org: { enterprise: false }, ...over })

  it('records the plan, that staff set it and when, and fires an event', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(ws())
    expect(await setWorkspacePlan({ workspaceId: 'w1', plan: 'PAID', note: ' paid by card ', actor: 'justin@x.com' })).toEqual({ organizationId: 'o1' })
    const data = db.orgWorkspace.update.mock.calls[0][0].data
    expect(data).toMatchObject({ plan: 'PAID', planSource: 'STAFF', planNote: 'paid by card' })
    expect(data.planUpdatedAt).toBeInstanceOf(Date)
    expect(capture).toHaveBeenCalledWith('justin@x.com', 'employer_section_plan_set', { organizationId: 'o1', workspaceId: 'w1', section: 'employees', from: 'FREE', to: 'PAID' })
  })
  it('refuses an unknown plan, and a workspace that is not an employer section', async () => {
    expect(await setWorkspacePlan({ workspaceId: 'w1', plan: 'GOLD', actor: null })).toEqual({ error: expect.any(String) })
    db.orgWorkspace.findUnique.mockResolvedValue(ws({ type: 'COACH' }))
    expect(await setWorkspacePlan({ workspaceId: 'w1', plan: 'PAID', actor: null })).toEqual({ error: expect.stringContaining('Hiring, Employees and Outplacement') })
    expect(db.orgWorkspace.update).not.toHaveBeenCalled()
  })
  it('allows Enterprise only when the organization has the package', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(ws())
    expect(await setWorkspacePlan({ workspaceId: 'w1', plan: 'ENTERPRISE', actor: null })).toEqual({ error: expect.stringContaining('enterprise package') })
    db.orgWorkspace.findUnique.mockResolvedValue(ws({ org: { enterprise: true } }))
    expect(await setWorkspacePlan({ workspaceId: 'w1', plan: 'ENTERPRISE', actor: null })).toMatchObject({ organizationId: 'o1' })
  })
  it('touches no payment: only plan fields are written', async () => {
    db.orgWorkspace.findUnique.mockResolvedValue(ws())
    await setWorkspacePlan({ workspaceId: 'w1', plan: 'CONTRACT', actor: null })
    expect(Object.keys(db.orgWorkspace.update.mock.calls[0][0].data).sort()).toEqual(['plan', 'planNote', 'planSource', 'planUpdatedAt'])
  })
})

describe('setOrganizationEnterprise', () => {
  it('turns it on and stamps the date once', async () => {
    db.organization.findUnique.mockResolvedValue({ id: 'o1', enterprise: false, enterpriseSince: null })
    expect(await setOrganizationEnterprise({ organizationId: 'o1', on: true, actor: 'a' })).toEqual({})
    expect(db.organization.update.mock.calls[0][0].data).toMatchObject({ enterprise: true })
    expect(db.organization.update.mock.calls[0][0].data.enterpriseSince).toBeInstanceOf(Date)
    expect(db.orgWorkspace.updateMany).not.toHaveBeenCalled()
    expect(capture).toHaveBeenCalledWith('a', 'employer_enterprise_set', { organizationId: 'o1', enterprise: true, sectionsReset: 0 })
  })
  it('turning it off sends sections marked Enterprise back to Free', async () => {
    db.organization.findUnique.mockResolvedValue({ id: 'o1', enterprise: true, enterpriseSince: new Date() })
    await setOrganizationEnterprise({ organizationId: 'o1', on: false, actor: 'a' })
    expect(db.organization.update.mock.calls[0][0].data).toEqual({ enterprise: false, enterpriseSince: null })
    expect(db.orgWorkspace.updateMany.mock.calls[0][0]).toMatchObject({ where: { orgId: 'o1', plan: 'ENTERPRISE' }, data: { plan: 'FREE' } })
    expect(capture).toHaveBeenCalledWith('a', 'employer_enterprise_set', expect.objectContaining({ enterprise: false, sectionsReset: 2 }))
  })
  it('does nothing when it is already in that state, and says so when the organization is gone', async () => {
    db.organization.findUnique.mockResolvedValue({ id: 'o1', enterprise: true, enterpriseSince: new Date() })
    expect(await setOrganizationEnterprise({ organizationId: 'o1', on: true, actor: null })).toEqual({})
    expect(db.organization.update).not.toHaveBeenCalled()
    db.organization.findUnique.mockResolvedValue(null)
    expect(await setOrganizationEnterprise({ organizationId: 'x', on: true, actor: null })).toEqual({ error: 'Organization not found.' })
  })
})
