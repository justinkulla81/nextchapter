/**
 * Reads brand colors from websites without touching the database: "label<TAB>url" lines from the file given as the first argument, and one
 * "label<TAB>primary<TAB>secondary<TAB>derived<TAB>url" line per site whose colors the scan is confident about. Nothing is saved here; use the
 * output to set OrgBrand rows (see scan-employers.ts for the same reading, with saving).
 *
 *   tsx --conditions=react-server scripts/branding/scan-sites.ts sites.tsv
 */
import { readFileSync } from 'node:fs'
import { fetchSite } from '../../src/lib/branding/fetch-site'
import { confidentPair, scanBrand } from '../../src/lib/branding/scan'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const rows = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.split('\t')).filter((r) => r[0] && r[1])
  let next = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < rows.length) {
      const [label, url] = rows[next++]
      await sleep(200)
      try {
        const site = await fetchSite(url)
        const result = scanBrand(site.html, site.stylesheets, site.hints)
        const pair = confidentPair(result)
        if (pair) console.log(`${label}\t${pair.primary}\t${pair.secondary}\t${pair.secondaryDerived ? 1 : 0}\t${site.siteUrl}`)
        else console.error(`no confident colors: ${label}`)
      } catch (e) {
        console.error(`${label}: ${(e as Error).message.slice(0, 80)}`)
      }
    }
  }))
}
main()
