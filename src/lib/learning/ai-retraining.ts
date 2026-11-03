// The AI retraining page (/ai-retraining): which online courses we put first, the college and public programs we have checked by
// hand, and the choices on the interest form. Pure and client-safe.
//
// "Best" here is our own review, not a vote: the online picks are courses that scored A or B in our 22 October 2026 review of the
// catalog (docs/AI_COURSE_SUITE.md section 11), looked up by title in the live catalog so a retired or moved link drops off the page.


export const REVIEWED_ON = '22 October 2026'
export const PROGRAMS_CHECKED_ON = '3 November 2026'

/** Our review's grade for a catalog course, by a distinctive part of its title. A is "top pick", B is "good". */
export const ONLINE_PICKS: { match: RegExp; grade: 'A' | 'B'; why: string; sponsor?: string }[] = [
  { match: /^Google AI Essentials/i, grade: 'A', why: 'Graded practice on everyday AI work, and it teaches you to check the output. The best first course for most people.' },
  { match: /^Google Prompting Essentials/i, grade: 'A', why: 'Short, graded, and builds a reusable way to write prompts and check what comes back.' },
  { match: /AI Fluency/i, grade: 'A', why: 'Assessed, from the people who build Claude. Teaches how to work with AI well, whatever tool you use.' },
  { match: /Generative AI for HR/i, grade: 'A', sponsor: 'Vanderbilt University', why: 'Written for HR and recruiting work, with graded exercises.' },
  { match: /^AI For Everyone$/, grade: 'B', why: 'About 7 hours, with quizzes. A clear overview for managers, more general than hands-on.' },
  { match: /^Generative AI for Everyone/i, grade: 'B', why: 'About 6 hours. Explains what generative AI can and cannot do at work.' },
  { match: /^Claude 101/i, grade: 'B', why: 'Free, with a certificate. Practical for people who will use Claude at work.' },
  { match: /^AI for Business/i, grade: 'B', why: 'A university course (about 44 hours) for business roles. Longer and more strategic.' },
  { match: /^AI Product Management/i, grade: 'B', why: 'For product managers, from Duke. Specific to that job.' },
  { match: /^Prompt Engineering for ChatGPT/i, grade: 'B', why: 'About 18 hours from Vanderbilt. The most thorough of the prompt-writing courses.' },
]

export interface CourseProgram {
  id: string
  name: string
  provider: string
  where: string
  format: string
  cost: string
  when: string
  who: string
  url: string
  how: string
}

/** Programs we opened and read, with only what the page itself states. Each one is rechecked before it stays on the page. */
export const CHECKED_PROGRAMS: CourseProgram[] = [
  {
    id: 'mgccc-workforce-ai', name: 'Workforce AI courses (18 courses)', provider: 'Mississippi Gulf Coast Community College', where: 'Mississippi',
    format: 'Online, self-paced', cost: 'Free', when: 'Open to enroll until 30 June 2027', who: 'Mississippi workforce members, students and educators',
    url: 'https://mgccc.edu/programs/community-education/workforce-ai-courses/', how: 'Create a free account with the college\'s workforce office, add the courses to your cart and check out at no charge.',
  },
  {
    id: 'kingsborough-ai-professionals', name: 'AI for Professionals: AI Essentials and Future of Work', provider: 'Kingsborough Community College (CUNY)', where: 'Brooklyn, New York',
    format: 'Evening cohort; the page does not say whether it meets in person or online', cost: 'Not listed', when: 'Fall 2026 cohort: 23 September to 18 November, Mondays and Wednesdays 6 to 9 p.m.',
    who: 'New York City residents 18 or older who are authorized to work in the U.S. and hold a high school diploma or equivalent',
    url: 'https://www.kbcc.cuny.edu/ce/AI-for-Professionals.html', how: 'Join the interest list from the form on the program page.',
  },
]

export const FORMATS = [
  { value: 'online', label: 'Online' },
  { value: 'in-person', label: 'In person' },
  { value: 'either', label: 'Either' },
] as const
export type RetrainFormat = (typeof FORMATS)[number]['value']
export const formatByValue = (v: string) => FORMATS.find((f) => f.value === v)?.value ?? null

/** The key stored in HomepageLead.searchLoc: the format, plus the state for in-person interest ("in-person:OH"). */
export const interestLoc = (format: RetrainFormat, state: string) => (format === 'online' || !state ? format : `${format}:${state}`)
