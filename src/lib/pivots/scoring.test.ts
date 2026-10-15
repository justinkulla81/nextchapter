import { describe, expect, it } from 'vitest'
import {
  BANDS,
  StatIndex,
  demandLine,
  detectContraction,
  energyFromCollaboration,
  fitLabelFor,
  hasEvidence,
  landingBands,
  memberBand,
  personalityTilt,
  rankPivots,
  shareTrend,
  shouldOfferPivotPaths,
  type MarketContext,
  type MarketStatRow,
  type MemberPivotInput,
} from './scoring'
import { ROLES } from './pivot-map'

function stat(roleKey: string, geo: string, band: string, o: Partial<MarketStatRow> = {}): MarketStatRow {
  return { roleKey, geo, band, openNow: 0, lowCompetitionOpen: 0, new30: 0, prior30: 0, new90: 0, prior90: 0, payP50: null, paySample: 0, ...o }
}

function member(o: Partial<MemberPivotInput> = {}): MemberPivotInput {
  return {
    title: null,
    primaryFunction: null,
    targetFunction: null,
    highestLevelReached: 'Manager',
    isPivoting: true,
    state: null,
    remotePreference: null,
    openToRelocation: false,
    skills: [],
    targetCompMin: null,
    peopleEnergyAnswer: null,
    collaborationVector: null,
    dismissed: [],
    ...o,
  }
}

const EMPTY_CTX: MarketContext = { stats: [], warn90: null, payBenchmarks: [], payChange: [] }

/** Totals ('*') with comparable history in both windows, so trends can be read. */
function totals(geo: string, n = 10_000): MarketStatRow[] {
  return BANDS.map((b) => stat('*', geo, b, { openNow: n, new30: n, prior30: n, new90: n, prior90: n }))
}

describe('levels', () => {
  it('maps member levels to bands and pivots to realistic landing bands', () => {
    expect(memberBand('IC')).toBe('IC')
    expect(memberBand('Manager')).toBe('MANAGER')
    expect(memberBand('Director')).toBe('DIRECTOR')
    expect(memberBand('VP')).toBe('EXEC')
    expect(memberBand('C-Suite')).toBe('EXEC')
    expect(memberBand(null)).toBeNull()
    expect(landingBands('DIRECTOR', 'KEEP_SENIORITY')).toEqual(['DIRECTOR', 'MANAGER'])
    expect(landingBands('DIRECTOR', 'RESET')).toEqual(['MANAGER', 'IC'])
    expect(landingBands('IC', 'RESET')).toEqual(['IC'])
    expect(landingBands(null, 'KEEP_SENIORITY')).toEqual(['IC', 'MANAGER'])
  })
})

describe('share trend', () => {
  it('reads a role’s share of new postings, not raw growth', () => {
    const rows = [
      ...BANDS.map((b) => stat('*', 'US', b, { new90: 2000, prior90: 1000 })),
      // The role doubled in raw count while the whole board doubled: share flat.
      stat('hris', 'US', 'MANAGER', { new90: 200, prior90: 100 }),
    ]
    expect(shareTrend(new StatIndex(rows), 'hris', 'US', ['MANAGER'], 90)).toBeCloseTo(0)
  })

  it('stays silent when the earlier window is too thin to compare (board still being built)', () => {
    const rows = [
      ...BANDS.map((b) => stat('*', 'US', b, { new30: 40_000, prior30: 1_400 })),
      stat('hris', 'US', 'MANAGER', { new30: 400, prior30: 40 }),
    ]
    expect(shareTrend(new StatIndex(rows), 'hris', 'US', ['MANAGER'], 30)).toBeNull()
  })

  it('stays silent when the role has too few earlier postings', () => {
    const rows = [...totals('US'), stat('hris', 'US', 'MANAGER', { new30: 30, prior30: 5 })]
    expect(shareTrend(new StatIndex(rows), 'hris', 'US', ['MANAGER'], 30)).toBeNull()
  })
})

