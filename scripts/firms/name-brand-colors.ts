// For firms with no site on file: reads firm names (one per line) from the file given as the first argument, guesses the firm's own
// domain from the name (the name joined, without company suffixes, its first two words), keeps a guess only when the site's page
// title or site name contains the firm's distinctive name, then reads the color from the site (theme color or icon), else from the
// logo the home page shares. Prints "name<TAB>color<TAB>source<TAB>domain" lines. Colors that repeat across three or more firms are
// a platform default and are dropped. Nothing is written here.
import { readFileSync } from 'node:fs'
import { dropSharedDefaults } from '@/lib/firms/brand-color'
import { findBrandColor, findLogoColor } from '@/lib/firms/brand-color-fetch'

const CONCURRENCY = 8
const UA = 'Mozilla/5.0 (compatible; NextChapterBot/1.0)'
const SUFFIX = new Set(['inc', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'company', 'co', 'the', 'and', 'of', 'group', 'groupe', 'partners', 'associates', 'international', 'consulting', 'consultants', 'search', 'executive', 'recruiting', 'recruitment', 'staffing', 'services', 'solutions', 'careers'])

const words = (name: string) => name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)

/** Domain guesses, most specific first. */
export function candidates(name: string): { domains: string[]; must: string } {
  const all = words(name).filter((w) => w !== 'the' && w !== 'careers')
  const core = all.filter((w) => !SUFFIX.has(w))
  const joins = [all.join(''), core.join(''), all.slice(0, 2).join(''), core.slice(0, 2).join(''), core[0] && core[0].length >= 6 ? core[0] : ''].filter((j) => j.length >= 4)
  const bases = [...new Set(joins)]
  return { domains: bases.flatMap((b) => [`${b}.com`, `${b}.net`, `${b}.org`]), must: (core.length ? core : all).slice(0, 2).join('') }
}

async function verified(domain: string, must: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}`, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(7_000) })
    if (!res.ok) return false
    const html = (await res.text()).slice(0, 300_000)
    const title = /<title[^>]*>([^<]*)/i.exec(html)?.[1] ?? ''
    const site = /property=["']og:site_name["'][^>]*content=["']([^"']*)/i.exec(html)?.[1] ?? ''
    const text = `${title} ${site}`.toLowerCase().replace(/[^a-z0-9]/g, '')
    return text.includes(must) || (must.length > 12 && text.includes(must.slice(0, 12)))
  } catch {
    return false
  }
}

async function main() {
  const names = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  let out: { name: string; color: string | null; source: string; domain: string }[] = []
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < names.length) {
      const name = names[next++]
      const { domains, must } = candidates(name)
      if (must.length < 4) continue
      for (const domain of domains) {
        if (!(await verified(domain, must))) continue
        let r = await findBrandColor(domain)
        if (!r.color) {
          const logo = await findLogoColor(`https://${domain}`)
          if (logo) r = { color: logo, source: 'logo' }
        }
        out.push({ name, color: r.color, source: r.source, domain })
        break
      }
    }
  }))
  out = dropSharedDefaults(out)
  for (const o of out) if (o.color) console.log(`${o.name}\t${o.color}\t${o.source}\t${o.domain}`)
  console.error(`${out.filter((o) => o.color).length} of ${names.length} found a color`)
}
main()
