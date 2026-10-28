// Targeted Hunter pass: P0/P1 people and NAWB Forum 2027 presenters. Read-only on the DB; writes the two CSVs
// scripts/crm/hunter-import.ts reads (1-verified-emails.csv, 2-found-emails.csv) into <outDir>.
//   node scripts/crm/hunter/targeted-pass.cjs <outDir> [searchFloor] [verifyFloor] [tier2]
// tier2 = P2 people and unprioritized people at A/B-grade organizations, no guess on file (finder only).
const fs = require('fs')
const root = process.cwd()
const env = Object.fromEntries(fs.readFileSync(root + '/.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
process.env.DATABASE_URL = env.DATABASE_URL
const { PrismaClient } = require(root + '/node_modules/@prisma/client')
const db = new PrismaClient(); const KEY = env.HUNTER_API_KEY
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
const TIER2 = process.argv[5] === 'tier2'
const outDir = process.argv[2]; const SEARCH_FLOOR = +process.argv[3] || 1200; const VERIFY_FLOOR = +process.argv[4] || 500
async function acct() { const d = (await (await fetch(`https://api.hunter.io/v2/account?api_key=${KEY}`)).json()).data.requests; return { s: d.searches.available - d.searches.used, v: d.verifications.available - d.verifications.used } }
async function call(url) {
  for (let a = 0; a < 5; a++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(40000) }).catch(() => null)
    if (!res) { await sleep(3000); continue }
    const t = await res.text()
    if (res.status === 202 || /too_many/.test(t)) { await sleep(6000 * (a + 1)); continue }
    try { return JSON.parse(t) } catch { return null }
  }
  return null
}
;(async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const base = `p."mergedIntoId" is null and p."deletedAt" is null and (p.email is null or p.email='')`
  const aff = `select distinct on (a."personId") a."personId", o.name org, coalesce(o."emailDomain", nullif(regexp_replace(coalesce(o.website,''),'^https?://(www\\.)?([^/]+).*$','\\2'),'')) dom from "CrmAffiliation" a join "CrmOrganization" o on o.id=a."orgId" where a."isCurrent" order by a."personId", a."isPrimary" desc, a."createdAt" desc`
  const guesses = TIER2 ? [] : await db.$queryRawUnsafe(`select p.id, p."fullName", p."guessedEmail" email, p.priority::text pr from "CrmPerson" p where ${base} and p."guessedEmail" is not null and p.priority in ('P0','P1') order by p.priority, p."priorityScore" desc`)
  const finds = await db.$queryRawUnsafe(`with aff as (${aff}) select p.id, p."fullName", p."firstName", p."lastName", p.priority::text pr, aff.org, aff.dom, (p.notes like '%NAWB Forum 2027%') nawb from "CrmPerson" p join aff on aff."personId"=p.id where ${base} and p."guessedEmail" is null and (${TIER2 ? `p.priority = 'P2' or (p.priority is null and exists (select 1 from "CrmAffiliation" a2 join "CrmOrganization" o2 on o2.id=a2."orgId" where a2."personId"=p.id and o2."leadQuality" in ('A','B')))` : `p.priority in ('P0','P1') or p.notes like '%NAWB Forum 2027%'`}) order by (p.priority='P0') desc, (p.priority='P1') desc, p."priorityScore" desc`)
  console.log('verify queue', guesses.length, 'find queue', finds.length)
  fs.writeFileSync(outDir + '/1-verified-emails.csv', ['id', 'name', 'priority', 'email', 'kind', 'hunterResult', 'score'].map(q).join(',') + '\n')
  fs.writeFileSync(outDir + '/2-found-emails.csv', ['id', 'name', 'priority', 'org', 'domainUsed', 'foundEmail', 'confidence', 'verification', 'note'].map(q).join(',') + '\n')
  fs.writeFileSync(outDir + '/3-new-contacts-from-domain-search.csv', ['orgId', 'orgTypes', 'first', 'last', 'email', 'position', 'verification', 'confidence'].map(q).join(',') + '\n')
  let { s, v } = await acct(); console.log('start', { searches: s, verifications: v })
  const tally = { verify: {}, find: {} }
  let i = 0, stop = false
  async function vworker() {
    while (!stop) {
      const r = guesses[i++]; if (!r) return
      if (v <= VERIFY_FLOOR) { stop = true; return }
      const j = await call(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(r.email)}&api_key=${KEY}`)
      const d = (j && j.data) || {}; v--
      const k = d.result || 'error'; tally.verify[k] = (tally.verify[k] || 0) + 1
      fs.appendFileSync(outDir + '/1-verified-emails.csv', [r.id, r.fullName, r.pr, r.email, 'guessed', d.result || '', d.score ?? ''].map(q).join(',') + '\n')
    }
  }
  await Promise.all(Array.from({ length: 3 }, vworker))
  stop = false; let f = 0, done = 0
  async function fworker() {
    while (!stop) {
      const r = finds[f++]; if (!r) return
      if (s <= SEARCH_FLOOR) { stop = true; return }
      const fn = r.firstName || (r.fullName || '').split(' ')[0], ln = r.lastName || (r.fullName || '').split(' ').slice(1).join(' ')
      let note = '', d = {}
      if (!fn || !ln || !(r.dom || r.org)) note = 'no name or organization'
      else {
        const qs = new URLSearchParams({ first_name: fn, last_name: ln, api_key: KEY })
        if (r.dom) qs.set('domain', r.dom); else qs.set('company', r.org)
        const j = await call('https://api.hunter.io/v2/email-finder?' + qs)
        d = (j && j.data) || {}
        if (d.email) { note = 'found'; s-- } else note = (j && j.errors && j.errors[0] && j.errors[0].id) || 'not found'
      }
      tally.find[note] = (tally.find[note] || 0) + 1
      fs.appendFileSync(outDir + '/2-found-emails.csv', [r.id, r.fullName, r.pr || (r.nawb ? 'NAWB' : ''), r.org, r.dom || '', d.email || '', d.score ?? '', (d.verification && d.verification.status) || '', note].map(q).join(',') + '\n')
      done++
    }
  }
  await Promise.all(Array.from({ length: 3 }, fworker))
  const end = await acct()
  console.log('verify', JSON.stringify(tally.verify), 'find', JSON.stringify(tally.find), 'processed finds', done, 'of', finds.length, 'remaining', end)
  await db.$disconnect()
})()
