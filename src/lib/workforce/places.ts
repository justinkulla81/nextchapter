/**
 * Names, normalised the same way on both sides of a lookup: a Census place
 * ("Port St. Lucie city") and what a WARN filing says ("Port Saint Lucie").
 */
export function placeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+(city and borough|consolidated government \(balance\)|metro(?:politan)? government \(balance\)|unified government \(balance\)|\(balance\)|city|town|village|cdp|borough|municipality|township|plantation|comunidad|zona urbana)$/g, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bst\.\s*/g, 'st ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A county name as boards list it and filings write it: "Harris County" → "harris". */
export function countyKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+(county|parish|borough|census area|city and borough|municipality)$/, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bst\.\s*/g, 'st ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The city a WARN notice's address names, if it names one in the notice's
 * own state. States write this field differently: a bare city ("Jersey
 * City"), a full address ("3600 Cabover Drive Hanover MD 21076"), a city and
 * state ("Grand Prairie, TX" — a headquarters elsewhere, so not used), or
 * nothing useful ("Remote", "Nationwide").
 */
export function cityFromAddress(address: string | null | undefined, state: string | null): string | null {
  if (!address || !state) return null
  const a = address.replace(/\s+/g, ' ').trim()
  if (!a || /^(remote|nationwide|n\/?a|united states|various|multiple|statewide)$/i.test(a)) return null
  // "... Hanover MD 21076" / "... San Francisco CA 94107" / "Lutz, FL, 33559"
  const full = a.match(/(?:^|[\s,])([A-Za-z][A-Za-z .'-]*?),?\s+([A-Z]{2}),?\s+\d{5}(?:-\d{4})?$/)
  if (full) {
    if (full[2] !== state) return null
    // The city is the trailing words before the state; drop a street part.
    const words = full[1].trim().split(' ')
    const street = words.findIndex((w) => /^(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|way|ln|lane|pkwy|parkway|hwy|highway|ct|court|pl|place|suite|ste|floor|fl)\.?$/i.test(w))
    return (street >= 0 ? words.slice(street + 1) : words).join(' ').trim() || null
  }
  const withState = a.match(/^([A-Za-z .'-]+),\s*([A-Z]{2})$/)
  if (withState) return withState[2] === state ? withState[1].trim() : null
  // A bare city: letters only, a few words.
  return /^[A-Za-z .'-]{2,40}$/.test(a) && a.split(' ').length <= 4 ? a : null
}