describe('contraction', () => {
  const hr = ROLES.get('hr_generalist')!

  it('flags the member’s own work when its local share of postings drops 10%+, with WARN context', () => {
    const rows = [...totals('KY'), stat('hr_generalist', 'KY', 'MANAGER', { new90: 70, prior90: 100 })]
    const c = detectContraction(new StatIndex(rows), hr, { state: 'KY' }, 'MANAGER', { filings: 12, employees: 900 })
    expect(c.contracting).toBe(true)
    expect(c.headline).toBe('HR generalist roles in your area are down 30% in 90 days and 12 layoff notices were filed in Kentucky. Here is where your skills map.')
    expect(c.reasons.join(' ')).toContain('covering 900 workers')
  })

  it('does not flag on WARN alone (filings are all employers, not this function)', () => {
    const rows = [...totals('KY'), stat('hr_generalist', 'KY', 'MANAGER', { new90: 100, prior90: 100 })]
    const c = detectContraction(new StatIndex(rows), hr, { state: 'KY' }, 'MANAGER', { filings: 40, employees: 5000 })
    expect(c.contracting).toBe(false)
    expect(c.headline).toBeNull()
  })

  it('flags allowlisted structural decline (customer service) even before trend history exists', () => {
    const c = detectContraction(new StatIndex([]), ROLES.get('customer_service')!, { state: null }, 'IC', null)
    expect(c.contracting).toBe(true)
    expect(c.reasons[0]).toMatch(/Census CPS/)
  })

  it('does not treat a "pressure" note as contraction for roles outside the allowlist', () => {
    expect(detectContraction(new StatIndex([]), ROLES.get('sales')!, { state: null }, 'IC', null).contracting).toBe(false)
    expect(detectContraction(new StatIndex([]), ROLES.get('recruiter')!, { state: null }, 'IC', null).contracting).toBe(false)
  })

  it('offers pivot paths on the board when pivoting or contracting', () => {
    expect(shouldOfferPivotPaths({ isPivoting: true }, { contracting: false })).toBe(true)
    expect(shouldOfferPivotPaths({ isPivoting: false }, { contracting: true })).toBe(true)
    expect(shouldOfferPivotPaths({ isPivoting: false }, { contracting: false })).toBe(false)
  })
})

describe('personality', () => {
  it('reads the assessment collaboration dimension, never anything else', () => {
    expect(energyFromCollaboration(0.8)).toBe('HIGH')
    expect(energyFromCollaboration(-0.6)).toBe('LOW')
    expect(energyFromCollaboration(0.1)).toBe('SOME')
    expect(energyFromCollaboration(null)).toBeNull()
  })

  it('tilts extraverts toward high-rejection, high-upside people work and introverts toward deep work', () => {
    const ae = ROLES.get('account_executive')!
    const analytics = ROLES.get('people_analytics')!
    expect(personalityTilt('HIGH', ae).delta).toBeGreaterThan(personalityTilt('HIGH', ROLES.get('customer_success')!).delta)
    expect(personalityTilt('HIGH', analytics).delta).toBeLessThan(0)
    expect(personalityTilt('LOW', analytics).delta).toBeGreaterThan(0)
    expect(personalityTilt('LOW', ae).delta).toBeLessThan(personalityTilt('LOW', ROLES.get('customer_success')!).delta)
    expect(personalityTilt(null, ae)).toEqual({ delta: 0, note: null })
  })

  it('an extravert recruiter sees sales first; an introvert recruiter does not', () => {
    const base = member({ title: 'Senior Recruiter', primaryFunction: 'Human Resources' })
    const extravert = rankPivots({ ...base, peopleEnergyAnswer: 'HIGH' }, EMPTY_CTX)
    const introvert = rankPivots({ ...base, peopleEnergyAnswer: 'LOW' }, EMPTY_CTX)
    expect(extravert.suggestions[0].highRejectionHighUpside).toBe(true)
    expect(introvert.suggestions[0].highRejectionHighUpside).toBe(false)
    expect(extravert.energySource).toBe('answer')
  })

  it('the explicit answer wins over the assessment', () => {
    const r = rankPivots(member({ title: 'Recruiter', peopleEnergyAnswer: 'LOW', collaborationVector: 0.9 }), EMPTY_CTX)
    expect(r.energy).toBe('LOW')
    const a = rankPivots(member({ title: 'Recruiter', collaborationVector: 0.9 }), EMPTY_CTX)
    expect(a.energy).toBe('HIGH')
    expect(a.energySource).toBe('assessment')
  })
})

