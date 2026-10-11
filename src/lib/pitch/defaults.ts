import type { CustomerType, OfferTerms, Package, RuleSet, SlideRule } from './types'
import { CUSTOMER_LABELS } from './types'

// Default rule sets. The admin tool stores edits as overrides; "Reset to
// default" deletes the override. Copy rules: plain, declarative, numbers over
// adjectives, no claim we cannot source. This is an INTRO deck: no prices,
// no outcome claims we cannot back. Demo screens use clearly labeled sample
// data. Anything Justin must confirm is a review note, shown as a warning.

type Patch = Partial<Omit<SlideRule, 'id' | 'section' | 'kind'>>
type S = [SlideRule['id'], SlideRule['section'], SlideRule['kind'], Patch]

const BASE: S[] = [
  ['cover', 'Opening', 'cover', { title: 'Re-employing white-collar workers in {{area}}', kicker: 'Prepared for {{org}}', why: 'Their name and logo next to ours, and a title about their place.' }],
  ['summary', 'Opening', 'bullets', { title: 'In one slide', kicker: 'Executive summary', why: 'A busy buyer who reads only this slide still knows the problem, the offer and the ask.' }],
  ['about', 'Opening', 'bullets', {
    title: 'Who we are', kicker: 'Background',
    bullets: [
      'NextChapter is an AI-powered career-transition platform for laid-off and displaced white-collar workers.',
      'It pairs each person with a coach and a recruiter, and gives employers a hiring portal.',
      'We publish the NextChapter Displacement Report each month, with the method and code open.',
    ],
    why: 'Establishes who is speaking, in three sentences.',
  }],
  ['local-data', 'Data', 'stats', { title: 'What is happening in {{area}}', kicker: 'The data', bullets: ['White-collar unemployment in {{area}} is an estimated {{wcEst}}, against {{bcEst}} for blue-collar work.', '{{layoffs12}} workers were named in layoff notices in the last 12 months, {{layoffs90}} of them in the last 90 days.'], needsGeo: true, why: 'Their own numbers first. Nothing persuades like the buyer\'s county.' }],
  ['layoffs', 'Data', 'warn', { title: 'Recent layoff announcements near you', kicker: 'The data', needsGeo: true, why: 'Names the employers. Real WARN filings, with dates.' }],
  ['white-collar', 'Data', 'stats', { title: 'White-collar workers are the story', kicker: 'The data', bullets: ['White-collar unemployment is {{natWc}} nationally, {{natWcChange}} from a year ago (3-month average, {{natAsOf}}).', 'The Information industry, the most exposed to AI, is at {{natInfo}}, {{natInfoChange}} from a year ago.'], why: 'The national white-collar trend, from our monthly report.' }],
  ['problem', 'Problem', 'bullets', { title: 'The problem', kicker: 'Problem', why: 'What fails today for the people and the institution.' }],
  ['why-now', 'Problem', 'bullets', {
    title: 'Why now', kicker: 'Problem',
    bullets: [
      'Experienced white-collar workers are staying unemployed longer than they used to.',
      'AI is changing which roles are posted and how people are screened.',
      'Public workforce services were built for a different kind of job loss.',
    ],
    why: 'Urgency, tied to the trend, not to fear.',
  }],
  ['cost', 'Problem', 'bullets', { title: 'What it costs when nobody acts', kicker: 'Problem', why: 'Makes doing nothing a choice with a price.' }],
  ['solution', 'Solution', 'bullets', { title: 'What NextChapter does', kicker: 'Solution', why: 'The product in the buyer\'s terms.' }],
  ['how', 'Solution', 'timeline', { title: 'How it works for one person', kicker: 'Solution', why: 'Three steps anyone can repeat to a colleague.' }],
  ['who', 'Solution', 'constituents', { title: 'One platform, several audiences', kicker: 'Who benefits', why: 'A table of every audience inside the customer, built from the slides below. Switch the audience slides on or off and this table follows.' }],
  ['measure', 'Solution', 'bullets', { title: 'What you will see', kicker: 'Measurement', why: 'Reporting and outcomes the buyer can take to their own board.' }],
  ['privacy', 'Solution', 'bullets', { title: 'Privacy and consent', kicker: 'Trust', bullets: ['People control what is shared about their search.', 'We do not sell personal data.', 'Staff see aggregate numbers by default; individual detail only where the person agreed.'], why: 'The first question from counsel, answered in a slide.' }],
  ['fit', 'Solution', 'bullets', { title: 'How it fits with what you already run', kicker: 'Solution', why: 'Removes the fear that we replace or compete with them.' }],
  ['evidence', 'Solution', 'bullets', {
    title: 'What you can check today', kicker: 'Evidence',
    bullets: [
      'Every figure in our monthly Displacement Report is sourced, with the method and code published.',
      'The numbers in this deck come from the Bureau of Labor Statistics, the Census Bureau and state layoff filings; sources are in the appendix.',
      'County white-collar and blue-collar unemployment are labeled as estimates wherever they appear.',
    ],
    why: 'No pilot results yet, so this slide proves rigor instead. Add real results here once you have them.',
  }],
  ['packages', 'Offer', 'packages', { title: 'Three ways to start', kicker: 'Offer', why: 'Different sizes of yes. No prices in an intro deck; scope only.' }],
  ['offer', 'Offer', 'offer', { title: 'What we need to start', kicker: 'Offer', why: 'The small things we need from them, and how we begin.' }],
  ['timeline', 'Offer', 'timeline', {
    title: 'The first 90 days', kicker: 'Offer',
    bullets: ['Days 1 to 14: agree scope, set up access, name one owner on each side.', 'Days 15 to 45: first cohort starts; weekly check-in.', 'Days 46 to 90: review results together and decide what happens next.'],
    why: 'Makes saying yes feel small and specific.',
  }],
  ['team', 'Close', 'people', { title: 'Who you would work with', kicker: 'Team', why: 'Real names. Suggested by customer type; remove them all for a generic deck.' }],
  ['next', 'Close', 'bullets', { title: 'Next step', kicker: 'The ask', why: 'One ask, one date.' }],

  ['appx', 'Appendix', 'divider', { title: 'Appendix: the detail behind {{area}}', kicker: 'Appendix', needsGeo: true, appendix: true }],
  ['a-profile', 'Appendix', 'stats', { title: '{{area}}: county profile', kicker: 'Appendix', needsGeo: true, appendix: true }],
  ['a-warn', 'Appendix', 'warn', { title: 'Layoff announcements, last 12 months', kicker: 'Appendix', needsGeo: true, appendix: true }],
  ['a-employers', 'Appendix', 'employers', { title: 'Major employers with recent layoffs', kicker: 'Appendix', needsGeo: true, appendix: true }],
  ['a-colleges', 'Appendix', 'colleges', { title: 'Higher education in {{area}}', kicker: 'Appendix', needsGeo: true, appendix: true }],
  ['a-datacenters', 'Appendix', 'datacenters', { title: 'Data centers in {{area}}', kicker: 'Appendix', needsGeo: true, appendix: true }],
  ['a-board', 'Appendix', 'board', { title: 'Your workforce board', kicker: 'Appendix', needsGeo: true, appendix: true }],
  ['a-initiatives', 'Appendix', 'text', { title: 'Local initiatives', kicker: 'Appendix', needsGeo: true, appendix: true }],
  ['a-news', 'Appendix', 'news', { title: 'Recent local news', kicker: 'Appendix', needsGeo: true, appendix: true }],
  ['a-faq', 'Appendix', 'bullets', { title: 'Questions we expect', kicker: 'Appendix', appendix: true, why: 'Objections answered before they are asked.' }],
  ['a-security', 'Appendix', 'bullets', {
    title: 'Security and compliance', kicker: 'Appendix', enabled: false,
    bullets: ['[ADD: your current security and compliance statements]'],
    appendix: true,
    why: 'Off by default until you have statements to put here. Switch it on when you do.',
  }],
  ['a-method', 'Appendix', 'bullets', {
    title: 'Sources and method', kicker: 'Appendix',
    bullets: [
      'Unemployment: Bureau of Labor Statistics Local Area Unemployment Statistics, latest month.',
      'Income and occupations: Census Bureau American Community Survey, 5-year estimates.',
      'Colleges: National Center for Education Statistics IPEDS. Layoffs: state WARN filings.',
      'White-collar and blue-collar unemployment for a county are ESTIMATES: the county rate split by its white-collar share, using the national ratio from our Displacement Report.',
      'Demo screens show sample data, not real people or results.',
    ],
    appendix: true,
    why: 'Honesty about what is measured and what is modeled protects the whole deck.',
  }],
]

