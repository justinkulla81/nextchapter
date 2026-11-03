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
  icopen: {
    why: 'Each industry hires in a different set of cities. Counting an industry\'s open roles by city shows where its demand is deepest, which is where its employers, recruiters and professional events are concentrated.',
    use: 'If you work in this industry, look at the top cities for the employers to follow and the networks to join. A large market also means more competition, so read it with the pay list for the same industry.',
  },
  icpay: {
    why: 'Pay in an industry varies by city as much as the cost of living does. Adjusting posted pay for local prices shows where the same industry\'s salary goes furthest.',
    use: 'Use it to compare offers in the same industry across cities. A city with a lower headline salary can leave you ahead once prices are counted.',
  },
  cgrad: {
    why: 'New graduates need a place with many entry-level roles, pay that covers the cost of living and employers that state their pay. This list weighs those together and shows the weights, so it ranks the all-round picture rather than one number.',
    use: 'Start with the top ten and read each city\'s numbers against what you value most. If one thing matters most to you, such as pay, switch to the single-measure list for it.',
  },
  cmid: {
    why: 'Mid-career professionals look for depth of experienced roles, pay that holds up after the cost of living and room to move up. This list weighs those together, with published weights.',
    use: 'Use it to shortlist places for a move or a search, then check the employers hiring in your function. The weights are a judgment, so use the single-measure lists when one factor decides it.',
  },
  cremote: {
    why: 'Remote work is attached to a city by the employer\'s base. This list weighs how many openings are remote, how many there are and what the pay is worth locally, to show which cities hire remotely in volume.',
    use: 'If you want a remote role, the top cities show where the employers are. You can live elsewhere and still apply to them as a remote candidate.',
  },
  cai: {
    why: 'Careers that use AI cluster in a few places. This list weighs the share and number of openings that ask for AI skills and the pay they offer, to show where AI work is concentrated.',
    use: 'If you are building AI skills, the top cities show where the employers and the roles are. The gap between your city and the top is a guide to what to add to your résumé.',
  },
  perunemp: {
    why: 'Counties differ in how many professional openings there are for each person looking for work. The ratio is one way to compare how much hiring is happening in a place against how many people need it.',
    use: 'Use it to compare places, not to count your own odds. Our openings cover professional roles on the career sites we track, and the unemployed include people in every kind of work.',
  },
  coverall: {
    why: 'A good job market is more than one number. This list weighs openings per unemployed person, the unemployment rate, job growth and population growth, with the weights shown.',
    use: 'Use it to shortlist counties to research. Open the county page for the employers, colleges and job centers behind the score.',
  },
  claidoff: {
    why: 'For someone who has lost a job, the useful counties have openings for people looking, job centers to help and unemployment that is falling. This list weighs those with published weights.',
    use: 'If you are between jobs, use it to find nearby counties with more going on, and read each county page for its American Job Centers and workforce board.',
  },
  lowunemp: {
    why: 'The unemployment rate shows how much slack a county\'s labor market has. A low rate means employers are competing for the people who are available.',
    use: 'If you are looking for work, a low-rate county is a sign that employers there are hiring. Check the county page for its largest employers and recent layoffs.',
  },
  unempdrop: {
    why: 'A county where unemployment is falling fastest is a labor market that is improving, whatever its starting point.',
    use: 'Look at these counties when you want a market moving in the right direction. Compare with the lowest-unemployment list to see where improvement and a tight market overlap.',
  },
  whitecollar: {
    why: 'The share of working people in management, business, financial and professional occupations shows where the economy is built around professional work.',
    use: 'If your work is professional, counties near the top have more peers, more employers who hire for it, and more local networks.',
  },
  aiexposed: {
    why: 'Some local economies rely on sectors whose tasks AI can do in principle. The share of private-sector jobs in those sectors shows how exposed a county\'s job base is.',
    use: 'Use it as a prompt to look at which skills your own work depends on. Exposure describes tasks AI could do, not jobs that will disappear.',
  },
  collegepay: {
    why: 'Median earnings ten years after enrolling show what former students of a college go on to earn, as the Department of Education publishes it.',
    use: 'Compare colleges within the same level and field, and read earnings next to completion rate and net price. Earnings reflect who enrolls and what they study as much as the college.',
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
