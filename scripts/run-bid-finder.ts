// Runs the bid finder by hand; the same code runs daily from /api/cron/board-bids and /api/cron/competitor-awards.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/run-bid-finder.ts boards [--ids KY-243,PA-512] [--limit 40] [--dry-run]
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/run-bid-finder.ts file-bids|file-awards [--max 200]
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/run-bid-finder.ts awards [--names "Maximus,LHH"] [--limit 20] [--dry-run]
import { prisma } from '../src/lib/prisma'
import { crawlBoardBids } from '../src/lib/bids/board-crawl'
import { syncCompetitorAwards } from '../src/lib/bids/awards-sync'
import { fileAwardsToCrm, fileBidsToCrm } from '../src/lib/bids/crm-filing'

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined }
const dryRun = process.argv.includes('--dry-run')
const limit = arg('--limit') ? Number(arg('--limit')) : undefined
const max = arg('--max') ? Number(arg('--max')) : 200
const run = process.argv[2] === 'file-bids' ? fileBidsToCrm({ max })
  : process.argv[2] === 'file-awards' ? fileAwardsToCrm({ max })
  : process.argv[2] === 'awards'
  ? syncCompetitorAwards({ limit, dryRun, names: arg('--names')?.split(',') })
  : crawlBoardBids({ limit, dryRun, boardIds: arg('--ids')?.split(','), force: !!arg('--ids') })
run.then((r) => console.log(JSON.stringify(r, null, 1))).finally(() => prisma.$disconnect())
