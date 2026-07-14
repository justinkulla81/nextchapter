// Curated (not exhaustive) map from a normalized "city, state" or bare state
// abbreviation to a BLS OEWS area code. CBSA codes themselves are confirmed
// against published Census/BLS CBSA lists. The 7-digit *series-ID* padding
// convention is only independently confirmed for state-level codes (2-digit
// FIPS + "00000" trailing zeros, verified against a real OEUS series ID:
// Mississippi, FIPS 28 -> area code "2800000"). Metro codes here apply the
// same "code + trailing zero padding" convention (5-digit CBSA + "00") by
// analogy, which is NOT independently confirmed — if a metro lookup comes
// back empty/erroring from the live BLS API, bls.ts treats it as
// `unavailable` rather than surfacing a false number, so a padding mismatch
// degrades gracefully instead of corrupting a report. Unmatched cities fall
// back to the state entry; unmatched states return null ("unavailable").
export const METRO_AREA_CODES: Record<string, string> = {
  'new york, ny': '3562000',
  'los angeles, ca': '3108000',
  'chicago, il': '1698000',
  'dallas, tx': '1910000',
  'fort worth, tx': '1910000',
  'houston, tx': '2642000',
  'washington, dc': '4790000',
  'miami, fl': '3310000',
  'philadelphia, pa': '3798000',
  'atlanta, ga': '1206000',
  'phoenix, az': '3806000',
  'boston, ma': '1446000',
  'san francisco, ca': '4186000',
  'riverside, ca': '4014000',
  'detroit, mi': '1982000',
  'seattle, wa': '4266000',
  'minneapolis, mn': '3346000',
  'san diego, ca': '4174000',
  'tampa, fl': '4530000',
  'denver, co': '1974000',
  'st. louis, mo': '4118000',
  'saint louis, mo': '4118000',
  'baltimore, md': '1258000',
  'charlotte, nc': '1674000',
  'orlando, fl': '3674000',
  'san antonio, tx': '4170000',
  'portland, or': '3890000',
  'pittsburgh, pa': '3830000',
  'sacramento, ca': '4090000',
  'austin, tx': '1242000',
  'las vegas, nv': '2982000',
  'cincinnati, oh': '1714000',
  'columbus, oh': '1814000',
  'cleveland, oh': '1746000',
  'nashville, tn': '3498000',
  'kansas city, mo': '2814000',
}

const STATE_FIPS: Record<string, string> = {
  al: '01', ak: '02', az: '04', ar: '05', ca: '06', co: '08', ct: '09', de: '10',
  fl: '12', ga: '13', hi: '15', id: '16', il: '17', in: '18', ia: '19', ks: '20',
  ky: '21', la: '22', me: '23', md: '24', ma: '25', mi: '26', mn: '27', ms: '28',
  mo: '29', mt: '30', ne: '31', nv: '32', nh: '33', nj: '34', nm: '35', ny: '36',
  nc: '37', nd: '38', oh: '39', ok: '40', or: '41', pa: '42', ri: '44', sc: '45',
  sd: '46', tn: '47', tx: '48', ut: '49', vt: '50', va: '51', wa: '53', wv: '54',
  wi: '55', wy: '56', dc: '11',
}

export function lookupAreaCode(city: string | null, state: string | null): { areaCode: string; areaType: 'M' | 'S' } | null {
  if (city && state) {
    const key = `${city.trim().toLowerCase()}, ${state.trim().toLowerCase()}`
    const metroCode = METRO_AREA_CODES[key]
    if (metroCode) return { areaCode: metroCode, areaType: 'M' }
  }
  if (state) {
    const fips = STATE_FIPS[state.trim().toLowerCase()]
    if (fips) return { areaCode: `${fips}00000`, areaType: 'S' }
  }
  return null
}
