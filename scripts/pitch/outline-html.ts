// Writes the pitch outline page (HTML) from the default rule sets, so the doc cannot drift from the tool.
import { writeFileSync } from 'fs'
import { defaultRuleSet } from '../../src/lib/pitch/defaults'
import { CUSTOMER_TYPES, CUSTOMER_LABELS } from '../../src/lib/pitch/types'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const clean = (s: string) => esc(s.replace(/\{\{(\w+)\}\}/g, '‹$1›'))
const base = defaultRuleSet('ECON_DEV')

const skeleton = base.slides.map((s) => `<tr class="${s.appendix ? 'appx' : ''}"><td>${esc(s.section)}</td><td>${clean(s.title)}</td><td>${esc(s.why ?? '')}</td></tr>`).join('')

const types = CUSTOMER_TYPES.map((t) => {
  const r = defaultRuleSet(t)
  const on = r.slides.filter((s) => s.enabled && !s.appendix)
  const off = r.slides.filter((s) => !s.enabled)
  const ap = r.slides.filter((s) => s.enabled && s.appendix)
  const custom = ['summary', 'problem', 'cost', 'solution', 'fit'].map((id) => r.slides.find((s) => s.id === id)).filter(Boolean)
  return `<section class="type" id="${t}">
  <h3>${esc(CUSTOMER_LABELS[t])}</h3>
  <dl>
    <dt>Buyer</dt><dd>${esc(r.buyer)}</dd>
    <dt>Angle</dt><dd>${esc(r.angle)}</dd>
    <dt>Tone</dt><dd>${esc(r.tone)}</dd>
    <dt>The ask</dt><dd>${esc(r.ask)}</dd>
    <dt>Starting point</dt><dd><strong>${esc(r.offer.name)}</strong>, ${esc(r.offer.term)}. No price in an intro deck. We need: ${r.offer.theyProvide.map(esc).join('; ')}.</dd>
    <dt>Packages</dt><dd>${r.packages.map((x) => `<strong>${esc(x.name)}</strong> (${esc(x.bestFor.toLowerCase())})`).join('<br>')}</dd>
    <dt>Audiences</dt><dd>${r.slides.filter((x) => x.constituent && x.enabled).map((x) => esc(x.constituent!)).join(', ')}</dd>
    <dt>Demo screens</dt><dd>${r.slides.filter((x) => x.kind === 'demo' && x.enabled).map((x) => esc(x.title)).join('<br>')}</dd>
    <dt>Team slide</dt><dd>${r.suggestedPeople.map(esc).join('<br>')}</dd>
  </dl>
  <h4>Main deck: ${on.length} slides</h4>
  <ol class="flow">${on.map((s) => `<li>${clean(s.title)}</li>`).join('')}</ol>
  <h4>Appendix: ${ap.length} slides</h4>
  <p class="muted">${ap.map((s) => clean(s.title)).join(' · ') || 'None'}</p>
  ${off.length ? `<p class="muted">Switched off for this type: ${off.map((s) => clean(s.title)).join(', ')}.</p>` : ''}
  <details><summary>The tailored messaging</summary>
    ${custom.map((s) => `<h5>${clean(s!.title)}</h5><ul>${s!.bullets.map((b) => `<li>${clean(b)}</li>`).join('')}</ul>`).join('')}
  </details>
</section>`
}).join('\n')

