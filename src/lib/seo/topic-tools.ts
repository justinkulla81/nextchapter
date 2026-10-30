// The free tools that go with each guide. A guide that points to a working tool gives the reader something to do, and the tools are
// what other sites link to, so every guide passes its readers (and its links) to the tool that fits it.

export interface TopicTool { label: string; href: string }

const T = {
  deadlines: { label: 'Layoff deadlines: what to do and by when', href: '/tools/layoff-deadlines' },
  unemployment: { label: 'Unemployment benefit estimator: about how much you could get', href: '/tools/unemployment-estimator' },
  severance: { label: 'Severance calculator', href: '/tools/severance-calculator' },
  cobra: { label: 'COBRA vs ACA cost calculator', href: '/tools/cobra-vs-aca-calculator' },
  runway: { label: 'Layoff runway: how long your money will last', href: '/tools/layoff-runway' },
  pay: { label: 'Pay check: is your salary in line?', href: '/tools/pay-check' },
  salary: { label: 'Salary converter: hourly to yearly and back', href: '/tools/salary-converter' },
  resume: { label: 'Free résumé check: score your résumé in a minute', href: '/tools/resume-check' },
  scams: { label: 'Scam watch: fake postings and recruiter scams we are tracking', href: '/scam-watch' },
  places: { label: 'Local job markets: openings and layoffs by place', href: '/places' },
} satisfies Record<string, TopicTool>

export const TOPIC_TOOLS: Record<string, TopicTool[]> = {
  severance: [T.severance, T.deadlines, T.unemployment],
  'should-i-take-the-buyout': [T.severance, T.runway],
  'what-to-say-when-laid-off': [T.deadlines, T.severance],
  'laid-off-no-savings': [T.runway, T.unemployment, T.cobra],
  'laid-off-over-40': [T.severance, T.deadlines],
  'fired-vs-laid-off': [T.unemployment, T.deadlines],
  'acquisition-layoffs': [T.deadlines, T.severance],
  'first-two-weeks-after-layoff': [T.deadlines, T.unemployment, T.cobra, T.runway],
  'benefits-after-layoff': [T.unemployment, T.cobra, T.deadlines],
  'unemployment-and-job-search': [T.unemployment, T.deadlines],
  '401k-after-layoff': [T.runway, T.severance],
  'freelance-after-layoff': [T.runway, T.unemployment],
  'how-long-job-search-takes': [T.runway],
  'resume-tips': [T.resume],
  'resume-review': [T.resume],
  'resume-ats-ai-screening': [T.resume],
  'is-this-salary-fair': [T.pay, T.salary],
  'negotiate-a-job-offer': [T.pay, T.salary],
  'relocating-for-a-job': [T.places, T.salary],
  'fake-job-postings': [T.scams],
}
