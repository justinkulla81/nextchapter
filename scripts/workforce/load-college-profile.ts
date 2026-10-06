/**
 * Adds each college's Carnegie classification (IPEDS directory) and admit
 * rate (IPEDS admissions) to LocalCollege, for ranking. One SQL update for
 * all of them. Run after load-colleges, yearly:
 *
 *   npx tsx --env-file=.env.local scripts/workforce/load-college-profile.ts [hdYear] [admYear]
 */
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import { csvFields } from './load-colleges'

function readCsv(zipUrl: string, file: string): Record<string, string>[] {
  const zip = `/tmp/${file}.zip`
  execSync(`curl -s -L -A "Mozilla/5.0" -o ${zip} ${zipUrl}`)
  const name = execSync(`unzip -Z1 ${zip}`).toString().split('\n').find((n) => n.toLowerCase() === `${file.toLowerCase()}.csv`)
  if (!name) throw new Error(`${file}.csv not in ${zipUrl}`)
  const bytes = execSync(`unzip -p ${zip} "${name}"`, { maxBuffer: 64 * 1024 * 1024 })
  const text = new TextDecoder('windows-1252').decode(bytes).replace(/^(﻿|ï»¿)/, '')
  const [header, ...lines] = text.split(/\r?\n/).filter((l) => l.trim())
  const cols = csvFields(header).map((h) => h.trim().toUpperCase())
  return lines.map((l) => {
    const f = csvFields(l)
    return Object.fromEntries(cols.map((c, i) => [c, f[i] ?? '']))
  })
}

async function main() {
  const hdYear = process.argv[2] ?? '2024'
  const admYear = process.argv[3] ?? '2023'
  const base = 'https://nces.ed.gov/ipeds/datacenter/data'
  const hd = readCsv(`${base}/HD${hdYear}.zip`, `HD${hdYear}`)
  const adm = readCsv(`${base}/ADM${admYear}.zip`, `adm${admYear}`)
  const carnegie = new Map(hd.map((r) => [r.UNITID, Number(r.C21BASIC)]).filter(([, v]) => Number(v) > 0) as [string, number][])
  const admit = new Map(adm.map((r) => {
    const a = Number(r.APPLCN)
    const b = Number(r.ADMSSN)
    return [r.UNITID, a > 0 && b >= 0 ? Math.round((b / a) * 1000) / 1000 : NaN] as [string, number]
  }).filter(([, v]) => Number.isFinite(v)))
  const ids = [...new Set([...carnegie.keys(), ...admit.keys()])]
  const prisma = new PrismaClient()
  const n = await prisma.$executeRaw`
    UPDATE "LocalCollege" c SET "carnegie" = v.carnegie, "admitRate" = v.admit
    FROM (SELECT unnest(${ids}::text[]) AS id,
                 unnest(${ids.map((i) => carnegie.get(i) ?? null)}::int[]) AS carnegie,
                 unnest(${ids.map((i) => admit.get(i) ?? null)}::float8[]) AS admit) v
    WHERE c.id = v.id`
  console.log(`${n} colleges updated (${carnegie.size} Carnegie, ${admit.size} admit rates)`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
