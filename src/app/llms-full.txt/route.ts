import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { reportsNewestFirst, reportPath } from '@/lib/reports'
import { FACTS, SITE_URL } from '@/lib/seo/facts'
import { htmlToPlainText } from '@/lib/seo/plain-text'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { REPORT_BODY_HTML as SEPTEMBER_2026 } from '../reports/white-collar-employment-report-september-2026/report-body'

// /llms-full.txt — plain-text bodies of every guide and report, no navigation
// or boilerplate, regenerated at build time.
//
// Guides contribute their public text (excerpt, outline, FAQ). The full guide
// stays behind the email unlock until that decision changes.
export const dynamic = 'force-static'

// Authored HTML body per edition slug. Register each new edition here too.
const REPORT_BODIES: Record<string, string> = {
  'white-collar-employment-report-september-2026': SEPTEMBER_2026,
}

export function GET() {
  const parts: string[] = [`# ${FACTS.name}: full text of guides and reports\n\n> ${FACTS.summary}\n\nSource: ${SITE_URL}`]

  for (const r of reportsNewestFirst()) {
    const html = REPORT_BODIES[r.slug]
    if (!html) continue
    parts.push(
      `# NextChapter White Collar Employment Report — ${r.month}\n\nURL: ${SITE_URL}${reportPath(r)}\nPublished: ${r.publishedAt}\nAuthor: ${FACTS.founder.name}\n\n${htmlToPlainText(html)}`,
    )
  }

  for (const g of GUIDE_LANDING_CONTENT) {
    parts.push(
      [
        `# ${g.title}`,
        `URL: ${SITE_URL}/resources/${g.slug}\nLast updated: ${g.lastUpdated}\nAuthor: ${FACTS.founder.name}`,
        g.excerpt.join('\n\n'),
        `## What the full guide covers\n\n${g.outline.map((o) => `- ${o}`).join('\n')}`,
        g.faq.length ? `## Frequently asked questions\n\n${g.faq.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    )
  }

  const directory = (title: string, root: string, what: string) =>
    `# ${title}\n\nURL: ${SITE_URL}${root}\n${what} Each page lists the counties served, open professional jobs and entry-level roles in the area, contact details as the organization publishes them, colleges and other local help.\n\n` +
    ALL_STATE_CODES.map((c) => `- ${stateName(c)}: ${SITE_URL}${root}/${stateSlug(c)}`).join('\n')
  parts.push(
    directory('American Job Centers by state', '/job-centers', 'One page for each American Job Center.'),
    directory('Economic development organizations by state', '/economic-development', 'One page for each regional, county and state economic development organization.'),
    directory('Workforce boards by state', '/workforce-boards', 'One page for each local workforce development board.'),
  )

  return new Response(parts.join('\n\n---\n\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
