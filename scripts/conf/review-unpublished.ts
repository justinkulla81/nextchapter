// Review of unpublished catalog rows from other sources: dedupe against published rows, then publish only when the official page loads and names the event.
// Never deletes. Dry run by default (reads the web and the database, writes nothing). Usage: tsx scripts/conf/review-unpublished.ts [--apply]
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'
import { findExistingSeries } from '../../src/lib/conferences/dedupe'
import { nameKey, isPublicHttpUrl } from '../../src/lib/conferences/canonical'

const prisma = new PrismaClient()
const APPLY = process.argv[2] === '--apply'
const UA = 'Mozilla/5.0 (compatible; NextChapterEventCheck/1.0; +https://launchyournextchapter.com)'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// Not professional conferences: awards dinners, union governance assemblies, K-12 teacher events, equestrian sport, multi-event "tech weeks".
const NOT_PROFESSIONAL = new Set(['us-equestrian-annual-meeting', 'pa-chamber-annual-dinner', 'pittsburgh-cio-tech-titan-awards', 'nysut-representative-assembly', 'mta-annual-meeting-of-delegates', 'south-dakota-stem-education-conference', 'ny-tech-week', 'seattle-tech-week', 'careertech-vision', 'education-minnesota-mea-conference'])
const last = new Map<string, number>()
const robots = new Map<string, string[]>()
async function polite(h: string) {
  const w = (last.get(h) ?? 0) + 2500 - Date.now()
  if (w > 0) await sleep(w)
  last.set(h, Date.now())
}
async function allowed(u: URL) {
  if (!robots.has(u.host)) {
    const dis: string[] = []
    try {
      await polite(u.host)
      const r = await fetch(`${u.protocol}//${u.host}/robots.txt`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': UA } })
      if (r.ok) {
        let star = false
        for (const l0 of (await r.text()).split('\n')) {
          const l = l0.split('#')[0].trim()
          if (/^user-agent:/i.test(l)) star = l.split(':')[1].trim() === '*'
          else if (star && /^disallow:/i.test(l)) dis.push(l.slice(9).trim())
        }
      }
    } catch { /* no robots.txt */ }
    robots.set(u.host, dis)
  }
  return !robots.get(u.host)!.some((d) => d && (u.pathname || '/').startsWith(d))
}
async function load(url: string) {
  const u = new URL(url)
  if (!(await allowed(u))) return { status: 'ROBOTS', text: '' }
  await polite(u.host)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow' })
    if (res.status === 403 || res.status === 429 || res.status === 503) return { status: 'BLOCKED', text: '' }
    if (!res.ok) return { status: res.status === 404 || res.status === 410 ? 'BROKEN' : 'ERROR', text: '' }
    const $ = cheerio.load((await res.text()).slice(0, 600_000))
    $('script,style,noscript').remove()
    return { status: 'OK', text: ($('title').text() + ' ' + $('body').text().replace(/\s+/g, ' ')).slice(0, 80_000) }
  } catch { return { status: 'ERROR', text: '' } }
}

async function main() {
  const all = await prisma.conferenceEvent.findMany({ select: { id: true, name: true, urlKey: true, url: true, published: true, source: true, rejectedAt: true } })
  const pub = all.filter((r) => r.published)
  const todo = all.filter((r) => !r.published && !r.rejectedAt && !(r.source ?? '').startsWith('wave'))
  const out: Record<string, string[]> = { published: [], duplicate: [], notProfessional: [], unverified: [] }
  const note = async (id: string, text: string, data: object = {}) => {
    if (APPLY) await prisma.conferenceEvent.update({ where: { id }, data: { adminNote: text, ...data } })
  }
  for (const r of todo) {
    if (NOT_PROFESSIONAL.has(r.id)) { out.notProfessional.push(r.id); await note(r.id, 'Reviewed 2026-11-02: not a professional conference (awards dinner, union assembly, K-12/sport or multi-event week). Left unpublished.'); continue }
    const dup = findExistingSeries(pub.filter((p) => p.id !== r.id), { urlKey: r.urlKey, name: r.name })
    if (dup) { out.duplicate.push(`${r.id} -> ${dup.id}`); await note(r.id, `Reviewed 2026-11-02: duplicate of ${dup.id} (matched by ${dup.by}). Left unpublished; merge or delete from the CRM.`); continue }
    if (!r.url || !isPublicHttpUrl(r.url)) { out.unverified.push(`${r.id} (no url)`); continue }
    const page = await load(r.url)
    const tokens = nameKey(r.name).split(' ').filter((t) => t.length > 2)
    const ok = page.status === 'OK' && tokens.length > 0 && tokens.filter((t) => page.text.toLowerCase().includes(t)).length >= Math.ceil(tokens.length * 0.6)
    if (ok) {
      out.published.push(r.id)
      await note(r.id, 'Reviewed 2026-11-02: official page loads and names the event; published.', { published: true, verified: true, linkStatus: 'OK', linkCheckedAt: new Date(), checkedAt: new Date() })
    } else {
      const why = page.status === 'OK' ? 'page does not name the event' : page.status
      out.unverified.push(`${r.id} (${why})`)
      await note(r.id, `Reviewed 2026-11-02: could not verify from the official page (${why}). Left unpublished.`, { linkCheckedAt: new Date() })
    }
    process.stdout.write(`${ok ? '+' : '-'} ${r.id}\n`)
  }
  fs.writeFileSync('/tmp/cg2/review.json', JSON.stringify(out, null, 1))
  console.log(APPLY ? 'APPLIED' : 'DRY RUN', todo.length, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])))
}
main().finally(() => prisma.$disconnect())
