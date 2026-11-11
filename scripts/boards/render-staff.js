#!/usr/bin/env node
/**
 * Second pass for the staff crawler: hosts whose pages need JavaScript, or whose staff list is a PDF.
 * Renders each host's home page and its best staff/team/contact links in headless Chromium, downloads staff-looking PDFs
 * (text via pdftotext), and writes {host, orgs, pages:[{url, html}]} for scripts/boards/read-rendered.py to read people off.
 * Polite: robots.txt honoured, one page at a time per host, 1 second apart, at most 6 pages per host.
 *
 *   node scripts/boards/render-staff.js sites.tsv out.json
 */
const { chromium } = require('playwright')
const fs = require('fs'), cp = require('child_process')
const [, , SITES, OUT] = process.argv
const UA = 'Mozilla/5.0 (compatible; NextChapterStaffDirectory/1.0; +https://launchyournextchapter.com)'
const LINK = /\b(staff|our team|meet|team|leadership|directory|contact|about us|who we are|people|personnel|administration|management|executive)\b/i
const STRONG = /\b(staff|our team|meet (the|our)|leadership|directory|team members)\b/i
const rows = fs.readFileSync(SITES, 'utf8').split('\n').filter(Boolean).map((l) => { const [kind, id, state, name, website] = l.split('\t'); return { kind, id, state, name, website } })
const byHost = new Map(); for (const r of rows) { const h = new URL(r.website).host.toLowerCase(); byHost.set(h, [...(byHost.get(h) ?? []), r]) }
const hosts = [...byHost.keys()]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function robotsOk(url) {
  try { const u = new URL(url); const r = await fetch(u.origin + '/robots.txt', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }); if (!r.ok) return true
    const t = await r.text(); let ua = false, dis = []; for (const l of t.split('\n')) { const m = l.trim(); if (/^user-agent:/i.test(m)) ua = /\*/.test(m); else if (ua && /^disallow:/i.test(m)) dis.push(m.slice(9).trim()) }
    return !dis.some((d) => d && u.pathname.startsWith(d)) } catch { return true }
}
async function renderHost(browser, host) {
  const orgs = byHost.get(host); const pages = []
  const ctx = await browser.newContext({ userAgent: UA }); const page = await ctx.newPage(); page.setDefaultTimeout(20000)
  const visit = async (url) => {
    if (!(await robotsOk(url))) return null
    try { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); await sleep(1000); return page.url() } catch { return null }
  }
  const home = await visit(orgs[0].website)
  if (!home) { await ctx.close(); return { host, orgs, pages, error: 'unreachable' } }
  pages.push({ url: home, html: await page.content() })
  const links = await page.$$eval('a[href]', (as) => as.map((a) => [a.href, (a.textContent || '').trim()]))
  const cands = new Map()
  for (const [href, text] of links) {
    if (!/^https?:/.test(href) || /^mailto|^tel/.test(href)) continue
    let u; try { u = new URL(href) } catch { continue }; u.hash = ''
    const pdf = /\.pdf$/i.test(u.pathname)
    if (!pdf && u.host.replace(/^www\./, '') !== new URL(home).host.replace(/^www\./, '')) continue
    const score = (STRONG.test(text) ? 3 : LINK.test(text) ? 1 : 0) + (STRONG.test(u.href) ? 2 : 0) + (pdf && /staff|directory|contact|team/i.test(u.href + text) ? 2 : 0)
    if (score) cands.set(u.href, Math.max(score, cands.get(u.href) ?? 0))
  }
  for (const u of [...cands.keys()].sort((a, b) => cands.get(b) - cands.get(a)).slice(0, 5)) {
    if (/\.pdf$/i.test(new URL(u).pathname)) {
      try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }); if (!r.ok) continue
        const f = `/tmp/render_${process.pid}.pdf`; fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()))
        const txt = cp.execFileSync('pdftotext', ['-layout', f, '-'], { maxBuffer: 20e6 }).toString()
        pages.push({ url: u, html: '<div>' + txt.split('\n').map((l) => '<p>' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>').join('') + '</div>' }); await sleep(1000) } catch {}
      continue
    }
    const fu = await visit(u); if (fu) pages.push({ url: fu, html: await page.content() })
  }
  await ctx.close(); return { host, orgs, pages }
}
;(async () => {
  const browser = await chromium.launch(); const out = []; let i = 0, done = 0
  const worker = async () => { for (;;) { const h = hosts[i++]; if (!h) return; try { out.push(await renderHost(browser, h)) } catch (e) { out.push({ host: h, orgs: byHost.get(h), pages: [], error: String(e).slice(0, 80) }) } if (++done % 10 === 0) console.log(done, '/', hosts.length) } }
  await Promise.all(Array.from({ length: 4 }, worker)); await browser.close()
  fs.writeFileSync(OUT, JSON.stringify(out)); console.log('done', out.length, 'hosts', out.reduce((n, r) => n + r.pages.length, 0), 'pages')
})()
