// Email wording for bridge jobs (src/lib/jobs/relevance.ts): a small strict market widens with
// jobs that miss one criterion, and emails say so in one line. Pure.

import type { Relaxed } from '@/lib/jobs/relevance'

/** One line for an email naming why a bridge job is there: "Worth a look: your kind of work in Healthcare". */
export function bridgeEmailNote(relaxed: Relaxed, jobIndustry: string | null): string {
  if (relaxed === 'industry') return `Worth a look: your kind of work${jobIndustry ? ` in ${jobIndustry}` : ' in another industry'} — see how to bridge it on your board`
  if (relaxed === 'function') return 'Worth a look: a field next to yours — see what transfers on your board'
  return 'Worth a look: your field, with fewer of the skills it lists — see the gap on your board'
}
