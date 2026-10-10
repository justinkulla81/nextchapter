import { describe, expect, it } from 'vitest'
import { CSV_HEADERS, firmRowsToCsv, type FirmRow } from './report'

const row = (over: Partial<FirmRow> = {}): FirmRow => ({
  id: 'f1', sourceKey: 'sf:x', name: 'Acme, Search', website: 'https://acme.com', segment: 'retained', liveSearchCount: 3,
  sampleTitles: ['CFO', 'VP "Ops"'], matchStatus: 'MATCHED', crmOrg: { id: 'o1', name: 'Acme Search' }, reviewOrg: null,
  reviewReason: null, teamPageUrl: 'https://acme.com/team', contacts: [], ...over,
})

describe('firmRowsToCsv', () => {
  it('writes one line for a firm with no contacts, quoting commas and quotes', () => {
    const lines = firmRowsToCsv([row()]).split('\n')
    expect(lines[0]).toBe(CSV_HEADERS.join(','))
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('"Acme, Search"')
    expect(lines[1]).toContain('"CFO | VP ""Ops"""')
  })

  it('labels a guessed address as a guess, a real one as real', () => {
    const csv = firmRowsToCsv([row({
      contacts: [
        { personId: 'p1', name: 'Ann Lee', title: 'Partner', email: 'ann@acme.com', guessedEmail: null, guessedEmailBasis: null, rank: 2 },
        { personId: 'p2', name: 'Bo Diaz', title: 'Managing Director', email: null, guessedEmail: 'bo.diaz@acme.com', guessedEmailBasis: 'first.last — 3 of 3', rank: 1 },
      ],
    })])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('ann@acme.com,real')
    expect(lines[2]).toContain('bo.diaz@acme.com,GUESS,first.last — 3 of 3')
  })

  it('shows a firm awaiting review with its possible match', () => {
    const csv = firmRowsToCsv([row({ matchStatus: 'REVIEW', crmOrg: null, reviewOrg: { id: 'o2', name: 'Acme' }, reviewReason: 'generic words' })])
    expect(csv).toContain('Needs review')
    expect(csv).toContain('Acme — generic words')
  })
})
