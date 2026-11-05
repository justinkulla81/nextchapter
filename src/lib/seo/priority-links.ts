// The free tools and ranking lists linked from the home page and /news. Google has indexed few of them (the 2026-11-04 audit found all 10
// sampled ranking pages unknown to it), and a link from the busiest pages is the quickest way to put them in front of it. Chosen for what a
// laid-off or job-searching professional looks for first; kept short so each link stays prominent.

export interface PriorityLink {
  href: string
  label: string
}

export const PRIORITY_TOOLS: PriorityLink[] = [
  { href: '/tools/resume-check', label: 'Free ATS résumé checker' },
  { href: '/tools/severance-calculator', label: 'Severance calculator' },
  { href: '/tools/layoff-deadlines', label: 'Layoff deadlines' },
  { href: '/tools/cobra-vs-aca-calculator', label: 'COBRA vs ACA calculator' },
  { href: '/tools/unemployment-estimator', label: 'Unemployment benefit estimator' },
  { href: '/tools/pay-check', label: 'Pay check' },
  { href: '/tools/ai-job-check', label: 'AI job check' },
  { href: '/tools/job-loss-readiness', label: 'Job loss readiness' },
]

export const PRIORITY_RANKINGS: PriorityLink[] = [
  { href: '/rankings/industries-with-the-highest-posted-pay', label: 'Industries with the highest posted pay' },
  { href: '/rankings/job-groups-most-exposed-to-ai', label: 'Job groups most exposed to AI' },
  { href: '/rankings/best-cities-for-remote-jobs', label: 'Best cities for remote-friendly jobs' },
  { href: '/rankings/best-cities-for-pay-vs-cost-of-living', label: 'Best cities for pay after cost of living' },
  { href: '/rankings/cities-with-the-most-job-openings', label: 'Cities with the most professional job openings' },
  { href: '/rankings/fastest-growing-job-markets', label: 'Fastest-growing job markets' },
  { href: '/rankings/employers-with-the-most-open-jobs', label: 'Employers with the most open jobs' },
  { href: '/rankings/best-counties-for-laid-off-professionals', label: 'Best counties for laid-off professionals' },
]

// Reports and data lists: the September white-collar report is the public page people read most (96 visitors in 30 days to 2026-11-04), and
// the lists below are what the sitemap now leads with. Linked from the home page footer so each is found from the busiest page.
export const PRIORITY_REPORTS: PriorityLink[] = [
  { href: '/reports/white-collar-employment-report-september-2026', label: 'White-collar employment report, September 2026' },
  { href: '/reports/white-collar-index', label: 'White-collar index' },
  { href: '/reports/early-warning', label: 'Layoff early-warning report' },
  { href: '/salaries', label: 'Salaries by job' },
  { href: '/resources/pay-data', label: 'Pay data by area' },
  { href: '/jobs/entry-level', label: 'Entry-level white-collar jobs' },
  { href: '/top-employers', label: 'Top employers by function' },
  { href: '/events', label: 'Career events' },
]
