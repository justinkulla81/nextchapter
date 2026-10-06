/**
 * Loads every active, degree-granting college from the Department of
 * Education's IPEDS institutional directory into LocalCollege, placed by
 * county so each workforce board can list the colleges in its area. Run
 * once a year when IPEDS publishes a new directory:
 *
 *   npx tsx --env-file=.env.local scripts/workforce/load-colleges.ts [year]
 */
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import { countyKey } from '../../src/lib/workforce/places'

/** One CSV line, with quoted fields that may hold commas. */
export function csvFields(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

const phone = (raw: string) => {
  const d = raw.replace(/\D/g, '')
  return d.length >= 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}${d.length > 10 ? ` x${d.slice(10)}` : ''}` : raw.trim() || null
}
const site = (raw: string) => (raw.trim() ? (/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`) : null)

async function main() {
  const year = process.argv[2] ?? '2024'
  const prisma = new PrismaClient()
  const zip = `/tmp/HD${year}.zip`
  execSync(`curl -s -L -A "Mozilla/5.0" -o ${zip} https://nces.ed.gov/ipeds/datacenter/data/HD${year}.zip`)
  const bytes = execSync(`unzip -p ${zip} HD${year}.csv`, { maxBuffer: 64 * 1024 * 1024 })
  // The file starts with a UTF-8 byte-order mark, which reads as "ï»¿" here.
  const text = new TextDecoder('windows-1252').decode(bytes).replace(/^(﻿|ï»¿)/, '')
  const [header, ...lines] = text.split(/\r?\n/).filter((l) => l.trim())
  const col = Object.fromEntries(csvFields(header).map((h, i) => [h.trim().toUpperCase(), i]))
  const rows = lines.map(csvFields).filter((c) =>
    c[col.CYACTIVE] === '1' && c[col.DEGGRANT] === '1' && ['1', '2', '3', '4', '5', '6'].includes(c[col.SECTOR]),
  ).map((c) => {
    const fips = c[col.COUNTYCD]?.trim()
    return {
      id: c[col.UNITID], name: c[col.INSTNM].trim(), state: c[col.STABBR], city: c[col.CITY] || null,
      address: c[col.ADDR] || null, zip: c[col.ZIP]?.slice(0, 5) || null,
      countyFips: /^\d{4,5}$/.test(fips) ? fips.padStart(5, '0') : null,
      countyKey: c[col.COUNTYNM] && !c[col.COUNTYNM].startsWith('-') ? countyKey(c[col.COUNTYNM]) : null,
      phone: phone(c[col.GENTELE] ?? ''), website: site(c[col.WEBADDR] ?? ''),
      chiefName: c[col.CHFNM]?.trim() || null, chiefTitle: c[col.CHFTITLE]?.trim() || null,
      sector: Number(c[col.SECTOR]) || null,
      size: Number(c[col.INSTSIZE]) > 0 ? Number(c[col.INSTSIZE]) : null,
      updatedAt: new Date(),
    }
  })
  for (const r of rows) {
    await prisma.localCollege.upsert({ where: { id: r.id }, create: r, update: r })
  }
  console.log(`HD${year}: ${rows.length} active degree-granting colleges`)
  await prisma.$disconnect()
}
if (process.argv[1]?.includes('load-colleges')) main().catch((e) => { console.error(e); process.exit(1) })
