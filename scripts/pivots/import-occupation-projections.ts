// Yearly: rebuild src/lib/market/occupation-projections.json, the BLS Employment Projections for EVERY occupation, from the
// public occupation table (no API keys):
//
//   https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx   (public domain, Table 1.2)
//
// BLS blocks generic bots: download the file once with a descriptive User-Agent and contact info into a fresh empty directory, then:
//
//   npx tsx scripts/pivots/import-occupation-projections.ts <occupation.xlsx>
//
// Only 6-digit SOC rows are kept (a row for a group such as 13-1020 is skipped: the page shows a figure only where one occupation
// honestly stands for the title). The O*NET Bright Outlook flag stays in occupation-outlook.json for the pivot targets.
import { execFileSync } from 'child_process'
import { writeFileSync } from 'fs'
import path from 'path'

const [xlsxPath] = process.argv.slice(2)
if (!xlsxPath) throw new Error('Usage: import-occupation-projections.ts <occupation.xlsx>')

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
const cEmp = col(/Employment, \d{4}/i)
const cPct = col(/Employment change, percent/i)
const cOpenings = col(/Occupational openings/i)
const cWage = col(/Median annual wage/i)
const period = /(\d{4})[–-](\d{2,4})/.exec(header[cPct])
if (!period) throw new Error(`No projection period in "${header[cPct]}"`)
const baseYear = period[1]
const projectedYear = period[2].length === 2 ? baseYear.slice(0, 2) + period[2] : period[2]
const wageYear = /(\d{4})\s*$/.exec(header[cWage])?.[1] ?? null

// soc6 -> [title, percent change (whole), annual openings, median annual wage, employment]
const occupations: Record<string, [string, number, number | null, number | null, number | null]> = {}
for (const r of rows.slice(headerAt + 1)) {
  const code = r[cCode] ?? ''
  const pct = num(r[cPct])
  if (!/^\d{2}-\d{4}$/.test(code) || pct === null) continue
  const openings = num(r[cOpenings])
  const emp = num(r[cEmp])
  occupations[code] = [r[cTitle], Math.round(pct) || 0, openings === null ? null : Math.round(openings * 1000), num(r[cWage]), emp === null ? null : Math.round(emp * 1000)]
}

const out = {
  source: `BLS Employment Projections ${baseYear}–${projectedYear.slice(2)} (Table 1.2; median wages from BLS OEWS ${wageYear})`,
  baseYear,
  projectedYear,
  wageYear,
  fetchedAt: new Date().toISOString().slice(0, 10),
  occupations,
}
writeFileSync(path.join(__dirname, '../../src/lib/market/occupation-projections.json'), JSON.stringify(out) + '\n')
console.log(`${Object.keys(occupations).length} occupations written (${baseYear}-${projectedYear}, wages ${wageYear})`)
