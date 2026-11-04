/**
 * Reads company brand colors from their own websites without the database: "name|key" lines from the file given as the first argument
 * (the company's name and its Company.canonicalNameNormalized key), and one "key<TAB>primary<TAB>secondary<TAB>derived<TAB>siteUrl" line per
 * company whose colors the scan is confident about. A guessed address is used only when its home page names the company
 * (src/lib/branding/company-domain.ts). Nothing is saved here; the lines become OrgBrand rows of kind EMPLOYER keyed by the key.
 *
 *   tsx --conditions=react-server scripts/branding/scan-names.ts names.txt
 */
import { readFileSync } from 'node:fs'
import { fetchSite } from '../../src/lib/branding/fetch-site'
import { guessHosts, pageMatchesCompany } from '../../src/lib/branding/company-domain'
import { confidentPair, scanBrand } from '../../src/lib/branding/scan'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const rows = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.split('|')).filter((r) => r[0] && r[1])
  let next = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < rows.length) {
      const [name, key] = rows[next++]
      let done = false
      for (const host of guessHosts(name).slice(0, 4)) {
        await sleep(200)
        try {
          const site = await fetchSite(`https://${host}`)
          if (!pageMatchesCompany(name, site.html)) continue
          const pair = confidentPair(scanBrand(site.html, site.stylesheets, site.hints))
          if (pair) { console.log(`${key}\t${pair.primary}\t${pair.secondary}\t${pair.secondaryDerived ? 1 : 0}\t${site.siteUrl}`); done = true; break }
        } catch { /* try the next address */ }
      }
      if (!done) console.error(`not read: ${name}`)
    }
  }))
}
main()
