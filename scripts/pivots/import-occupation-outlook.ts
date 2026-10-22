// Yearly: rebuild src/lib/pivots/occupation-outlook.json straight from public files.
// No API keys, no CareerOneStop.
//
//   1. BLS Employment Projections occupation table (public domain):
//      https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx
//      Table 1.2 gives percent change, annual openings and the median annual
//      wage (the wage column is BLS OEWS data, per the table's own note).
//   2. O*NET OnLine "All Bright Outlook Occupations" CSV (CC BY 4.0):
//      https://www.onetonline.org/find/bright/All_Bright_Outlook_Occupations.csv?b=0&fmt=csv
//
// BLS blocks generic bots: download each file once with a descriptive
// User-Agent and contact info, into a fresh empty directory, then:
//
//   npx tsx scripts/pivots/import-occupation-outlook.ts <occupation.xlsx> <bright.csv>
import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { ROLE_SOC, type OccupationOutlook } from '../../src/lib/pivots/occupation-outlook'

const [xlsxPath, brightPath] = process.argv.slice(2)
if (!xlsxPath || !brightPath) throw new Error('Usage: import-occupation-outlook.ts <occupation.xlsx> <bright.csv>')

// Allowlist from the O*NET-SOC codes in ROLE_SOC to the BLS Employment
// Projections code whose numbers stand for it. A plain ".00" code maps to its
// own 6-digit SOC; anything else must be listed here or it gets no outlook
// (e.g. 13-1199.05 Sustainability Specialists would only get the
// "Business operations specialists, all other" catch-all, so it is left out).
const EP_CODE_OVERRIDES: Record<string, string> = {
  // BLS projects buyers and purchasing agents as one occupation.
  '13-1023.00': '13-1020',
  // O*NET detail occupations; BLS projects the parent SOC occupation.
  '15-1211.01': '15-1211',
  '15-2051.01': '15-2051',
}
const epCodeFor = (soc: string): string | null => EP_CODE_OVERRIDES[soc] ?? (soc.endsWith('.00') ? soc.slice(0, 7) : null)

// ── Minimal XLSX reader (the yearly script only; uses the system unzip) ─────
const unzip = (entry: string) => execFileSync('unzip', ['-p', xlsxPath, entry], { maxBuffer: 64 << 20 }).toString('utf8')
const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
const shared = [...unzip('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode(m[1]))

function sheetRows(name: string): string[][] {
  const rid = new RegExp(`<sheet [^>]*name="${name}"[^>]*r:id="([^"]+)"`).exec(unzip('xl/workbook.xml'))?.[1]
  const target = rid && new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(unzip('xl/_rels/workbook.xml.rels'))?.[1]
  if (!target) throw new Error(`No sheet named ${name}`)
  const xml = unzip(`xl/${target.replace(/^\/?xl\//, '')}`)
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const cells: string[] = []
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = [...c[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1]
      cells[col] = v === undefined ? (/t="inlineStr"/.test(c[2]) ? decode(c[3] ?? '') : '') : /t="s"/.test(c[2]) ? shared[Number(v)] : decode(v)
    }
    return Array.from(cells, (x) => (x ?? '').trim())
  })
}

const num = (s: string | undefined): number | null => {
  const t = (s ?? '').replace(/[,$%]/g, '').trim()
  const n = Number(t)
  return t !== '' && Number.isFinite(n) ? n : null
}

// ── Table 1.2 Occupational projections and worker characteristics ──────────
const rows = sheetRows('Table 1.2')
const headerAt = rows.findIndex((r) => r.some((c) => /National Employment Matrix code/i.test(c)))
if (headerAt < 0) throw new Error('Table 1.2 header row not found')
const header = rows[headerAt]
const col = (re: RegExp) => {
  const i = header.findIndex((h) => re.test(h))
  if (i < 0) throw new Error(`Table 1.2 column not found: ${re}`)
  return i
}
const cCode = col(/Matrix code/i)
const cTitle = col(/Matrix title/i)
const cPct = col(/Employment change, percent/i)
const cOpenings = col(/Occupational openings/i)
const cWage = col(/Median annual wage/i)
const period = /(\d{4})[–-](\d{2,4})/.exec(header[cPct])
if (!period) throw new Error(`No projection period in "${header[cPct]}"`)
const baseYear = period[1]
const projectedYear = period[2].length === 2 ? baseYear.slice(0, 2) + period[2] : period[2]
const wageYear = /(\d{4})\s*$/.exec(header[cWage])?.[1] ?? null

const ep = new Map<string, string[]>()
for (const r of rows.slice(headerAt + 1)) if (/^\d{2}-\d{4}$/.test(r[cCode] ?? '')) ep.set(r[cCode], r)

// ── O*NET Bright Outlook list, keyed by O*NET-SOC code ─────────────────────
const bright = new Set<string>()
for (const line of readFileSync(brightPath, 'utf8').split(/\r?\n/).slice(1)) {
  const code = /^"?(\d{2}-\d{4}\.\d{2})/.exec(line)?.[1]
  if (code) bright.add(code)
}
if (bright.size < 100) throw new Error(`Bright Outlook list looks wrong (${bright.size} codes)`)

const occupations: Record<string, OccupationOutlook> = {}
for (const soc of [...new Set(Object.values(ROLE_SOC))].sort()) {
  const code = epCodeFor(soc)
  const r = code ? ep.get(code) : undefined
  const pct = num(r?.[cPct])
  if (!r || pct === null) {
    console.log(`skip ${soc}${code ? ` (no BLS row for ${code})` : ' (no allowlisted BLS code)'}`)
    continue
  }
  const openingsThousands = num(r[cOpenings])
  occupations[soc] = {
    soc,
    // BLS's own title for the occupation the numbers describe.
    title: r[cTitle],
    // Whole percent, as the Occupational Outlook Handbook reports it.
    pctChange: Math.round(pct) || 0,
    annualOpenings: openingsThousands === null ? null : Math.round(openingsThousands * 1000),
    brightOutlook: bright.has(soc),
    medianWage: num(r[cWage]),
    wageYear,
    baseYear,
    projectedYear,
  }
}

const out = {
  source: `BLS Employment Projections ${baseYear}–${projectedYear.slice(2)} (Table 1.2, median wages from BLS OEWS ${wageYear}) and the O*NET OnLine Bright Outlook list`,
  fetchedAt: new Date().toISOString().slice(0, 10),
  occupations,
}
writeFileSync(path.join(__dirname, '../../src/lib/pivots/occupation-outlook.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`${Object.keys(occupations).length} occupations written (${baseYear}-${projectedYear}, wages ${wageYear})`)
