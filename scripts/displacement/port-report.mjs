// Port the authored report HTML into the Next.js edition page.
//
//   node scripts/displacement/port-report.mjs [source.html] [route-dir]
//
// Writes, from incoming-report/displacement-report-september-2026.html by default:
//   <route>/report-body.ts    body markup (cover through footer), verbatim
//   <route>/report-styles.ts  the <style> blocks, every selector scoped to .ncr
//   public/reports/report-charts.js  the inline chart script, with null guards
// Metadata and JSON-LD live in page.tsx and are edited by hand.
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const SRC = process.argv[2] ?? 'incoming-report/displacement-report-september-2026.html'
const ROUTE = process.argv[3] ?? 'src/app/reports/displacement-report-september-2026'
const html = fs.readFileSync(SRC, 'utf8')

const asTemplate = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

// Body: from the cover header up to the JSON-LD / script tail.
const start = html.indexOf('<header class="cover">')
const end = html.search(/\n\s*<script[\s>]/)
if (start < 0 || end < start) throw new Error('Could not find the report body boundaries')
let body = html.slice(start, end).trim()

// Site-only additions the authored file doesn't carry: the ungated PDF link
// under the cover buttons (ReportEnhancements tracks it), and anchors on the
// correction boxes so the page's correction banner can link to each one.
const patch = (re, fn, label) => {
  if (!re.test(body)) throw new Error(`Port patch did not apply: ${label}`)
  body = body.replace(re, fn)
}
patch(
  /(<div class="actions">[\s\S]*?<\/div>\n)/,
  (m) =>
    `${m}    <p style="margin:0;font-size:.8rem"><a id="pdf-direct" href="/reports/displacement-report-2026-09.pdf" download style="color:var(--muted);text-underline-offset:2px">Media or researcher? Download the PDF directly →</a></p>\n`,
  'pdf-direct link',
)
let n = 0
patch(
  /<div class="box disclose" style="margin:0 0 14px">(?=<p style="margin:0"><strong>Correction \(Version)/g,
  () => `<div class="box disclose" id="${n++ === 0 ? 'correction' : `correction-${n}`}" style="margin:0 0 14px;scroll-margin-top:80px">`,
  'correction anchors',
)
const base = path.basename(SRC)
fs.writeFileSync(
  path.join(ROUTE, 'report-body.ts'),
  `// AUTO-EXTRACTED verbatim from the authored report HTML (incoming-report/
// ${base}), body only, by scripts/displacement/port-report.mjs. Links already
// point at /reports/*. Charts render into the empty .plot divs via
// public/reports/report-charts.js. Interactive pieces (Logo, newsletter slot,
// PDF gate) are layered on by ReportEnhancements via the ids/classes below.
export const REPORT_BODY_HTML = \`${asTemplate(body)}\`
`,
)

// Styles: scope every selector to .ncr; :root/html/body fold onto .ncr.
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
const root = postcss.parse(css)
const scope = (sel) => {
  const s = sel.trim()
  if (/^(:root|html|body)$/.test(s)) return '.ncr'
  if (s === '*') return '.ncr *'
  return `.ncr ${s.replace(/^(:root|html|body)\s+/, '')}`
}
root.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
  rule.selectors = rule.selectors.map(scope)
})
root.walkDecls((d) => {
  if (d.prop === '--display') d.value = 'var(--font-source-serif),"Source Serif 4",Georgia,"Times New Roman",serif'
  if (d.prop === '--body' || d.prop === '--mono') d.value = 'var(--font-inter),"Inter",system-ui,-apple-system,"Segoe UI",sans-serif'
})
fs.writeFileSync(
  path.join(ROUTE, 'report-styles.ts'),
  `// AUTO-SCOPED from the authored report HTML's <style> blocks: every selector
// prefixed with .ncr so the report's CSS styles only the report document and
// never the site chrome. :root/body/* fold onto .ncr; the two font tokens
// point at the site's next/font variables. Regenerate with
// scripts/displacement/port-report.mjs.
export const REPORT_CSS = \`${asTemplate(root.toString().trim())}\`
`,
)

// Chart script: the last non-JSON-LD inline script, with null guards.
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
if (!scripts.length) throw new Error('No inline chart script found')
const js = scripts.at(-1)
  .trim()
  .replace(/var fig=document\.getElementById\(([^)]+)\)(?:,|;var )host=/g, 'var fig=document.getElementById($1);if(!fig)return;var host=')
fs.writeFileSync(
  'public/reports/report-charts.js',
  `// Progressive enhancement for the Displacement Report: draws the SVG exhibits
// and wires the copy-citation button. The page reads fine without it — every
// word, table and note is already in the server HTML. Download buttons work as
// normal links on the website; inside the Claude viewer (window.claude) they
// route through the downloads capability. Verbatim from the authored report,
// with defensive guards, by scripts/displacement/port-report.mjs.
${js}
`,
)
console.log(`body ${body.length} chars, css ${root.nodes.length} nodes, charts ${js.length} chars`)
