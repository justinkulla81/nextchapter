import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: () => {} }))
vi.mock('@/lib/institution/admin', () => ({ createInstitution: async () => ({ id: 'x' }) }))
vi.mock('@/lib/admin/outplacement-contracts', () => ({ createOutplacementOrg: async () => ({ id: 'x' }) }))

import { validateCreateInput, type CreateOrganizationInput } from './service'

const base: CreateOrganizationInput = { name: 'Riverside College', portals: ['HIGHER_ED'], mode: 'demo' }

describe('validateCreateInput', () => {
  it('accepts a minimal demo', () => {
    expect(validateCreateInput(base)).toBeNull()
  })
  it('needs a name and at least one portal', () => {
    expect(validateCreateInput({ ...base, name: '  ' })).toMatch(/name/)
    expect(validateCreateInput({ ...base, portals: [] })).toMatch(/at least one portal/)
  })
  it('refuses a workforce board for now', () => {
    expect(validateCreateInput({ ...base, portals: ['WORKFORCE'] })).toMatch(/not available/)
  })
  it('refuses a bad brand color', () => {
    expect(validateCreateInput({ ...base, brand: { accent: 'blue' } })).toMatch(/color/)
    expect(validateCreateInput({ ...base, brand: { accent: '#1d6fb8' } })).toBeNull()
  })
  it('needs an admin email for a live non-college portal, not for a live college', () => {
    expect(validateCreateInput({ ...base, mode: 'live', portals: ['COACH'] })).toMatch(/email/)
    expect(validateCreateInput({ ...base, mode: 'live', portals: ['COACH'], contactEmail: 'lead@acme.com' })).toBeNull()
    expect(validateCreateInput({ ...base, mode: 'live', portals: ['HIGHER_ED'] })).toBeNull()
  })
  it('does not need an email for a demo', () => {
    expect(validateCreateInput({ ...base, mode: 'demo', portals: ['COACH', 'RECRUITER', 'HIRING'] })).toBeNull()
  })
})
