/**
 * Named contacts for the chambers, economic development groups and workforce nonprofits in
 * areas with a layoff in the last 90 days (the geography lead list), from Hunter.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/hunter-geo.ts <maxSearches> <out.json> [--apply]
 *
 * One Domain Search per lead (by its website's domain, else by its name for chambers, which
 * have no website on file). Executives and managers only. A domain found by name is kept only
 * when it contains the first distinctive word of the organization's name, so "Greater Dayton
 * Chamber" does not take another city's domain. With --apply the best contact goes onto the
 * lead's own contact fields (name, title, email, phone, source); nothing else is changed.
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { lookupDomain, receivesMail } from '../../src/lib/crm/org-domains'

const KEY = process.env.HUNTER_API_KEY
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const TITLE = /president|ceo|chief executive|executive director|managing director|director|vice president|\bvp\b|manager|chair|workforce|business (development|retention|attraction|services)|economic|talent|member|development/i
const BAD = /sales|marketing|intern|assistant|accountant|bookkeeper|office manager|events?\b|membership coordinator/i
const STOP = new Set(['greater', 'area', 'chamber', 'commerce', 'of', 'the', 'county', 'economic', 'development', 'council', 'inc', 'association', 'regional', 'corporation', 'corp', 'foundation', 'partnership', 'alliance', 'authority', 'workforce', 'board', 'and', 'for', 'metro', 'metropolitan', 'city', 'industrial', 'community'])

const score = (t: string) => /executive director|president|ceo|chief executive|managing director/i.test(t) ? 0 : /workforce|business (development|retention|attraction|services)|economic|talent/i.test(t) ? 1 : /director|vice president|\bvp\b/i.test(t) ? 2 : 3
const hostOf = (site: string | null) => (site ? site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase() : null)
const clean = (name: string) => name.replace(/\(.*?\)/g, '').replace(/,?\s+(inc|llc|corp|corporation|co|ltd|incorporated)\.?\s*$/i, '').trim()
const keyword = (name: string) => name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).find((w) => w.length >= 4 && !STOP.has(w)) ?? null

async function hunter(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, api_key: KEY! })
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.hunter.io/v2/${path}?${qs}`, { signal: AbortSignal.timeout(30_000) }).catch(() => null)
    if (!res) { await sleep(3000); continue }
    if (res.status === 429 || res.status === 202) { await sleep(6000 * (attempt + 1)); continue }
    if (res.status === 401 || res.status === 403) throw new Error(`Hunter refused the request (${res.status})`)
    return res.json().catch(() => null)
  }
  return null
}

async function main() {
  const [maxArg, out, flag] = process.argv.slice(2)
  if (!KEY) throw new Error('HUNTER_API_KEY is not set')
  const max = Number(maxArg ?? 100), apply = flag === '--apply'
  // Quotas so no kind uses the whole budget: all economic development, then workforce and chambers in the areas with the most layoffs.
  // HUNTER_GEO_PASS=nosite: the economic development and workforce leads with no website on file (domain looked up first).
  const nosite = process.env.HUNTER_GEO_PASS === 'nosite'
  const quota = nosite
    ? { ECON_DEV: Math.round(max * 0.45), WORKFORCE: Math.round(max * 0.55), CHAMBER: 0 }
    : { ECON_DEV: Math.round(max * 0.34), WORKFORCE: Math.round(max * 0.33), CHAMBER: Math.round(max * 0.33) }
  const pick = async (kind: 'ECON_DEV' | 'WORKFORCE' | 'CHAMBER') => (await prisma.geoOrgLead.findMany({
    where: { kind, dismissedAt: null, contactEmail: null, geoArea: { layoffs90d: { gt: 0 } }, ...(kind === 'CHAMBER' ? {} : nosite ? { OR: [{ website: null }, { website: '' }] } : { website: { not: null } }) },
    include: { geoArea: { select: { layoffs90d: true } } },
    orderBy: [{ geoArea: { layoffs90d: 'desc' } }, { fitScore: { sort: 'desc', nulls: 'last' } }],
    take: kind === 'CHAMBER' ? 1000 : nosite ? 700 : quota[kind],
  })).filter((l) => kind === 'CHAMBER' || nosite || (l.website ?? '').trim() !== '')
  const leads = [...(await pick('ECON_DEV')), ...(await pick('WORKFORCE')), ...(nosite ? [] : await pick('CHAMBER'))]
  console.log(`${leads.length} leads (up to ${max} searches)`)

  const queue = [...leads]
  const rows: any[] = []
  let searches = 0, saved = 0
  const spent: Record<string, number> = { ECON_DEV: 0, WORKFORCE: 0, CHAMBER: 0 }
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      if (searches >= max) return
      if (spent[l.kind] >= quota[l.kind as keyof typeof quota]) continue
      let domain = hostOf(l.website)
      // A chamber has no website on file: find one for free, and search only when it looks like theirs.
      if (!domain && (l.kind === 'CHAMBER' || nosite)) {
        const d = await lookupDomain(clean(l.name)).catch(() => null)
        const k = keyword(l.name)
        if (d && k && d.includes(k) && (await receivesMail(d))) domain = d
        else { rows.push({ id: l.id, kind: l.kind, name: l.name, state: l.state, domain: null, viaName: true, hits: [] }); continue }
      }
      searches++; spent[l.kind]++
      const params: Record<string, string> = { limit: '6', department: 'executive,management', seniority: 'senior,executive', type: 'personal' }
      if (domain) params.domain = domain; else params.company = clean(l.name)
      const j = await hunter('domain-search', params).catch(() => null)
      const data = j?.data
      let hits: any[] = (data?.emails ?? []).filter((e: any) => e.first_name && e.last_name && e.position && TITLE.test(e.position) && !BAD.test(e.position) && (e.confidence ?? 0) >= 70)
      // A domain found by name must look like this organization's.
      if (!domain && data?.domain) {
        const k = keyword(l.name)
        if (!k || !String(data.domain).toLowerCase().includes(k)) hits = []
      }
      hits.sort((a, b) => score(a.position) - score(b.position) || (b.confidence ?? 0) - (a.confidence ?? 0))
      const best = hits[0]
      rows.push({ id: l.id, kind: l.kind, name: l.name, state: l.state, domain: data?.domain ?? domain, viaName: !l.website, hits: hits.map((h) => ({ name: `${h.first_name} ${h.last_name}`, title: h.position, email: h.value, confidence: h.confidence, status: h.verification?.status ?? null, phone: h.phone_number ?? null })) })
      if (apply && best) {
        await prisma.geoOrgLead.update({
          where: { id: l.id },
          data: {
            contactName: `${best.first_name} ${best.last_name}`, contactTitle: best.position, contactEmail: best.value, contactPhone: best.phone_number ?? null,
            contactSource: 'Hunter domain search', contactConfidence: best.verification?.status ?? `confidence ${best.confidence}`, enrichedAt: new Date(),
            ...(!l.website && (data?.domain ?? domain) ? { website: `https://${data?.domain ?? domain}` } : {}),
          },
        })
        saved++
      }
      if (rows.length % 25 === 0) console.log(`${rows.length} done, ${rows.filter((r) => r.hits.length).length} with a contact`)
      await sleep(250)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  writeFileSync(out, JSON.stringify(rows, null, 1))
  const by = (k: string) => `${rows.filter((r) => r.kind === k && r.hits.length).length}/${rows.filter((r) => r.kind === k).length}`
  console.log(`done: ${rows.length} leads searched; with a contact: economic development ${by('ECON_DEV')}, workforce ${by('WORKFORCE')}, chambers ${by('CHAMBER')}; saved to leads: ${saved}. Saved ${out}`)
  const acct = await hunter('account', {})
  const rq = acct?.data?.requests
  if (rq) console.log(`Hunter left: ${rq.searches?.remaining} searches, ${rq.verifications?.remaining} verifications`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
