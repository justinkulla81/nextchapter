import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { latestReport, reportPath } from '@/lib/reports'
import { FACTS, SITE_URL } from '@/lib/seo/facts'

// /llms.txt — the site map for AI answer engines (llmstxt.org). Generated at
// build time from the same facts, guides and report registry the pages use,
// so it can't drift from the site. Plain-text bodies are in /llms-full.txt.
export const dynamic = 'force-static'

const u = (path: string) => `${SITE_URL}${path}`

export function GET() {
  const report = latestReport()
  const body = `# ${FACTS.name}

> ${FACTS.summary} Free for candidates, always.

## For job seekers

- [Home](${u('/')}): overview of the Market Reality Assessment, the weekly Search Sprint system, and how the platform works end to end.
- [FAQ](${u('/faq')}): pricing (free for candidates), privacy, how the Market Reality Assessment works, and how employer matching works.
- [Executive Coach](${u('/coaching')}): an optional paid human career coach on top of Victoria, the free AI coach — mock interviews, resume review, negotiation support. Prices are on [Pricing](${u('/pricing')}).

## For organizations

- [For Organizations](${u('/for-organizations')}): overview of all five ways organizations partner with NextChapter.
- [Employers](${u('/talent')}): verified candidate profiles and work-style fit signal, flat monthly price, no per-hire fees.
- [Recruiters](${u('/recruiters')}): a searchable, opted-in candidate pool including strong candidates ATS filters bury.
- [Outplacement](${u('/outplacement')}): a candid diagnostic, personalized plan, and direct employer matches for departing employees.
- [Government & Workforce Agencies](${u('/government-workforce')}): a WIOA-aligned partnership, free to every jobseeker served, with placement data for program reporting.
- [Nonprofits & Academia](${u('/nonprofits')}): free community service plus consent-based research partnerships.

## Research and data

- [NextChapter Displacement Report](${u('/reports')}): a monthly, independent read on the U.S. white-collar labor market — layoffs, long-term unemployment, AI attribution and the safety net, with methods and data files published.
- [White-Collar Displacement Index](${u('/reports/white-collar-index')}): monthly long-term unemployment among U.S. managers and professionals, 2019 = 100, from Census CPS microdata; history downloadable as CSV.
${report ? `- [Latest edition: ${report.month}](${u(reportPath(report))}): ${report.dek}\n` : ''}- [Layoff tracker](${u('/layoffs')}): WARN notices filed with state labor agencies, this year's totals, coverage notes and the BLS context, with a page for each state and employer.
- [Unemployment benefits by state](${u('/unemployment-benefits')}): maximum and minimum weekly benefit, weeks, waiting week, severance rules and where to file, for all 50 states and DC, from Department of Labor and state agency sources.
- [Editorial standards](${u('/editorial-standards')}): how NextChapter researches and sources content, keeps it separate from what it sells, and handles corrections.

## Guides

Free guides for every stage of a job search, at [Resources](${u('/resources')}). Each has a public excerpt; the full guide is unlocked with an email.

${GUIDE_LANDING_CONTENT.map((g) => `- [${g.title}](${u(`/resources/${g.slug}`)})`).join('\n')}

## Key facts

- ${FACTS.name} is ${FACTS.tagline.charAt(0).toLowerCase()}${FACTS.tagline.slice(1)} Founded by ${FACTS.founder.name} (${u(FACTS.founder.authorPath)}).
- Who it is for: ${FACTS.audience}
- ${FACTS.candidatePrice}
- The Market Reality Assessment (A–F) is a day-one read on how the market sees a candidate's background. The Search Action Grade (A–F) is separate and measures how effectively they are running their own search. Neither is shown as a raw numeric score.
- Victoria is NextChapter's free AI career coach, available to every candidate. Executive Coach is a separate, optional paid human coach.
- Candidates who land a job through NextChapter may qualify for a $500 offer bonus once their offer letter is verified.
- Contact: ${FACTS.contactEmail}

## Optional

- [Full text of guides and reports](${u('/llms-full.txt')})
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
