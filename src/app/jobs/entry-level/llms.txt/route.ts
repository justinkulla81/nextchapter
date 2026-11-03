import { FACTS, SITE_URL } from '@/lib/seo/facts'
import { ENTRY_CATEGORIES, ENTRY_ROLES, rolesInCategory } from '@/lib/entry-roles/roles'
import { roleLabel } from '@/lib/entry-roles/text'

// /jobs/entry-level/llms.txt: every entry-level role page with a one-line definition, grouped by kind of work, for AI answer engines.
// Linked from /llms.txt. Built from the role list alone (no database), so it is static.
export const dynamic = 'force-static'

export function GET() {
  const parts = [
    `# ${FACTS.name}: entry-level jobs by role\n\n> ${ENTRY_ROLES.length} starting roles in white-collar work. Each page defines the job, lists a typical day and the skills, shows entry-level openings counted from employers' own career sites (and how many state that no experience is required), pay where listings state it, BLS outlook for the closest government category, and the roles the job leads to. Role-by-city pages exist where enough openings are live. Figures are rebuilt daily and name their source.\n`,
  ]
  for (const c of ENTRY_CATEGORIES) {
    parts.push(`## ${c.name}\n\n${rolesInCategory(c.slug).map((r) => `- [${roleLabel(r)}](${SITE_URL}/jobs/entry-level/${r.slug}): ${r.what.split('. ')[0].replace(/\.$/, '')}.`).join('\n')}`)
  }
  return new Response(parts.join('\n\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' } })
}
