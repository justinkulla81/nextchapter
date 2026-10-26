// Fills TopicSnapshot (the job aggregates behind the industry and function pages) without waiting for the cron.
// Usage: set -a; . ./.env.local; set +a; NODE_OPTIONS=--conditions=react-server npx tsx scripts/seo/refresh-topic-snapshots.ts [budgetSeconds]
import { refreshTopicSnapshots } from '../../src/lib/seo/topic-snapshot'

async function main() {
  const budget = Number(process.argv[2] ?? 3000) * 1000
  const r = await refreshTopicSnapshots(budget)
  console.log(JSON.stringify(r))
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
