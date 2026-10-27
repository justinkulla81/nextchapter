import { TITLE_LIMIT } from '@/lib/seo/title'

// Title, description and H1 wording for the programmatic page families (one page per state, employer, job...), in one
// place. Each family's phrases come from its cluster in keywords.ts; change the wording here, not on each page, so a
// new page of the family gets the same shape. Titles are written without the " | NextChapter" suffix, fit 60
// characters, and get the suffix from titleMeta (title.ts) only when it fits too.

/** Trim to `max` characters on a word boundary, never mid-word. Used for descriptions. */
function fit(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20))}…`
}

/**
 * The richest title wording that fits in 60 characters (candidates run richest to plainest; the last is the fallback).
 * The page passes it through titleMeta (title.ts), which adds " | NextChapter" only when the brand fits in 60 too.
 */
function pick(...candidates: string[]): string {
  return candidates.find((c) => c.length <= TITLE_LIMIT) ?? candidates[candidates.length - 1]
}

/** /unemployment-benefits/[state] */
export const unemploymentStateSeo = (state: string) => ({
  title: pick(`${state} Unemployment Benefits: Amount and How to File`, `${state} Unemployment Benefits and How to File`, `${state} Unemployment Benefits`),
  h1: `${state} unemployment benefits: weekly amount, weeks and how to file`,
})

/** /layoffs/[state] */
export const layoffsStateSeo = (state: string) => ({
  title: pick(`${state} Layoffs: WARN Notices and Layoff List`, `${state} Layoffs: WARN Notices`),
  h1: `${state} layoffs: WARN notices and recent layoff list`,
})

/** /layoffs/company/[slug]: the owner of "<company> layoffs". */
export const layoffsCompanySeo = (company: string) => ({
  title: pick(`${company} Layoffs: WARN Notices and Dates`, `${company} Layoffs and WARN Notices`, `${company} Layoffs`),
  h1: `${company} layoffs: WARN notices and dates`,
})

/** /network/company/[slug]: workers laid off from the company, kept off the "<company> layoffs" phrase /layoffs/company owns. */
export const networkCompanySeo = (company: string) => ({
  title: pick(`${company} Laid-Off Workers: Jobs and Benefits`, `${company} Laid-Off Workers: Jobs, Benefits, Retraining`, `${company} Laid-Off Workers`),
  h1: `${company} laid-off workers: jobs, benefits and retraining`,
})

/** /employers/[slug]: jobs and pay; the layoff record sits on /layoffs/company. */
export const employerSeo = (company: string, openRoles: number | null) => ({
  // People look an employer up as "<employer> careers" or "<employer> jobs" (Search Console, 2026-10: "gathering littles careers"), so both words lead the title.
  title: pick(
    ...(openRoles && openRoles > 0 ? [`${company} Careers, Jobs and Pay: ${openRoles.toLocaleString('en-US')} Open Roles`, `${company} Careers and Jobs: ${openRoles.toLocaleString('en-US')} Open Roles`] : []),
    `${company} Careers and Jobs`,
    `${company} Jobs`,
  ),
  h1: `${company}: jobs, salaries and hiring`,
})

/** /workforce-boards/[state] */
export const workforceStateSeo = (state: string) => ({
  title: pick(`${state} Workforce Boards and American Job Centers`, `${state} Workforce Development Boards`),
  h1: `${state} workforce development boards and American Job Centers`,
})

/** /workforce-boards/[state]/[board] */
export const workforceBoardSeo = (board: string, code: string) => ({
  title: pick(/workforce|board/i.test(board) ? `${board}: Counties and Job Centers, ${code}` : `${board} Workforce Board: Counties and Job Centers, ${code}`, `${board}: Job Centers, ${code}`, board),
  h1: /workforce|board/i.test(board) ? board : `${board} workforce board`,
})

/** /rapid-response/[state] */
export const rapidResponseStateSeo = (state: string) => ({
  title: pick(`${state} Rapid Response: Layoff Support for Employers`, `${state} Rapid Response and Layoff Support`),
  h1: `${state} rapid response: layoff support for employers`,
})

/** /higher-education/[state] */
export const higherEdStateSeo = (state: string) => ({
  title: pick(`${state} Colleges: Career Services and Alumni Support`, `${state} Colleges and Career Services`, `${state} Colleges`),
  h1: `${state} colleges: career services and alumni support`,
})


const MIN_DESCRIPTION = 110

/** A meta description of at most `max` characters: the whole text, else its first sentences that fit, else a trim. */
export function fitDescription(text: string, max = 160): string {
  if (text.length <= max) return text
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((s) => s.trim()) ?? []
  let out = ''
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s
    if (next.length > max) break
    out = next
  }
  // Whole sentences only when they leave a useful description; a one-line fragment of a long text is trimmed at a word instead.
  return out.length >= MIN_DESCRIPTION ? out : fit(text, max)
}

/** /places/[state]: the owner of "<state> jobs" and "<state> job market". */
export const placeStateSeo = (state: string) => ({
  title: pick(`${state} Jobs and Job Market by County and City`, `${state} Jobs and Job Market`),
  h1: `${state} jobs and job market: layoffs, colleges and workforce help`,
})

/** /places/[state]/county/[county]: the owner of "<county> jobs" and "<county> unemployment". */
export const placeCountySeo = (county: string, code: string) => ({
  title: pick(`${county}, ${code} Jobs, Unemployment and Layoffs`, `${county}, ${code} Jobs and Unemployment`, `${county}, ${code} Jobs`),
  h1: `${county}, ${code} jobs, unemployment and layoffs`,
})

/** /places/[state]/city/[city]: the owner of "<city> jobs" and "<city> layoffs". */
export const placeCitySeo = (city: string, code: string) => ({
  title: pick(`${city}, ${code} Jobs, Layoffs and Employers`, `${city}, ${code} Jobs and Layoffs`, `${city}, ${code} Jobs`),
  h1: `${city}, ${code} jobs, layoffs and employers`,
})

/** /salaries/[slug]: the owner of "<title> salary". */
export const salarySeo = (name: string, median: number | null, payCount: number) => ({
  title: fit(median ? `${name} Salary: Median $${Math.round(median / 1000)}k, Pay Range` : `${name} Salary and Pay Range`, 60),
  h1: median ? `${name} salary: median $${Math.round(median).toLocaleString('en-US')} a year` : `${name} salary and pay range`,
  description: fitDescription(
    median
      ? `${name} pay from ${payCount.toLocaleString('en-US')} open job listings that state it: the typical range, median and the states that pay most. Plus current ${name.toLowerCase()} jobs.`
      : `What ${name.toLowerCase()} roles pay, from current job listings, and the open jobs to apply to.`,
    160,
  ),
})

/** /jobs/title/[slug]: the owner of "<title> jobs". */
export const titleJobsSeo = (name: string, jobs: number) => ({
  title: fit(`${name} Jobs: ${jobs.toLocaleString('en-US')} Open Roles`, 60),
  h1: `${name} jobs: ${jobs.toLocaleString('en-US')} open roles`,
  description: fitDescription(`${jobs.toLocaleString('en-US')} open ${name.toLowerCase()} jobs from employers’ own career sites, checked within the last week: pay where listed, top employers and states.`, 160),
})

/** /jobs/type/[type]: remote, hybrid, contract, part-time and interim professional jobs. */
export const jobTypeSeo = (name: string, noun: string, jobs: number) => ({
  title: fit(`${name} Professional Jobs: ${jobs.toLocaleString('en-US')} Open Roles`, 60),
  h1: `${name} professional jobs: ${jobs.toLocaleString('en-US')} open roles`,
  description: fitDescription(`${jobs.toLocaleString('en-US')} open ${noun} jobs for experienced professionals from employers’ own career sites, checked within the last week. Top titles, states and pay where listed.`, 160),
})
