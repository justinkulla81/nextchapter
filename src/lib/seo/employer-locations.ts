// The places an employer hires, as the meta description names them. Pure, so the rules are unit-tested.

/** The employer's top hiring places as people write them ("Tempe, AZ"): no multi-place values, no country suffix, no repeats. */
export function hiringPlaces(locations: { location: string; count: number }[], max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const l of locations) {
    if (l.location.includes(';')) continue
    const name = l.location.replace(/,\s*(USA|US|United States)$/i, '').trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push(name)
    if (out.length === max) break
  }
  return out
}

/** "A", "A and B", "A, B and C"; when an item itself holds a comma ("Tempe, AZ"), the items are split by semicolons so the list reads cleanly. */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  const sep = items.some((i) => i.includes(',')) ? '; ' : ', '
  return `${items.slice(0, -1).join(sep)}${sep === '; ' ? '; and ' : ' and '}${items[items.length - 1]}`
}