const html = `<title>Pitch Deck Outlines</title>
<style>
:root{--bg:#f7f8f6;--fg:#1d2a24;--muted:#5d6b64;--line:#d9dfdb;--card:#ffffff;--accent:#2e7d5b;--navy:#0b2545;--tint:#e8f1ec;--warn:#8a5a00}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111815;--fg:#e6ece8;--muted:#9aa8a0;--line:#2a3630;--card:#18211d;--accent:#5fbf91;--navy:#9cc0ef;--tint:#1c2c25;--warn:#e0b24f;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#111815;--fg:#e6ece8;--muted:#9aa8a0;--line:#2a3630;--card:#18211d;--accent:#5fbf91;--navy:#9cc0ef;--tint:#1c2c25;--warn:#e0b24f;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.55 "Source Sans 3",system-ui,sans-serif;padding-inline:max(16px,4vw);padding-block:32px}
main{max-width:980px;margin:0 auto}
h1,h2,h3{font-family:"Source Serif 4",Georgia,serif;text-wrap:balance;line-height:1.2}
h1{font-size:2rem;margin:0 0 6px}h2{font-size:1.4rem;margin:44px 0 12px;padding-top:8px;border-top:1px solid var(--line)}h3{font-size:1.2rem;margin:0 0 10px}h4{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:18px 0 6px}h5{margin:14px 0 4px;font-size:.95rem}
.lede{color:var(--muted);max-width:68ch;margin:0 0 8px}.muted{color:var(--muted);margin:4px 0}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--card)}
table{border-collapse:collapse;width:100%;min-width:640px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}tr.appx td{color:var(--muted)}tr:last-child td{border-bottom:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.box{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px 16px}.box h3{font-size:1rem;font-family:inherit;margin:0 0 6px}
nav.jump{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}nav.jump a{border:1px solid var(--line);border-radius:6px;padding:4px 10px;text-decoration:none;color:var(--fg);background:var(--card);font-size:.9rem}nav.jump a:hover{border-color:var(--accent)}
.type{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin:16px 0}
dl{display:grid;grid-template-columns:110px 1fr;gap:6px 14px;margin:0}dt{color:var(--muted);font-size:.85rem}dd{margin:0;min-width:0}
ol.flow{display:flex;flex-wrap:wrap;gap:6px;padding:0;margin:0;list-style:none;counter-reset:n}ol.flow li{counter-increment:n;background:var(--tint);border-radius:6px;padding:4px 10px;font-size:.88rem}ol.flow li::before{content:counter(n) ". ";color:var(--muted);font-variant-numeric:tabular-nums}
details{margin-top:12px}summary{cursor:pointer;color:var(--accent);font-weight:600}summary:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.sw{display:inline-flex;gap:6px;align-items:center}.sw i{width:18px;height:18px;border-radius:4px;border:1px solid var(--line);display:inline-block}
.todo{border-left:3px solid var(--warn);padding:2px 0 2px 12px;margin:8px 0}
@media (max-width:560px){dl{grid-template-columns:1fr}}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&family=Source+Serif+4:wght@600&display=swap">
<main>
<h1>Pitch deck outlines</h1>
<p class="lede">One deck skeleton, seven customer types. Each type has its own angle, offer, messaging and set of slides. Every slide is a rule you can switch on or off in Pitch rules, and every deck is built from those rules plus the local data for the customer's county.</p>
<nav class="jump" aria-label="Customer types">${CUSTOMER_TYPES.map((t) => `<a href="#${t}">${esc(CUSTOMER_LABELS[t])}</a>`).join('')}</nav>

<h2>The skeleton every deck follows</h2>
<p class="lede">Background, data, problem, solution and offer are all in, plus what a top intro deck adds: an executive summary up front, the cost of doing nothing, a product snapshot per audience, a slide for each audience inside the customer, what they will see, privacy and consent, three packages, a 90-day plan, a team slide, a single ask, and an appendix that holds the detail. Main decks run 23 to 29 slides; the appendix adds 2 to 7.</p>
<div class="tablewrap"><table><thead><tr><th>Part</th><th>Slide</th><th>Why it is there</th></tr></thead><tbody>${skeleton}</tbody></table></div>
<p class="muted">Greyed rows are the appendix. A generic deck drops every slide that needs a county's numbers.</p>

<h2>Customer types</h2>
${types}

<h2>Look and feel</h2>
<div class="grid">
<div class="box"><h3>Colors</h3><p>Pick per deck: <strong>NextChapter colors</strong> (<span class="sw"><i style="background:#2e7d5b"></i><i style="background:#0b2545"></i></span>), <strong>match their logo</strong> (we read the main colors off it), or <strong>choose colors</strong> by hand. Any color is darkened if needed so white text stays readable.</p></div>
<div class="box"><h3>Logo</h3><p>Their logo goes on the cover and in the footer, next to NextChapter. Give a website (we fetch an icon) or a direct logo link.</p></div>
<div class="box"><h3>People</h3><p>Justin is suggested for every deck. Boards' directors and anyone already in the CRM at that organization can be ticked in. Leave all unticked, or tick Keep it generic, for no names at all.</p></div>
<div class="box"><h3>Formats</h3><p>PowerPoint (every word editable; upload to Google Drive and open in Google Slides) and PDF. Both come from the same rules, so they match slide for slide.</p></div>
</div>

<h2>Decisions already made</h2>
<div class="todo"><strong>No prices.</strong> This is an intro deck. Packages show scope only. A price field exists in Pitch rules, blank by default; nothing shows until you fill it.</div>
<div class="todo"><strong>No proof yet.</strong> The Evidence slide says what can be checked today (sources, open method, labeled estimates). Add results to that slide when you have them.</div>
<div class="todo"><strong>Security and compliance</strong> is an appendix slide that stays off until you have statements to put on it.</div>
<div class="todo"><strong>Demo screens use sample data.</strong> Every one is labeled "Illustrative sample data" and is built from editable shapes, so it can be reworded in Google Slides.</div>
<div class="todo"><strong>Local news and initiatives.</strong> Those appendix slides stay out of a deck until the data exists for that county.</div>
<div class="todo"><strong>Higher ed claims follow the V1 build spec.</strong> Every higher-ed deck warns you to confirm which screens and tiers are live before presenting.</div>
</main>`
writeFileSync(process.argv[2], html)
console.log('wrote', html.length)
