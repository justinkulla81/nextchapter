// One-off full pass of the citation check: every tracked question on the listed assistants, under a spend budget given on the
// command line. Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/ai-citation-full-pass.ts <budgetUsd> <providers,comma> [skipSinceIso]
// It does not change the standing monthly cap; the budget applies to this run only.
import { runCitationCheck } from '../src/lib/ai-visibility/run'

async function main() {
  const budgetUsd = Number(process.argv[2])
  const providerIds = (process.argv[3] ?? '').split(',').filter(Boolean)
  const since = process.argv[4] ? new Date(process.argv[4]) : undefined
  if (!(budgetUsd > 0) || providerIds.length === 0) throw new Error('usage: ai-citation-full-pass.ts <budgetUsd> <providers> [skipSinceIso]')
  const r = await runCitationCheck({ all: true, budgetUsd, providerIds, concurrency: 5, skipAnsweredSince: since })
  console.log(JSON.stringify(r))
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
