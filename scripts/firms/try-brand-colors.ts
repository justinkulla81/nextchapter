// Tries the brand-color reader on websites given as arguments, and prints what it finds. Nothing is stored.
import { findBrandColor } from '@/lib/firms/brand-color-fetch'

async function main() {
  const sites = process.argv.slice(2)
  const results = await Promise.all(sites.map(async (s) => ({ s, ...(await findBrandColor(s)) })))
  for (const r of results) console.log(`${r.color ?? '-'.padEnd(7)}\t${r.source}\t${r.s}`)
  const hit = results.filter((r) => r.color).length
  console.log(`\n${hit} of ${results.length} found a color`)
}
main()
