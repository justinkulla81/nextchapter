import { describe, expect, it } from 'vitest'
import { parseCatalog } from '@/lib/benefits/parse'

const at = new Date('2026-10-22T00:00:00Z')

describe('benefits catalog parser', () => {
  it('reads a state table, marks only explicit Y/Yes verified, and maps status', () => {
    const md = `## Kentucky\n\n| Name | State | What it pays | Eligibility | Status | Official URL | Verified |\n|---|---|---|---|---|---|---|\n| Work Ready Kentucky Scholarship | KY | 60 credit hours tuition-free | No associate degree | Open; deadline Dec 1 | https://kctcs.edu/wrks | Yes |\n| Old Grant | KY | $500 | Anyone | Closed 2024 | https://example.gov/old | No |\n`
    const rows = parseCatalog(md, 'STATE_TRAINING', 'x.md', at)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ state: 'KY', verified: true, status: 'OPEN', scope: 'STATE', category: 'STATE_TRAINING' })
    expect(rows[1]).toMatchObject({ verified: false, status: 'CLOSED', checkedAt: null })
  })
  it('handles a leading # column and a missing pipe edge, and uses the section heading for the state', () => {
    const md = `## Texas\n| # | Name | Provider | What you get | Status | URL | Ver |\n|--|--|--|--|--|--|--|\n| 1 | Skills Fund | TWC | grant | Open | https://twc.texas.gov/x | P |\n`
    const [r] = parseCatalog(md, 'STATE_TRAINING', 'x.md', at)
    expect(r.state).toBe('TX')
    expect(r.verified).toBe(false)
    expect(r.url).toBe('https://twc.texas.gov/x')
  })
  it('never marks a row verified without a URL, and skips nameless rows', () => {
    const md = `| Name | Provider | Benefit | Status | Official URL | Verified |\n|---|---|---|---|---|---|\n| Free course | Acme | learn | Open | n/a | Y |\n`
    expect(parseCatalog(md, 'COURSES', 'x.md', at)[0].verified).toBe(false)
  })
  it('reads Employer and City columns and keys the employer like a CRM organization', () => {
    const md = `## Kentucky\n| Name | Employer | State | Locality | What it pays | Eligibility | Status | Official URL | Verified |\n|---|---|---|---|---|---|---|---|---|\n| Teacher relocation grant | Jefferson County Public Schools, Inc. | KY | Jefferson County | $4,000 | New teachers | Open | https://www.jefferson.kyschools.us/x | Yes |\n`
    const [r] = parseCatalog(md, 'RELOCATION', 'x.md', at)
    expect(r.employer).toBe('Jefferson County Public Schools, Inc.')
    expect(r.employerKey).toBe('jefferson county public schools')
    expect(r.locality).toBe('Jefferson County')
    expect(r.verified).toBe(true)
  })
})
