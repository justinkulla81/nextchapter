// Email wording for bridge jobs (src/lib/jobs/relevance.ts): a small strict market widens with
// jobs that miss one criterion, and emails say so in one line. Pure.

import type { Relaxed } from '@/lib/jobs/relevance'

/** One line for an email naming why a bridge job is there: "Worth a look: 45 mi away · similar industry: Healthcare". */
export function bridgeEmailNote(bridge: { kind: Relaxed; notes: string[] }): string {
  const why = bridge.notes.length > 0 ? bridge.notes.join(' · ') : bridge.kind === 'function' ? 'a field next to yours' : 'one step out from your exact match'
  return `Worth a look: ${why} — see how to bridge it on your board`
}
