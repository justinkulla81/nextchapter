/**
 * An employer's name as a person would write it. A WARN filing's name often carries the site's street address or a plant name ("The Mosaic
 * Company 5880 Manley Road FORT MEADE, FL, 33841", "Excel Mining LLC - MC Mining Preparation Plant"), which reads as sloppy and can read as
 * spam in a subject line. Pure.
 */
const STREET = /\b(road|rd|street|st|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way|highway|hwy|parkway|pkwy|court|ct|place|pl|circle|cir|suite|ste|plaza|turnpike|pike|route|rte)\b/i

export function cleanEmployerName(raw: string): string {
  let s = (raw ?? '').replace(/\s+/g, ' ').trim()
  // A street address: from the house number that precedes a street word, to the end.
  const street = /\s+\d{1,6}\s+(?:[A-Za-z0-9.'#-]+\s+){0,4}?(?:road|rd|street|st|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way|highway|hwy|parkway|pkwy|court|ct|place|pl|circle|cir|suite|ste|plaza|turnpike|pike|route|rte)\b.*$/i
  if (STREET.test(s)) s = s.replace(street, '')
  // A trailing "CITY, ST 12345" or ", ST, 12345".
  s = s.replace(/[\s,]+[A-Za-z .'-]*,?\s*[A-Z]{2}\s*,?\s*\d{5}(?:-\d{4})?\s*$/, '')
  // A site or plant after a dash, and a trailing parenthetical ("(Formerly Exel)").
  s = s.replace(/\s+[-–—]\s+.*$/, '').replace(/\s*\([^)]*\)\s*$/, '')
  s = s.replace(/[\s,;:]+$/, '').trim()
  if (s.length > 60) s = s.slice(0, 60).replace(/\s+\S*$/, '').trim()
  return s || (raw ?? '').trim()
}
