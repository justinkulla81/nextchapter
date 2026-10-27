import { describe, expect, it } from 'vitest'
import { AEI_OBSERVED_EXPOSURE } from '@/lib/market/aei-observed-exposure'
import {
  HIGH_AI_EXPOSURE,
  INDUSTRY_MIN_NOTICES,
  ROLE_FAMILIES,
  assessRisk,
  industryRising,
  roleExposure,
  type EmployerFacts,
  type RiskInput,
} from '@/lib/layoff-risk/rules'
import { FEDERAL_WARN, STATE_WARN_LAWS, WARN_GUIDE_AS_OF, WARN_SOURCES, stateWarnLaw, usedSources } from '@/lib/warn-guide/rules'
import { ALL_STATE_CODES } from '@/lib/seo/states'
import { companyWarnFacts } from '@/lib/warn/company-facts'
import { LAYOFF_TERMS } from '@/lib/warn/layoff-definitions'

const employer = (over: Partial<EmployerFacts> = {}): EmployerFacts => ({
  name: 'Acme',
  slug: 'acme',
  recentNotices: 0,
  recentMonths: 0,
  latest: null,
  announcedRecently: false,
  ...over,
})
const base: RiskInput = { employer: null, size: null, industry: null, roleCode: null }

describe('layoff risk check', () => {
  it('is low when nothing applies, and says what it could not check', () => {
    const r = assessRisk(base)
    expect(r.signal).toBe('low')
    expect(r.signs.every((s) => !s.applies)).toBe(true)
    expect(r.signs.every((s) => s.detail.length > 0)).toBe(true)
  })

  it('needs an employer sign to be high: one filing alone is watch', () => {
    expect(assessRisk({ ...base, employer: employer({ recentNotices: 1, recentMonths: 1 }) }).signal).toBe('watch')
  })

  it('is high when the employer filed and shows a second sign', () => {
    expect(assessRisk({ ...base, employer: employer({ recentNotices: 3, recentMonths: 2 }) }).signal).toBe('high')
    expect(assessRisk({ ...base, employer: employer({ recentNotices: 1, recentMonths: 1, announcedRecently: true }) }).signal).toBe('high')
  })

  it('does not call a repeat filer or an announcer high without a filing', () => {
    expect(assessRisk({ ...base, employer: employer({ announcedRecently: true }) }).signal).toBe('watch')
  })

  it('is watch when the industry and the kind of work both show a sign, and low with only one', () => {
    const industry = { bucket: 'Technology & Software', last6: 40, prior6: 20 }
    expect(assessRisk({ ...base, industry, roleCode: '15' }).signal).toBe('watch')
    expect(assessRisk({ ...base, industry }).signal).toBe('low')
    expect(assessRisk({ ...base, roleCode: '15' }).signal).toBe('low')
  })

  it('calls an industry trend only with enough notices and a real rise', () => {
    expect(industryRising({ bucket: 'x', last6: 12, prior6: 6 })).toBe(false) // 18 notices: too few
    expect(industryRising({ bucket: 'x', last6: 30, prior6: 25 })).toBe(false) // under 1.25x
    expect(industryRising({ bucket: 'x', last6: 30, prior6: 24 })).toBe(true) // exactly 1.25x
    expect(industryRising({ bucket: 'x', last6: INDUSTRY_MIN_NOTICES, prior6: 0 })).toBe(true)
    expect(industryRising(null)).toBe(false)
  })

  it('marks exactly the five role groups at or above the exposure threshold', () => {
    const high = ROLE_FAMILIES.filter((r) => (roleExposure(r.code) ?? 0) >= HIGH_AI_EXPOSURE).map((r) => r.code).sort()
    expect(high).toEqual(['13', '15', '23', '41', '43'])
  })

  it('only offers kinds of work that exist in the exposure file', () => {
    for (const r of ROLE_FAMILIES) expect(AEI_OBSERVED_EXPOSURE[r.code]).toBeDefined()
  })

  it('warns that an employer under 100 people is invisible to the record', () => {
    expect(assessRisk({ ...base, size: 'u100' }).limits.join(' ')).toMatch(/under 100/i)
    expect(assessRisk({ ...base, size: '5000+' }).limits.join(' ')).not.toMatch(/Employers under 100/)
  })

  it('always says the result is not a forecast', () => {
    expect(assessRisk(base).limits.join(' ')).toMatch(/not a forecast/i)
  })
})

