// Title, description and H1 wording for the programmatic page families (one page per state, employer, job...), in one
// place. Each family's phrases come from its cluster in keywords.ts; change the wording here, not on each page, so a
// new page of the family gets the same shape. Titles are written without the " | NextChapter" suffix and aim for
// 60 characters or less with it.

/** Trim to `max` characters on a word boundary, never mid-word. */
function fit(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20))}…`
}

/** First candidate that fits the title budget; the last one is the fallback and is never trimmed. */
function firstThatFits(max: number, ...candidates: string[]): string {
  return candidates.find((c) => c.length <= max) ?? candidates[candidates.length - 1]
}

const TITLE_MAX = 46

/** /unemployment-benefits/[state] */
export const unemploymentStateSeo = (state: string) => ({
  title: firstThatFits(TITLE_MAX + 6, `${state} Unemployment Benefits: Amount and How to File`, `${state} Unemployment Benefits and How to File`, `${state} Unemployment Benefits`),
  h1: `${state} unemployment benefits: weekly amount, weeks and how to file`,
})

/** /layoffs/[state] */
export const layoffsStateSeo = (state: string) => ({
  title: firstThatFits(TITLE_MAX + 6, `${state} Layoffs: WARN Notices and Layoff List`, `${state} Layoffs: WARN Notices`),
  h1: `${state} layoffs: WARN notices and recent layoff list`,
})

/** /layoffs/company/[slug]: the owner of "<company> layoffs". */
export const layoffsCompanySeo = (company: string) => ({
  title: fit(`${company} Layoffs: WARN Notices and Dates`, 60),
  h1: `${company} layoffs: WARN notices and dates`,
})

/** /network/company/[slug]: workers laid off from the company, kept off the "<company> layoffs" phrase /layoffs/company owns. */
export const networkCompanySeo = (company: string) => ({
  title: firstThatFits(TITLE_MAX + 8, `${company} Laid-Off Workers: Jobs and Benefits`, `${company} Laid-Off Workers: Jobs, Benefits, Retraining`, `${company} Laid-Off Workers`),
  h1: `${company} laid-off workers: jobs, benefits and retraining`,
})

/** /employers/[slug]: jobs and pay; the layoff record sits on /layoffs/company. */
export const employerSeo = (company: string, openRoles: number | null) => ({
  title: fit(openRoles && openRoles > 0 ? `${company} Jobs and Salaries: ${openRoles.toLocaleString('en-US')} Open Roles` : `${company} Jobs and Salaries`, 60),
  h1: `${company}: jobs, salaries and hiring`,
})

/** /workforce-boards/[state] */
export const workforceStateSeo = (state: string) => ({
  title: firstThatFits(TITLE_MAX + 6, `${state} Workforce Boards and American Job Centers`, `${state} Workforce Development Boards`),
  h1: `${state} workforce development boards and American Job Centers`,
})

/** /workforce-boards/[state]/[board] */
export const workforceBoardSeo = (board: string, code: string) => ({
  title: fit(/workforce|board/i.test(board) ? `${board}: Counties and Job Centers, ${code}` : `${board} Workforce Board: Counties and Job Centers, ${code}`, 60),
  h1: /workforce|board/i.test(board) ? board : `${board} workforce board`,
})

/** /rapid-response/[state] */
export const rapidResponseStateSeo = (state: string) => ({
  title: firstThatFits(TITLE_MAX + 8, `${state} Rapid Response: Layoff Support for Employers`, `${state} Rapid Response and Layoff Support`),
  h1: `${state} rapid response: layoff support for employers`,
})

/** /higher-education/[state] */
export const higherEdStateSeo = (state: string) => ({
  title: firstThatFits(TITLE_MAX + 8, `${state} Colleges: Career Services and Alumni Support`),
  h1: `${state} colleges: career services and alumni support`,
})


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
  return out || fit(text, max)
}
