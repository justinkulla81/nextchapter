import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { reportsNewestFirst, reportPath } from '@/lib/reports'
import { FACTS, SITE_URL } from '@/lib/seo/facts'
import { htmlToPlainText } from '@/lib/seo/plain-text'
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

  parts.push(
    [
      '# Search firm pages',
      `URL: ${SITE_URL}/search-firms`,
      `Every search firm, recruiting firm and staffing company with open searches on our job board has a page at ${SITE_URL}/search-firms/<name>. A page shows the roles the firm is recruiting for now (only roles with a public listing), the specialties its live searches point to (function and industry), the states it recruits in, how many searches are entry level or name AI skills, the median posted pay where roles state one, and how many days its searches have been open. Searches a firm runs in confidence, and their clients, are never shown. The hub lists firms by type (retained, contingent, nonprofit and higher-ed, staffing, outplacement) and by state. Pages refresh daily from our own job board.`,
    ].join('\n\n'),
  )

  return new Response(parts.join('\n\n---\n\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
