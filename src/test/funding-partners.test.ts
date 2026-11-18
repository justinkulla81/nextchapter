import { describe, expect, it } from 'vitest'
import { askText, dollars, matchTotals, validateCommitment } from '@/lib/workforce/funding-partners'
import { ECO_KINDS, ecoKindLabel } from '@/lib/workforce/ecosystem'

const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) })

describe('match on a funding application', () => {
  it('counts only partners who said yes, and what is left to find', () => {
    const c = [
      { role: 'MATCH', status: 'COMMITTED', amount: 50000 },
      { role: 'MATCH', status: 'COMMITTED', amount: 40000 },
      { role: 'MATCH', status: 'ASKED', amount: 30000 },
      { role: 'MATCH', status: 'DECLINED', amount: 99999 },
      { role: 'EVIDENCE', status: 'COMMITTED', amount: null },
    ]
    expect(matchTotals(c, 150000)).toEqual({ committed: 90000, asked: 30000, left: 60000 })
    expect(matchTotals(c, 80000).left).toBe(0)
    expect(matchTotals(c, null).left).toBeNull()
  })
})

describe('adding a partner to an application', () => {
  const ok = { partnerName: 'Greater Louisville Chamber', role: 'MATCH', status: 'COMMITTED', amount: '$25,000', note: 'Board approved Nov 12', partnerId: 'p1' }
  it('reads one as typed', () => {
    const r = validateCommitment(form(ok))
    expect('value' in r && r.value).toMatchObject({ partnerName: 'Greater Louisville Chamber', role: 'MATCH', status: 'COMMITTED', amount: 25000, partnerId: 'p1' })
  })
  it('says what to fix in plain words', () => {
    expect(validateCommitment(form({ ...ok, partnerName: ' ' }))).toMatchObject({ error: expect.stringMatching(/name of the partner/) })
    expect(validateCommitment(form({ ...ok, role: 'BOSS' }))).toMatchObject({ error: expect.stringMatching(/part in the application/) })
    expect(validateCommitment(form({ ...ok, status: 'MAYBE' }))).toMatchObject({ error: expect.stringMatching(/asked, committed or declined/) })
    expect(validateCommitment(form({ ...ok, amount: 'lots' }))).toMatchObject({ error: expect.stringMatching(/dollar amount/) })
  })
  it('a blank amount is fine and status defaults to asked', () => {
    const r = validateCommitment(form({ partnerName: 'X', role: 'PARTNER', amount: '' }))
    expect('value' in r && r.value).toMatchObject({ amount: null, status: 'ASKED' })
  })
  it('drafts the ask, naming the part and the amount', () => {
    const t = askText({ from: 'Live in Lou', partner: 'The Chamber', application: 'Reserve Fund', funder: 'the Cabinet', due: 'Dec 2, 2026', role: 'MATCH', amount: 25000 })
    expect(t).toMatch(/a match of \$25,000/)
    expect(t).toMatch(/Reserve Fund from the Cabinet, due Dec 2, 2026/)
    expect(dollars(null)).toBe('—')
  })
})

describe('who counts as a partner', () => {
  it('includes sister organizations, nonprofits and funders', () => {
    for (const k of ['ECON_DEV', 'WORKFORCE_BOARD', 'JOB_CENTER', 'CHAMBER', 'NONPROFIT', 'FUNDER']) expect(ECO_KINDS.some((x) => x.key === k)).toBe(true)
    expect(ecoKindLabel('JOB_CENTER')).toBe('American Job Center')
  })
})
