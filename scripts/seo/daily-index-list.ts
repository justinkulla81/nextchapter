/**
 * Today's list of layoff pages to ask Google Search Console to index (Request indexing allows about 10 a day):
 * the latest layoffs first, then layoff pages never asked about, until there are 10.
 *
 *   npx tsx scripts/seo/daily-index-list.ts              prints today's list as JSON
 *   npx tsx scripts/seo/daily-index-list.ts --mark <url> [<url> ...]   records that those were requested
 *   options: --n 10   --state ~/nextchapter-seo/gsc-requested.json
 *
 * Reads only the public sitemap. What was already requested is kept in a small JSON file on this computer.
 * The daily run that clicks Request indexing in Chrome uses this (it is a scheduled task, see the Search Console notes in memory).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname } from 'node:path'
import { DAILY_LIST_SIZE, parseSitemapEntries, pickDailyList, type Requested } from '../../src/lib/seo/daily-index-list'

const SITE = 'https://launchyournextchapter.com'
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null }
const statePath = (arg('--state') ?? `${homedir()}/nextchapter-seo/gsc-requested.json`).replace(/^~/, homedir())

function load(): Requested {
  try { return JSON.parse(readFileSync(statePath, 'utf8')) as Requested } catch { return {} }
}

async function main() {
  const mark = process.argv.indexOf('--mark')
  if (mark >= 0) {
    const state = load()
    const urls = process.argv.slice(mark + 1).filter((u) => u.startsWith(SITE))
    for (const u of urls) state[u] = new Date().toISOString()
    mkdirSync(dirname(statePath), { recursive: true })
    writeFileSync(statePath, JSON.stringify(state, null, 2))
    console.log(JSON.stringify({ marked: urls.length, total: Object.keys(state).length }))
    return
  }
  const res = await fetch(`${SITE}/sitemap.xml`, { headers: { 'User-Agent': 'NextChapter-DailyIndexList/1.0' } })
  if (!res.ok) throw new Error(`sitemap.xml returned ${res.status}`)
  const entries = parseSitemapEntries(await res.text())
  const n = Number(arg('--n')) || DAILY_LIST_SIZE
  const list = pickDailyList(entries, load(), n)
  console.log(JSON.stringify({ date: new Date().toISOString().slice(0, 10), size: list.length, list }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
