/**
 * Named leaders at the curated insurer, broker, bank, retirement, platform and investor firms
 * (~/nc-hunter-results/2026-10-30-partners/orgs.json), by Hunter Domain Search with a job-title filter. One search per firm.
 * Writes partners-D.json in the shape partners-import.ts reads. Only a Hunter-`valid` address becomes an email.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/partners-hunter.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'

const KEY = process.env.HUNTER_API_KEY
const DIR = `${process.env.HOME}/nc-hunter-results/2026-10-30-partners`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const TITLES: Record<string, string> = {
  insurer: 'disability,absence,leave,return to work,group benefits,voluntary benefits,employer solutions,strategic partnerships',
  broker: 'talent,workforce,human capital,career,benefits consulting,innovation,partnerships',
  bank: 'community development,community affairs,CRA,philanthropy,foundation,workforce,corporate responsibility,financial health,hardship',
  retirement: 'workplace,workforce solutions,financial wellness,partnerships,participant',
  platform: 'partnerships,channel,business development,alliances,ecosystem',
  investor: 'operating partner,talent,people,platform,portfolio',
}
const KEEP: Record<string, RegExp> = {
  insurer: /disabilit|absence|leave|return.to.work|group benefits|voluntary|employer solutions|partnership|strategic/i,
  broker: /talent|workforce|human capital|career|benefits|innovation|partnership|rewards/i,
  bank: /community|CRA|philanthrop|foundation|workforce|responsib|financial health|hardship|loss mitigation/i,
  retirement: /workplace|workforce|financial wellness|partnership|participant|employer/i,
  platform: /partnership|channel|business development|alliance|ecosystem/i,
  investor: /operating partner|talent|people|platform|portfolio/i,
}
const LEADER = /director|head|vice president|\bvp\b|chief|president|partner|leader/i
const JUNIOR = /assistant|associate(?! partner)|analyst|coordinator|specialist|representative|account (manager|executive)|sales|intern|recruiter|consultant(?!.*practice)/i

async function main() {
  const orgs = JSON.parse(readFileSync(`${DIR}/orgs.json`, 'utf8')) as Record<string, [string, string][]>
  const jobs = Object.entries(orgs).flatMap(([group, list]) => list.map(([org, domain]) => ({ group, org, domain })))
  const out: any[] = []; let i = 0, searched = 0
  async function worker() {
    for (;;) {
      const j = jobs[i++]; if (!j) return
      const qs = new URLSearchParams({ domain: j.domain, limit: '10', type: 'personal', job_titles: TITLES[j.group], api_key: KEY! })
      let r: any = null
      for (let a = 0; a < 5; a++) {
        const res = await fetch(`https://api.hunter.io/v2/domain-search?${qs}`).catch(() => null)
        if (!res) { await sleep(3000); continue }
        if (res.status === 429 || res.status === 202) { await sleep(6000); continue }
        r = await res.json().catch(() => null); break
      }
      searched++
      for (const e of r?.data?.emails ?? []) {
        const t = e.position ?? ''
        if (!e.first_name || !e.last_name || !t || (e.confidence ?? 0) < 75 || !KEEP[j.group].test(t) || !LEADER.test(t) || JUNIOR.test(t)) continue
        out.push({ name: `${e.first_name} ${e.last_name}`, org: j.org, domain: j.domain, group: j.group, title: t, email: e.verification?.status === 'valid' ? e.value : '', source_url: `Hunter domain search (${j.domain}), 2026-10-30`, evidence_note: `Hunter email status ${e.verification?.status ?? 'unchecked'}, confidence ${e.confidence}.` })
      }
      await sleep(200)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  // at most 3 per firm, most senior first
  const by = new Map<string, any[]>(); for (const p of out) (by.get(p.domain) ?? by.set(p.domain, []).get(p.domain)!).push(p)
  const final = [...by.values()].flatMap((l) => l.sort((a, b) => (/chief|president|head/i.test(b.title) ? 1 : 0) - (/chief|president|head/i.test(a.title) ? 1 : 0)).slice(0, 3))
  writeFileSync(`${DIR}/partners-D.json`, JSON.stringify(final, null, 1))
  console.log(`searched ${searched} firms, kept ${final.length} people at ${by.size} firms`)
}
main().catch((e) => { console.error(e); process.exit(1) })
