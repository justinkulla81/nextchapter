import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { reportsNewestFirst, reportPath } from '@/lib/reports'
import { FACTS, SITE_URL } from '@/lib/seo/facts'
import { htmlToPlainText } from '@/lib/seo/plain-text'
import { REPORT_BODY_HTML as SEPTEMBER_2026 } from '../reports/displacement-report-september-2026/report-body'

// /llms-full.txt — plain-text bodies of every guide and report, no navigation
// or boilerplate, regenerated at build time.
//
// Guides contribute their public text (excerpt, outline, FAQ). The full guide
// stays behind the email unlock until that decision changes.
export const dynamic = 'force-static'

// Authored HTML body per edition slug. Register each new edition here too.
const REPORT_BODIES: Record<string, string> = {
  'displacement-report-september-2026': SEPTEMBER_2026,
}

export function GET() {
  const parts: string[] = [`# ${FACTS.name}: full text of guides and reports\n\n> ${FACTS.summary}\n\nSource: ${SITE_URL}`]

  for (const r of reportsNewestFirst()) {
    const html = REPORT_BODIES[r.slug]
    if (!html) continue
    parts.push(
      `# NextChapter Displacement Report — ${r.month}\n\nURL: ${SITE_URL}${reportPath(r)}\nPublished: ${r.publishedAt}\nAuthor: ${FACTS.founder.name}\n\n${htmlToPlainText(html)}`,
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

  return new Response(parts.join('\n\n---\n\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
