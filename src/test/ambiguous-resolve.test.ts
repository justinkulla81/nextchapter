import { describe, expect, it } from 'vitest'
import { resolveAmbiguous } from '@/lib/warn/ambiguous-resolve'
import { letterEmployees, letterPlace, parseHawaiiNotice } from '@/lib/warn/letters'

const c = (name: string) => ({ id: name, name })

describe('resolving an ambiguous employer', () => {
  it('matches a site, address or legal tail to the company at the start of the name', () => {
    expect(resolveAmbiguous('Levine Management Groups, Inc. - Ponderosa Dr.', [c('Levine Management Group, Inc.')])).toMatchObject({ kind: 'match' })
    expect(resolveAmbiguous('Uber Technologies, Inc. 1725 3rd Street', [c('Uber Technologies, Inc.')])).toMatchObject({ kind: 'match' })
    expect(resolveAmbiguous('Amazon-BWI1', [c('Amazon')])).toMatchObject({ kind: 'match' })
    expect(resolveAmbiguous('Johnson & Johnson Services Inc', [c('Johnson & Johnson')])).toMatchObject({ kind: 'match' })
  })
  it('ignores filing notes such as UPDATE and Revised', () => {
    expect(resolveAmbiguous('UPDATE Refresco Beverages US Inc', [c('Refresco Beverages US Inc')])).toMatchObject({ kind: 'match' })
  })
  it('makes a new company when the loose match was only a substring', () => {
    expect(resolveAmbiguous('Metallics, Inc', [c('Meta')])).toEqual({ kind: 'new' })
    expect(resolveAmbiguous('Keystone Tower Systems', [c('Stem')])).toEqual({ kind: 'new' })
  })
  it('does not call a different place or owner the same company', () => {
    expect(resolveAmbiguous('Catholic Community Services of Southern Arizona, Inc.', [c('Catholic Community Services')]).kind).not.toBe('match')
  })
  it('leaves two identical candidates to a person', () => {
    expect(resolveAmbiguous('Acme Foods', [{ id: '1', name: 'Acme Foods' }, { id: '2', name: 'Acme Foods LLC' }]).kind).toBe('review')
  })
})

describe('reading a notice letter', () => {
  it('finds the worksite city and skips the state office the letter is sent to', () => {
    const text = 'Minnesota Department of Employment & Economic Development, 180 East Fifth Street St. Paul, MN 55101 ... the layoffs will occur at Heliene’s facility at 8787 Silicon Way, Mountain Iron, MN 55768.'
    expect(letterPlace(text, 'MN')).toBe('Mountain Iron')
    expect(letterPlace('Workforce West Virginia, 112 California Ave, Charleston, WV 25305. Site Address 1500 Industrial Rd W, Bridgeport, WV 26301', 'WV')).toBe('Bridgeport')
  })
  it('reads the headcount when the letter gives one plainly', () => {
    expect(letterEmployees('This closure will result in the loss of employment for seventy-three (71) employees.')).toBe(71)
    expect(letterEmployees('Approximately 200 employees in ECM’s West Virginia division')).toBe(200)
    expect(letterEmployees('We will write again.')).toBeNull()
  })
  it('reads a Hawaii notice page: island, worksite and headcount', () => {
    const html = '<main>Company Name: Laie Water Company Address: 55-510 Kamehameha Highway, Laie, Hawaii 96762 Contact Person: A Total employees affected: 4</main>'
    expect(parseHawaiiNotice(html)).toMatchObject({ county: 'Honolulu', employees: 4 })
  })
})
