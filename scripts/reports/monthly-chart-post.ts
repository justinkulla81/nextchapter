/**
 * One chart per month, as a social-ready post image.
 *
 *   npm run report:chart-post -- --list
 *   npm run report:chart-post -- --edition 2026-09 --chart productivity-vs-long-searches
 *
 * Renders PNGs (1200x1350 portrait for feeds, 1200x630 landscape for link
 * cards) from the published replication data in public/reports/, using SVG
 * and sharp (already a dependency). No network, no database, no LLM.
 *
 * Each image carries: a title that says what the chart shows, the source and
 * period, the margin-of-error note where the chart shows a survey estimate,
 * "NextChapter Displacement Report <Month Year>" and launchyournextchapter.com/reports.
 *
 * Options
 *   --list               print available charts and exit
 *   --edition <YYYY-MM>  report edition (default: latest registered)
 *   --chart <id>         chart id (see --list)
 *   --size <portrait|landscape|both>   default both
 *   --out <dir>          output folder (default public/reports)
 *   --svg                also write the SVG next to each PNG
 *   --data-dir <dir>     folder with the CSVs (default public/reports)
 *
 * Output names: chart-post-<edition>-<chart>-<w>x<h>.png
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { REPORT_EDITIONS } from '../../src/lib/reports'

// ── Types ───────────────────────────────────────────────────────────────

interface Box { x: number; y: number; w: number; h: number }

interface Style {
  w: number
  h: number
  pad: number
  kicker: number
  title: number
  subtitle: number
  axis: number
  small: number
  foot: number
  showSubtitle: boolean
}

interface ChartSpec {
  title: string
  subtitle: string
  /** "Source: ..." line, with the period. */
  source: string
  /** Shown only where the chart carries survey estimates with a margin of error. */
  moeNote?: string
  /** Shorter footer text for the landscape card, where there is little room. */
  compact?: { source: string; moeNote?: string }
  draw(box: Box, s: Style): string
}

interface Edition { key: string; month: string }

interface ChartDef {
  id: string
  label: string
  /** Editions the data supports. Omit for every edition. */
  editions?: string[]
  build(ctx: { edition: Edition; dataDir: string }): ChartSpec
}

// ── Look ────────────────────────────────────────────────────────────────

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif"
const C = {
  bg: '#ffffff', ink: '#0b1f3a', muted: '#4a5568', grid: '#e2e8f0',
  blue: '#2563a8', orange: '#c9711a', band: '#2563a8', rule: '#cbd5e1',
}

const PORTRAIT: Style = { w: 1200, h: 1350, pad: 72, kicker: 24, title: 56, subtitle: 28, axis: 22, small: 20, foot: 21, showSubtitle: true }
const LANDSCAPE: Style = { w: 1200, h: 630, pad: 48, kicker: 17, title: 32, subtitle: 20, axis: 16, small: 14, foot: 15, showSubtitle: false }

// ── Small helpers ───────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const f1 = (n: number) => n.toFixed(1)
/** Round half up on the printed value (0.815 prints 0.82, as the report does). */
const r2 = (n: number) => (Math.round(n * 100 + 1e-9) / 100).toFixed(2)

/** Greedy word wrap by average glyph width (0.5em for Helvetica-like fonts). */
function wrap(text: string, size: number, maxPx: number, em = 0.5): string[] {
  const maxChars = Math.max(8, Math.floor(maxPx / (size * em)))
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) { lines.push(line); line = word } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function textLines(lines: string[], x: number, y: number, size: number, lh: number, opts: { fill?: string; weight?: number; anchor?: string } = {}) {
  return lines
    .map((l, i) => `<text x="${x}" y="${y + i * size * lh}" font-size="${size}" font-weight="${opts.weight ?? 400}" fill="${opts.fill ?? C.ink}" text-anchor="${opts.anchor ?? 'start'}">${esc(l)}</text>`)
    .join('')
}