// ── helpers for per-type content ────────────────────────────────────────────
const aud = (id: string, name: string, needs: string, gets: string, sees: string): [string, Patch] => [
  `c-${id}`, { title: `For ${name}`, kicker: 'Who benefits', constituent: name, bullets: [`Needs: ${needs}`, `Gets: ${gets}`, `You will see: ${sees}`], why: `Speaks to ${name.toLowerCase()} directly.` },
]
const demo = (id: string, title: string, frame: string, kpis: [string, string][], head: string[], rows: string[][]): [string, Patch] => [
  id, { title, kicker: 'Product snapshot', bullets: [`FRAME|${frame}`, ...kpis.map(([l, v]) => `KPI|${l}|${v}`), `HEAD|${head.join('|')}`, ...rows.map((r) => `ROW|${r.join('|')}`)], why: 'A mock screen drawn from editable shapes, labeled as sample data. Edit the numbers and rows as text.' },
]
const pkg = (id: string, name: string, bestFor: string, includes: string[]): Package => ({ id, name, bestFor, includes })

interface Spec {
  buyer: string; angle: string; tone: string; ask: string
  offer: OfferTerms
  packages: Package[]
  reviewNotes?: string[]
  patches: Record<string, Patch>
  /** [afterSlideId, id, patch] */
  extra: [string, string, Patch][]
  off?: string[]
}

const NO_PRICE = ''

