/** The LinkedIn message for a layoff, with the public page's link, ready to copy. */
export function linkedinLayoffPost(s: { url: string; employer: string; employees: number | null; state: string | null }): string {
  const cuts = s.employees ? `${s.employees.toLocaleString('en-US')} jobs` : 'jobs'
  const where = s.state ? ` in ${s.state}` : ''
  return `${s.employer} is cutting ${cuts}${where}. If you or someone you know is affected, this page has what was announced and what to do next:\n\n${s.url}`
}