describe('rankPivots', () => {
  it('ranks by demand when fit is similar, and shows labels, not scores', () => {
    const rows = [
      ...totals('US'),
      ...totals('KY'),
      stat('people_operations', 'KY', 'MANAGER', { openNow: 2 }),
      stat('people_operations', 'US', 'MANAGER', { openNow: 20 }),
      stat('talent_acquisition', 'KY', 'MANAGER', { openNow: 250 }),
      stat('talent_acquisition', 'US', 'MANAGER', { openNow: 3000 }),
    ]
    const r = rankPivots(member({ title: 'HR Generalist', primaryFunction: 'Human Resources', state: 'KY' }), { ...EMPTY_CTX, stats: rows })
    const order = r.suggestions.map((s) => s.target)
    expect(order.indexOf('talent_acquisition')).toBeLessThan(order.indexOf('people_operations'))
    for (const s of r.suggestions) expect(['Strong fit', 'Good fit', 'Worth exploring']).toContain(s.fitLabel)
    const ta = r.suggestions.find((s) => s.target === 'talent_acquisition')!
    expect(ta.demand.localOpen).toBe(250)
    expect(demandLine(ta.demand)).toBe('250 open roles in Kentucky or remote')
  })

  it('counts remote roles locally unless the member wants on-site only', () => {
    const rows = [stat('hris', 'KY', 'MANAGER', { openNow: 10 }), stat('hris', 'REMOTE', 'MANAGER', { openNow: 40 }), stat('hris', 'US', 'MANAGER', { openNow: 400 })]
    const flex = rankPivots(member({ title: 'HR Generalist', state: 'KY' }), { ...EMPTY_CTX, stats: rows })
    const onsite = rankPivots(member({ title: 'HR Generalist', state: 'KY', remotePreference: 'onsite' }), { ...EMPTY_CTX, stats: rows })
    const pick = (x: typeof flex) => x.suggestions.concat().find((s) => s.target === 'hris')!.demand
    expect(pick(flex).localOpen).toBe(50)
    expect(pick(onsite).localOpen).toBe(10)
    expect(pick(onsite).localLabel).toBe('Kentucky')
  })

  it('removes skills the member already has from the gaps', () => {
    const r = rankPivots(member({ title: 'HR Generalist', skills: ['Workday', 'SQL'] }), EMPTY_CTX)
    const hris = r.suggestions.concat(r.hidden as never[]).find((s) => s.target === 'hris')
    expect(hris).toBeDefined()
    expect(hris!.gaps).toHaveLength(0)
    expect(hris!.alreadyHave).toHaveLength(2)
  })

  it('hides dismissed paths and lists them for undo', () => {
    const r = rankPivots(member({ title: 'Recruiter', dismissed: ['account_executive'] }), EMPTY_CTX)
    expect(r.suggestions.map((s) => s.target)).not.toContain('account_executive')
    expect(r.hidden).toEqual([{ key: 'account_executive', label: 'Account executive' }])
  })

  it('compares pay to the member’s target pay when set, else to their current field', () => {
    const rows = [
      stat('account_executive', 'US', 'MANAGER', { payP50: 132_000, paySample: 40 }),
      stat('recruiter', 'US', 'MANAGER', { payP50: 110_000, paySample: 40 }),
    ]
    const field = rankPivots(member({ title: 'Recruiter' }), { ...EMPTY_CTX, stats: rows }).suggestions.find((s) => s.target === 'account_executive')!
    expect(field.pay.deltaPct).toBeCloseTo(0.2)
    expect(field.pay.summary).toBe('Typical posted pay $132k, about 20% higher than your current field.')
    const big = rankPivots(member({ title: 'Recruiter', targetCompMin: 60_000 }), { ...EMPTY_CTX, stats: rows }).suggestions.find((s) => s.target === 'account_executive')!
    expect(big.pay.summary).toBe('Typical posted pay $132k, more than 40% higher than your target pay.')
    const own = rankPivots(member({ title: 'Recruiter', targetCompMin: 120_000 }), { ...EMPTY_CTX, stats: rows }).suggestions.find((s) => s.target === 'account_executive')!
    expect(own.pay.against).toBe('your target pay')
  })

  it('falls back to the PayBenchmark function median, then to the published reset range', () => {
    const ctx: MarketContext = {
      ...EMPTY_CTX,
      payBenchmarks: [{ fn: 'Sales', seniorityGroup: 'MANAGER', geo: 'US', p50: 120_000, sampleSize: 200 }],
      payChange: [
        { pathType: 'RESET', group: 'g', lowPct: -25, highPct: -14, medianPct: null, sampleSize: null, confidence: 'LOW', sourceTitle: 's', sourceUrl: null, asOf: null },
      ],
    }
    const r = rankPivots(member({ title: 'Recruiter' }), ctx)
    expect(r.suggestions.find((s) => s.target === 'account_executive')!.pay.targetMedian).toBe(120_000)
    const sdr = r.suggestions.concat().find((s) => s.target === 'sales_development')
    if (sdr) expect(sdr.pay.summary).toMatch(/pay often dips/)
  })

  it('empty data: no title or function gives no source and no paths; no market rows still gives paths', () => {
    const none = rankPivots(member({ title: null, primaryFunction: 'Other' }), EMPTY_CTX)
    expect(none.source).toBeNull()
    expect(none.suggestions).toHaveLength(0)
    expect(none.contraction.contracting).toBe(false)
    const noMarket = rankPivots(member({ title: 'Customer Service Representative' }), EMPTY_CTX)
    expect(noMarket.marketReady).toBe(false)
    expect(noMarket.suggestions.length).toBeGreaterThanOrEqual(3)
    expect(noMarket.suggestions.length).toBeLessThanOrEqual(5)
    expect(demandLine(noMarket.suggestions[0].demand)).toBe('0 open roles nationally')
  })
})

