/**
 * The three one-page PDFs the outreach emails promise: employer summary (with terms), partner handout (with QR), funder proposal.
 * Terms are DRAFT until Justin signs off; each page says so in the footer so none goes out by accident.
 *
 *   tsx --conditions=react-server scripts/crm/one-pagers.ts [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { qrSvg } from '../../src/lib/qr/qr-svg'

const OUT = process.argv[2] ?? '/Users/salitkulla/nc-hunter-results/one-pagers'
const SITE = 'https://launchyournextchapter.com'
const FOOT = 'NextChapter · 2248 Broadway #1838, New York, NY 10024 · justin@launchyournextchapter.com'

const page = (title: string, body: string, qr = '') => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
@page{size:Letter;margin:0.6in}body{font:11.5pt/1.45 -apple-system,Helvetica,Arial,sans-serif;color:#111;margin:0}
h1{font-size:21pt;margin:0 0 4pt}h2{font-size:12pt;margin:16pt 0 4pt;text-transform:uppercase;letter-spacing:.04em;color:#444}
p{margin:0 0 8pt}ul{margin:0 0 8pt;padding-left:18pt}li{margin-bottom:3pt}.sub{color:#555;margin-bottom:12pt}
.row{display:flex;gap:18pt;align-items:flex-start}.qr{width:120pt;flex:none;text-align:center;font-size:9pt;color:#555}
.terms{border:1px solid #bbb;border-radius:6pt;padding:8pt 12pt;margin-top:10pt}.foot{position:fixed;bottom:0;font-size:8.5pt;color:#888}
.draft{color:#a15c00}</style></head><body><div class="row"><div style="flex:1">${body}</div>${qr ? `<div class="qr">${qr}<div>Scan to see how it works</div></div>` : ''}</div>
<div class="foot">${FOOT}</div></body></html>`

const qr = qrSvg(`${SITE}/?utm_source=handout&utm_medium=one_pager`, { size: 120 })

const PAGES: Record<string, { title: string; html: string }> = {
  'employer-summary': {
    title: 'NextChapter for employers',
    html: page('NextChapter for employers', `
<h1>A job-search workspace for the people you are letting go</h1>
<p class="sub">Software for affected employees, offered by you. No coaching headcount to schedule, and it can start the day you announce.</p>
<h2>What your people get</h2>
<ul><li>A map of where their skills are in demand, built from their own work history</li><li>Open roles matched to them, including manager-level and AI-related roles, with the resume and interview prep to go after them</li><li>A private group with others from the same company, if they choose to join</li></ul>
<h2>What you get</h2>
<ul><li>A single link or QR code to include in your announcement or severance packet</li><li>A counts-only report: how many joined and, among those who choose to share it, how many are interviewing or have landed. Nothing about any one person unless they choose to share it with you.</li></ul>
<h2>How it works</h2>
<ul><li>Week 0: we set up a company group and send you a link</li><li>Weeks 1 to 12: people join on their own time</li><li>Day 45 and day 90: counts report</li></ul>
<div class="terms"><b class="draft">Draft terms, for discussion</b><ul><li>Pilot cohort: one group, up to 12 weeks</li><li>Software only, priced per participant who joins, not per person invited. You pay for use.</li><li>No employee data is shared with you without that person’s consent; no data is sold or used for hiring decisions</li><li>Either side can end the pilot with 14 days’ notice</li></ul></div>`),
  },
  'partner-handout': {
    title: 'NextChapter for workforce partners',
    html: page('NextChapter for workforce partners', `
<h1>One more resource for people leaving a layoff</h1>
<p class="sub">For Rapid Response teams, workforce boards and career centers. Free for the people you refer.</p>
<h2>What it is</h2>
<p>A job-search workspace for laid-off white-collar workers: a map of where their skills are in demand, matched openings, and resume and interview preparation. It sits alongside the services you already provide.</p>
<h2>Why it helps your team</h2>
<ul><li>People can start the same day, before an appointment is available</li><li>It is built around the local market, and shows openings near them as well as remote</li><li>You get a counts-only report on how many of your referrals joined and how many report interviews or a job</li></ul>
<h2>How to use it</h2>
<ul><li>Hand out this page or share the QR code at an event or in a packet</li><li>Ask us for a link for one layoff and we will tag it so you see your own numbers</li></ul>
<p class="sub">Free to participants. Participants decide what is shared and with whom.</p>`, qr),
  },
  'funder-proposal': {
    title: 'NextChapter pilot proposal',
    html: page('NextChapter pilot proposal', `
<h1>Pilot proposal: reemployment support for laid-off white-collar workers</h1>
<p class="sub">For workforce funders, foundations and public agencies.</p>
<h2>The need</h2>
<p>White-collar workers are often the least served by programs built for hourly and trades layoffs. They search alone, for longer, and often do not know where their skills transfer.</p>
<h2>The pilot</h2>
<ul><li>One region, one or more recent layoffs, 12 weeks</li><li>NextChapter provides a software workspace to each participant at no cost to them</li><li>Referrals come from the local Rapid Response team, American Job Center or employer</li></ul>
<h2>What we will report</h2>
<ul><li>At day 45 and day 90: how many joined, and among those who choose to share it, how many are interviewing or have landed</li><li>Counts only, with small groups withheld; no individual data</li></ul>
<h2>What we ask for</h2>
<p>Funding for participants in the pilot, and an introduction to the local team that works with the layoff. We will agree the measure with you before it starts.</p>
<div class="terms"><b class="draft">Draft budget, for discussion</b><p>Per-participant software cost, a small setup fee for the region, and a report. Figures to be set with Justin before this goes out.</p></div>`),
  },
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const pg = await browser.newPage()
  for (const [name, p] of Object.entries(PAGES)) {
    writeFileSync(`${OUT}/${name}.html`, p.html)
    await pg.setContent(p.html)
    await pg.pdf({ path: `${OUT}/${name}.pdf`, format: 'Letter', printBackground: true })
    console.log('wrote', `${OUT}/${name}.pdf`)
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