function parseCsv(raw: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (q) {
      if (ch === '"' && raw[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && raw[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

function readCsv(dir: string, file: string): Record<string, string>[] {
  const p = path.join(dir, file)
  if (!fs.existsSync(p)) throw new Error(`Missing data file ${p}`)
  return parseCsv(fs.readFileSync(p, 'utf8'))
}

const monthName = (m: number) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]

/** Last month of data an edition covers: the month before its title month (the September edition uses data through August). */
function dataThrough(editionKey: string): { year: number; month: number } {
  const [y, m] = editionKey.split('-').map(Number)
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 }
}

// ── Line chart ──────────────────────────────────────────────────────────

interface LineSeries { name: string; color: string; points: { x: number; y: number | null }[]; dashed?: boolean }

interface LineOpts {
  yMin: number; yMax: number; yTicks: number[]
  xMin: number; xMax: number; xTicks: { x: number; label: string }[]
  yFmt: (v: number) => string
  yUnit: string
  refLine?: { y: number; label: string }
  /** Fractional half-width of a band around series 0 (0.11 for ±11%). */
  band?: number
  endLabels: { text: string; y: number; color: string; bold?: boolean }[]
  marks?: { x: number; y: number; label: string; dy?: number; anchor?: string }[]
}

function lineChart(box: Box, s: Style, series: LineSeries[], o: LineOpts): string {
  const left = 64 + (s.axis > 18 ? 12 : 0)
  const right = Math.round(s.axis * 6)
  const top = s.axis + 14
  const bottom = s.axis + 14
  const px = { x: box.x + left, y: box.y + top, w: box.w - left - right, h: box.h - top - bottom }
  const X = (v: number) => px.x + ((v - o.xMin) / (o.xMax - o.xMin)) * px.w
  const Y = (v: number) => px.y + px.h - ((v - o.yMin) / (o.yMax - o.yMin)) * px.h
  let out = ''
  out += `<text x="${box.x}" y="${box.y + s.axis}" font-size="${s.axis}" fill="${C.muted}">${esc(o.yUnit)}</text>`
  for (const t of o.yTicks) {
    out += `<line x1="${px.x}" x2="${px.x + px.w}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.grid}" stroke-width="1.5"/>`
    out += `<text x="${px.x - 10}" y="${Y(t) + s.axis * 0.35}" font-size="${s.axis}" text-anchor="end" fill="${C.muted}">${esc(o.yFmt(t))}</text>`
  }
  for (const t of o.xTicks) {
    out += `<text x="${X(t.x)}" y="${px.y + px.h + s.axis + 8}" font-size="${s.axis}" text-anchor="middle" fill="${C.muted}">${esc(t.label)}</text>`
  }
  if (o.refLine) {
    const y = Y(o.refLine.y)
    out += `<line x1="${px.x}" x2="${px.x + px.w}" y1="${y}" y2="${y}" stroke="${C.muted}" stroke-width="2" stroke-dasharray="6 6"/>`
    out += `<text x="${px.x + 8}" y="${y - 8}" font-size="${s.axis}" fill="${C.muted}">${esc(o.refLine.label)}</text>`
  }
  // Contiguous segments (a missing month breaks the line instead of bridging it).
  const segments = (pts: LineSeries['points']) => {
    const segs: { x: number; y: number }[][] = []
    let cur: { x: number; y: number }[] = []
    for (const p of pts) {
      if (p.y === null) { if (cur.length) segs.push(cur); cur = [] } else cur.push({ x: p.x, y: p.y })
    }
    if (cur.length) segs.push(cur)
    return segs
  }
  if (o.band && series[0]) {
    for (const seg of segments(series[0].points)) {
      if (seg.length < 2) continue
      const up = seg.map((p) => `${X(p.x).toFixed(1)},${Y(p.y * (1 + o.band!)).toFixed(1)}`)
      const dn = [...seg].reverse().map((p) => `${X(p.x).toFixed(1)},${Y(p.y * (1 - o.band!)).toFixed(1)}`)
      out += `<polygon points="${[...up, ...dn].join(' ')}" fill="${C.band}" fill-opacity="0.13"/>`
    }
  }
  for (const sr of series) {
    for (const seg of segments(sr.points)) {
      const d = seg.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
      out += `<polyline points="${d}" fill="none" stroke="${sr.color}" stroke-width="${s.w > 1000 && s.h > 1000 ? 5 : 4}" stroke-linejoin="round" stroke-linecap="round"${sr.dashed ? ' stroke-dasharray="2 9"' : ''}/>`
    }
    const last = [...sr.points].reverse().find((p) => p.y !== null)
    if (last && last.y !== null) out += `<circle cx="${X(last.x)}" cy="${Y(last.y)}" r="${s.w > 1000 && s.h > 1000 ? 8 : 6}" fill="${sr.color}" stroke="#fff" stroke-width="3"/>`
  }
  for (const m of o.marks ?? []) {
    out += `<circle cx="${X(m.x)}" cy="${Y(m.y)}" r="5" fill="${C.ink}" stroke="#fff" stroke-width="2"/>`
    out += `<text x="${X(m.x)}" y="${Y(m.y) + (m.dy ?? -14)}" font-size="${s.axis}" text-anchor="${m.anchor ?? 'middle'}" fill="${C.ink}">${esc(m.label)}</text>`
  }
  for (const l of o.endLabels) {
    out += `<text x="${px.x + px.w + 14}" y="${Y(l.y) + s.axis * 0.35}" font-size="${s.axis}" font-weight="${l.bold ? 700 : 500}" fill="${l.color}">${esc(l.text)}</text>`
  }
  return out
}

// ── Charts ──────────────────────────────────────────────────────────────

interface WcRow { year: number; month: number; x: number; index: number | null; rate: number | null }

function readWcSeries(dataDir: string, editionKey: string): WcRow[] {
  const through = dataThrough(editionKey)
  const rows = readCsv(dataDir, 'wc-index.csv').map((r) => {
    const [y, m] = r.month.split('-').map(Number)
    const idx = Number(r.wc_index_2019_100)
    const rate = Number(r.wc_ltu_rate_pct_sa)
    const rate3 = Number(r.wc_ltu_rate_3mma_sa)
    return { year: y, month: m, x: y + (m - 1) / 12, index: Number.isFinite(idx) ? idx : null, rate: Number.isFinite(rate3) ? rate3 : (Number.isFinite(rate) ? rate : null) }
  })
  const kept = rows.filter((r) => r.year < through.year || (r.year === through.year && r.month <= through.month))
  if (!kept.length) throw new Error(`No wc-index rows through ${through.year}-${through.month}`)
  // Insert explicit gaps for months missing from the file (October 2025 was not collected).
  const out: WcRow[] = []
  for (let i = 0; i < kept.length; i++) {
    out.push(kept[i])
    const n = kept[i + 1]
    if (!n) continue
    const gap = (n.year - kept[i].year) * 12 + (n.month - kept[i].month)
    for (let g = 1; g < gap; g++) {
      const mm = ((kept[i].month - 1 + g) % 12) + 1
      const yy = kept[i].year + Math.floor((kept[i].month - 1 + g) / 12)
      out.push({ year: yy, month: mm, x: yy + (mm - 1) / 12, index: null, rate: null })
    }
  }
  return out
}

const yearTicks = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => ({ x: from + i * step, label: String(from + i * step) }))

const wcIndexChart: ChartDef = {
  id: 'wc-index',
  label: 'White-Collar Long-Term Unemployment Index, 2019 = 100, monthly 2015 to latest',
  build({ edition, dataDir }) {
    const rows = readWcSeries(dataDir, edition.key)
    const last = [...rows].reverse().find((r) => r.index !== null)!
    const above = Math.round((last.index! - 100))
    const lastLabel = `${monthName(last.month)} ${last.year}`
    const peak = Math.max(...rows.map((r) => r.index ?? 0))
    const stepIdx = peak > 400 ? 200 : 50
    const yMaxIdx = Math.ceil((peak * 1.05) / stepIdx) * stepIdx
    const ticksIdx = Array.from({ length: yMaxIdx / stepIdx + 1 }, (_, i) => i * stepIdx)
    return {
      title: `Long-term unemployment among managers and professionals is ${above}% above its 2019 average`,
      subtitle: `White-Collar Long-Term Unemployment Index: white-collar workers unemployed 27 weeks or more as a share of the white-collar labor force. 2019 average = 100. Latest: ${Math.round(last.index!)} in ${lastLabel}.`,
      source: `Source: NextChapter calculation from U.S. Census Bureau Current Population Survey microdata, through ${lastLabel}. Seasonally adjusted, 3-month moving average. The gap is October 2025, which was not collected during the federal shutdown.`,
      moeNote: 'Shaded band: 90% margin of error, about ±11% of the index level (BLS generalized variance method).',
      draw: (box, s) => lineChart(box, s, [{ name: 'Index', color: C.blue, points: rows.map((r) => ({ x: r.x, y: r.index })) }], {
        yMin: 0, yMax: yMaxIdx, yTicks: ticksIdx, yFmt: (v) => String(v), yUnit: 'Index, 2019 average = 100',
        xMin: 2015, xMax: Math.max(2026.9, last.x + 0.1), xTicks: yearTicks(2015, last.year, s.h > 1000 ? 1 : 2),
        refLine: { y: 100, label: '2019 average' }, band: 0.11,
        endLabels: [{ text: String(Math.round(last.index!)), y: last.index!, color: C.blue, bold: true }],
      }),
    }
  },
}

const wcRateChart: ChartDef = {
  id: 'wc-ltu-rate',
  label: 'White-collar long-term unemployment rate (% of white-collar labor force out 27+ weeks), monthly',
  build({ edition, dataDir }) {
    const rows = readWcSeries(dataDir, edition.key)
    const last = [...rows].reverse().find((r) => r.rate !== null)!
    const lastLabel = `${monthName(last.month)} ${last.year}`
    const peakR = Math.max(...rows.map((r) => r.rate ?? 0))
    const yMaxR = Math.ceil((peakR * 1.05) / 0.5) * 0.5
    const ticksR = Array.from({ length: Math.round(yMaxR / 0.5) + 1 }, (_, i) => i * 0.5)
    return {
      title: 'The share of white-collar workers out of work for 27 weeks or more has risen since 2019',
      subtitle: `Percent of the white-collar labor force unemployed 27 weeks or more, seasonally adjusted, 3-month moving average. Latest: ${last.rate!.toFixed(2)}% in ${lastLabel}.`,
      source: `Source: NextChapter calculation from U.S. Census Bureau Current Population Survey microdata, through ${lastLabel}. White-collar means management, business, financial and professional occupations. The gap is October 2025 (federal shutdown).`,
      moeNote: 'Monthly estimates are survey-based; the band is about ±11% of the level at 90% confidence (BLS generalized variance method).',
      draw: (box, s) => lineChart(box, s, [{ name: 'Rate', color: C.blue, points: rows.map((r) => ({ x: r.x, y: r.rate })) }], {
        yMin: 0, yMax: yMaxR, yTicks: ticksR, yFmt: (v) => `${v.toFixed(1)}%`, yUnit: '% of white-collar labor force',
        xMin: 2015, xMax: Math.max(2026.9, last.x + 0.1), xTicks: yearTicks(2015, last.year, s.h > 1000 ? 1 : 2),
        band: 0.11,
        endLabels: [{ text: `${last.rate!.toFixed(2)}%`, y: last.rate!, color: C.blue, bold: true }],
      }),
    }
  },
}

const hiresChart: ChartDef = {
  id: 'hires-per-opening',
  label: 'Hires per job opening, 2001 to latest (all industries and professional and business services)',
  build({ edition, dataDir }) {
    const through = dataThrough(edition.key)
    const rows = readCsv(dataDir, 'hires-per-opening.csv')
      .map((r) => {
        const partial = /\(/.test(r.year)
        const year = Number(r.year.slice(0, 4))
        return { year, partial, all: Number(r.hires_per_opening_total), pbs: Number(r.hires_per_opening_prof_business_services), label: r.year }
      })
      .filter((r) => r.year < through.year || (r.year === through.year && (r.partial || through.month === 12)))
    const lastRow = rows[rows.length - 1]
    const first3 = rows.filter((r) => r.year <= 2003)
    const lo = Math.min(...first3.map((r) => r.all)).toFixed(1)
    const hi = Math.max(...first3.map((r) => r.all)).toFixed(1)
    const per10 = Math.round(lastRow.all * 10)
    const r2019 = rows.find((r) => r.year === 2019)
    const r2022 = rows.find((r) => r.year === 2022)
    const periodNote = lastRow.partial ? `${lastRow.year} is January to ${monthName(through.month)}.` : ''
    return {
      title: `Employers now make about ${per10} hires for every 10 job openings, down from ${Math.round(Number(lo) * 10)} to ${Math.round(Number(hi) * 10)} in the early 2000s`,
      subtitle: `Hires per job opening: annual average monthly hires divided by annual average monthly openings. ${lastRow.year}: ${r2(lastRow.all)} all industries, ${r2(lastRow.pbs)} professional and business services.`,
      source: `Source: Bureau of Labor Statistics JOLTS via FRED (JTSJOL, JTSHIL; JTS540099JOL, JTS540099HIL), seasonally adjusted; NextChapter calculation. ${periodNote} A ratio of flows, not a matched placement rate.`,
      draw: (box, s) => lineChart(box, s, [
        { name: 'All industries', color: C.blue, points: rows.map((r) => ({ x: r.year, y: r.all })) },
        { name: 'Professional and business services', color: C.orange, points: rows.map((r) => ({ x: r.year, y: r.pbs })) },
      ], {
        yMin: 0.4, yMax: 1.6, yTicks: [0.5, 1.0, 1.5], yFmt: (v) => v.toFixed(1), yUnit: 'Hires per job opening',
        xMin: 2001, xMax: lastRow.year, xTicks: yearTicks(2001, 2021, s.h > 1000 ? 4 : 4).concat([{ x: lastRow.year, label: lastRow.partial ? `${lastRow.year}*` : String(lastRow.year) }]),
        refLine: { y: 1, label: '1 hire per opening' },
        endLabels: [
          { text: `All ${r2(lastRow.all)}`, y: lastRow.all - 0.04, color: C.blue, bold: true },
          { text: `PBS ${r2(lastRow.pbs)}`, y: lastRow.pbs + 0.05, color: C.orange, bold: true },
        ],
        marks: [
          ...(r2019 ? [{ x: 2019, y: r2019.all, label: `2019: ${r2(r2019.all)}`, dy: 34 }] : []),
          ...(r2022 ? [{ x: 2022, y: r2022.all, label: `2022: ${r2(r2022.all)}`, dy: 34 }] : []),
        ],
      }) + `<text x="${box.x + box.w}" y="${box.y + s.axis}" font-size="${s.axis - 2}" text-anchor="end" fill="${C.muted}">* ${esc(lastRow.label.replace(/^\d{4} /, ''))}</text>`,
    }
  },
}

interface IndustryRow { name: string; naics: string; tfp: string; y2019: number; y2026: number; change: number; moe: number; total: boolean }

const productivityChart: ChartDef = {
  id: 'productivity-vs-long-searches',
  label: 'Industry productivity growth versus long searches among unemployed white-collar workers, 2019 vs 2026 (Q3 feature)',
  editions: ['2026-09'],
  build({ dataDir }) {
    const rows: IndustryRow[] = readCsv(dataDir, 'industry-productivity-vs-long-searches.csv').map((r) => ({
      name: r.cps_industry, naics: r.bls_naics, tfp: r.tfp_growth_2019_24_pct_per_year,
      y2019: Number(r.wc_ltu_share_2019_pct), y2026: Number(r.wc_ltu_share_2026_pct),
      change: Number(r.change_pts), moe: Number(r.moe90_pts), total: r.cps_industry.toLowerCase().startsWith('all '),
    }))
    return {
      title: 'Productivity growth and long job searches do not line up by industry',
      subtitle: 'Share of unemployed white-collar workers looking 27 weeks or more, by industry of last job, January to August 2019 and 2026. Productivity: BLS total factor productivity growth, 2019 to 2024, % a year.',
      source: 'Sources: BLS, Total Factor Productivity for Major Industries 2024 (Dec 19, 2025; revised Mar 19, 2026), Table 3, accessed Oct 6, 2026; NextChapter calculation from U.S. Census Bureau CPS microdata. Not seasonally adjusted. CPS classifies by last job and BLS by establishment, so the match is approximate. Five-year sector averages cannot rule out effects concentrated in particular occupations or firms.',
      moeNote: 'Changes are bold only where they exceed the 90% margin of error (BLS generalized variance method): education and health services, and white-collar overall.',
      compact: {
        source: 'Sources: BLS, Total Factor Productivity for Major Industries 2024, Table 3; NextChapter calculation from Census CPS microdata, January to August. Not seasonally adjusted.',
        moeNote: 'bold changes exceed the 90% margin of error (BLS generalized variance method).',
      },
      draw: (box, s) => {
        const big = s.h > 1000
        const labelW = big ? 330 : 360
        const changeW = big ? 230 : 190
        const axisH = s.axis * 2 + 26
        const px = { x: box.x + labelW, w: box.w - labelW - changeW }
        const n = rows.length
        const rowH = (box.h - axisH - s.axis - 8) / n
        const top = box.y + s.axis + 8
        const X = (v: number) => px.x + (v / 40) * px.w
        let out = ''
        for (const t of [0, 10, 20, 30, 40]) {
          out += `<line x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${top + rowH * n}" stroke="${C.grid}" stroke-width="1.5"/>`
          out += `<text x="${X(t)}" y="${top + rowH * n + s.axis + 6}" font-size="${s.axis}" text-anchor="middle" fill="${C.muted}">${t}%</text>`
        }
        out += `<text x="${px.x}" y="${box.y + s.axis}" font-size="${s.axis}" fill="${C.muted}">Hollow = 2019, filled = 2026</text>`
        out += `<text x="${box.x + box.w}" y="${box.y + s.axis}" font-size="${s.axis}" text-anchor="end" fill="${C.muted}">Change in points (±90% MOE)</text>`
        out += `<text x="${px.x + px.w / 2}" y="${top + rowH * n + s.axis * 2 + 14}" font-size="${s.axis}" text-anchor="middle" fill="${C.muted}">% of unemployed white-collar workers out 27+ weeks</text>`
        rows.forEach((r, i) => {
          const cy = top + rowH * i + rowH / 2
          if (r.total && i > 0) out += `<line x1="${box.x}" x2="${box.x + box.w}" y1="${top + rowH * i}" y2="${top + rowH * i}" stroke="${C.rule}" stroke-width="1.5"/>`
          const tfpText = r.total ? '' : r.tfp.replace(/\//g, ' / ')
          if (big) {
            const nameLines = wrap(r.name.replace(/&/g, 'and'), s.axis + 2, labelW - 16)
            const tfpLine = r.total ? 'All industries' : `Productivity ${tfpText}% a year`
            const block = nameLines.length * (s.axis + 2) * 1.1 + (s.axis - 3) * 1.1
            let ty = cy - block / 2 + (s.axis + 2) * 0.9
            out += textLines(nameLines, box.x, ty, s.axis + 2, 1.1, { weight: r.total ? 700 : 600 })
            ty += nameLines.length * (s.axis + 2) * 1.1
            out += `<text x="${box.x}" y="${ty}" font-size="${s.axis - 3}" fill="${C.muted}">${esc(tfpLine)}</text>`
          } else {
            const short = r.name.replace('Professional & business services', 'Prof. and business services').replace('Education & health services', 'Education and health').replace(/&/g, 'and')
            out += `<text x="${box.x}" y="${cy + s.axis * 0.35}" font-size="${s.axis}" font-weight="${r.total ? 700 : 600}" fill="${C.ink}">${esc(short)}<tspan dx="10" font-weight="400" fill="${C.muted}" font-size="${s.axis - 2}">${r.total ? '' : `${esc(tfpText)}%/yr`}</tspan></text>`
          }
          const sig = Math.abs(r.change) > r.moe
          const x0 = X(r.y2019), x1 = X(r.y2026)
          out += `<line x1="${x0}" x2="${x1}" y1="${cy}" y2="${cy}" stroke="${sig ? C.orange : C.blue}" stroke-width="${big ? 6 : 5}" stroke-opacity="0.55"/>`
          out += `<circle cx="${x0}" cy="${cy}" r="${big ? 10 : 8}" fill="#fff" stroke="${C.muted}" stroke-width="3"/>`
          out += `<circle cx="${x1}" cy="${cy}" r="${big ? 10 : 8}" fill="${sig ? C.orange : C.blue}" stroke="#fff" stroke-width="2"/>`
          const [lo, hi] = x0 <= x1 ? [r.y2019, r.y2026] : [r.y2026, r.y2019]
          out += `<text x="${X(lo) - 16}" y="${cy + s.axis * 0.35 - (big ? 18 : 14)}" font-size="${s.axis - 2}" text-anchor="end" fill="${C.muted}">${f1(lo)}%</text>`
          out += `<text x="${X(hi) + 16}" y="${cy + s.axis * 0.35 - (big ? 18 : 14)}" font-size="${s.axis - 2}" text-anchor="start" fill="${C.ink}">${f1(hi)}%</text>`
          out += `<text x="${box.x + box.w}" y="${cy + s.axis * 0.35}" font-size="${s.axis}" text-anchor="end" font-weight="${sig ? 700 : 400}" fill="${sig ? C.ink : C.muted}">${r.change > 0 ? '+' : ''}${f1(r.change)} ±${f1(r.moe)}</text>`
        })
        return out
      },
    }
  },
}

const CHARTS: ChartDef[] = [wcIndexChart, wcRateChart, hiresChart, productivityChart]

// ── Layout and render ───────────────────────────────────────────────────

function render(spec: ChartSpec, edition: Edition, s: Style): string {
  const inner = s.w - s.pad * 2
  const kicker = `NextChapter Displacement Report ${edition.month}`
  const titleLines = wrap(spec.title, s.title, inner, 0.57)
  const subLines = s.showSubtitle ? wrap(spec.subtitle, s.subtitle, inner) : []
  const srcText = !s.showSubtitle && spec.compact ? spec.compact.source : spec.source
  const moeText = !s.showSubtitle && spec.compact ? spec.compact.moeNote : spec.moeNote
  const srcLines = wrap(srcText, s.small, inner)
  const moeLines = moeText ? wrap(`Margin of error: ${moeText}`, s.small, inner) : []
  const lh = 1.18

  let y = s.pad + s.kicker
  let body = `<text x="${s.pad}" y="${y}" font-size="${s.kicker}" font-weight="700" letter-spacing="1.2" fill="${C.blue}">${esc(kicker.toUpperCase())}</text>`
  y += s.kicker * 0.9 + s.title
  body += textLines(titleLines, s.pad, y, s.title, lh, { weight: 700 })
  y += (titleLines.length - 1) * s.title * lh
  if (subLines.length) {
    y += s.subtitle * 1.9
    body += textLines(subLines, s.pad, y, s.subtitle, 1.3, { fill: C.muted })
    y += (subLines.length - 1) * s.subtitle * 1.3
  }
  const chartTop = y + (s.showSubtitle ? 40 : 26)

  // Footer is stacked from the bottom.
  const footLine = s.h - s.pad
  const brandY = footLine
  let fy = brandY - s.foot * 1.9
  const srcH = srcLines.length * s.small * 1.3
  const moeH = moeLines.length * s.small * 1.3
  fy -= srcH
  const srcY = fy + s.small
  fy -= moeH ? moeH + 6 : 0
  const moeY = fy + s.small
  const ruleY = fy - s.small * 0.9
  const chartBottom = ruleY - 22

  let foot = `<line x1="${s.pad}" x2="${s.w - s.pad}" y1="${ruleY}" y2="${ruleY}" stroke="${C.rule}" stroke-width="1.5"/>`
  if (moeLines.length) foot += textLines(moeLines, s.pad, moeY, s.small, 1.3, { fill: C.muted })
  foot += textLines(srcLines, s.pad, srcY, s.small, 1.3, { fill: C.muted })
  foot += `<text x="${s.pad}" y="${brandY}" font-size="${s.foot}" font-weight="700" fill="${C.ink}">${esc(`NextChapter Displacement Report ${edition.month}`)}</text>`
  foot += `<text x="${s.w - s.pad}" y="${brandY}" font-size="${s.foot}" font-weight="700" text-anchor="end" fill="${C.blue}">launchyournextchapter.com/reports</text>`

  const chart = spec.draw({ x: s.pad, y: chartTop, w: inner, h: chartBottom - chartTop }, s)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" viewBox="0 0 ${s.w} ${s.h}" font-family="${FONT}"><rect width="${s.w}" height="${s.h}" fill="${C.bg}"/>${body}${chart}${foot}</svg>`
}

// ── CLI ─────────────────────────────────────────────────────────────────

function editionFromKey(key: string): Edition {
  const [y, m] = key.split('-').map(Number)
  const found = REPORT_EDITIONS.find((e) => e.month === `${monthName(m)} ${y}`)
  if (!found) throw new Error(`No registered edition ${key}. Registered: ${REPORT_EDITIONS.map((e) => e.month).join(', ')}`)
  return { key, month: found.month }
}

function latestEditionKey(): string {
  const latest = [...REPORT_EDITIONS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]
  const [mName, y] = latest.month.split(' ')
  const m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(mName) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

function args() {
  const a = process.argv.slice(2)
  const get = (k: string) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined }
  return {
    list: a.includes('--list'), svg: a.includes('--svg'),
    edition: get('edition'), chart: get('chart'), size: get('size') ?? 'both',
    out: get('out') ?? 'public/reports', dataDir: get('data-dir') ?? 'public/reports',
  }
}

async function main() {
  const o = args()
  if (o.list) {
    console.log('Available charts (--chart <id>):')
    for (const c of CHARTS) console.log(`  ${c.id.padEnd(32)} ${c.label}${c.editions ? `  [editions: ${c.editions.join(', ')}]` : ''}`)
    console.log(`\nEditions: ${REPORT_EDITIONS.map((e) => e.month).join(', ')}`)
    return
  }
  if (!o.chart) throw new Error('Pass --chart <id>. Use --list to see the charts.')
  const def = CHARTS.find((c) => c.id === o.chart)
  if (!def) throw new Error(`Unknown chart "${o.chart}". Use --list.`)
  const key = o.edition ?? latestEditionKey()
  const edition = editionFromKey(key)
  if (def.editions && !def.editions.includes(key)) throw new Error(`Chart ${def.id} is only available for editions ${def.editions.join(', ')}.`)
  const spec = def.build({ edition, dataDir: o.dataDir })
  const styles = o.size === 'portrait' ? [PORTRAIT] : o.size === 'landscape' ? [LANDSCAPE] : [PORTRAIT, LANDSCAPE]
  fs.mkdirSync(o.out, { recursive: true })
  for (const s of styles) {
    const svg = render(spec, edition, s)
    const base = path.join(o.out, `chart-post-${key}-${def.id}-${s.w}x${s.h}`)
    await sharp(Buffer.from(svg)).png().toFile(`${base}.png`)
    if (o.svg) fs.writeFileSync(`${base}.svg`, svg)
    console.log(`wrote ${base}.png`)
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