const SPEC: Record<CustomerType, Spec> = {
  // ───────────────────────────── Higher education ─────────────────────────────
  HIGHER_ED: {
    buyer: 'Vice president of advancement or alumni relations, with the director of career services',
    angle: 'Alumni who lose white-collar jobs still call their college. NextChapter gives career services, alumni relations and development one coordinated way to help them, with alumni in control of what is shared.',
    tone: 'Plain, outcomes first, respectful of donor and alumni relationships, no AI hype',
    ask: 'A 30-minute call with career services and alumni relations together, then a 90-day alumni pilot',
    offer: { name: '90-day alumni pilot', scope: ['A branded alumni portal', 'Coaching and job-search tools for each alumnus', 'Staff workspaces for the teams in the package you choose'], theyProvide: ['An alumni roster (email, class year)', 'Your email domain for sign-in', 'One named owner in career services and one in alumni relations'], term: '90 days', price: NO_PRICE },
    packages: [
      pkg('career', 'Career', 'Career services that wants a coached path for alumni', ['Branded alumni portal under your name', 'Career Services workspace: caseloads, check-ins, student invites', 'Employer approvals and job posts for your region', 'Local market view with layoff notices and your workforce board']),
      pkg('advancement', 'Advancement', 'Alumni relations and development working together', ['Everything in Career', 'Alumni Relations workspace: layoff alerts, outreach, mentors, coaching packages', 'Development workspace: who is in transition and who not to solicit, with no search detail shown', 'Gratitude-ask timing after a placed alumnus has settled in']),
      pkg('institution', 'Institution', 'A campus-wide program across alumni, students and families', ['Everything in Advancement', 'Students, parents and spouse seats', 'Single sign-on and roster import', 'Outcome and ROI reporting for leadership, with data export']),
    ],
    reviewNotes: ['Higher Ed copy follows the V1 build spec. Confirm which screens and tiers are live, and what each tier includes, before presenting.'],
    patches: {
      summary: { bullets: ['Laid-off alumni are an unserved group at {{org}}; white-collar unemployment in {{area}} is an estimated {{wcEst}}.', 'NextChapter coaches each alumnus back to work and gives career services, alumni relations and development one shared, consent-based view.', 'Proposal: a 90-day alumni pilot in one of three packages. Ask: a call with career services and alumni relations.'] },
      problem: { bullets: ['Career centers are built for students and recent graduates, not for a 45-year-old alumnus who lost a director role.', 'Alumni ask the college for help and there is no program to send them to.', 'Alumni relations, development and career services each hear a piece of the story and none sees the whole.'] },
      cost: { bullets: ['An alumnus who loses a job often goes quiet: fewer gifts, fewer introductions, fewer recommendations to prospective students.', 'Development can ask at the wrong moment, and a bad ask is remembered.', 'Employers who hire your graduates lose a pipeline they already trust.'] },
      solution: { bullets: ['A branded portal where each alumnus sees their market reality, gets a plan, and works it weekly with a coach.', 'Three staff workspaces that each see only what their role should: career services, alumni relations, development.', 'Employers in your region can post roles and meet alumni who agreed to share their profile.'] },
      how: { bullets: ['Understand: the alumnus sees where they stand in today\'s market and gets a plan', 'Act: weekly sprints, coaching, resume work and warm introductions', 'Land: the new role is reported, the outcome counts, and the relationship stays whole'] },
      measure: { bullets: ['Who is in transition, who is active, who is stuck, by class year and region.', 'Outcomes reported by alumni who agreed to share them.', 'Engagement and placement over time, for the ROI conversation with your board.', 'Only what alumni consented to share: four settings, in plain language.'] },
      privacy: { bullets: ['Alumni choose what is shared: engagement and outcomes (on by default), search detail with career services and their profile with employers (off by default).', 'Development sees who is in transition and who not to solicit, never the reason or the search detail.', 'Every staff view of an individual is logged, and alumni can see which workspace viewed their profile.', 'We do not sell personal data.'] },
      fit: { bullets: ['Runs next to career services; it does not replace staff or your existing platform.', 'Alumni data stays under your consent rules; we align with FERPA expectations.', 'Hands people to {{board}} where public services fit better.'] },
      next: { bullets: ['A 30-minute call with {{org}} career services and alumni relations.', 'Choose a package and an alumni cohort for the pilot.'] },
      'a-faq': { bullets: ['Does this replace career services? No. It gives your staff caseloads, check-ins and reports; people still do the human work.', 'Who owns the alumni data? The institution owns its roster; each alumnus owns their own search data and chooses what to share.', 'Can development use this to solicit alumni who just lost a job? No. They see a do-not-solicit flag and nothing else.', 'What do we need to start? A roster, your email domain, and one owner in career services and one in alumni relations.', 'What does it cost? We scope it with you after the first call.'] },
    },
    extra: [
      ['how', ...demo('d-career', 'Career services: who needs help this week', 'Career Services · Caseload', [['In transition', '38'], ['Active in search', '24'], ['Placed, last 90 days', '9'], ['Awaiting outreach', '5']], ['Alumnus', 'Stage', 'Last activity', 'Next step'], [['Class of 2009, operations', 'Active search', '2 days ago', 'Check-in Thursday'], ['Class of 2002, finance', 'Interviewing', 'Today', 'Mock interview'], ['Class of 2014, marketing', 'Stalled', '19 days ago', 'Outreach'], ['Class of 1998, engineering', 'Placed', '6 days ago', 'Gratitude timing']])],
      ['d-career', ...demo('d-alumni-relations', 'Alumni relations: a layoff near your alumni', 'Alumni Relations · Local market', [['Layoff notices, 90 days', '4'], ['Alumni possibly affected', '7'], ['Mentors available', '31'], ['Outreach sent', '5']], ['Notice', 'Workers', 'Alumni match', 'Action'], [['Example Corp, regional office', '420', '4', 'Send outreach'], ['Sample Health Systems', '180', '2', 'Send outreach'], ['Demo Logistics', '95', '1', 'Review'], ['Illustrative Bank', '60', '0', 'None']])],
      ['d-alumni-relations', ...demo('d-development', 'Development: who not to ask', 'Development · Alumni in transition', [['In transition', '38'], ['Do not solicit', '38'], ['Placed, in grace period', '9'], ['Gratitude ask ready', '3']], ['Alumnus', 'Flag', 'Since', 'Gratitude ask'], [['Class of 2009, operations', 'In transition, do not solicit', 'Sep 12', 'Not yet'], ['Class of 2002, finance', 'In transition, do not solicit', 'Aug 30', 'Not yet'], ['Class of 1998, engineering', 'Placed, grace period', 'Aug 02', 'In 21 days'], ['Class of 2011, sales', 'Cleared', 'Jun 14', 'Ready']])],
      ['who', ...aud('alumni', 'alumni who lose a job', 'a plan and a person who knows today\'s market', 'a branded portal, a market reality check, weekly sprints, coaching and mentors from fellow alumni', 'their own progress, and who has viewed their profile')],
      ['c-alumni', ...aud('career', 'career services', 'a way to help alumni without adding staff', 'caseloads, check-ins, student invites and employer approvals in one workspace', 'who is active and who is stuck, week by week')],
      ['c-career', ...aud('alumni-relations', 'alumni relations', 'to reach alumni who are hurting, at the right moment', 'layoff alerts for alumni employers, outreach tools, a mentor network and coaching packages', 'engagement and who responded')],
      ['c-alumni-relations', ...aud('development', 'development and advancement', 'to protect donor relationships through a job loss', 'a do-not-solicit flag, the transition and placement dates, and a gratitude-ask window; never the reason or search detail', 'who not to ask, and who is ready to be thanked')],
      ['c-development', ...aud('employers', 'employer relations', 'hiring partners who trust your graduates', 'employer approvals, featured and basic job-post packages, and introductions to alumni who agreed to share', 'roles posted and introductions made')],
      ['c-employers', ...aud('leadership', 'institution leadership', 'evidence that alumni outcomes are improving', 'outcome and engagement reporting, branding and roster controls, exports', 'a dashboard for the board, with consent respected')],
    ],
    off: ['a-datacenters'],
  },

  // ───────────────────────── Economic development ─────────────────────────────
  ECON_DEV: {
    buyer: 'President or CEO; vice president of business retention and expansion or talent',
    angle: 'When a local employer lays off white-collar staff, the region loses that talent to other metros. NextChapter helps keep and redeploy it locally and gives the organization a retention story for employer visits and site selection.',
    tone: 'Regional, data first, works alongside the workforce board and never competes with it',
    ask: 'A 30-minute call, then a co-branded regional talent-transition page',
    offer: { name: 'Regional talent-transition pilot', scope: ['A co-branded page for people affected by layoffs in the region', 'Coaching and job-search tools for each participant', 'A regional talent brief for your board and employers'], theyProvide: ['An introduction to the workforce board and two or three employers', 'One named owner'], term: '6 months', price: NO_PRICE },
    packages: [
      pkg('page', 'Regional talent page', 'A fast, visible start', ['Co-branded page for people affected by layoffs', 'Coaching and job-search tools for every participant', 'Monthly participation report']),
      pkg('retention', 'Retention partnership', 'A retention team that visits employers', ['Everything in the talent page', 'A response kit when a local employer announces cuts', 'Quarterly regional talent brief for your board and employers']),
      pkg('network', 'Regional talent network', 'A region that wants to keep and place its white-collar talent', ['Everything in the retention partnership', 'Hiring portal for local employers', 'Coordination with the workforce board and one-stop', 'Outcome reporting by employer and field']),
    ],
    patches: {
      summary: { bullets: ['{{layoffs12}} workers in {{area}} were named in layoff notices in the last 12 months; white-collar unemployment is an estimated {{wcEst}}.', 'NextChapter helps those workers get re-employed locally and gives {{org}} a talent-retention story.', 'Proposal: a six-month regional pilot in one of three packages. Ask: a 30-minute call.'] },
      problem: { bullets: ['Laid-off white-collar workers are the hardest to place locally: the roles are few and the search is long.', 'Many leave for other metros, taking their income and their children\'s schools with them.', 'Employers weighing a layoff ask what the region will do for the people affected, and today there is no answer.'] },
      cost: { bullets: ['Each white-collar household that leaves takes income and tax base with it.', 'A region known for handling layoffs badly is harder to sell to the next employer.', 'Open roles at growing local employers go unfilled while skilled people search elsewhere.'] },
      solution: { bullets: ['A regional page and coached path for every affected worker, run under {{org}}\'s name with the workforce board.', 'Local employers can hire from the pool through a hiring portal.', 'A monthly view of who is searching, in which fields, and where demand is.'] },
      how: { bullets: ['Respond: when a layoff is announced, the page and kit are ready within days', 'Coach: each person gets a market check, a plan and a weekly rhythm', 'Place: introductions to local employers first, outside the region second'] },
      measure: { bullets: ['People enrolled, active and placed, by employer and field.', 'How many stayed in the region.', 'Employer hiring interest by role family.', 'A quarterly brief you can hand to your board and to site-selection prospects.'] },
      fit: { bullets: ['Coordinates with {{board}} and the American Job Center; we hand off, not duplicate.', 'Gives your retention team a concrete offer when an employer announces cuts.', 'Uses public data you already cite.'] },
      next: { bullets: ['A 30-minute call with {{org}} leadership.', 'Introduce us to {{board}} and two employers.'] },
      'a-faq': { bullets: ['Do you compete with the workforce board? No. We refer people to WIOA services and coordinate with the board.', 'Who sees participants\' information? Aggregate numbers only, unless a person agrees to share more.', 'How quickly can a page be live? We agree scope in the first two weeks of the pilot.', 'What does it cost? We scope it with you after the first call.'] },
    },
    extra: [
      ['how', ...demo('d-region', 'Regional talent dashboard', 'Regional program · Talent transition', [['Affected workers enrolled', '214'], ['Active in search', '148'], ['Hired in the region', '41'], ['Hired elsewhere', '6']], ['Layoff event', 'Workers', 'Enrolled', 'Hired locally'], [['Employer A, headquarters', '420', '96', '18'], ['Employer B, regional office', '180', '61', '14'], ['Employer C, plant offices', '95', '33', '7'], ['Employer D, shared services', '60', '24', '2']])],
      ['d-region', ...demo('d-employer-view', 'Local employers see a vetted pool', 'Hiring portal · Regional pool', [['Candidates in the pool', '148'], ['Employers browsing', '17'], ['Introductions made', '23'], ['Interviews', '11']], ['Function', 'Level', 'Candidates', 'Open local roles'], [['Finance and accounting', 'Manager to director', '22', '9'], ['Operations', 'Manager to VP', '31', '14'], ['Marketing', 'Manager', '18', '6'], ['IT and data', 'Senior', '27', '19']])],
      ['who', ...aud('residents', 'laid-off residents', 'a credible path back to work close to home', 'a market reality check, a weekly plan, coaching and introductions to local employers', 'their own progress and local roles that fit')],
      ['c-residents', ...aud('retention', 'your business retention team', 'something to offer an employer that is cutting jobs', 'a ready response kit and a co-branded page', 'participation by employer, for the next visit')],
      ['c-retention', ...aud('employers', 'local employers', 'experienced people for roles that are hard to fill', 'a vetted pool through a hiring portal, and a transition path for their own departing staff', 'candidates by function and level')],
      ['c-employers', ...aud('board-partners', 'the workforce board and partners', 'white-collar help that adds to WIOA services', 'referrals both ways and shared participation numbers', 'combined outcomes without duplicate effort')],
      ['c-board-partners', ...aud('officials', 'your board and elected officials', 'proof that the region is acting on layoffs', 'a quarterly talent brief with retention and placement numbers', 'people kept in the region and employers engaged')],
    ],
  },

  // ─────────────────────────────── Chambers ───────────────────────────────────
  CHAMBER: {
    buyer: 'President or CEO; vice president of member services',
    angle: 'A member benefit: laid-off white-collar workers and the member firms that want to hire them, matched locally.',
    tone: 'Practical, member value first',
    ask: 'An intro call, then a member webinar',
    offer: { name: 'Member benefit and hiring pilot', scope: ['Member firms get access to a vetted local candidate pool', 'A co-branded landing page and one member webinar', 'A quarterly report on local white-collar hiring'], theyProvide: ['A member email or newsletter slot', 'Introductions to five member employers'], term: '6 months', price: NO_PRICE },
    packages: [
      pkg('benefit', 'Member benefit', 'A simple benefit you can announce', ['Co-branded landing page', 'One member webinar', 'Coaching tools for people in your community who are between jobs']),
      pkg('hiring', 'Member hiring', 'Members who say they cannot find experienced people', ['Everything in the member benefit', 'Hiring portal access for member firms', 'Introductions to vetted local candidates']),
      pkg('network', 'Chamber talent network', 'A chamber that leads on workforce', ['Everything in member hiring', 'Transition support for members that must reduce staff', 'Quarterly local hiring and layoff report']),
    ],
    patches: {
      summary: { bullets: ['{{layoffs12}} workers in {{area}} were named in layoff notices in the last 12 months while members report hard-to-fill roles.', 'NextChapter connects vetted local candidates to member firms.', 'Proposal: a six-month member-benefit pilot in one of three packages. Ask: an intro call.'] },
      problem: { bullets: ['Members struggle to find experienced professionals while others in the same county are out of work.', 'Job boards return volume, not fit.', 'Chambers have no good answer when a member lays people off.'] },
      cost: { bullets: ['Open roles at member firms stay open longer than they should.', 'Members who must cut staff look to the chamber for help and find none.', 'A talent story is now part of why a business chooses to join.'] },
      solution: { bullets: ['Candidates arrive with an evidence-backed profile, so members see skills and not only keywords.', 'A hiring portal for members; coaching for candidates.', 'The chamber is the host and gets the credit.'] },
      how: { bullets: ['Announce: the chamber launches the benefit to members', 'Match: candidates and member roles meet in the portal', 'Report: members and the board see local hires'] },
      measure: { bullets: ['Member firms using the portal.', 'Introductions and hires among members.', 'A quarterly local hiring and layoff report for your board.'] },
      fit: { bullets: ['Complements the workforce board and your job fairs.', 'Members browse at no cost; terms are agreed with the chamber.'] },
      next: { bullets: ['An intro call with {{org}}.', 'Pick a date for a member webinar.'] },
      'a-faq': { bullets: ['Does a member pay to browse candidates? We agree terms with the chamber during scoping.', 'Is this only for members? We set eligibility with you.', 'Does it compete with local staffing firms? It does not replace them; some members use both.'] },
    },
    extra: [
      ['how', ...demo('d-members', 'Member talent pool', 'Member portal · Local candidates', [['Candidates in the pool', '96'], ['Member firms browsing', '14'], ['Introductions', '18'], ['Hires reported', '5']], ['Function', 'Level', 'Candidates', 'Members hiring'], [['Finance', 'Manager', '14', '6'], ['Operations', 'Director', '19', '8'], ['Sales', 'Manager', '16', '5'], ['HR', 'Manager', '9', '3']])],
      ['who', ...aud('employers', 'member employers who are hiring', 'experienced people for roles that stay open', 'a vetted local pool and introductions', 'candidates by function and level')],
      ['c-employers', ...aud('layoff-members', 'members that must reduce staff', 'a respectful way to support departing employees', 'a transition path with the chamber\'s name on it', 'aggregate participation')],
      ['c-layoff-members', ...aud('staff', 'chamber staff', 'a benefit that is easy to run', 'a landing page, a webinar and a report', 'member use and local hires')],
      ['c-staff', ...aud('professionals', 'professionals between jobs', 'local roles and a plan', 'coaching tools and introductions to member firms', 'their own progress')],
    ],
    off: ['a-colleges', 'a-datacenters', 'a-initiatives'],
  },

  // ───────────────────────────── Workforce boards ─────────────────────────────
  WIOA_BOARD: {
    buyer: 'Board executive director; one-stop operator; Rapid Response coordinator',
    angle: 'A tool for the white-collar dislocated workers the one-stop struggles to serve, and for Rapid Response events, that adds to WIOA services and does not replace them.',
    tone: 'Compliance-aware, respectful of public-sector constraints, specific about performance measures',
    ask: 'A call with the director and the Rapid Response coordinator',
    offer: { name: 'Rapid Response and dislocated-worker pilot', scope: ['NextChapter available at the next Rapid Response events', 'Coaching and job-search tools for dislocated workers', 'Participation reporting for the board'], theyProvide: ['A named owner', 'The next two layoff events for the pilot'], term: '90 days', price: NO_PRICE },
    packages: [
      pkg('rr', 'Rapid Response add-on', 'A first step at your next layoff event', ['NextChapter introduced at the Rapid Response session', 'Self-serve tools and coaching for attendees', 'Participation report for the event']),
      pkg('program', 'Dislocated-worker program', 'White-collar clients who drop out of standard pathways', ['Everything in the add-on', 'Ongoing coaching between one-stop visits', 'Referrals to WIOA training where eligible', 'Monthly report for the board']),
      pkg('region', 'Regional program', 'A board that wants one picture of white-collar re-employment', ['Everything in the program', 'Employer hiring portal', 'Coordination with the state Rapid Response team', 'Outcome reporting by event and employer']),
    ],
    patches: {
      summary: { bullets: ['{{layoffs12}} workers in {{area}} were named in layoff notices in the last 12 months; white-collar unemployment is an estimated {{wcEst}}.', 'NextChapter gives dislocated white-collar workers coaching and tools between one-stop visits.', 'Proposal: a 90-day pilot at your next Rapid Response events.'] },
      problem: { bullets: ['White-collar dislocated workers often do not fit standard training pathways and drop out of services.', 'Rapid Response sessions reach people on day one, then follow-up is thin.', 'Boards are measured on employment outcomes with limited staff time.'] },
      cost: { bullets: ['People who stop engaging after Rapid Response are hard to find again.', 'Employment and earnings measures suffer when a long search goes unsupported.', 'Staff time goes to people who need training while professionals wait.'] },
      solution: { bullets: ['A self-serve plus coached path that continues after the Rapid Response session.', 'Reporting on participation and outcomes for the board.', 'Built to sit beside WIOA services, never to replace them.'] },
      how: { bullets: ['Introduce: at the Rapid Response session, with the board\'s name on it', 'Support: weekly plan and coaching after the session', 'Report: participation and outcomes to the board'] },
      measure: { bullets: ['Attendance and sign-up at each Rapid Response event.', 'Active participants, and who reports a new job.', 'A monthly report formatted for your board.'] },
      fit: { bullets: ['We refer people to WIOA training and supportive services where eligible.', 'We are not a WIOA provider and do not bill WIOA.', 'Pilot can be funded from local, state or philanthropic dollars.'] },
      next: { bullets: ['A call with {{board}} leadership.', 'Name the next two layoff events for the pilot.'] },
      'a-faq': { bullets: ['Is this WIOA-funded? Not by default. We can scope a pilot on local, state or philanthropic funds.', 'Do you replace career advisors? No. Advisors keep the people who need training and supportive services.', 'What data does the board receive? Participation and outcomes in aggregate.'] },
    },
    extra: [
      ['how', ...demo('d-rapid', 'Rapid Response session report', 'Board report · Rapid Response', [['Attended session', '120'], ['Signed up', '87'], ['Active at 30 days', '58'], ['Reported a new job', '14']], ['Event', 'Date', 'Signed up', 'Active at 30 days'], [['Employer A layoff', 'Sep 04', '41', '28'], ['Employer B layoff', 'Aug 19', '29', '19'], ['Employer C layoff', 'Aug 02', '17', '11']])],
      ['who', ...aud('workers', 'dislocated workers', 'support after the session ends', 'a plan, coaching and employer introductions', 'their own progress')],
      ['c-workers', ...aud('rr', 'the Rapid Response team', 'a follow-up that does not add to their workload', 'a ready add-on for each event', 'sign-up and activity after each event')],
      ['c-rr', ...aud('advisors', 'one-stop career advisors', 'time for clients who need training and services', 'professionals served in parallel, with referrals back to the center', 'who is active and who needs the center')],
      ['c-advisors', ...aud('board', 'board members and the state', 'evidence of results', 'a monthly report', 'participation and outcomes by event and employer')],
    ],
    off: ['a-board', 'a-datacenters'],
  },

  // ───────────────────────────── Workforce nonprofits ─────────────────────────
  WORKFORCE_NONPROFIT: {
    buyer: 'Executive director; director of programs',
    angle: 'Add AI-supported coaching and a white-collar track to existing programs without hiring.',
    tone: 'Mission-aligned, funding-aware',
    ask: 'An intro call and a joint funding conversation',
    offer: { name: 'Program add-on pilot', scope: ['A white-collar track for your participants', 'Coaching and job-search tools', 'Outcome reporting you can use in grant reports'], theyProvide: ['A cohort of participants', 'A named program owner'], term: '90 days', price: NO_PRICE },
    packages: [
      pkg('addon', 'Program add-on', 'Trying it with one cohort', ['Coaching and tools for a cohort', 'Cohort progress report']),
      pkg('track', 'White-collar track', 'A standing track for professionals', ['Everything in the add-on', 'Track curriculum alongside your programs', 'Grant-ready outcome reporting']),
      pkg('partner', 'Funded partnership', 'Applying for funding together', ['Everything in the track', 'Joint grant proposal support', 'Employer partner introductions']),
    ],
    patches: {
      summary: { bullets: ['White-collar unemployment in {{area}} is an estimated {{wcEst}} and few programs serve it.', 'NextChapter adds a coached white-collar track to {{org}}\'s programs.', 'Proposal: a 90-day pilot in one of three packages. Ask: an intro call.'] },
      problem: { bullets: ['Most workforce programs are built for entry-level and trades pathways.', 'Experienced professionals do not self-identify with those programs and do not enroll.', 'Staff time is the limit, not interest.'] },
      cost: { bullets: ['Professionals who find no program stay unemployed longer and draw down savings.', 'Funders ask about new populations and growth.', 'Staff capacity stays flat while demand shifts.'] },
      solution: { bullets: ['A ready-made white-collar track under your brand.', 'Coaching and tools that scale without more staff.', 'Participant outcomes in a form funders accept.'] },
      how: { bullets: ['Enroll: participants join under your program', 'Coach: a plan and weekly support', 'Report: outcomes for your funders'] },
      measure: { bullets: ['Enrollment, activity and placement by cohort.', 'Outcome reports formatted for grant files.'] },
      fit: { bullets: ['Adds to your existing curriculum.', 'Can be paid for from existing grants where allowed.'] },
      next: { bullets: ['An intro call with {{org}} program leadership.', 'Choose a cohort for the pilot.'] },
      'a-faq': { bullets: ['Will staff need training? A short onboarding is included.', 'Can this be grant-funded? Often; we will help you scope it.', 'Who owns participant data? You and the participant, under your policies.'] },
    },
    extra: [
      ['how', ...demo('d-cohort', 'Program cohort view', 'Program · White-collar track', [['Enrolled', '36'], ['Active this week', '27'], ['Interviewing', '11'], ['Placed', '6']], ['Participant', 'Stage', 'Last activity', 'Support needed'], [['Participant 1, operations', 'Interviewing', 'Today', 'None'], ['Participant 2, finance', 'Active', '2 days ago', 'Resume'], ['Participant 3, marketing', 'Stalled', '14 days ago', 'Check-in'], ['Participant 4, HR', 'Placed', '5 days ago', 'None']])],
      ['who', ...aud('participants', 'participants', 'a path that fits their experience', 'a plan, coaching and tools', 'their own progress')],
      ['c-participants', ...aud('staff', 'program staff', 'to serve more people without more hours', 'a ready track and a cohort view', 'who needs a check-in')],
      ['c-staff', ...aud('funders', 'funders', 'a new population reached with evidence', 'outcome reports', 'enrollment and placement')],
      ['c-funders', ...aud('employers', 'employer partners', 'experienced hires', 'introductions to participants', 'candidates by function')],
    ],
    off: ['a-colleges', 'a-datacenters', 'a-initiatives'],
  },

  // ──────────────────────────────── Recruiters ────────────────────────────────
  RECRUITER: {
    buyer: 'Managing partner; head of talent',
    angle: 'NextChapter Talent: evidence-backed white-collar candidates and an intake you do not have to build.',
    tone: 'Direct, commercial, short',
    ask: 'A 20-minute demo',
    offer: { name: 'NextChapter Talent pilot', scope: ['Access to vetted candidate profiles in your search areas', 'Intake and screening tools', 'Direct introductions to candidates who opt in'], theyProvide: ['Two open searches for the pilot', 'Feedback on each candidate'], term: '60 days', price: NO_PRICE },
    packages: [
      pkg('pilot', 'Search pilot', 'Testing on two live searches', ['Candidate access for two searches', 'Introductions to candidates who opt in']),
      pkg('team', 'Team access', 'A team that fills many searches', ['Everything in the pilot', 'Seats for your recruiters', 'Saved searches and alerts']),
      pkg('firm', 'Firm-wide intake', 'Replacing your own intake build', ['Everything in team access', 'Branded candidate intake page', 'Reporting by search and client']),
    ],
    patches: {
      summary: { bullets: ['Experienced white-collar candidates are available now and hard to find through job boards.', 'NextChapter Talent gives you vetted profiles with evidence of skills and an intake you do not have to build.', 'Proposal: a 60-day pilot on two searches. Ask: a 20-minute demo.'] },
      problem: { bullets: ['Resumes look alike and keyword matching misses fit.', 'Building intake, screening and follow-up costs recruiter time.', 'Strong candidates are laid off and invisible until they apply.'] },
      cost: { bullets: ['Recruiter hours go to sorting resumes instead of conversations with clients.', 'Searches stay open while good candidates sit unseen.', 'Intake you build yourself is a cost that never ends.'] },
      solution: { bullets: ['Profiles built from assessments, work samples and references, not only a resume.', 'Candidates opt in to introductions.', 'Your team spends time on conversations, not sourcing.'] },
      how: { bullets: ['Search: filter by function, level and evidence', 'Review: see assessments, samples and references together', 'Introduce: candidates opt in, you take it from there'] },
      measure: { bullets: ['Candidates viewed, introduced and advanced per search.', 'Time from opening a search to a first slate.'] },
      fit: { bullets: ['Works beside your ATS and your own sourcing.', 'You keep the client relationship and the fee.'] },
      next: { bullets: ['A 20-minute demo.', 'Choose two searches for the pilot.'] },
      'a-faq': { bullets: ['Do we pay a placement fee to NextChapter? Terms are agreed during the pilot scoping.', 'Do candidates know they are visible to recruiters? Yes, they opt in.', 'Can we export profiles to our ATS? We will confirm the formats during the demo.'] },
    },
    extra: [
      ['how', ...demo('d-talent', 'Candidate pool for a search', 'NextChapter Talent · Search results', [['Matching candidates', '64'], ['Opted in to intros', '51'], ['With work samples', '29'], ['Introduced', '8']], ['Candidate', 'Function', 'Level', 'Evidence'], [['Candidate 1', 'Finance', 'Director', 'Assessment, 2 samples'], ['Candidate 2', 'Operations', 'VP', 'Assessment, 3 references'], ['Candidate 3', 'Finance', 'Manager', 'Assessment'], ['Candidate 4', 'Strategy', 'Director', 'Assessment, 1 sample']])],
      ['who', ...aud('recruiters', 'your recruiters', 'qualified slates faster', 'filters, evidence and opt-in introductions', 'time to first slate')],
      ['c-recruiters', ...aud('clients', 'your clients', 'candidates who fit', 'slates with evidence behind them', 'quality of the first slate')],
      ['c-clients', ...aud('leadership', 'firm leadership', 'recruiter hours spent on revenue work', 'an intake you do not maintain', 'searches filled per recruiter')],
      ['c-leadership', ...aud('candidates', 'candidates', 'to be seen for what they can do', 'a profile built on evidence and control over introductions', 'who viewed their profile')],
    ],
    off: ['local-data', 'layoffs', 'a-profile', 'a-warn', 'a-employers', 'a-colleges', 'a-datacenters', 'a-board', 'a-initiatives', 'a-news', 'appx', 'timeline'],
  },

  // ─────────────────────────── Employers with layoffs ─────────────────────────
  OUTPLACEMENT_EMPLOYER: {
    buyer: 'Chief human resources officer; vice president of people; head of HR',
    angle: 'A transition benefit for departing white-collar employees that goes further than a hotline and costs less than legacy outplacement.',
    tone: 'Respectful of the people affected, no hype, quick to act',
    ask: 'A call this week, before the effective date',
    offer: { name: 'Transition benefit for departing employees', scope: ['Every departing employee gets coaching and job-search tools', 'A custom landing page for departing employees', 'Aggregate reporting to HR, never individual data without consent'], theyProvide: ['The list of affected employees or an invitation link', 'A named HR owner'], term: '6 months from notice', price: NO_PRICE },
    packages: [
      pkg('standard', 'Transition benefit', 'A single layoff event', ['Landing page for departing employees', 'Coaching and job-search tools for each person', 'Aggregate report to HR']),
      pkg('plus', 'Transition plus manager support', 'A layoff where managers deliver the news', ['Everything in the standard benefit', 'Guidance for managers who stay', 'A FAQ for departing and remaining employees']),
      pkg('program', 'Enterprise program', 'Several events or sites across the year', ['Everything in plus', 'One program across locations', 'Coordination with each local workforce board']),
    ],
    patches: {
      summary: { bullets: ['{{org}} is reducing its workforce; departing employees will search in a market where white-collar searches run long.', 'NextChapter coaches each person toward their next role and reports in aggregate.', 'Proposal: a transition benefit for the affected group. Ask: a call before the effective date.'] },
      problem: { bullets: ['Departing employees get a short severance and a hotline.', 'Remaining employees watch how the company treats those who leave.', 'Legacy outplacement is expensive and generic.'] },
      cost: { bullets: ['Departing employees who feel abandoned talk about it.', 'Remaining employees reconsider their own commitment.', 'A poor transition affects the employer brand for years.'] },
      solution: { bullets: ['A coached, evidence-based path for each departing employee, starting on day one.', 'Coordination with the local workforce board for Rapid Response.', 'Aggregate reporting for HR; individual data only with consent.'] },
      how: { bullets: ['Announce: employees receive the benefit with the notice', 'Support: a plan, coaching and introductions', 'Report: HR sees aggregate progress'] },
      measure: { bullets: ['Invitations, starts and active use, in aggregate.', 'Interviews and new roles reported by those who agree to share.', 'No individual data goes to the company without the person\'s consent.'] },
      fit: { bullets: ['Works with severance and existing benefits.', 'Pairs with state Rapid Response services; we refer people to them.'] },
      next: { bullets: ['A call with {{org}} HR this week.', 'Confirm the affected group and effective date.'] },
      'a-faq': { bullets: ['Can HR see who is struggling? Only in aggregate; individuals choose what to share.', 'How fast can it start? Within days of an agreed scope.', 'Does it replace severance? No. It sits beside it.'] },
    },
    extra: [
      ['how', ...demo('d-hr', 'HR view: aggregate progress', 'HR dashboard · Transition benefit', [['Invited', '120'], ['Started', '87'], ['Interviewing', '34'], ['New role reported', '22']], ['Week', 'Started', 'Active', 'Interviewing'], [['Week 1', '41', '39', '2'], ['Week 2', '63', '55', '9'], ['Week 4', '82', '61', '24'], ['Week 6', '87', '58', '34']])],
      ['who', ...aud('departing', 'departing employees', 'dignity, a plan and fast help', 'a plan, coaching and introductions from day one', 'their own progress')],
      ['c-departing', ...aud('hr', 'your HR team', 'a transition that reflects well on the company', 'a landing page, a FAQ and an aggregate report', 'participation and outcomes in aggregate')],
      ['c-hr', ...aud('managers', 'managers and remaining employees', 'to see the company handle this well', 'guidance for conversations and a visible benefit', 'steadier engagement')],
      ['c-managers', ...aud('leadership', 'leadership and finance', 'a cost-effective benefit', 'an alternative to legacy outplacement', 'cost per participant and use')],
    ],
    off: ['a-colleges', 'a-datacenters', 'a-initiatives', 'a-employers'],
  },
}

