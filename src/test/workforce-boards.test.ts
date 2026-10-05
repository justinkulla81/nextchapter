import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { cityFromAddress, countyKey, placeKey } from '@/lib/workforce/places'
import { parseBoardDetails } from '@/lib/workforce/directory'
import { pickBoard } from '@/lib/workforce/match'

describe('placeKey / countyKey', () => {
  it('matches a Census place name to how a filing writes it', () => {
    expect(placeKey('Port St. Lucie city')).toBe(placeKey('Port Saint Lucie'))
    expect(placeKey('Nashville-Davidson metropolitan government (balance)')).toBe('nashvilledavidson')
  })
  it('drops County / Parish', () => {
    expect(countyKey('Harris County')).toBe('harris')
    expect(countyKey('St. Tammany Parish')).toBe('st tammany')
    expect(countyKey(' Palo Pinto ')).toBe('palo pinto')
  })
})

describe('cityFromAddress', () => {
  it('reads the city from a full address in the same state', () => {
    expect(cityFromAddress('3600 Cabover Drive Hanover MD 21076', 'MD')).toBe('Hanover')
    expect(cityFromAddress('2200 Mission College Boulevard  Santa Clara CA 95054', 'CA')).toBe('Santa Clara')
  })
  it('ignores a headquarters in another state', () => {
    expect(cityFromAddress('Chattanooga, TN', 'OR')).toBeNull()
    expect(cityFromAddress('100 Main St Austin TX 78701', 'CA')).toBeNull()
  })
  it('takes a bare city, not filler', () => {
    expect(cityFromAddress('Jersey City', 'NJ')).toBe('Jersey City')
    expect(cityFromAddress('Remote', 'NJ')).toBeNull()
  })
})

describe('parseBoardDetails', () => {
  const html = `<html><body><main>
    <table><tbody id="tblWdbYc"><tr><td>North Central Texas Workforce Development Board<br></td>
      <td><span class="notranslate">600 Six Flags Drive, Suite 300<br>PO Box 5888 (76005-5888)<br>Arlington, TX 76011</span><br><a href="/map"><span class="notranslate">Local WDB Map</span></a></td></tr>
      <tr><td colspan="2"><div class="wrapurl">Website: <a href="https://www.dfwjobs.com/">https://www.dfwjobs.com/</a></div></td></tr>
      <tr><td colspan="2">Service Area:<br><span class="notranslate">Collin, Denton, Palo Pinto<br>City:  City of Fort Worth</span></td></tr></tbody></table>
    <table><thead><tr><th colspan="2">WDB Contact Information</th></tr></thead><tbody>
      <tr><td><b>Executive Director</b><br><span class="notranslate">Phedra Redifer</span><br>Email: <a href="mailto:PRedifer@dfwjobs.com">PRedifer@dfwjobs.com</a><br>Phone: <a href="tel:253-380-2692"><span class="notranslate">253-380-2692</span></a></td><td><b>Mailing Address</b></td></tr>
      <tr><td colspan="2"><hr></td></tr>
      <tr><td><b>Board Vice-Chair, NCT</b><br><span class="notranslate">Craig Driggers</span><br>Email: <a href="mailto:c@x.com">c@x.com</a></td></tr>
      <tr><td><b>Board Chair, NCT</b><br><span class="notranslate">Mr. Carlton Tidwell</span><br>Email: <a href="mailto:carlton@terrelltexas.com">carlton@terrelltexas.com</a><br>Phone: <a href="tel:972-563-5703"><span class="notranslate">972-563-5703</span></a></td></tr>
    </tbody></table></main></body></html>`

  it('reads the board, its area and its people', () => {
    const b = parseBoardDetails('568', html)!
    expect(b.name).toBe('North Central Texas Workforce Development Board')
    expect(b.address).toBe('600 Six Flags Drive, Suite 300, PO Box 5888 (76005-5888), Arlington, TX 76011')
    expect(b.zip).toBe('76011')
    expect(b.website).toBe('https://www.dfwjobs.com/')
    expect(b.counties).toEqual(['collin', 'denton', 'palo pinto'])
    expect(b.serviceArea).toBe('Collin, Denton, Palo Pinto; City: City of Fort Worth')
    expect(b).toMatchObject({
      directorTitle: 'Executive Director', directorName: 'Phedra Redifer',
      directorEmail: 'PRedifer@dfwjobs.com', directorPhone: '253-380-2692',
      chairName: 'Mr. Carlton Tidwell', chairEmail: 'carlton@terrelltexas.com', chairPhone: '972-563-5703',
    })
  })

  it('returns null for a page without a board', () => {
    expect(parseBoardDetails('1', '<html><body>Not found</body></html>')).toBeNull()
  })
})

describe('pickBoard', () => {
  const board = (id: string, counties: string[], extra: Partial<{ name: string; serviceArea: string; statewide: boolean }> = {}) => ({
    id, name: extra.name ?? id, counties, serviceArea: extra.serviceArea ?? counties.join(', '), statewide: extra.statewide ?? false,
  })

  it('picks the board whose area lists the county', () => {
    const boards = [board('a', ['collin', 'denton']), board('b', ['dallas'])]
    expect(pickBoard(boards, 'Dallas County', null)?.id).toBe('b')
  })

  it('prefers the city board for its own city, the county board elsewhere', () => {
    const boards = [
      board('la-city', [], { name: 'City of Los Angeles WDB', serviceArea: 'City: Los Angeles' }),
      board('fw', ['tarrant'], { serviceArea: 'Tarrant; City: City of Fort Worth' }),
      board('la-county', ['los angeles'], { name: 'Los Angeles County WDB' }),
    ]
    expect(pickBoard(boards, 'Los Angeles County', 'Los Angeles')?.id).toBe('la-city')
    expect(pickBoard(boards, null, 'Los Angeles')?.id).toBe('la-city')
    expect(pickBoard(boards, 'Los Angeles County', 'Pasadena')?.id).toBe('la-county')
    expect(pickBoard(boards, null, 'Fort Worth')?.id).toBe('fw')
  })

  it('falls back to a single-area state’s only board', () => {
    expect(pickBoard([board('vt', ['vermont'], { statewide: true })], null, null)?.id).toBe('vt')
    expect(pickBoard([board('state', [], { statewide: true }), board('only', ['x'])], null, null)?.id).toBe('only')
  })

  it('gives up rather than guess between several boards', () => {
    expect(pickBoard([board('a', ['x']), board('b', ['y'])], null, 'Somewhere')).toBeNull()
  })
})
