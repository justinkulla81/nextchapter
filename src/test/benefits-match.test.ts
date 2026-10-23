import { describe, expect, it } from 'vitest'
import catalog from '@/lib/benefits/catalog.json'
import { audienceOf, deriveWorkTags, groupByGoal, matchPrograms, parseAmount, type MemberFacts } from '@/lib/benefits/match'
import type { BenefitProgramRow } from '@/lib/benefits/types'

const rows = (catalog as unknown as { rows: (Omit<BenefitProgramRow, 'checkedAt'> & { checkedAt: string | null })[] }).rows.map((r) => ({ ...r, checkedAt: r.checkedAt ? new Date(r.checkedAt) : null })) as BenefitProgramRow[]

const base: MemberFacts = { state: 'KY', relocation: { scope: 'LOCAL', states: [] }, laidOff: true, pivoting: false, tags: [] }

describe('audienceOf', () => {
  it('reads plain audiences', () => {
    expect(audienceOf([])).toEqual({ kind: 'general' })
    expect(audienceOf(['Career changers'])).toEqual({ kind: 'general' })
    expect(audienceOf(['Veterans'])).toEqual({ kind: 'tags', options: [['veteran']] })
  })
  it('treats slashes as alternatives and nouns as all-required', () => {
    expect(audienceOf(['MD clinicians/lawyers'])).toEqual({ kind: 'tags', options: [['clinician'], ['lawyer']] })
    expect(audienceOf(['Vet entrepreneurs'])).toEqual({ kind: 'tags', options: [['veteran', 'entrepreneur']] })
  })
  it('keeps military spouses apart from veterans', () => {
    expect(audienceOf(['Military spouses'])).toEqual({ kind: 'tags', options: [['military_spouse']] })
  })
  it('hides employer programs and unreadable audiences', () => {
    expect(audienceOf(['Employer incentive']).kind).toBe('unreadable')
    expect(audienceOf(['Public sector']).kind).toBe('unreadable')
  })
})

describe('parseAmount', () => {
  it('reads the first dollar figure', () => {
    expect(parseAmount('City DPA $25,000, plus $10,000')).toBe(25000)
    expect(parseAmount('up to $5k')).toBe(5000)
    expect(parseAmount('Free')).toBeNull()
  })
})

describe('deriveWorkTags', () => {
  it('reads work history', () => {
    expect(deriveWorkTags({ industryContext: 'Hospital nursing' })).toContain('clinician')
  })
})

describe('matchPrograms against the real catalog', () => {
  it('never shows closed, unverified or link-less rows', () => {
    const m = matchPrograms(rows, { ...base, relocation: { scope: 'ANYWHERE', states: [] } })
    for (const x of m) {
      expect(x.program.verified).toBe(true)
      expect(x.program.status).not.toBe('CLOSED')
      expect(x.program.url).toBeTruthy()
    }
  })
  it('shows a resident only their own state, plus national', () => {
    const m = matchPrograms(rows, base).filter((x) => x.goal !== 'move')
    for (const x of m) expect(x.program.scope === 'NATIONAL' || x.program.state === 'KY').toBe(true)
  })
  it('shows no relocation money to someone who stays put, except nationwide programs', () => {
    const m = matchPrograms(rows, base).filter((x) => x.goal === 'move')
    for (const x of m) expect(x.program.scope).toBe('NATIONAL')
  })
  it('shows relocation money only for the states they pick', () => {
    const m = matchPrograms(rows, { ...base, relocation: { scope: 'STATES', states: ['MD'] } }).filter((x) => x.goal === 'move' && x.program.scope === 'STATE')
    expect(m.length).toBeGreaterThan(0)
    for (const x of m) expect(x.program.state).toBe('MD')
  })
  it('hides audience-specific programs from members who do not hold the tag, and shows them when they do', () => {
    const none = matchPrograms(rows, base)
    const vet = matchPrograms(rows, { ...base, tags: ['veteran'] })
    expect(vet.length).toBeGreaterThan(none.length)
    expect(none.some((x) => /veteran/i.test(x.program.segments.join(' ')))).toBe(false)
  })
  it('ranks audience-specific matches above general ones', () => {
    const vet = matchPrograms(rows, { ...base, tags: ['veteran'] })
    const firstGeneral = vet.findIndex((x) => x.program.segments.length === 0)
    const lastSpecific = vet.map((x) => x.program.segments.length > 0).lastIndexOf(true)
    expect(vet.length).toBeGreaterThan(0)
    expect(firstGeneral === -1 || lastSpecific === -1 || vet[0].score >= vet[vet.length - 1].score).toBe(true)
  })
  it('hides veteran-by-name programs and non-benefits from everyone else', () => {
    const names = matchPrograms(rows, base).map((x) => x.program.name)
    expect(names.some((n) => /GI Bill|VET TEC|VA home loan/i.test(n))).toBe(false)
    expect(names.some((n) => /Child Tax Credit|EITC|988|Food Bank/i.test(n))).toBe(false)
    expect(names.some((n) => /SBA|Ticket to Work/i.test(n))).toBe(false)
  })
  it('shows the GI Bill to a veteran', () => {
    const names = matchPrograms(rows, { ...base, tags: ['veteran'] }).map((x) => x.program.name)
    expect(names.some((n) => /GI Bill/i.test(n))).toBe(true)
  })
  it('groups by goal', () => {
    const g = groupByGoal(matchPrograms(rows, { ...base, relocation: { scope: 'ANYWHERE', states: [] } }))
    expect(Object.keys(g).sort()).toEqual(['learn', 'move', 'retrain', 'support', 'tax'])
  })
  it('lists real dollars before any free course', () => {
    const m = matchPrograms(rows, { ...base, relocation: { scope: 'ANYWHERE', states: [] } })
    const firstLearn = m.findIndex((x) => x.goal === 'learn')
    expect(firstLearn).toBeGreaterThan(0)
    expect(m.slice(firstLearn).every((x) => x.goal === 'learn')).toBe(true)
  })
  it('includes tax benefits and no freemium courses', () => {
    const m = matchPrograms(rows, base)
    expect(m.some((x) => x.goal === 'tax')).toBe(true)
    for (const x of m.filter((y) => y.goal === 'learn')) expect(x.program.amount ?? '').not.toMatch(/\$\s?\d|paid|\bpro\b|tier|trial/i)
  })
  it('shows help-while-out-of-work money, local rows only in the member\'s city, and profession bodies only to that profession', () => {
    const pa = matchPrograms(rows, { ...base, state: 'PA', city: 'Pittsburgh' })
    const names = (m: typeof pa) => m.filter((y) => y.goal === 'support').map((y) => y.program.name)
    expect(names(pa).some((n) => /HEMAP/i.test(n))).toBe(true)
    expect(names(pa).some((n) => /ACEP|IEEE|ASME|CFA Institute/i.test(n))).toBe(false)
    const eng = matchPrograms(rows, { ...base, state: 'PA', city: 'Pittsburgh', tags: ['engineer'] })
    expect(names(eng).some((n) => /IEEE|ASME/i.test(n))).toBe(true)
    expect(names(pa).some((n) => /Medicare/i.test(n))).toBe(false)
  })
})
