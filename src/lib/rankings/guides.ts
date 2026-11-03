import type { MeasureId } from '@/lib/rankings/types'

// Written guidance for each kind of list: why the measure matters and how a reader can use it. Plain text, one pair per
// measure, so every ranking page carries an explanation that does not change with the month's numbers.
export interface Guide { why: string; use: string }

const OPENINGS = 'It counts the open professional roles on employer career sites that we verified in the last week.'

export const MEASURE_GUIDE: Record<MeasureId, Guide> = {
  junior: {
    why: 'Entry-level hiring is concentrated in some metro areas and thin in others. The share of openings pitched at entry or early-career level shows where a first or second job is easiest to find.',
    use: 'If you are early in your career, start your search in the places near the top and read their employer lists. Places lower down can still have entry roles, but they make up a smaller part of what is open.',
  },
  ai: {
    why: 'Some labor markets ask for AI skills in a large share of postings, others in very few. The share tells you how far AI has moved from a specialist skill into ordinary job requirements in that place.',
    use: 'Compare your own city to the top of the list. A gap is a reason to build one AI skill and show it on your résumé before you apply, not a reason to move.',
  },
  paycost: {
    why: 'A salary buys different amounts in different places. This list adjusts posted pay by the local price level, so it ranks what the pay is worth rather than the number on the posting.',
    use: 'Use it to compare two offers or two cities. A lower headline salary in a cheaper place can leave you ahead of a higher one in an expensive metro.',
  },
  remote: {
    why: 'Remote work is spread unevenly across the country. The share of openings that are remote shows where employers are most open to hiring people who live elsewhere.',
    use: 'If you want a remote role, note that the employer is often in a different city from the one you live in. Search the top places for the employers, then apply as a remote candidate.',
  },
  swe: {
    why: 'Engineering hiring clusters in a handful of metros. Counting engineering openings shows where the demand for software and engineering skills is deepest.',
    use: 'Use it to decide where to network and which employers to follow. A big market also means more competition, so compare it with the pay and entry-level lists.',
  },
  largest: {
    why: 'The number of open professional roles is the simplest measure of how much hiring a place is doing right now.',
    use: 'A large market gives you more employers to approach and more ways to change direction without moving. Check the pay and entry-level lists before assuming bigger is better for you.',
  },
  transparent: {
    why: 'Many postings still leave pay off. The share of openings that post a salary range shows where employers are most open about it, which makes negotiating easier.',
    use: 'In the places at the top you can usually see the range before you apply. In places at the bottom, ask for the range early in the process.',
  },
  growth: {
    why: 'Private-sector job counts and population growth show which counties are adding people and work, rather than which are already large.',
    use: 'If you are choosing where to settle, growth counties often have newer employers still building teams. Read the county page for its largest employers and layoffs.',
  },
  infogrowth: {
    why: 'The Information sector covers software, media and data businesses. Its job growth by county shows where that kind of work is expanding.',
    use: 'Use it to look beyond the best-known tech metros. A fast-growing county can be a smaller place with employers hiring for the same skills.',
  },
  midcareer: {
    why: 'Mid-career roles (mid-level, senior and manager) are spread differently from entry-level roles. This list shows where employers are hiring people with several years of experience.',
    use: 'If you have five or more years behind you, start with the places at the top, then narrow by job family on the cities and employers pages.',
  },
  leadership: {
    why: 'Director, VP and executive openings are rare and cluster in headquarters cities. Their share of local openings shows where leadership hiring happens.',
    use: 'Senior searches depend on a small number of employers. Follow the employers listed under each city and watch their openings page.',
  },
  fnopen: {
    why: `The cities with the most openings in one job family show where that kind of work is concentrated. ${OPENINGS}`,
    use: 'Pick your job family, look at the top cities and their employers, then open the family page for titles and pay.',
  },
  fnpay: {
    why: 'Pay for the same job family varies by city, and so does the cost of living. This list ranks cities on posted pay for the family after adjusting for local prices.',
    use: 'Use it to see where your family\'s pay stretches furthest, and compare it with the city\'s opening count on the job-family list.',
  },
  aiskills: {
    why: 'Postings name specific AI skills, from using AI in everyday work to building AI systems. The share of openings that name a skill shows which ones employers ask for most often.',
    use: 'Pick the skill near the top that you can show evidence for, and put it on your résumé with a concrete result. Open the skill\'s page for the jobs that ask for it.',
  },
  aitools: {
    why: 'Employers name the AI tools they expect people to use. The most-named tools show what to learn first if you only have time for one or two.',
    use: 'Learn the tool by finishing a small, real task with it, then describe that task on your résumé.',
  },
  aicerts: {
    why: 'Some postings name an AI certification. Which ones appear most shows which credentials employers recognize in writing.',
    use: 'Weigh a certification against the time and cost it takes. A project you can show often matters more than the badge.',
  },
  skillpay: {
    why: 'Roles that name some AI skills post higher pay than roles that do not. This list ranks skills by the median pay of the roles that name them.',
    use: 'A higher median means those roles pay more, not that the skill causes the pay. Use it to see where AI skills sit in senior, well-paid roles, then check the roles you want.',
  },
  indjunior: {
    why: 'Industries differ in how much of their hiring is at entry level. This list ranks industries by the share of their openings aimed at entry or early-career people.',
    use: 'If you are starting out, look at the top industries for roles that fit your degree or skills, then follow the employers on the industry page.',
  },
  indai: {
    why: 'AI skills show up in postings at very different rates by industry. The share tells you where AI is already an expected part of the job.',
    use: 'If you work in or want to move into a top industry, treat the AI skills on the skills lists as part of your next résumé update.',
  },
  indpay: {
    why: 'Median posted pay differs widely between industries for the same kind of professional role.',
    use: 'Use it when you are choosing between industries, or deciding whether to take your skills to another one. Pay reflects the roles each industry posts, so compare within your job family too.',
  },
}