const SUGGESTED: Record<CustomerType, string[]> = {
  HIGHER_ED: ['Justin Kulla (presenter)', 'A career-services lead from the college (their side)', 'The head of alumni relations (their side)', 'An advisor from higher education, if you have one'],
  ECON_DEV: ['Justin Kulla (presenter)', 'The local workforce board director (their side, shows we work with WIOA)', 'The business retention lead (their side)'],
  CHAMBER: ['Justin Kulla (presenter)', 'The chamber\'s member services lead (their side)'],
  WIOA_BOARD: ['Justin Kulla (presenter)', 'The board director (their side)', 'The state Rapid Response coordinator (their side)'],
  WORKFORCE_NONPROFIT: ['Justin Kulla (presenter)', 'The program director (their side)'],
  RECRUITER: ['Justin Kulla (presenter)', 'A recruiter already using NextChapter, if one will be named'],
  OUTPLACEMENT_EMPLOYER: ['Justin Kulla (presenter)', 'The CHRO or head of HR (their side)', 'The local workforce board director (their side; Rapid Response)'],
}

function build(spec: Spec): SlideRule[] {
  const rules: SlideRule[] = BASE.map(([id, section, kind, p]) => ({
    id, section, kind, enabled: true, title: '', bullets: [], ...p, ...(spec.patches[id] ?? {}), ...(spec.off?.includes(id) ? { enabled: false } : {}),
  }))
  // insert per-type extra slides after the slide they name, in order
  for (const [after, id, patch] of spec.extra) {
    const i = rules.findIndex((r) => r.id === after)
    const at = i < 0 ? rules.findIndex((r) => r.id === 'solution') : i
    const kind: SlideRule['kind'] = id.startsWith('d-') ? 'demo' : 'bullets'
    rules.splice(at + 1, 0, { id, section: 'Solution', kind, enabled: true, title: '', bullets: [], ...patch })
  }
  return rules
}

export function defaultRuleSet(type: CustomerType): RuleSet {
  const s = SPEC[type]
  return {
    type, label: CUSTOMER_LABELS[type], buyer: s.buyer, angle: s.angle, tone: s.tone, ask: s.ask,
    offer: s.offer, packages: s.packages, reviewNotes: s.reviewNotes ?? [], suggestedPeople: SUGGESTED[type], slides: build(s),
  }
}
