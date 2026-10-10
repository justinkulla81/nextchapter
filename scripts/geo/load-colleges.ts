// Loads data/colleges/colleges.json (scripts/geo/build_colleges.py) into CollegeProfile
// (the facts: alumni, tuition, majors, endowment, budget, giving, earnings). Scoring and CRM
// linking stay with LocalCollege / src/lib/workforce/college-rank.ts, joined on UNITID.
// Fields found by research (exec ed, retraining, contacts, reported alumni) are never overwritten.
//   npx tsx scripts/geo/load-colleges.ts [--apply]
import 'dotenv/config'
import { readFileSync } from 'fs'
import path from 'path'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
type C = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null)

async function main() {
  const colleges: C[] = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'colleges', 'colleges.json'), 'utf8'))
  console.log('colleges', colleges.length)
  if (!apply) return console.log('dry run — pass --apply')
  for (let i = 0; i < colleges.length; i += 100) {
    const rows = colleges.slice(i, i + 100).map((c) => Prisma.sql`(${c.unitid}, ${c.name}, ${c.city}, ${c.state}, ${c.zip}, ${c.countyFips}, ${c.website}, ${c.control}, ${c.level},
      ${c.presidentName}, ${c.presidentTitle}, ${c.phone}, ${int(c.enrollment)}, ${int(c.annualAwards)}, ${c.annualAwards ? int(c.annualAwards * 30) : null},
      ${c.annualAwards ? 'annual awards x 30 years (rough)' : null}, ${int(c.tuitionInState)}, ${int(c.tuitionOutState)}, ${int(c.netPrice)}, ${c.topMajors ? JSON.stringify(c.topMajors) : null}::jsonb,
      ${c.endowment ?? c.endowScorecard ?? null}, ${c.revenue ?? null}, ${c.expenses ?? null}, ${c.gifts ?? null}, ${int(c.earnings6)}, ${int(c.earnings10)},
      ${c.employedShare10 ?? null}, ${c.completionRate ?? null}, ${'IPEDS 2023 / Scorecard 2026-06'}, now())`)
    await prisma.$executeRaw`insert into "CollegeProfile" ("unitid","name","city","state","zip","countyFips","website","control","level","presidentName","presidentTitle","phone",
      "enrollment","annualAwards","alumniEstimate","alumniEstimateMethod","tuitionInState","tuitionOutState","netPrice","topMajors","endowment","revenue","expenses","privateGifts",
      "earnings6","earnings10","employedShare10","completionRate","dataYear","updatedAt")
      values ${Prisma.join(rows)}
      on conflict ("unitid") do update set "name"=excluded."name","city"=excluded."city","state"=excluded."state","zip"=excluded."zip","countyFips"=excluded."countyFips",
        "website"=excluded."website","control"=excluded."control","level"=excluded."level","presidentName"=excluded."presidentName","presidentTitle"=excluded."presidentTitle",
        "phone"=excluded."phone","enrollment"=excluded."enrollment","annualAwards"=excluded."annualAwards","alumniEstimate"=excluded."alumniEstimate",
        "alumniEstimateMethod"=excluded."alumniEstimateMethod","tuitionInState"=excluded."tuitionInState","tuitionOutState"=excluded."tuitionOutState","netPrice"=excluded."netPrice",
        "topMajors"=excluded."topMajors","endowment"=excluded."endowment","revenue"=excluded."revenue","expenses"=excluded."expenses","privateGifts"=excluded."privateGifts",
        "earnings6"=excluded."earnings6","earnings10"=excluded."earnings10","employedShare10"=excluded."employedShare10","completionRate"=excluded."completionRate",
        "dataYear"=excluded."dataYear","updatedAt"=now()`
  }
  console.log(`loaded ${colleges.length} college profiles`)
}
main().finally(() => prisma.$disconnect())
