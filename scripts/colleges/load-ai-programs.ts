/**
 * Loads each college's AI, data science, data analytics and robotics degrees and certificates from IPEDS completions
 * (the C<year>_A file, by program code) into CollegeProfile.aiPrograms. Free: a public download, no API or LLM cost.
 * Run yearly after IPEDS publishes completions. Dry run unless --apply.
 *
 *   curl -L -o /tmp/c2024.zip https://nces.ed.gov/ipeds/datacenter/data/C2024_A.zip && unzip -o /tmp/c2024.zip -d /tmp/ipeds
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/colleges/load-ai-programs.ts /tmp/ipeds/C2024_a.csv 2024 [--apply]
 *
 * A college that appears in the file with none of these programs gets {programs: []} ("none reported"); one missing
 * from the file keeps null (unknown).
 */
import { readFileSync } from 'fs'
import { prisma } from '@/lib/prisma'
import { AI_TRACK_CIP, aiLevelOf, type AiProgramRow } from '@/lib/seo/college-bar'

function csvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === ',' && !q) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}

async function main() {
  const [file, yearArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const year = Number(yearArg)
  if (!file || !year) throw new Error('usage: load-ai-programs.ts <C20xx_a.csv> <year> [--apply]')
  const apply = process.argv.includes('--apply')
  const [header, ...lines] = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)
  const cols = csvLine(header).map((c) => c.trim().toUpperCase())
  const at = (name: string) => cols.indexOf(name)
  const [iU, iC, iL, iT] = [at('UNITID'), at('CIPCODE'), at('AWLEVEL'), at('CTOTALT')]

  const seen = new Set<string>()
  const byCollege = new Map<string, Map<string, number>>()
  for (const l of lines) {
    const f = csvLine(l)
    const unitid = f[iU]
    seen.add(unitid)
    const track = AI_TRACK_CIP[f[iC].trim()]
    const level = aiLevelOf(f[iL])
    const n = Number(f[iT] || 0)
    if (!track || !level || !(n > 0)) continue
    const m = byCollege.get(unitid) ?? new Map<string, number>()
    m.set(`${track}|${level}`, (m.get(`${track}|${level}`) ?? 0) + n)
    byCollege.set(unitid, m)
  }

  const profiles = new Set((await prisma.collegeProfile.findMany({ select: { unitid: true } })).map((p) => p.unitid))
  const withPrograms = [...byCollege.keys()].filter((u) => profiles.has(u))
  const none = [...seen].filter((u) => profiles.has(u) && !byCollege.has(u))
  console.log(apply ? 'APPLYING' : 'DRY RUN', { year, inFile: seen.size, profiles: profiles.size, withPrograms: withPrograms.length, noneReported: none.length, notInFile: [...profiles].filter((u) => !seen.has(u)).length })
  if (!apply) return

  for (const unitid of withPrograms) {
    const programs: AiProgramRow[] = [...byCollege.get(unitid)!].map(([k, awards]) => {
      const [track, level] = k.split('|')
      return { track, level: level as AiProgramRow['level'], awards }
    })
    await prisma.collegeProfile.update({ where: { unitid }, data: { aiPrograms: { year, programs } } })
  }
  await prisma.collegeProfile.updateMany({ where: { unitid: { in: none } }, data: { aiPrograms: { year, programs: [] } } })
  console.log('DONE')
}

main().finally(() => prisma.$disconnect())
