// The regions the rankings use. Several overlap on purpose (Northeast contains New England; Great Lakes sits inside the
// Midwest): a reader looks for their own region, and a list is published only if its top places differ enough to be
// worth a page of their own.

export interface Region { id: string; name: string; phrase: string; states: string[] }

export const REGIONS: Region[] = [
  { id: 'northeast', name: 'Northeast', phrase: 'the Northeast', states: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'] },
  { id: 'new-england', name: 'New England', phrase: 'New England', states: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT'] },
  { id: 'mid-atlantic', name: 'Mid-Atlantic', phrase: 'the Mid-Atlantic', states: ['NY', 'NJ', 'PA', 'DE', 'MD', 'DC', 'VA'] },
  { id: 'southeast', name: 'Southeast', phrase: 'the Southeast', states: ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN', 'VA'] },
  { id: 'southwest', name: 'Southwest', phrase: 'the Southwest', states: ['AZ', 'NM', 'NV', 'OK', 'TX'] },
  { id: 'midwest', name: 'Midwest', phrase: 'the Midwest', states: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'] },
  { id: 'great-lakes', name: 'Great Lakes', phrase: 'the Great Lakes', states: ['IL', 'IN', 'MI', 'MN', 'OH', 'WI'] },
  { id: 'mountain-west', name: 'Mountain West', phrase: 'the Mountain West', states: ['CO', 'ID', 'MT', 'NV', 'UT', 'WY'] },
  { id: 'pacific-northwest', name: 'Pacific Northwest', phrase: 'the Pacific Northwest', states: ['WA', 'OR'] },
  { id: 'west-coast', name: 'West Coast', phrase: 'the West Coast', states: ['CA', 'OR', 'WA'] },
]

export const regionById = (id: string) => REGIONS.find((r) => r.id === id) ?? null

/** State FIPS codes, for the state-level price parities when a city has no metro figure. */
export const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18',
  IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33',
  NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49',
  VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56',
}