describe('WARN guide facts', () => {
  it('backs every federal rule and state summary with a source that exists', () => {
    for (const f of Object.values(FEDERAL_WARN)) {
      expect(f.sources.length).toBeGreaterThan(0)
      for (const k of f.sources) expect(WARN_SOURCES[k]).toBeDefined()
    }
    for (const s of STATE_WARN_LAWS) {
      expect(s.sources.length).toBeGreaterThan(0)
      for (const k of s.sources) expect(WARN_SOURCES[k].url).toMatch(/^https?:\/\//)
    }
  })

  it('names real states once each and finds them by code', () => {
    const codes = STATE_WARN_LAWS.map((s) => s.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const c of codes) expect((ALL_STATE_CODES as readonly string[]).includes(c)).toBe(true)
    expect(stateWarnLaw('nj')?.name).toBe('New Jersey')
    expect(stateWarnLaw('TX')).toBeNull()
  })

  it('carries a read-on date and lists every source it uses once', () => {
    expect(WARN_GUIDE_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const used = usedSources()
    expect(new Set(used).size).toBe(used.length)
  })

  it('does not put the sourced numbers out of line with the statute text it quotes', () => {
    expect(FEDERAL_WARN.coverage.text).toContain('100 or more')
    expect(FEDERAL_WARN.notice.text).toContain('60 days')
    expect(FEDERAL_WARN.plantClosing.text).toContain('50 or more')
    expect(FEDERAL_WARN.massLayoff.text).toContain('33%')
    expect(FEDERAL_WARN.massLayoff.text).toContain('500')
    expect(FEDERAL_WARN.penalty.text).toContain('$500')
  })
})

describe('company filing facts', () => {
  const d = (s: string, workers: number | null) => ({ noticeDate: new Date(`${s}T00:00:00Z`), workers })
  const now = new Date('2026-10-27T00:00:00Z').getTime()

  it('counts the last 12 months, the months with filings and the workers named', () => {
    const f = companyWarnFacts({ states: ['CA', 'TX'], notices: [d('2026-10-01', 100), d('2026-10-15', null), d('2026-03-02', 40), d('2024-01-10', 500)] }, now)
    expect(f.total).toBe(4)
    expect(f.recent).toBe(3)
    expect(f.recentWorkers).toBe(140)
    expect(f.recentUnknown).toBe(1)
    expect(f.recentMonthsWithFilings).toBe(2)
    expect(f.monthsWithFilings).toBe(3)
    expect(f.first?.toISOString().slice(0, 10)).toBe('2024-01-10')
    expect(f.latest?.toISOString().slice(0, 10)).toBe('2026-10-15')
  })

  it('handles an employer with no notices', () => {
    const f = companyWarnFacts({ states: [], notices: [] }, now)
    expect(f.total).toBe(0)
    expect(f.first).toBeNull()
    expect(f.latest).toBeNull()
  })
})

describe('journey hand-off', () => {
  it('has an onboarding situation for each persona the layoff pages hand off', async () => {
    const { getPersona } = await import('@/lib/constants/personas')
    expect(getPersona('laid-off')?.situation).toBeTruthy()
    expect(getPersona('thinking-about-a-move')?.situation).toBeTruthy()
  })
})

describe('layoff definitions', () => {
  it('defines each unit once, with a plain definition', () => {
    const keys = LAYOFF_TERMS.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of LAYOFF_TERMS) expect(t.definition.length).toBeGreaterThan(40)
    expect(keys).toEqual(expect.arrayContaining(['filing', 'layoff', 'reported', 'workers', 'not-counted']))
  })
})
