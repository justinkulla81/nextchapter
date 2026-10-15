import { describe, expect, it } from 'vitest'
import { BANDS, rankPivots, type MarketContext, type MarketStatRow, type MemberPivotInput } from './scoring'
import { ROLES, SOURCES } from './pivot-map'
import { DATA_EDGE_TARGET, MAX_ONET_EDGES, ONET_EDGE_MIN_OPEN, edgesFor, onetEdges, onetGaps, onetOccupation } from './onet'
import { onetSocForRole, pivotSocCodes } from './onet-soc'

const none = () => false

describe('O*NET pivot data', () => {
  it('has an occupation for every SOC the pivot map uses', () => {
    for (const soc of pivotSocCodes()) expect(onetOccupation(soc), soc).not.toBeNull()
  })

  it('every data-driven target SOC is one of our pivot occupations', () => {
    for (const [soc, role] of Object.entries(DATA_EDGE_TARGET)) {
      expect(ROLES.has(role), role).toBe(true)
      expect(onetSocForRole(role), role).toBe(soc)
    }
  })
})

describe('onetGaps (skills to add)', () => {
  it('names skills the target leans on more and in-demand tools the source lacks', () => {
    const g = onetGaps('teaching', 'instructional_design', none)!
    expect(g.targetOccupation).toBe('Instructional Coordinators')
    expect(g.sourceOccupation).toMatch(/Teachers/)
    expect(g.tools).toEqual(expect.arrayContaining(['Articulate Storyline']))
    expect(g.skills.length).toBeGreaterThan(0)
    expect(g.skills.length).toBeLessThanOrEqual(3)
    expect(g.tools.length).toBeLessThanOrEqual(4)
  })

  it('leaves out what the member already shows and office basics', () => {
    const g = onetGaps('finance_accounting', 'fpa', (aliases) => aliases.includes('tableau'))!
    expect(g.tools).not.toContain('Tableau')
    expect(g.tools).toEqual(expect.arrayContaining(['Microsoft Power BI']))
    for (const t of g.tools) expect(t).not.toMatch(/^Microsoft (Excel|Word|Outlook|PowerPoint)/)
  })

  it('is null when source and target are the same occupation, or the target has none', () => {
    expect(onetGaps('recruiter', 'talent_acquisition', none)).toBeNull() // both 13-1071.00
    expect(onetGaps('sales', 'revenue_operations', none)).toBeNull() // no O*NET stand-in
  })
})

describe('onetEdges (data-driven pivots)', () => {
  it('adds a few edges that pass the rules and never duplicate the hand-written map', () => {
    let total = 0
    for (const [key, source] of SOURCES) {
      const extra = onetEdges(key)
      total += extra.length
      expect(extra.length).toBeLessThanOrEqual(MAX_ONET_EDGES)
      const curated = new Set(source.edges.map((e) => e.to))
      for (const e of extra) {
        expect(e.origin).toBe('onet')
        expect(curated.has(e.to), `${key} -> ${e.to}`).toBe(false)
        expect(e.to).not.toBe(key)
        expect(Object.values(DATA_EDGE_TARGET)).toContain(e.to)
        expect(ROLES.get(e.to)!.needs.length).toBeGreaterThan(0)
        expect(e.brings.length).toBeGreaterThanOrEqual(2)
        expect(e.why).toMatch(/^O\*NET lists this among the occupations most related to /)
        expect(e.why).not.toMatch(/english language/i)
      }
      expect(edgesFor(key).slice(0, source.edges.length)).toEqual(source.edges)
    }
    expect(total).toBeGreaterThan(0)
  })
})

function stat(roleKey: string, geo: string, band: string, openNow: number): MarketStatRow {
  return { roleKey, geo, band, openNow, lowCompetitionOpen: 0, new30: 0, prior30: 0, new90: 0, prior90: 0, payP50: null, paySample: 0 }
}
const member: MemberPivotInput = {
  title: 'Senior Recruiter', primaryFunction: null, targetFunction: null, highestLevelReached: 'Manager', isPivoting: true, state: null,
  remotePreference: null, openToRelocation: false, skills: [], targetCompMin: null, peopleEnergyAnswer: null, collaborationVector: null, dismissed: [],
}

describe('rankPivots with O*NET', () => {
  const extra = onetEdges('recruiter').map((e) => e.to)

  it('carries O*NET skills to add on suggestions', () => {
    const r = rankPivots(member, { stats: [], warn90: null, payBenchmarks: [], payChange: [] })
    const ae = [...r.suggestions, ...r.more].find((s) => s.target === 'account_executive')!
    expect(ae.onet?.targetOccupation).toMatch(/Sales Representatives/)
    expect(ae.origin).toBe('curated')
  })

  it('drops a data-driven path when the board has few such jobs, keeps it when demand is there', () => {
    expect(extra.length).toBeGreaterThan(0)
    const target = extra[0]
    const ctx = (open: number): MarketContext => ({
      stats: [stat('*', 'US', 'IC', 10_000), ...BANDS.map((b) => stat(target, 'US', b, open))],
      warn90: null,
      payBenchmarks: [],
      payChange: [],
    })
    const all = (c: MarketContext) => {
      const r = rankPivots(member, c)
      return [...r.suggestions, ...r.more]
    }
    expect(all(ctx(1)).some((s) => s.target === target)).toBe(false)
    const shown = all(ctx(ONET_EDGE_MIN_OPEN * 4)).find((s) => s.target === target)
    expect(shown?.origin).toBe('onet')
  })
})