describe('helpers', () => {
  it('matches skills as whole words', () => {
    expect(hasEvidence(['salesforce', 'excel'], ['salesforce'])).toBe(true)
    expect(hasEvidence(['data formats'], ['ats'])).toBe(false)
    expect(hasEvidence(['greenhouse ats'], ['ats'])).toBe(true)
    expect(hasEvidence(['power bi'], ['r'])).toBe(false)
  })

  it('labels fit in words', () => {
    expect(fitLabelFor(0.9)).toBe('Strong fit')
    expect(fitLabelFor(0.75)).toBe('Good fit')
    expect(fitLabelFor(0.5)).toBe('Worth exploring')
  })

  it('writes the demand line with a trend when there is one', () => {
    expect(
      demandLine({ localOpen: 412, nationalOpen: 9000, remoteOpen: 100, localLabel: 'Illinois or remote', trendPct: 0.18, trendDays: 90, trendScope: 'local', lowCompetitionShare: 0.2 })
    ).toBe('412 open roles in Illinois or remote, up 18% in 90 days')
    expect(
      demandLine({ localOpen: null, nationalOpen: 9000, remoteOpen: 100, localLabel: null, trendPct: -0.12, trendDays: 30, trendScope: 'national', lowCompetitionShare: 0.2 })
    ).toBe('9,000 open roles nationally, down 12% in 30 days nationally')
  })
})
