// Loads the nationwide WIOA Eligible Training Provider List (approved programs, by state) from the CareerOneStop Web API into
// TrainingProgram. Replaces state-by-state CSV files for every state but Texas, whose TWC list carries occupation codes and is
// loaded by import-training-programs.ts.
//
// Needs a free CareerOneStop API user id and token (careeronestop.org, Developers, Web API registration), in the environment as
// CAREERONESTOP_USER_ID and CAREERONESTOP_TOKEN. Never write them to a file or print them.
//
//   npx tsx --env-file=.env.local scripts/careers/load-careeronestop-etpl.ts [--state TX] [--dry-run]
//
// API: GET https://api.careeronestop.org/v2/training/programs/{userId}/{keyword}/{location}/{radius}/{programLength}/{school}/
//      {programName}/{programFormat}/{occupation}/{filterBySource}/{area}/{sortColumns}/{sortDirection}/{startRecord}/{limitRecord}
// filterBySource=Y returns only ETPL programs; limitRecord is capped at 250; sort by Provider so paging is stable.
// The list does not carry occupation codes, cost or duration, so those stay empty (rows from this loader never match a role's SOC
// code in programsForOccupation); see the README for the follow-up that fills socCodes by querying per occupation.
// The 2026-11-24 load ran inside a Supabase edge function (the cloud session has no database connection) with the same rows and keys.
import { prisma } from '../../src/lib/prisma'

const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(' ')
const cut = (s: unknown, n = 300) => (s == null ? null : String(s).slice(0, n))

function mode(f: string[] | null): string | null {
  const a = (f ?? []).join(' ').toLowerCase()
  if (!a) return null
  if (a.includes('mix') || (a.includes('online') && a.includes('in-person'))) return 'HYBRID'
  if (a.includes('online')) return 'ONLINE'
  if (a.includes('in-person')) return 'IN_PERSON'
  return null
}

async function main() {
  const user = process.env.CAREERONESTOP_USER_ID, token = process.env.CAREERONESTOP_TOKEN
  if (!user || !token) throw new Error('Set CAREERONESTOP_USER_ID and CAREERONESTOP_TOKEN')
  const only = process.argv.includes('--state') ? process.argv[process.argv.indexOf('--state') + 1].toUpperCase() : null
  const dry = process.argv.includes('--dry-run')
  const source = `CareerOneStop ETPL (WIOA-approved training programs), loaded ${new Date().toISOString().slice(0, 10)}`
  for (const state of only ? [only] : STATES) {
    if (state === 'TX') continue // Texas has its own TWC list (SOC codes inferred); do not overwrite
    let start = 0, total = 0, written = 0
    for (;;) {
      const url = `https://api.careeronestop.org/v2/training/programs/${user}/0/${state}/0/0/0/0/0/0/Y/0/Provider/ASC/${start}/250?enableMetaData=false`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      if (!r.ok) throw new Error(`${state}: CareerOneStop ${r.status}`)
      const d = (await r.json()) as { RecordCount?: number; SchoolPrograms?: Record<string, any>[] }
      total = d.RecordCount ?? total
      const list = d.SchoolPrograms ?? []
      const rows = new Map<string, { providerName: string; programName: string; url: string | null; credential: string | null; deliveryMode: string | null }>()
      for (const p of list) {
        const providerName = cut(p.SchoolName), programName = cut(p.EtaProgramName || p.CipTitle || 'Program')
        if (providerName && programName) rows.set(`${providerName}|${programName}`, { providerName, programName, url: cut(p.SchoolURL, 500), credential: cut(p.Credential || p.AwardLevel), deliveryMode: mode(p.Format) })
      }
      if (!dry) {
        const now = new Date()
        await prisma.$transaction([...rows.values()].map((x) => prisma.trainingProgram.upsert({
          where: { state_providerName_programName: { state, providerName: x.providerName, programName: x.programName } },
          create: { state, ...x, fundingSource: 'WIOA_ETPL', sourceName: source, importedAt: now },
          update: {}, // never touch an existing row's source, dates or codes
        })))
      }
      written += rows.size
      start += list.length
      if (list.length < 250 || start >= total) break
    }
    console.log(`${state}: ${total} programs listed, ${written} distinct provider/program rows${dry ? ' (dry run)' : ' written'}`)
  }
}
main().finally(() => prisma.$disconnect())
