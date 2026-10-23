import { NextResponse } from 'next/server'
import { seedCatalogIfEmpty } from '@/lib/benefits/store'
import { seedBoardProcurement } from '@/lib/boards/procurement'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Daily: load the catalogs bundled with the app into the database when the database copy is empty or older than the bundle
// (the benefits catalog and the workforce boards' bids/RFP pages). Without this, a catalog update would wait for someone to
// open the CRM page. A no-op when nothing changed. Candidate benefits and company-side RFP pages are separate: each is
// reported on its own and one failing does not stop the other.
export const GET = withCronRun('catalog-seeds', async () => {
  const run = async (fn: () => Promise<number>) => fn().then((written) => ({ written }), (e) => ({ error: e instanceof Error ? e.message : String(e) }))
  const benefits = await run(seedCatalogIfEmpty)
  const boardProcurement = await run(seedBoardProcurement)
  return NextResponse.json({ benefits, boardProcurement })
})
