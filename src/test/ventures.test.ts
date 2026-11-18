import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/plans/visible-members', () => ({ visibleMemberSqlFor: vi.fn() }))

const { ventureFromProfile, isFounderTitle, stageLabel, detailLines } = await import('@/lib/higher-ed/ventures')

describe('ventureFromProfile', () => {
  it('is null when not building or buying a business', () => {
    expect(ventureFromProfile('LAID_OFF', {})).toBeNull()
    expect(ventureFromProfile(null, null)).toBeNull()
  })
  it('an entrepreneur before launch is considering, with the venture name', () => {
    const v = ventureFromProfile('ENTREPRENEUR', { venture: ' Wynwood Data Labs ', start: { stage: 'validate' } })
    expect(v).toMatchObject({ status: 'CONSIDERING', name: 'Wynwood Data Labs', stage: 'validate', buying: false })
  })
  it('launch or grow is started', () => {
    expect(ventureFromProfile('ENTREPRENEUR', { start: { stage: 'launch' } })?.status).toBe('STARTED')
    expect(ventureFromProfile('GROWING', { start: { stage: 'grow' } })?.status).toBe('STARTED')
  })
  it('buying alongside another journey counts; owning or running is started', () => {
    expect(ventureFromProfile('LAID_OFF', { buy: { stage: 'search' } })).toMatchObject({ status: 'CONSIDERING', stage: 'buying:search', buying: true })
    expect(ventureFromProfile('BUY_BUSINESS', { buy: { stage: 'run' } })?.status).toBe('STARTED')
  })
})

describe('isFounderTitle', () => {
  it('matches founders and owners, not product or process owners', () => {
    expect(isFounderTitle('Founder and CEO')).toBe(true)
    expect(isFounderTitle('Co-founder')).toBe(true)
    expect(isFounderTitle('Owner')).toBe(true)
    expect(isFounderTitle('Product Owner')).toBe(false)
    expect(isFounderTitle('Director of Product')).toBe(false)
  })
})

describe('labels', () => {
  it('names stages and buying stages', () => {
    expect(stageLabel('validate')).toBeTruthy()
    expect(stageLabel('buying:own')).toBe('New owner')
    expect(stageLabel(null)).toBeNull()
  })
  it('details in words never include money fields', () => {
    const lines = detailLines({ kind: 'tech' })
    expect(lines.join(' ')).toMatch(/Software/)
  })
})

describe('office names', async () => {
  const { officeNamesOf, officeLabel, WORKSPACES } = await import('@/lib/higher-ed/workspaces')
  it('keeps only renamable offices, trimmed and capped', () => {
    const n = officeNamesOf({ officeNames: { development: '  University Advancement ', candidate: 'Nope', career: '', ventures: 'x'.repeat(80) } })
    expect(n).toEqual({ development: 'University Advancement', ventures: 'x'.repeat(60) })
    expect(officeNamesOf(null)).toEqual({})
  })
  it('falls back to our name', () => {
    const dev = WORKSPACES.find((w) => w.key === 'development')!
    expect(officeLabel(dev, 'college', {})).toBe('Development')
    expect(officeLabel(dev, 'college', { development: 'University Advancement' })).toBe('University Advancement')
  })
})
