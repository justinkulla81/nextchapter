/** The LinkedIn message for a layoff, with the public page's link, ready to copy. */
export function linkedinLayoffPost(s: { url: string; employer: string; employees: number | null; state: string | null }): string {
  const cuts = s.employees ? `${s.employees.toLocaleString('en-US')} jobs` : 'jobs'
  const where = s.state ? ` in ${s.state}` : ''
  return `${s.employer} is cutting ${cuts}${where}. If you or someone you know is affected, NextChapter wants to help them get back in business fast.\n\nIt's free, start your #nextchapter here: ${s.url}\n\n${s.employer}`
}
