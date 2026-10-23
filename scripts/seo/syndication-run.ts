// The job syndication crons (src/lib/syndication) run by hand against the database in
// .env.local. Dry run by default: nothing is sent to IndexNow or Google and nothing is
// written to storage. --apply runs for real (the deployed crons are the normal way).
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/seo/syndication-run.ts [indexnow|google|feed] [--shard=N] [--apply]
import { runIndexNow } from '@/lib/syndication/indexnow-server'
import { runGoogleIndexing } from '@/lib/syndication/google-indexing-server'
import { runJobFeed } from '@/lib/syndication/job-feed-server'

const which = process.argv[2] ?? 'all'
const dryRun = !process.argv.includes('--apply')
const shardArg = process.argv.find((a) => a.startsWith('--shard='))
const shards = shardArg ? [Number(shardArg.split('=')[1])] : undefined

async function main() {
  if (which === 'all' || which === 'indexnow') {
    const t = Date.now()
    console.log(`IndexNow ${dryRun ? '(dry run)' : '(applied)'}:`, JSON.stringify(await runIndexNow({ dryRun }), null, 2), `${Date.now() - t} ms`)
  }
  if (which === 'all' || which === 'google') {
    const t = Date.now()
    console.log(`Google Indexing ${dryRun ? '(dry run)' : '(applied)'}:`, JSON.stringify(await runGoogleIndexing({ dryRun }), null, 2), `${Date.now() - t} ms`)
  }
  if (which === 'all' || which === 'feed') {
    const { sampleXml, ...r } = await runJobFeed({ dryRun, shards, budgetMs: Number.MAX_SAFE_INTEGER })
    console.log(`Job feed ${dryRun ? '(dry run)' : '(applied)'}:`, JSON.stringify(r, null, 2))
    console.log('Sample <job>:\n' + sampleXml)
  }
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
