/**
 * The niches NextChapter has a directory page for: one /niches/<slug> page per kind of job-search, career-change or
 * layoff-support service. The text on each page is generic and describes the kind of service, never a named company.
 * The company list under it is read from the competitor database (src/lib/niches/providers.ts): names and links only.
 *
 * Each niche is also a keyword-map cluster (spread into KEYWORD_CLUSTERS), so it has one owner per phrase.
 */
import type { CompetitorAreaKey } from '@/lib/vision/competitor-areas'

export interface Niche {
  slug: string
  /** Short name, sentence case. */
  label: string
  /** ProductCompetitor.category values whose companies belong here. */
  categories: string[]
  /** Companies added by exact name (ProductCompetitor.name), for niches no category covers. */
  includeNames?: string[]
  /** Who this niche is for, one sentence. */
  audience: 'people' | 'employers' | 'organizations'
  primary: string
  secondary: string[]
  title: string
  description: string
  h1: string
  what: string
  whoFor: string
  howToChoose: string[]
  /** Capability areas used to show what NextChapter already does here. */
  areas: CompetitorAreaKey[]
  related: { href: string; label: string }[]
}

export const NICHES: Niche[] = [
  {
    slug: 'reverse-recruiting',
    label: 'Reverse recruiting and done-for-you applications',
    categories: [],
    includeNames: ['Scale.jobs', 'WeAreCareer (Career Enterprise)'],
    audience: 'people',
    primary: 'reverse recruiting companies',
    secondary: ['reverse recruiting companies compared', 'best reverse recruiting services', 'done for you job applications', 'job application service', 'pay someone to apply to jobs', 'job search agency'],
    title: 'Reverse Recruiting Companies and How to Choose',
    description: 'Companies that apply and reach out to employers for you: what reverse recruiting services do, what they cost to ask about, and what to check before paying.',
    h1: 'Reverse recruiting companies',
    what: 'A reverse recruiting or done-for-you application service works for the job seeker. Staff or software find openings, submit applications or contact employers on your behalf, and you pay the service.',
    whoFor: 'People who have the time to interview but not the time to search, or who want someone else to handle the volume of applications.',
    howToChoose: [
      'Ask what is done each week and by whom: a person, software, or both.',
      'Ask how it is priced, whether any fee depends on a job offer, and what happens if you stop.',
      'Ask for examples at your level and field, and whether you approve each application or message before it goes out.',
      'Check how they use your accounts, résumé and contact details, and who can see them.',
    ],
    areas: ['job_search', 'networking'],
    related: [
      { href: '/topics/reverse-recruiter', label: 'Reverse recruiter: what it is and how it compares' },
      { href: '/tools/resume-check', label: 'Free resume check' },
    ],
  },
  {
    slug: 'outplacement-companies',
    label: 'Outplacement and career transition firms',
    categories: ['outplacement', 'job_transition'],
    audience: 'employers',
    primary: 'outplacement companies',
    secondary: ['outplacement firms', 'list of outplacement providers', 'outplacement companies directory', 'job transition services companies', 'outplacement vendors list'],
    title: 'Outplacement Companies: A Directory and Checklist',
    description: 'A directory of outplacement and career transition firms, with what outplacement includes and the questions an employer should ask before choosing one.',
    h1: 'Outplacement companies',
    what: 'Outplacement is career support an employer pays for when it lets people go: coaching, résumé help, job search tools and sometimes a search platform. Firms range from global consultancies to small coaching practices and software vendors.',
    whoFor: 'HR and legal teams planning a reduction in force, and the people leaving.',
    howToChoose: [
      'Ask what the person keeps after the contract ends, and for how long.',
      'Ask what the employer sees about each person, and whether reports show groups or individuals.',
      'Ask for a sample of the documentation that shows the support was offered.',
      'Ask how pricing works per person, and whether outplacement is sold on its own or inside a wider agreement.',
    ],
    areas: ['outplacement', 'coaching'],
    related: [
      { href: '/outplacement', label: 'NextChapter for employers' },
      { href: '/vs', label: 'Outplacement providers compared' },
      { href: '/rfp-template', label: 'Outplacement RFP template' },
    ],
  },
  {
    slug: 'career-coaching-platforms',
    label: 'Online career coaching platforms',
    categories: ['coaching'],
    audience: 'people',
    primary: 'online career coaching platforms',
    secondary: ['career coaching companies', 'online career coach services', 'career coaching apps', 'career coaching platforms compared'],
    title: 'Online Career Coaching Platforms Compared',
    description: 'Online career coaching platforms and marketplaces: what a session covers, how coaches are matched and priced, and what to check before you book.',
    h1: 'Online career coaching platforms',
    what: 'Career coaching platforms match you with a coach for sessions on direction, interviews, negotiation or a search plan. Some sell individual sessions, some sell employer-paid programs, and some use software in place of a person.',
    whoFor: 'People who want guidance on a decision or a plan and will do the search work themselves.',
    howToChoose: [
      'Ask who the coaches are, how they are chosen, and whether you pick yours.',
      'Ask what one session covers and what you leave with.',
      'Ask how pricing and cancellation work, and whether an employer or a school can pay.',
      'Ask what is kept private from an employer or school that paid.',
    ],
    areas: ['coaching'],
    related: [{ href: '/coaching', label: 'Coaching on NextChapter' }],
  },
  {
    slug: 'career-change-tools',
    label: 'Career change and career exploration tools',
    categories: ['career_exploration'],
    audience: 'people',
    primary: 'career change tools',
    secondary: ['career change apps', 'career exploration tools', 'tools to find a new career', 'career pivot tools', 'what career should i switch to tool'],
    title: 'Career Change Tools and Career Exploration Apps',
    description: 'Tools that help you choose a new career: assessments, role matching and pivot paths. What they do, what data they use and how to judge the results.',
    h1: 'Career change tools',
    what: 'Career change and exploration tools suggest roles you could move into, usually from your skills, interests or past titles. Methods range from questionnaires to skills matching against job and wage data.',
    whoFor: 'People whose field has shrunk or who want a different kind of work and need options to look at.',
    howToChoose: [
      'Ask what data the suggestions come from and how recent it is.',
      'Check whether suggestions account for pay, demand and the time to retrain.',
      'See whether the tool explains why it suggested a role.',
      'Check what happens to the answers you enter.',
    ],
    areas: ['career_exploration'],
    related: [
      { href: '/topics/career-pivot', label: 'Career pivot' },
      { href: '/topics/career-exploration', label: 'Career exploration' },
    ],
  },
  {
    slug: 'ai-job-search-tools',
    label: 'AI job search tools',
    categories: ['job_search_tools'],
    audience: 'people',
    primary: 'ai job search tools',
    secondary: ['ai job search apps', 'ai resume and job search tools', 'job application autofill tools', 'job search copilots', 'ai tools to apply for jobs'],
    title: 'AI Job Search Tools: Resume, Autofill and Trackers',
    description: 'AI job search tools in one list: résumé builders, application autofill, trackers and job matchers. What each kind does and what to check before you sign up.',
    h1: 'AI job search tools',
    what: 'These tools use software to help with parts of a search: tailoring a résumé to a posting, filling in application forms, tracking applications or matching you to openings. Many are free to start and charge for the AI features.',
    whoFor: 'Active job seekers who want to cut the repetitive parts of applying.',
    howToChoose: [
      'Check whether you review each résumé change and each application before it is sent.',
      'Check how the tool gets its job listings and how often they are refreshed.',
      'Read the free and paid limits before you build your search around it.',
      'Check what it stores about you and whether you can export and delete it.',
    ],
    areas: ['job_search', 'resume'],
    related: [
      { href: '/tools/resume-check', label: 'Free resume check' },
      { href: '/topics/job-search-tracker', label: 'Job application tracker' },
    ],
  },
  {
    slug: 'fractional-and-gig-marketplaces',
    label: 'Fractional and independent work marketplaces',
    categories: ['fractional_gig'],
    audience: 'people',
    primary: 'fractional work marketplaces',
    secondary: ['fractional executive jobs', 'freelance marketplaces for professionals', 'interim and contract work platforms', 'where to find fractional work'],
    title: 'Fractional Work Marketplaces and Contract Platforms',
    description: 'Marketplaces for fractional, interim and contract professional work: how they differ, how they take fees, and what to ask before you list yourself.',
    h1: 'Fractional work marketplaces',
    what: 'Fractional and independent work marketplaces connect experienced professionals with companies that need part-time, interim or project work. Some vet and place people, and some are open listings.',
    whoFor: 'Professionals who want income while they search, or who want to work independently.',
    howToChoose: [
      'Ask how people are vetted and how work is matched.',
      'Ask how the platform is paid, and whether you or the client pays the fee.',
      'Ask whether you can work with a client outside the platform later.',
      'Check how payment, contracts and taxes are handled.',
    ],
    areas: ['fractional'],
    related: [{ href: '/resources/bridge-income', label: 'Bridge income while you search' }],
  },
  {
    slug: 'job-sites-for-older-workers',
    label: 'Job sites for workers over 50',
    categories: ['older_workers'],
    audience: 'people',
    primary: 'job sites for workers over 50',
    secondary: ['job boards for older workers', 'jobs for people over 50', 'senior job boards', 'age friendly employers'],
    title: 'Job Sites for Workers Over 50: A Directory',
    description: 'Job boards and programs for workers over 50: what they list, how they screen employers and what to check, with a directory of sites and programs.',
    h1: 'Job sites for workers over 50',
    what: 'Some job boards and programs focus on experienced and older workers. They list roles from employers that say they welcome experienced applicants, and some add coaching or training.',
    whoFor: 'Experienced professionals who want employers that expect applicants at their stage.',
    howToChoose: [
      'Check how employers are screened, and what the listing standard is.',
      'Look at whether the roles match your level, including full-time and senior roles, not just part-time or entry work.',
      'Check whether the site charges job seekers.',
      'Check how recently the listings were posted.',
    ],
    areas: ['job_search'],
    related: [{ href: '/start/laid-off', label: 'Laid off? Start here' }],
  },
  {
    slug: 'early-career-platforms',
    label: 'Entry-level and early-career job platforms',
    categories: ['early_career'],
    audience: 'people',
    primary: 'entry level job platforms',
    secondary: ['early career job platforms', 'internship and graduate job sites', 'entry level job sites', 'where to find entry level jobs'],
    title: 'Entry-Level and Early-Career Job Platforms',
    description: 'Platforms for entry-level, graduate and internship roles: what they list, who pays for them and how to compare them before you spend time applying.',
    h1: 'Entry-level and early-career platforms',
    what: 'Early-career platforms list entry-level jobs, internships and short projects, often through universities or employers who recruit graduates. Some also offer paid micro-projects.',
    whoFor: 'Students, new graduates and career changers starting out in a field.',
    howToChoose: [
      'Check whether roles are paid and whether the posting shows pay.',
      'Check whether the site works through a school or is open to anyone.',
      'Check how many listings are current and in your field and location.',
    ],
    areas: ['job_search'],
    related: [{ href: '/jobs/entry-level', label: 'Entry-level jobs' }],
  },
  {
    slug: 'career-change-bootcamps',
    label: 'Bootcamps and retraining programs',
    categories: ['retraining'],
    audience: 'people',
    primary: 'career change bootcamps',
    secondary: ['bootcamps for career changers', 'retraining programs for adults', 'coding bootcamps directory', 'reskilling programs compared'],
    title: 'Career Change Bootcamps and Retraining Programs',
    description: 'Bootcamps and retraining programs for career changers: what they teach, how they are paid for and the outcome questions to ask before you enroll.',
    h1: 'Career change bootcamps',
    what: 'Bootcamps and retraining programs teach job skills in months, usually for technology, data, design or business roles. Costs range from free to tens of thousands of dollars, and some are funded by workforce programs.',
    whoFor: 'People moving into a field that needs skills they do not have yet.',
    howToChoose: [
      'Ask how outcomes are measured, who is counted, and over what period.',
      'Ask the total cost, including what you pay if you do not finish.',
      'Check whether you can pay with workforce or retraining funding.',
      'Ask what support continues after the course ends.',
    ],
    areas: ['learning', 'ai_reskilling'],
    related: [
      { href: '/funding', label: 'Funding for laid-off workers' },
      { href: '/ai-retraining', label: 'AI retraining' },
    ],
  },
  {
    slug: 'professional-networking-platforms',
    label: 'Professional networking and mentorship platforms',
    categories: ['networking'],
    audience: 'people',
    primary: 'professional networking platforms',
    secondary: ['mentorship platforms', 'online networking sites for professionals', 'find a mentor online', 'networking apps for job seekers'],
    title: 'Professional Networking and Mentorship Platforms',
    description: 'Networking and mentorship platforms for professionals: how they match people, what they charge and how to use them when you are between jobs.',
    h1: 'Professional networking platforms',
    what: 'Networking and mentorship platforms connect people for conversations, advice and introductions. Some are open communities, some are matched programs, and some are run by schools or employers.',
    whoFor: 'People who want introductions and advice from others in a field they want to enter.',
    howToChoose: [
      'Check how people are matched and whether you can choose.',
      'Check whether mentors are paid and whether you are charged.',
      'Check how many members are in your field and region.',
    ],
    areas: ['networking'],
    related: [{ href: '/resources/network-activation', label: 'How to network when job searching' }],
  },
  {
    slug: 'job-loss-support-groups',
    label: 'Job loss support groups and communities',
    categories: ['community'],
    audience: 'people',
    primary: 'job loss support groups',
    secondary: ['job transition support groups', 'support groups for unemployed professionals', 'online communities for job seekers', 'layoff support community'],
    title: 'Job Loss Support Groups and Online Communities',
    description: 'Support groups and communities for people between jobs: free and paid groups, in-person and online, and what to look for in a group that helps your search.',
    h1: 'Job loss support groups',
    what: 'Job loss support groups bring people together to share leads, practice interviews and stay accountable. Many are run by volunteers, churches, associations or career services, and some are online.',
    whoFor: 'People who want company and accountability during a long search.',
    howToChoose: [
      'Check how often the group meets and whether you can sit in on a meeting before you commit.',
      'Check whether members are at your level and in your field.',
      'Check who runs it and whether it is free.',
    ],
    areas: ['community'],
    related: [{ href: '/start/laid-off', label: 'Laid off? Start here' }],
  },
  {
    slug: 'nonprofit-job-search-help',
    label: 'Nonprofit job search and training help',
    categories: ['nonprofit_providers'],
    audience: 'people',
    primary: 'nonprofit job search help',
    secondary: ['free job search help nonprofits', 'free career services for adults', 'nonprofit career training programs', 'job training nonprofits near me'],
    title: 'Nonprofit Job Search and Career Training Help',
    description: 'Nonprofits that offer free job search, career coaching and training: what they provide, who qualifies and how to find a local office near you.',
    h1: 'Nonprofit job search help',
    what: 'Many nonprofits offer free résumé help, coaching, training and job placement, often at local offices. Eligibility varies by program, and some serve everyone and some serve specific groups.',
    whoFor: 'People who want free, in-person or local help, or who need a program with funding attached.',
    howToChoose: [
      'Check who qualifies and what documents you need.',
      'Check what the program provides: coaching, training, placement or referrals alone.',
      'Call the local office to confirm services, since offerings differ by location.',
    ],
    areas: ['coaching', 'benefits'],
    related: [
      { href: '/job-centers', label: 'American Job Centers' },
      { href: '/nonprofits', label: 'Nonprofits' },
    ],
  },
  {
    slug: 'workforce-case-management-software',
    label: 'Workforce board and case management software',
    categories: ['workforce_gov'],
    audience: 'organizations',
    primary: 'workforce case management software',
    secondary: ['case management software for workforce boards', 'workforce board technology vendors', 'career services software for workforce programs'],
    title: 'Workforce Case Management Software Directory',
    description: 'Software for workforce boards and public career services: case management, reporting and career tools. What these systems do and what to ask when you buy one.',
    h1: 'Workforce case management software',
    what: 'Workforce boards and public career services run on case management and reporting software that tracks participants, services and outcomes, plus career tools for the people they serve. Vendors range from long-standing government systems to newer platforms.',
    whoFor: 'Workforce boards, states and career centers choosing or adding software.',
    howToChoose: [
      'Ask how it reports outcomes and whether it matches the funder reporting you owe.',
      'Ask how participant data is stored and who can see it.',
      'Ask how it connects with the systems you already use.',
      'Ask what a participant can use without a caseworker.',
    ],
    areas: ['workforce_system'],
    related: [
      { href: '/workforce-boards', label: 'NextChapter for workforce boards' },
      { href: '/government-workforce', label: 'Government workforce' },
    ],
  },
  {
    slug: 'college-career-services-software',
    label: 'College career services software',
    categories: ['higher_ed'],
    audience: 'organizations',
    primary: 'college career services software',
    secondary: ['career services platforms for universities', 'alumni career platforms', 'university career center software', 'career outcomes software'],
    title: 'College Career Services Software Directory',
    description: 'Career services and alumni platforms for colleges: job boards, appointment tools and outcomes reporting, and the questions to ask before choosing one.',
    h1: 'College career services software',
    what: 'Colleges buy platforms for job and internship boards, appointment scheduling, employer relations, alumni networking and outcomes reporting. Some focus on students, some on alumni, and some on reporting to funders.',
    whoFor: 'Career centers and alumni offices choosing or comparing platforms.',
    howToChoose: [
      'Ask how it handles alumni as well as current students.',
      'Ask how outcomes are counted and whether the method is shown.',
      'Ask what it costs per student or for a flat fee, and what is included.',
      'Ask what a graduate keeps after leaving the school.',
    ],
    areas: ['higher_ed'],
    related: [{ href: '/higher-education', label: 'NextChapter for higher education' }],
  },
]

const BY_SLUG = new Map(NICHES.map((n) => [n.slug, n]))
export const nicheBySlug = (slug: string): Niche | undefined => BY_SLUG.get(slug)

/** The keyword-map clusters for the niche pages and their hub; spread into KEYWORD_CLUSTERS. */
export const NICHES_HUB_CLUSTER = {
  id: 'niches-hub',
  intent: 'See the kinds of job search, career change and layoff support services',
  owner: '/niches',
  kind: 'page' as const,
  primary: 'job search services compared',
  secondary: ['types of job search services', 'career services directory', 'job search companies by type'],
  seo: {
    title: 'Job Search and Career Services by Type',
    description: 'Directories of job search and career services by type: reverse recruiting, outplacement, coaching, bootcamps, tools and more, with what each is and how to choose.',
    h1: 'Job search and career services by type',
  },
}

export const NICHE_CLUSTERS = NICHES.map((n) => ({
  id: `niche-${n.slug}`,
  intent: `Find ${n.label.toLowerCase()}`,
  owner: `/niches/${n.slug}`,
  kind: 'page' as const,
  primary: n.primary,
  secondary: n.secondary,
  seo: { title: n.title, description: n.description, h1: n.h1 },
}))
