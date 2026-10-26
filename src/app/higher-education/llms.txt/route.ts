import { FACTS, SITE_URL } from '@/lib/seo/facts'
import { collegePath } from '@/lib/seo/college-bar'
import { indexableColleges } from '@/lib/seo/college-pages'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

// /higher-education/llms.txt — every college page that passes the bar (college-bar.ts), grouped by state, for AI answer
// engines. Linked from /llms.txt and /llms-full.txt. Rebuilt daily.
export const revalidate = 86400

export async function GET() {
  const rows = await indexableColleges().catch(() => [])
  const parts = [
    `# ${FACTS.name}: college pages\n\n> One page per college: enrollment, degrees by field, graduation, earnings and net price (IPEDS, College Scorecard), the job market in its county, the workforce board and American Job Centers that serve it. ${rows.length.toLocaleString('en-US')} colleges.\n`,
  ]
  for (const code of ALL_STATE_CODES) {
    const mine = rows.filter((r) => r.state === code)
    if (mine.length === 0) continue
    parts.push(`## ${stateName(code)}\n\n${mine.map((r) => `- [${r.name}](${SITE_URL}${collegePath(stateSlug(code), r.slug)}): ${[r.control, r.level].filter(Boolean).join(' ').toLowerCase()}${r.city ? ` in ${r.city}` : ''}${r.enrollment ? `, about ${r.enrollment.toLocaleString('en-US')} students` : ''}.`).join('\n')}`)
  }
  return new Response(parts.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
