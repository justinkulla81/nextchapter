/**
 * Reads the last N weekdays of SEC 8-Ks and Form Ds into CompanyEvent (free, no AI). SEC allows 10 requests a second; this stays under 8.
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/events/backfill-sec-events.ts [days=90]
 */
import { ingestRecentSecEvents } from '../../src/lib/events/sec-events'

const days = Number(process.argv[2]) || 90
ingestRecentSecEvents(days, 20 * 60_000)
  .then((r) => console.log(r))
  .then(() => process.exit(0))
