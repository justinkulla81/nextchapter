import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { latestReport, reportPath } from '@/lib/reports'
import { FACTS, SITE_URL } from '@/lib/seo/facts'
import { llmsPageLines } from '@/lib/seo/keywords'

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
- [FAQ](${u('/faq')}): plans (free for candidates), privacy, how the Market Reality Assessment works, and how employer matching works.
- [Career coach](${u('/coaching')}): Victoria, the free AI career coach, and an optional human executive and professional career coach on top — mock interviews, resume review, negotiation support. Plans are on [Plans](${u('/pricing')}).

## For organizations

- [For Organizations](${u('/for-organizations')}): one card for each portal: higher education, workforce, hiring, employees, outplacement, recruiters and coaches, each with its page and log in.
- [Employers](${u('/employers')}): the three employer sections by employee lifecycle: Hiring for future employees, Employees for current ones, Outplacement for departing ones.
- [Hiring](${u('/talent')}): post a role and see candidates who chose to be seen, with an evidence brief for each.
- [Employees](${u('/employees')}): retention, and learning and development, reported as counts by team, never by person.
- [Outplacement](${u('/outplacement')}): seats for departing employees, reporting in counts for HR and a compliance record for each seat. Set up by contract.
- [Higher education](${u('/higher-education')}): a workspace for career services and alumni relations; a free workspace is created when staff claim the institution's page with a work email at its domain.
- [Government & Workforce](${u('/government-workforce')}): a workspace for workforce boards, economic development organizations and chambers, with live counts from our own data.
- [Nonprofits & community organizations](${u('/nonprofits')}): the same free workspace after a verified claim; research partnerships are set up one at a time.
- [Recruiters](${u('/recruiters')}): search candidates who chose to be found and submit them in your firm's logo.
- [Coaches](${u('/coaches')}): invite clients with a code, a pre-session brief and session notes.

## Research and data

- [AI skills in job postings](${u('/ai-skills')}): which functions ask for AI skills, the advertised pay premium raw and like for like, and independent research by seniority. Updated weekly.
- [AI training](${u('/ai-training')}): for colleges, workforce boards and employers, a measured AI-skill gap and the short courses that close it.
- [NextChapter White Collar Employment Report](${u('/reports')}): a monthly, independent read on the U.S. white-collar labor market — layoffs, long-term unemployment, AI attribution and the safety net, with methods and data files published.
- [White-Collar Long-Search Index](${u('/reports/white-collar-index')}): monthly long-term unemployment among U.S. managers and professionals, 2019 = 100, from Census CPS microdata; history downloadable as CSV.
${report ? `- [Latest edition: ${report.month}](${u(reportPath(report))}): ${report.dek}\n` : ''}- [Layoff tracker](${u('/layoffs')}): WARN notices filed with state labor agencies, this year's totals, coverage notes and the BLS context, with a page for each state and employer.
- [Employer pages for current and former employees](${u('/layoffs')}): for each employer with a recent, sizeable WARN filing, the notices, open professional jobs in its state, unemployment benefits, retraining help and a way to join. Linked from each employer's layoff page.
- [Unemployment benefits by state](${u('/unemployment-benefits')}): maximum and minimum weekly benefit, weeks, waiting week, severance rules and where to file, for all 50 states and DC, from Department of Labor and state agency sources.
- [Editorial standards](${u('/editorial-standards')}): how NextChapter researches and sources content, keeps it separate from what it sells, and handles corrections.

## Find what you need, by topic

The main page for each topic people search for: layoffs, severance, unemployment benefits, job search, resumes, career change, career pivot, career exploration, career coaches, executive recruiters, reverse recruiters, outplacement and more.

${llmsPageLines(SITE_URL).join('\n')}

## Guides

Free guides for every stage of a job search, at [Resources](${u('/resources')}). Each has a public excerpt; the full guide is unlocked with an email.

${GUIDE_LANDING_CONTENT.map((g) => `- [${g.title}](${u(`/resources/${g.slug}`)})`).join('\n')}

## Key facts

- ${FACTS.name} is ${FACTS.tagline.charAt(0).toLowerCase()}${FACTS.tagline.slice(1)} Founded by ${FACTS.founder.name} (${u(FACTS.founder.authorPath)}).
- Who it is for: ${FACTS.audience}
- ${FACTS.candidatePrice}
- The Market Reality Assessment (A–F) is a day-one read on how the market sees a candidate's background. The Search Action Grade (A–F) is separate and measures how effectively they are running their own search. Neither is shown as a raw numeric score.
- Victoria is NextChapter's free AI career coach, available to every candidate. Executive Coach is a separate, optional human coach.
- Candidates who land a job through NextChapter may qualify for a $500 offer bonus once their offer letter is verified.
- Contact: ${FACTS.contactEmail}

## Optional

- [Full text of guides and reports](${u('/llms-full.txt')})
`
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
