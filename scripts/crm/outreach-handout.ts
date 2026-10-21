/**
 * The asset to send when someone answers a cold email: a one-page PDF for their organization with a tracked QR code, and a short tracked link.
 * Colleges get the college overview, employers the employer summary, everyone else the partner handout. Boards also get the self-serve demo link.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/crm/outreach-handout.ts <recipient-email> [merge.csv]
 *
 * Writes ~/nc-hunter-results/handouts/<org>.pdf and prints what to paste into the reply. The link is a ReferralLink labelled outreach:<template>:<email>,
 * so clicks and sign-ups through it are counted against that recipient.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { prisma } from '../../src/lib/prisma'
import { newReferralCode } from '../../src/lib/candidates/referral'
import { kitUrl } from '../../src/lib/cohorts/launch-kit'
import { qrSvg } from '../../src/lib/qr/qr-svg'

const SITE = 'https://launchyournextchapter.com'
const FOOT = 'NextChapter · 2248 Broadway #1838, New York, NY 10024 · justin@launchyournextchapter.com'
const OUT = '/Users/salitkulla/nc-hunter-results/handouts'
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function parseCsvRow(text: string, email: string): Record<string, string> | null {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  const [head, ...rest] = rows
  const r = rest.find((x) => (x[head.indexOf('email')] ?? '').toLowerCase() === email.toLowerCase())
  return r ? Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])) : null
}

async function main() {
  const [email, mergeFile] = process.argv.slice(2)
  if (!email) { console.log('usage: outreach-handout.ts <recipient-email> [merge.csv]'); return }
  const m = parseCsvRow(readFileSync(mergeFile ?? '/Users/salitkulla/nc-hunter-results/27-outreach-merge-data.csv', 'utf8'), email)
  if (!m) throw new Error(`${email} is not in the merge file`)
  const label = `outreach:${m.template}:${email.toLowerCase()}`
  const existing = await prisma.referralLink.findFirst({ where: { label }, select: { code: true } })
  const code = existing?.code ?? (await prisma.referralLink.create({ data: { code: newReferralCode(), label, kind: m.template === 'college' ? 'HIGHER_ED' : ['head_hr', 'rewards', 'er', 'ta'].includes(m.template) ? 'EMPLOYER' : 'OTHER' }, select: { code: true } })).code
  const url = kitUrl(SITE, code, 'handout', '/')
  const org = m.recipient_org || m.company
  const kind = m.template === 'college' ? 'college' : ['head_hr', 'rewards', 'er', 'ta'].includes(m.template) ? 'employer' : 'partner'

  const body = kind === 'college'
    ? `<h1>Supporting ${esc(m.county || 'your region')}'s laid-off workers and affected alumni</h1><p class="sub">Prepared for ${esc(org)}.</p><p>Several employers have filed layoff notices in your county. White-collar searches are running long: 28% of unemployed white-collar workers are still looking after 27 weeks, up from 23% a year ago (our monthly report, methods published).</p><h2>What the partnership covers</h2><ul><li>A pivot plan from each person's work history, and retraining matched to their skill gaps, including your own programs</li><li>Networking outreach drafted, coaching, and exclusive jobs and recruiters</li><li>An outreach path to affected alumni, with their consent</li></ul><h2>What you see</h2><ul><li>Counts of who engaged, enrolled, interviewed and landed. Never names.</li></ul><p class="sub">Pricing on request.</p>`
    : kind === 'employer'
      ? `<h1>A job transition platform for the people leaving ${esc(m.company || org)}</h1><p class="sub">Prepared for ${esc(org)}.</p><p>28% of unemployed white-collar workers are still looking after 27 weeks, up from 23% a year ago (our monthly report, methods published). Most outplacement ends at 90 days.</p><h2>What each person gets</h2><ul><li>A search strategy and a pivot plan built from their work history</li><li>Retraining for their gaps, networking outreach drafted, coaching, and exclusive jobs and recruiters</li></ul><h2>What you get</h2><ul><li>One link or QR code for your announcement or severance packet</li><li>Counts of who engaged, interviewed and landed. Never names.</li><li>An account for every affected employee; pricing on request</li></ul>`
      : `<h1>One more resource for white-collar workers after a layoff</h1><p class="sub">Prepared for ${esc(org)}.</p><p>White-collar workers are often the hardest for standard services to reach. 28% are still looking after 27 weeks, up from 23% a year ago (our monthly report, methods published).</p><h2>What each person gets</h2><ul><li>A pivot plan from their work history, retraining for the gaps, networking outreach drafted, coaching, and exclusive jobs and recruiters</li></ul><h2>For your team</h2><ul><li>Free to the people you refer</li><li>Counts back on who engaged, interviewed and landed. Never names.</li><li>A tagged link, so you see your own numbers</li></ul>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:Letter;margin:0.6in}body{font:11.5pt/1.45 -apple-system,Helvetica,Arial,sans-serif;color:#111;margin:0}h1{font-size:21pt;margin:0 0 4pt}h2{font-size:12pt;margin:16pt 0 4pt;text-transform:uppercase;letter-spacing:.04em;color:#444}p{margin:0 0 8pt}ul{margin:0 0 8pt;padding-left:18pt}li{margin-bottom:3pt}.sub{color:#555}.row{display:flex;gap:18pt}.qr{width:120pt;flex:none;text-align:center;font-size:9pt;color:#555}.foot{position:fixed;bottom:0;font-size:8.5pt;color:#888}</style></head><body><div class="row"><div style="flex:1">${body}</div><div class="qr">${qrSvg(url, { size: 120 })}<div>Scan to see how it works</div></div></div><div class="foot">${FOOT}</div></body></html>`
  mkdirSync(OUT, { recursive: true })
  const file = `${OUT}/${slug(org) || slug(email)}.pdf`
  const browser = await chromium.launch()
  const pg = await browser.newPage()
  await pg.setContent(html)
  await pg.pdf({ path: file, format: 'Letter', printBackground: true })
  await browser.close()
  writeFileSync(file.replace(/\.pdf$/, '.link.txt'), url + '\n')
  console.log(`PDF: ${file}\nTracked link: ${url}${m.template === 'board' ? `\nSelf-serve demo for their region: ${SITE}/demo/workforce` : ''}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
