// Yearly: refresh src/lib/pivots/occupation-outlook.json from CareerOneStop
// (BLS projections, O*NET Bright Outlook, OEWS national median wage).
// Needs CAREERONESTOP_USER_ID and CAREERONESTOP_TOKEN in the environment
// (e.g. `set -a; source ~/nextchapter-jobs/.env.weekly-sync; set +a`); never commit them.
// npx tsx scripts/pivots/import-occupation-outlook.ts
import { writeFileSync } from 'fs'
import path from 'path'
import { ROLE_SOC, type OccupationOutlook } from '../../src/lib/pivots/occupation-outlook'

const userId = process.env.CAREERONESTOP_USER_ID
const token = process.env.CAREERONESTOP_TOKEN
if (!userId || !token) throw new Error('Set CAREERONESTOP_USER_ID and CAREERONESTOP_TOKEN')

const num = (s: unknown): number | null => {
  const n = Number(String(s ?? '').replace(/[,$%]/g, ''))
  return Number.isFinite(n) && String(s ?? '').trim() !== '' ? n : null
}

async function fetchOne(soc: string): Promise<OccupationOutlook | null> {
  const q = 'training=false&interest=false&videos=false&tasks=false&dwas=false&wages=true&alternateOnetTitles=false&projectedEmployment=true&ooh=false&stateLMILinks=false&relatedOnetTitles=false&skills=false&knowledge=false&ability=false&trainingPrograms=false'
  const res = await fetch(`https://api.careeronestop.org/v1/occupation/${userId}/${soc}/US?${q}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.error(soc, res.status)
    return null
  }
  const o = (await res.json()).OccupationDetail?.[0]
  const proj = o?.Projections?.Projections?.find((p: { Stfips: string }) => p.Stfips === '00')
  const annual = o?.Wages?.NationalWagesList?.find((w: { RateType: string }) => w.RateType === 'Annual')
  const pct = num(proj?.PerCentChange)
  if (!o || pct === null) return null
  return {
    soc,
    title: o.OnetTitle,
    pctChange: pct,
    annualOpenings: num(proj?.ProjectedAnnualJobOpening),
    brightOutlook: /bright/i.test(o.BrightOutlook ?? ''),
    medianWage: num(annual?.Median),
    wageYear: o.Wages?.WageYear ?? null,
    baseYear: String(proj?.EstimatedYear ?? o.Projections?.EstimatedYear ?? ''),
    projectedYear: String(proj?.ProjectedYear ?? o.Projections?.ProjectedYear ?? ''),
  }
}

;(async () => {
  const occupations: Record<string, OccupationOutlook> = {}
  for (const soc of [...new Set(Object.values(ROLE_SOC))].sort()) {
    const o = await fetchOne(soc)
    if (o) occupations[soc] = o
  }
  const out = { source: 'BLS Employment Projections, O*NET Bright Outlook and BLS OEWS via CareerOneStop', fetchedAt: new Date().toISOString().slice(0, 10), occupations }
  writeFileSync(path.join(__dirname, '../../src/lib/pivots/occupation-outlook.json'), JSON.stringify(out, null, 2) + '\n')
  console.log(`${Object.keys(occupations).length} occupations written`)
})()
