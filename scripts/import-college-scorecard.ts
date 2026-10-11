// Loads College Scorecard institution outcomes (free public bulk file) onto our canonical
// School rows. Exact canonical-key match only; unmatched institutions are skipped, never
// guessed. Re-runnable.
//
//   curl -L -o sc.zip https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_06102026.zip && unzip sc.zip
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/import-college-scorecard.ts Most-Recent-Cohorts-Institution.csv [--dry-run]
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma'
import { schoolKey } from '../src/lib/education/school-match'

function parseLine(line: string): string[] {
  const out: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { out.push(cell); cell = '' } else cell += c
  }
  out.push(cell)
  return out
}
const num = (v: string | undefined) => {
  if (v === undefined || v === '' || v === 'NA' || v === 'PrivacySuppressed') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function main() {
  const file = process.argv[2]
  const dry = process.argv.includes('--dry-run')
  if (!file) throw new Error('usage: import-college-scorecard.ts <csv> [--dry-run]')
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  const header = parseLine(lines[0])
  const ix = Object.fromEntries(header.map((h, i) => [h, i]))
  for (const need of ['UNITID', 'INSTNM', 'STABBR', 'UGDS', 'C150_4', 'RET_FT4', 'MD_EARN_WNE_P6', 'MD_EARN_WNE_P10', 'GRAD_DEBT_MDN']) {
    if (!(need in ix)) throw new Error(`missing column ${need}`)
  }

  const schools = await prisma.school.findMany({ select: { id: true, canonicalKey: true, aliases: true } })
  const byKey = new Map<string, string>()
  for (const s of schools) {
    byKey.set(s.canonicalKey, s.id)
    for (const a of s.aliases) byKey.set(schoolKey(a), s.id)
  }

  let matched = 0
  let written = 0
  for (const line of lines.slice(1)) {
    if (!line) continue
    const r = parseLine(line)
    const schoolId = byKey.get(schoolKey(r[ix.INSTNM] ?? ''))
    if (!schoolId) continue
    matched++
    if (dry) continue
    const data = {
      unitId: r[ix.UNITID],
      institutionName: r[ix.INSTNM],
      state: r[ix.STABBR] || null,
      enrollment: num(r[ix.UGDS]),
      completionRate: num(r[ix.C150_4]),
      retentionRate: num(r[ix.RET_FT4]),
      medianEarnings6: num(r[ix.MD_EARN_WNE_P6]),
      medianEarnings10: num(r[ix.MD_EARN_WNE_P10]),
      medianDebt: num(r[ix.GRAD_DEBT_MDN]),
    }
    await prisma.schoolFederalOutcome.upsert({ where: { schoolId }, create: { schoolId, ...data }, update: data })
    written++
  }
  console.log(`${schools.length} schools in our directory; ${matched} matched a Scorecard institution; ${dry ? 'dry run' : `${written} written`}`)
}

main().finally(() => prisma.$disconnect())
