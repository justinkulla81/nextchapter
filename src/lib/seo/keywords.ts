// The keyword map: which page owns which search phrases, and the title and description that page sends to search
// engines. docs/seo/keyword-map.md is generated from this file (`npm run seo:keyword-map`); src/test/seo-keyword-map.test.ts
// fails if a phrase has two owners, an owner page does not exist, or a title or description is the wrong length.
//
// Rules (docs/seo/README.md):
//  - One owner per phrase. A phrase two pages could rank for goes to the page that answers it best; the other page
//    links to the owner instead of repeating the phrase in its title.
//  - Titles are written without the " | NextChapter" suffix the root layout adds.
//  - Plain, factual wording. "The leading job transition platform" (POSITIONING) appears once, on the pages that
//    introduce NextChapter (home, about, how it works), not in every description.
//  - Programmatic pages (one per state, employer, job, county...) get their wording from src/lib/seo/templates.ts, which
//    reads the cluster for that family from here.

import type { Metadata } from 'next'
import { SITE_URL } from './facts'
import { titleMeta } from '@/lib/seo/title'
import { fitDescription } from '@/lib/seo/templates'

export interface PageSeo {
  /** Without the " | NextChapter" suffix. 30-56 characters. */
  title: string
  /** 110-165 characters. Starts with the primary phrase's idea, not with "NextChapter is". */
  description: string
  /** The visible H1 when it differs from the page's own headline. Carries the primary phrase. */
  h1?: string
}

export interface KeywordCluster {
  id: string
  /** What a searcher wants. */
  intent: string
  /** The page (or page family, with a :param) that owns every phrase in this cluster. */
  owner: string
  /** One word: how the owner is built. */
  kind: 'page' | 'family'
  /** The phrase the owner's title, H1 and first paragraph are written around. */
  primary: string
  /** Other phrases the owner covers in its headings and copy. */
  secondary: string[]
  /** For a single page: its title and description. Families use templates.ts. */
  seo?: PageSeo
}

// ---------------------------------------------------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------------------------------------------------

export const KEYWORD_CLUSTERS: KeywordCluster[] = [
  // ---- Brand and category ----------------------------------------------------------------------------------------
  {
    id: 'home',
    intent: 'Find help after a layoff or while changing jobs; brand searches',
    owner: '/',
    kind: 'page',
    primary: 'job transition platform',
    secondary: ['job transition', 'job search help', 'free job search tools', 'help finding a job after a layoff', 'white collar job search', 'job search for experienced professionals', 'market reality assessment', 'nextchapter'],
    seo: {
      title: 'NextChapter: Job Search Help After a Layoff or Career Change',
      description:
        'NextChapter is the leading job transition platform for laid-off and career-changing professionals. Free assessment, weekly job search plan and an AI career coach.',
    },
  },
  {
    id: 'about',
    intent: 'Who is NextChapter',
    owner: '/about',
    kind: 'page',
    primary: 'about NextChapter',
    secondary: ['nextchapter company', 'justin kulla', 'job transition company'],
  },
  {
    id: 'careers',
    intent: 'Jobs at NextChapter',
    owner: '/careers',
    kind: 'page',
    primary: 'careers at NextChapter',
    secondary: ['nextchapter jobs', 'work at nextchapter', 'nextchapter openings'],
  },
  {
    id: 'how-it-works',
    intent: 'How the product works',
    owner: '/how-it-works',
    kind: 'page',
    primary: 'how NextChapter works',
    secondary: ['weekly job search plan', 'search sprint', 'job search action plan', 'job search score'],
    seo: {
      title: 'How NextChapter Works: Assessment, Plan and Dossier',
      description:
        'From a Market Reality Assessment to a weekly job search plan and a verified Dossier: how NextChapter, the leading job transition platform, helps you get hired.',
      h1: 'How NextChapter works',
    },
  },
  {
    id: 'faq',
    intent: 'Product questions',
    owner: '/faq',
    kind: 'page',
    primary: 'NextChapter FAQ',
    secondary: ['is nextchapter free', 'nextchapter privacy'],
    seo: {
      title: 'NextChapter FAQ: Plans, Assessment and Privacy',
      description:
        'Answers about NextChapter: what is free for job seekers, how the Market Reality Assessment works, what employers can see, and how matching works.',
      h1: 'NextChapter frequently asked questions',
    },
  },
  {
    id: 'pricing',
    intent: 'What it costs',
    owner: '/pricing',
    kind: 'page',
    primary: 'plans and pricing',
    secondary: ['free job search platform', 'nextchapter plans', 'job search tools free'],
    seo: {
      title: 'Plans and Pricing: Free for Job Seekers',
      description:
        'NextChapter is free for job seekers. See the plans for individuals, colleges, workforce organizations, employers, recruiters and coaches, and what each includes.',
      h1: 'Plans and pricing',
    },
  },
  {
    id: 'contact',
    intent: 'Reach NextChapter',
    owner: '/contact',
    kind: 'page',
    primary: 'contact NextChapter',
    secondary: ['nextchapter support'],
    seo: {
      title: 'Contact NextChapter',
      description: 'Contact NextChapter: job seekers, organizations, coaches, recruiters and press. Email us or tell us what you need and we will reply.',
    },
  },
  {
    id: 'refer',
    intent: 'Send a friend',
    owner: '/refer',
    kind: 'page',
    primary: 'refer someone who was laid off',
    secondary: ['help a friend who lost their job', 'refer a friend job search'],
    seo: {
      title: 'Refer Someone Who Was Laid Off or Is Job Hunting',
      description: 'Someone you care about lost a job or is job hunting. Send them NextChapter, free for job seekers, so they start with a plan instead of a blank page.',
      h1: 'Refer someone who was laid off or is job hunting',
    },
  },

  // ---- Laid off: first steps -------------------------------------------------------------------------------------
  {
    id: 'laid-off',
    intent: 'I was just laid off and want to know what to do',
    owner: '/start/laid-off',
    kind: 'page',
    primary: 'laid off',
    secondary: ['i got laid off', 'just got laid off', 'what to do when you get laid off', 'laid off what now', 'laid off help', 'layoff help', 'laid off professionals', 'after a layoff', 'recently laid off', 'job loss help', 'lost my job'],
    seo: {
      title: 'Laid Off? What to Do Next and a Plan to Get Hired',
      description:
        'Just laid off? Get a free Market Reality Assessment, a weekly job search plan, unemployment and layoff resources, and a community of people going through it too.',
      h1: 'Laid off? A real plan beats another job board.',
    },
  },
  {
    id: 'first-72-hours',
    intent: 'Checklist for the first days after a layoff',
    owner: '/resources/72-hours',
    kind: 'page',
    primary: 'first 72 hours after a layoff',
    secondary: ['layoff checklist', 'job loss checklist', 'what to do first after being laid off', 'first week after layoff', 'what to do after losing your job'],
    seo: {
      title: 'Laid Off? Your First 72 Hours: A Checklist',
      description: 'The first 72 hours after a layoff: what to do, in what order, before the shock wears off and the deadlines start. Unemployment, COBRA, severance, references.',
      h1: 'Laid off? Your first 72 hours.',
    },
  },
  {
    id: 'unemployed',
    intent: 'Job search while out of work',
    owner: '/resources/unemployed',
    kind: 'page',
    primary: 'job search while unemployed',
    secondary: ['unemployed professional', 'unemployed what to do', 'how to look for a job while unemployed', 'how to structure a job search', 'job search routine'],
    seo: {
      title: 'Job Search While Unemployed: What Actually Works',
      description: 'Job search while unemployed: what to do in week one, how to split your time across applications, outreach and visibility, and what works by month three.',
      h1: "Job search while unemployed: what actually works",
    },
  },
  {
    id: 'pre-exit',
    intent: 'Prepare for a layoff or a departure',
    owner: '/resources/pre-exit',
    kind: 'page',
    primary: 'how to prepare for a layoff',
    secondary: ['signs of a layoff', 'about to be laid off', 'before you leave a job', 'preparing to leave a job', 'exit checklist', 'what to take when leaving a job'],
    seo: {
      title: 'Preparing for a Layoff: What to Do Before You Leave',
      description: 'Bracing for a layoff or planning a departure? Secure references, your own data and clarity on what you can take while you still have access. A checklist.',
      h1: 'Preparing for a layoff: what to do before you leave',
    },
  },
  {
    id: 'severance',
    intent: 'Understand and negotiate a severance package',
    owner: '/topics/severance',
    kind: 'page',
    primary: 'severance package',
    secondary: ['severance pay', 'severance agreement', 'severance negotiation', 'how to negotiate severance', 'what is severance', 'severance and unemployment', 'is severance required', 'how much severance', 'layoff package'],
    seo: {
      title: 'Severance Package: What It Is and How to Negotiate',
      description: 'What a severance package usually includes, what is negotiable, how severance affects unemployment benefits and health coverage, and what to check before you sign.',
    },
  },
  {
    id: 'cobra-aca',
    intent: 'Compare COBRA with an ACA Marketplace plan after a job loss',
    owner: '/resources/cobra-aca',
    kind: 'page',
    primary: 'health insurance after a layoff: COBRA vs. marketplace',
    secondary: ['cobra', 'cobra vs aca', 'cobra or aca', 'aca vs cobra', 'cobra vs obamacare', 'cobra or obamacare', 'cobra vs affordable care act', 'cobra vs marketplace', 'which is better cobra or marketplace', 'is aca cheaper than cobra', 'health insurance after layoff', 'health insurance after job loss', 'aca marketplace after job loss', 'special enrollment period', 'cobra deadline', 'cobra cost'],
    seo: {
      title: 'COBRA vs ACA After a Layoff: Which Costs Less?',
      description: 'COBRA or the ACA Marketplace after a layoff: how the cost compares, the 60-day deadlines, the 2026 and 2027 subsidy rules and Medicaid, with a free calculator.',
      h1: 'COBRA vs ACA: health insurance after a layoff',
    },
  },
  {
    id: 'cobra-aca-state',
    intent: 'Compare COBRA with an ACA Marketplace plan in one state',
    owner: '/resources/cobra-aca/:state',
    kind: 'family',
    primary: 'cobra vs aca in {state}',
    secondary: ['is aca cheaper than cobra in {state}', 'cobra vs aca cost {state}', '{state} cobra vs marketplace', 'can i get aca instead of cobra in {state}', '{state} health insurance after a layoff'],
  },
  {
    id: 'cobra-aca-calculator',
    intent: 'Work out what COBRA and a Marketplace plan would each cost me',
    owner: '/tools/cobra-vs-aca-calculator',
    kind: 'page',
    primary: 'cobra vs aca calculator',
    secondary: ['cobra vs aca cost calculator', 'cobra or marketplace cost calculator', 'aca subsidy calculator after layoff', 'how much is health insurance after a layoff'],
    seo: {
      title: 'COBRA vs ACA Calculator: What You Would Pay',
      description: 'Free COBRA vs ACA calculator: enter your COBRA quote and household income to see the Marketplace cost after the premium tax credit, with your deadlines.',
      h1: 'COBRA vs ACA cost calculator',
    },
  },
  {
    id: 'bridge-income',
    intent: 'Earn while searching',
    owner: '/resources/bridge-income',
    kind: 'page',
    primary: 'bridge income',
    secondary: ['income while job searching', 'interim jobs', 'contract work after layoff', 'freelance after layoff', 'consulting after layoff', 'side income after layoff'],
    seo: {
      title: 'Bridge Income While Job Searching: Interim Work',
      description: 'Ways to earn while you search without derailing the search: fractional work, interim roles and contract work, and how to weigh the tradeoffs.',
      h1: 'Bridge income while you search',
    },
  },
  {
    id: 'funding',
    intent: 'Money to relocate, retrain or study after a job loss',
    owner: '/funding',
    kind: 'page',
    primary: 'funding for laid-off workers',
    secondary: ['relocation assistance', 'retraining grants', 'training grants for laid off workers', 'tuition assistance after layoff', 'displaced worker programs', 'free courses for job seekers', 'wioa training funds', 'reskilling funding'],
    seo: {
      title: 'Funding for Laid-Off Workers: Relocate, Retrain, Study',
      description: 'Relocation grants, tuition aid, federal training money and free courses for laid-off workers, ranked for you. Join NextChapter free to see what you qualify for.',
    },
  },

  // ---- Unemployment benefits -------------------------------------------------------------------------------------
  {
    id: 'unemployment-hub',
    intent: 'Unemployment insurance rules across states',
    owner: '/unemployment-benefits',
    kind: 'page',
    primary: 'unemployment benefits by state',
    secondary: ['unemployment benefits', 'unemployment insurance', 'how to file for unemployment', 'apply for unemployment', 'unemployment eligibility', 'weekly unemployment benefit amount', 'maximum unemployment benefit by state', 'how long does unemployment last', 'unemployment waiting week', 'does severance affect unemployment'],
    seo: {
      title: 'Unemployment Benefits by State: Amounts and How to File',
      description: 'Unemployment benefits in every state and DC: the maximum and minimum weekly benefit, how many weeks, the waiting week, how severance counts, and where to file.',
    },
  },
  {
    id: 'unemployment-state',
    intent: 'Unemployment benefits in one state',
    owner: '/unemployment-benefits/:state',
    kind: 'family',
    primary: '{state} unemployment benefits',
    secondary: ['{state} unemployment', 'file for unemployment in {state}', '{state} weekly unemployment benefit', '{state} unemployment eligibility', '{state} unemployment weeks'],
  },

  // ---- Layoff tracking -------------------------------------------------------------------------------------------
  {
    id: 'layoffs-hub',
    intent: 'Which companies are laying off, and where',
    owner: '/layoffs',
    kind: 'page',
    primary: 'layoff tracker',
    secondary: ['layoffs', 'recent layoffs', 'layoffs today', 'layoffs 2026', 'companies laying off', 'layoff list', 'mass layoffs', 'WARN notices', 'WARN notice list', 'WARN Act layoffs', 'who is laying off'],
    seo: {
      title: 'Layoff Tracker: Recent Layoffs and WARN Notices by State',
      description: 'Recent layoffs from WARN Act notices filed with state labor departments, collected daily: totals, the latest filings, and a page for every state and employer.',
    },
  },
  {
    id: 'layoffs-this-week',
    intent: 'Layoff notices filed in the last seven days',
    owner: '/layoffs/this-week',
    kind: 'page',
    primary: 'layoffs this week',
    secondary: ['layoffs this week 2026', 'recent layoff notices', 'new WARN notices this week', 'latest layoff announcements'],
    seo: {
      title: 'Layoffs This Week: New WARN Notices by State',
      description: 'Layoff notices filed in the last seven days: how many workers, which states and employers, with the state record for each. Updated every day.',
      h1: 'Layoffs this week: new WARN notices',
    },
  },
  {
    id: 'layoffs-by-week',
    intent: 'Layoff notices week by week',
    owner: '/layoffs/week',
    kind: 'page',
    primary: 'layoffs by week',
    secondary: ['weekly layoffs', 'weekly layoff report', 'layoffs last week', 'WARN notices by week'],
    seo: {
      title: 'Layoffs by Week: WARN Notices, Week by Week',
      description: 'Every week of WARN layoff notices from the last two years: how many notices and workers, which states and employers, with the state record for each.',
      h1: 'Layoffs by week: WARN notices',
    },
  },
  {
    id: 'layoffs-week',
    intent: 'Layoffs in one calendar week',
    owner: '/layoffs/week/:week',
    kind: 'family',
    primary: 'layoffs week of {date}',
    secondary: ['layoffs {week}', 'WARN notices week of {date}'],
  },
  {
    id: 'layoff-data',
    intent: 'Download layoff data',
    owner: '/data',
    kind: 'page',
    primary: 'layoff data download',
    secondary: ['WARN notices csv', 'WARN notice data', 'layoff data by state', 'layoffs dataset'],
    seo: {
      title: 'Layoff Data Download: WARN Notices as CSV and JSON',
      description: 'Download every WARN Act layoff notice of the last 24 months as CSV or JSON, by state or all states, free to reuse with a link back.',
      h1: 'Layoff data: download the WARN record',
    },
  },
  {
    id: 'embed-widgets',
    intent: 'Embed layoff, jobs and benefits widgets',
    owner: '/data/embed',
    kind: 'page',
    primary: 'layoff widget for website',
    secondary: ['embed layoff tracker', 'unemployment benefits widget', 'jobs widget by industry'],
    seo: {
      title: 'Free Layoff, Jobs and Benefits Widgets for Your Site',
      description: 'Add live layoff notices, open jobs by industry or state unemployment benefits widgets to your website with one copy-paste snippet. Free, with a link back.',
      h1: 'Embeddable layoff, jobs and benefits widgets',
    },
  },
  {
    id: 'layoffs-state',
    intent: 'Layoffs in one state',
    owner: '/layoffs/:state',
    kind: 'family',
    primary: '{state} layoffs',
    secondary: ['{state} WARN notices', '{state} layoff list', 'recent layoffs in {state}', '{state} companies laying off'],
  },
  {
    id: 'layoffs-company',
    intent: 'Layoffs at one employer',
    owner: '/layoffs/company/:slug',
    kind: 'family',
    primary: '{company} layoffs',
    secondary: ['{company} WARN notice', '{company} layoff dates', '{company} layoff 2026'],
  },
  {
    id: 'network-company',
    intent: 'What happens to workers laid off from one employer',
    owner: '/network/company/:slug',
    kind: 'family',
    primary: '{company} laid-off workers',
    secondary: ['former {company} employees', '{company} laid off employees jobs', '{company} severance and benefits', '{company} alumni'],
  },
  {
    id: 'warn-act',
    intent: 'Employer asks whether WARN notice is required',
    owner: '/tools/warn-act-checker',
    kind: 'page',
    primary: 'WARN Act checker',
    secondary: ['WARN Act', 'WARN Act requirements', 'WARN Act 60 day notice', 'WARN Act calculator', 'mass layoff notice', 'reduction in force notice', 'plant closing notice', 'do I need to give WARN notice'],
    seo: {
      title: 'WARN Act Checker: Is 60 Days’ Notice Required?',
      description: 'A free WARN Act calculator for employers. Enter your headcount and the number of jobs being cut to see whether federal 60-day notice is likely required.',
    },
  },
  {
    id: 'rapid-response-hub',
    intent: 'Employer planning a layoff looks for state support',
    owner: '/rapid-response',
    kind: 'page',
    primary: 'rapid response layoff services',
    secondary: ['rapid response', 'rapid response team', 'layoff aversion', 'layoff support for employers', 'plan a layoff', 'state rapid response coordinator'],
    seo: {
      title: 'Rapid Response and Layoff Support for Employers by State',
      description: 'Planning a layoff? Find your state’s rapid response team, workforce boards and American Job Centers, the federal WARN Act rules, and a free calculator for notice.',
    },
  },
  {
    id: 'rapid-response-state',
    intent: 'Employer layoff support in one state',
    owner: '/rapid-response/:state',
    kind: 'family',
    primary: '{state} rapid response layoff support',
    secondary: ['{state} rapid response', '{state} layoff support for employers', '{state} WARN Act'],
  },
  {
    id: 'news',
    intent: 'Layoff and job-market news',
    owner: '/news',
    kind: 'page',
    primary: 'layoff and job market news',
    secondary: ['layoff news', 'hiring news', 'job market news', 'AI layoffs news', 'labor market news'],
    seo: {
      title: 'Layoff and Job Market News',
      description: 'Articles, videos, podcasts and posts on layoffs, hiring and the job market, picked by NextChapter, with what each means for people looking for work.',
      h1: 'Layoff and job market news',
    },
  },

  // ---- Reports and data ------------------------------------------------------------------------------------------
  {
    id: 'reports-hub',
    intent: 'White-collar job market data',
    owner: '/reports',
    kind: 'page',
    primary: 'white collar employment report',
    secondary: ['white collar jobs report', 'white collar job market', 'job market report', 'professional jobs report', 'hiring trends', 'job market 2026', 'unemployment rate for professionals'],
    seo: {
      title: 'White Collar Employment Report: Jobs, Hiring, Search Length',
      description: 'A monthly, independent read on the U.S. white-collar job market: hiring, job changes, how long searches take, AI and what public programs are adding.',
    },
  },
  {
    id: 'search-length',
    intent: 'How long does a job search take',
    owner: '/reports/white-collar-index',
    kind: 'page',
    primary: 'how long a job search takes',
    secondary: ['average job search length', 'how long to find a job', 'long search index', 'time to hire white collar'],
    seo: {
      title: 'How Long Does a Job Search Take? White-Collar Search Index',
      description: 'How long white-collar job searches are taking right now, by month and level, from live postings and published labor data. Updated with each report.',
    },
  },
  {
    id: 'early-warning',
    intent: 'Are graduates and entry-level workers being hit',
    owner: '/reports/early-warning',
    kind: 'page',
    primary: 'young graduates unemployment',
    secondary: ['recent graduate unemployment rate', 'entry level jobs and AI', 'AI layoffs', 'early warning labor indicators', 'AI job cuts by country'],
    seo: {
      title: 'Young Graduates and AI: Early-Warning Labor Indicators',
      description: 'Are young graduates the canary? Unemployment for recent graduates, entry-level hiring and AI-attributed job cuts by country, tracked against earlier downturns.',
    },
  },
  {
    id: 'ai-skills',
    intent: 'AI skills in demand and what they pay',
    owner: '/ai-skills',
    kind: 'page',
    primary: 'AI skills in job postings',
    secondary: ['AI jobs', 'AI skills salary premium', 'AI skills by function', 'in-demand AI skills', 'which jobs need AI skills', 'AI-proof careers', 'careers that use AI skills', 'AI jobs pay'],
    seo: {
      title: 'AI Skills in Job Postings: How Common and What They Pay',
      description: 'Which jobs ask for AI skills, how much more those postings advertise, and what research says about seniority. Measured on live U.S. job postings, limits stated.',
    },
  },
  {
    id: 'ai-training',
    intent: 'Organizations buying AI upskilling',
    owner: '/ai-training',
    kind: 'page',
    primary: 'AI training for workforce programs',
    secondary: ['AI upskilling', 'AI reskilling', 'AI courses for laid off workers', 'AI training for colleges', 'AI training for employers', 'AI skills gap'],
    seo: {
      title: 'AI Training for Colleges, Workforce Boards and Employers',
      description: 'NextChapter measures the AI-skill gap for the people you serve and builds short courses that close it, for the budgets and grants that already pay for training.',
    },
  },

  // ---- Job search ------------------------------------------------------------------------------------------------
  {
    id: 'jobs-hub',
    intent: 'Find open jobs',
    owner: '/jobs',
    kind: 'page',
    primary: 'job search',
    secondary: ['find jobs', 'job board', 'white collar jobs', 'professional jobs', 'executive jobs', 'senior level jobs', 'remote professional jobs', 'jobs with salary', 'manager jobs', 'director jobs'],
    seo: {
      title: 'Job Search: Live Professional Jobs, Checked Open',
      description: 'Search live professional and executive jobs taken from employers’ own career sites and checked to still be open. Filter by location and remote.',
      h1: 'Job search: live professional jobs',
    },
  },
  {
    id: 'job-page',
    intent: 'One specific opening',
    owner: '/jobs/:id',
    kind: 'family',
    primary: '{job title} jobs at {company}',
    secondary: ['{job title} {city}', '{company} {job title} salary', '{job title} remote'],
  },
  {
    id: 'employer-page',
    intent: 'Jobs and pay at one employer',
    owner: '/employers/:slug',
    kind: 'family',
    primary: '{company} jobs',
    secondary: ['{company} salaries', '{company} open roles', '{company} hiring', '{company} careers openings'],
  },
  {
    id: 'job-search-strategy',
    intent: 'How to run a job search',
    owner: '/topics/job-search-strategy',
    kind: 'page',
    primary: 'job search strategy',
    secondary: ['career search', 'how to search for a job', 'job search tips', 'job search plan', 'job search tracker', 'job hunting'],
    seo: {
      title: 'Job Search Strategy: A Weekly Plan That Gets Interviews',
      description: 'How to run a job search as a project: set a weekly plan, split time across applications, outreach and visibility, track results and change the plan when it stalls.',
    },
  },
  {
    id: 'why-stuck',
    intent: 'Why is my search not working',
    owner: '/why-stuck',
    kind: 'page',
    primary: 'why your job search isn’t working',
    secondary: ['why cant i find a job', 'not getting interviews', 'applications going nowhere', 'ghosted after applying', 'ats rejection', 'hard to find a job right now'],
    seo: {
      title: 'Why Your Job Search Isn’t Working (and What to Change)',
      description: 'Job searching is hard right now and most of it happens before a person sees your name. Why you aren’t getting interviews, and what to change this week.',
      h1: 'Why your job search isn’t working',
    },
  },
  {
    id: 'searching-too-long',
    intent: 'Search has dragged on for months',
    owner: '/start/searching-too-long',
    kind: 'page',
    primary: 'job search taking too long',
    secondary: ['been looking for a job for months', 'long-term unemployed', 'job search stalled', 'unemployed for a year'],
    seo: {
      title: 'Job Search Taking Too Long? Change the Plan',
      description: 'Months into a job search and nothing is moving? Find what is stalling it, change the plan and get a weekly list of new things to try. Free to start.',
      h1: 'Job search taking too long? Change the plan.',
    },
  },
  {
    id: 'gatekeeper',
    intent: 'Get past recruiters and resume screening',
    owner: '/resources/gatekeeper',
    kind: 'page',
    primary: 'getting past ATS screens and recruiters',
    secondary: ['applicant tracking system', 'ATS resume', 'resume screening', 'how recruiters screen resumes', 'get an interview', 'getting past the gatekeeper'],
    seo: {
      title: 'Getting Past ATS Screens and Recruiters to the Interview',
      description: 'How recruiters, ATS resume screeners and hiring managers actually work, and what it takes to move from an application in a queue to an interview.',
      h1: 'Getting past ATS screens and recruiters',
    },
  },
  {
    id: 'resume',
    intent: 'Write or fix a resume',
    owner: '/topics/resume-tips',
    kind: 'page',
    primary: 'resume tips for experienced professionals',
    secondary: ['resume help', 'resume after layoff', 'executive resume', 'resume writing', 'resume summary', 'how to write a resume'],
    seo: {
      title: 'Resume Tips for Experienced Professionals After a Layoff',
      description: 'What a resume has to do for an experienced professional: lead with results, explain a layoff or gap in one line, pass the screen and set up the interview.',
    },
  },
  {
    id: 'dossier',
    intent: 'Proof of work beyond a resume',
    owner: '/dossier',
    kind: 'page',
    primary: 'executive dossier',
    secondary: ['professional portfolio', 'proof of work', 'verified references', 'career portfolio', 'resume alternative', 'candidate evidence'],
    seo: {
      title: 'Executive Dossier: Proof of Your Work, Beyond a Resume',
      description: 'The Executive Dossier shows how you work, backed by the people who worked with you. What it contains, who sees it, and what you keep.',
    },
  },
  {
    id: 'membership',
    intent: 'Keep a profile current between jobs',
    owner: '/membership',
    kind: 'page',
    primary: 'membership between jobs',
    secondary: ['keep your dossier current', 'alumni membership', 'career maintenance'],
    seo: {
      title: 'Membership: Keep Your Dossier Current Between Jobs',
      description: 'Your Dossier stays alive after you land. Membership keeps your evidence current so you are ready the next time you search.',
    },
  },
  {
    id: 'interview-prep',
    intent: 'Prepare for interviews',
    owner: '/resources/interview-prep',
    kind: 'page',
    primary: 'interview prep',
    secondary: ['how to prepare for an interview', 'behavioral interview', 'phone screen', 'final round interview', 'executive interview'],
    seo: {
      title: 'Interview Prep for Experienced Professionals, Stage by Stage',
      description: 'How to prepare for interviews at every stage, from the phone screen to the final round, and what changes as you move through the process.',
      h1: 'Interview prep, from phone screen to final round',
    },
  },
  {
    id: 'post-interview',
    intent: 'What to do after an interview',
    owner: '/resources/post-interview',
    kind: 'page',
    primary: 'follow up after an interview',
    secondary: ['thank you email after interview', 'interview thank you note', 'waiting to hear back', 'second interview follow up'],
    seo: {
      title: 'Follow Up After an Interview: Thank-You Note and the Wait',
      description: 'What to do in the 24 to 48 hours after an interview: the thank-you note that stands out, how to follow up, and how to handle the wait.',
      h1: 'How to follow up after an interview',
    },
  },
  {
    id: 'offer-letter',
    intent: 'Read and negotiate an offer',
    owner: '/resources/offer-letter',
    kind: 'page',
    primary: 'how to negotiate a job offer',
    secondary: ['salary negotiation', 'offer letter', 'total compensation', 'negotiation script', 'job offer red flags', 'counteroffer'],
    seo: {
      title: 'Job Offer Letter: How to Read and Negotiate It',
      description: 'A total-comp breakdown, salary negotiation scripts and the red flags to catch before you sign: everything an offer letter does not say outright.',
      h1: 'Job offer letter: read it, then negotiate it',
    },
  },
  {
    id: 'first-90-days',
    intent: 'Start well in a new job',
    owner: '/resources/first-90-days',
    kind: 'page',
    primary: 'first 90 days in a new job',
    secondary: ['new job first 90 days plan', 'starting a new role', 'onboarding yourself', 'first month at a new job'],
    seo: {
      title: 'Your First 90 Days in a New Job: What to Prioritize',
      description: 'How to start strong in a new role: what to prioritize in the first month, and the mistakes that quietly cost people in their first quarter.',
      h1: 'Your first 90 days in a new job',
    },
  },
  {
    id: 'resources-hub',
    intent: 'Browse job search and layoff guides',
    owner: '/resources',
    kind: 'page',
    primary: 'job search and layoff guides',
    secondary: ['job search guides', 'layoff guides', 'career guides', 'free job search resources'],
    seo: {
      title: 'Job Search and Layoff Guides: Free, From Day One to Day 90',
      description: 'Free guides for every stage of a job search after a layoff, from your first 72 hours to your first 90 days in a new job: benefits, networking, interviews, offers.',
      h1: 'Job search and layoff guides',
    },
  },

  // ---- Networking and brand --------------------------------------------------------------------------------------
  {
    id: 'network-activation',
    intent: 'Use your network in a search',
    owner: '/resources/network-activation',
    kind: 'page',
    primary: 'how to network when you’re job searching',
    secondary: ['networking for job seekers', 'informational interview', 'reconnect with contacts', 'networking without feeling awkward', 'job search networking'],
    seo: {
      title: 'How to Network When You’re Job Searching',
      description: 'How to turn your existing contacts into real conversations without it feeling like you only reach out when you need something. Who to contact first.',
      h1: 'How to network when you’re job searching',
    },
  },
  {
    id: 'network-scripts',
    intent: 'Message templates for outreach',
    owner: '/resources/network-scripts',
    kind: 'page',
    primary: 'networking email and message scripts',
    secondary: ['networking message templates', 'cold outreach linkedin message', 'reach out to a former colleague', 'ask for an introduction', 'referral request template'],
    seo: {
      title: 'Networking Email and LinkedIn Message Scripts for Job Seekers',
      description: 'Scripts for every kind of outreach, cold, warm and in between, so you never start a networking message from a blank page.',
      h1: 'Networking email and message scripts',
    },
  },
  {
    id: 'ask-for-help',
    intent: 'Ask people for help in a search',
    owner: '/resources/ask-for-help',
    kind: 'page',
    primary: 'how to ask for help with your job search',
    secondary: ['asking for job leads', 'tell people you were laid off', 'how to tell friends you lost your job', 'ask for referrals'],
    seo: {
      title: 'How to Ask for Help With Your Job Search',
      description: 'Why asking for help works and how to do it without it feeling awkward: the reframe that makes outreach easier before you send a single message.',
      h1: 'How to ask for help with your job search',
    },
  },
  {
    id: 'narrative',
    intent: 'Tell your career story',
    owner: '/resources/narrative-workshop',
    kind: 'page',
    primary: 'your career story: tell me about yourself',
    secondary: ['career story', 'personal pitch', 'elevator pitch', 'how to explain a layoff', 'personal narrative for job search'],
    seo: {
      title: 'Your Career Story: Answer “Tell Me About Yourself”',
      description: 'A workshop for building the one story you tell about your career, the version that works the same on a resume, in an interview and in a networking conversation.',
      h1: 'Your career story: answer “tell me about yourself”',
    },
  },
  {
    id: 'thought-leadership',
    intent: 'Build visibility during a search',
    owner: '/resources/thought-leadership',
    kind: 'page',
    primary: 'thought leadership for job seekers',
    secondary: ['thought leadership', 'linkedin posts for job seekers', 'personal brand', 'get noticed by recruiters', 'linkedin profile'],
    seo: {
      title: 'Thought Leadership for Job Seekers: Build a Presence',
      description: 'How to write and share thought leadership content that gets noticed by recruiters and hiring managers, without it feeling like self-promotion. A guide.',
      h1: 'Build a professional presence with thought leadership',
    },
  },

  // ---- Career change, pivot, exploration -------------------------------------------------------------------------
  {
    id: 'career-change',
    intent: 'Move to a new field',
    owner: '/start/career-change',
    kind: 'page',
    primary: 'career change',
    secondary: ['changing careers', 'how to change careers', 'switch careers', 'career switch', 'new career path', 'career change plan', 'career transition'],
    seo: {
      title: 'Career Change: A New Field Is a Plan, Not a Leap',
      description: 'Changing careers? Get a free Market Reality Assessment of how the market reads your background, which roles fit, and a weekly plan to move into a new field.',
      h1: 'Career change: a new field is a plan, not a leap',
    },
  },
  {
    id: 'career-pivot',
    intent: 'Pivot from one role or industry to a related one',
    owner: '/topics/career-pivot',
    kind: 'page',
    primary: 'career pivot',
    secondary: ['job pivot', 'how to pivot careers', 'pivot to a new industry', 'career pivot examples', 'transferable skills', 'pivot your career', 'professional pivot'],
    seo: {
      title: 'Career Pivot: How to Move to a New Role or Industry',
      description: 'A career pivot keeps what you already do well and points it at a new role or industry. How to find the pivot, prove the skills transfer and make the move.',
    },
  },
  {
    id: 'career-exploration',
    intent: 'Figure out what to do next',
    owner: '/topics/career-exploration',
    kind: 'page',
    primary: 'career exploration',
    secondary: ['explore careers', 'career options', 'what career is right for me', 'career path ideas', 'what should I do next in my career', 'careers for experienced professionals', 'explore new careers'],
    seo: {
      title: 'Career Exploration: Find Your Next Direction',
      description: 'Career exploration for experienced professionals: use your work history to find roles you can move into, see what each pays and requires, and test them first.',
    },
  },
  {
    id: 'thinking-about-a-move',
    intent: 'Considering a change before anything happens',
    owner: '/start/thinking-about-a-move',
    kind: 'page',
    primary: 'thinking about leaving my job',
    secondary: ['should I leave my job', 'know my market value', 'confidential job search', 'quietly looking for a job', 'am I underpaid', 'sensing a layoff'],
    seo: {
      title: 'Thinking About Leaving Your Job? Know Your Market First',
      description: 'Curious, unhappy or sensing a layoff? See how the market reads you and what you are worth, privately, before anyone at work knows you looked. Free.',
      h1: 'Thinking about leaving your job? Know your market first.',
    },
  },
  {
    id: 'managing-my-career',
    intent: 'Manage a career while employed',
    owner: '/start/managing-my-career',
    kind: 'page',
    primary: 'career management',
    secondary: ['career growth plan', 'stay employable', 'layoff-proof your career', 'prepare for performance review', 'ask for a raise'],
    seo: {
      title: 'Career Management: Make the Job You Have a Stronger One',
      description: 'You are not leaving, and you still should not coast. Know your worth, build skills that hold up in a downturn and prepare for reviews and raise conversations.',
      h1: 'Career management: make the job you have a stronger one',
    },
  },
  {
    id: 'resigned',
    intent: 'Left a job without another lined up',
    owner: '/start/resigned',
    kind: 'page',
    primary: 'quit without another job lined up',
    secondary: ['resigned no job lined up', 'after quitting my job', 'left my job to find a better one'],
    seo: {
      title: 'Quit Without Another Job Lined Up? Make It Pay Off',
      description: 'You made the hard call. Close the gap fast with a structured search, a weekly plan and reference-backed proof of what you bring. Free to start.',
      h1: 'Quit without another job lined up? Make it pay off.',
    },
  },
  {
    id: 'returning',
    intent: 'Return to work after a gap',
    owner: '/start/returning',
    kind: 'page',
    primary: 'return to work after a career break',
    secondary: ['returning to work', 'resume gap', 'career gap', 'back to work after caregiving', 'returnship'],
    seo: {
      title: 'Returning to Work After a Career Gap or Break',
      description: 'A gap on your resume isn’t the whole story. Come back with your value clearly proven: a plan, a profile and references that show what you can do now.',
      h1: 'Returning to work after a career gap',
    },
  },
  {
    id: 'promotion',
    intent: 'Ask for a promotion',
    owner: '/start/promotion',
    kind: 'page',
    primary: 'how to ask for a promotion',
    secondary: ['promotion conversation', 'get promoted', 'build the case for a promotion', 'promotion or new job'],
    seo: {
      title: 'How to Ask for a Promotion: Walk In With Proof',
      description: 'Build the case for the next level, inside your company or outside it. Know your market, gather evidence and prepare the promotion conversation.',
      h1: 'How to ask for a promotion: walk in with proof',
    },
  },
  {
    id: 'new-grad',
    intent: 'First job after school',
    owner: '/start/new-grad',
    kind: 'page',
    primary: 'new grad job search',
    secondary: ['first job after college', 'entry level jobs', 'recent graduate jobs', 'first job search', 'graduate career plan'],
    seo: {
      title: 'New Grad Job Search: A Plan, Not a Pile of Applications',
      description: 'Starting your career? Get a plan for your first job or internship and a strong first year, instead of a pile of applications. Free to start.',
      h1: 'New grad job search: a plan, not a pile of applications',
    },
  },
  {
    id: 'next-act',
    intent: 'Board, consulting or part-time work later in a career',
    owner: '/start/next-act',
    kind: 'page',
    primary: 'next act career',
    secondary: ['encore career', 'second act career', 'board seats', 'consulting after a corporate career', 'part-time professional work', 'package your experience'],
    seo: {
      title: 'Next Act Career: Board, Consulting and Part-Time Work',
      description: 'Your experience is the product. Package it for board, fractional, consulting or part-time work that fits the next stage of your career.',
      h1: 'Next act career: package your experience',
    },
  },
  {
    id: 'taking-a-break',
    intent: 'Step away and return',
    owner: '/start/taking-a-break',
    kind: 'page',
    primary: 'career break',
    secondary: ['sabbatical', 'family leave and career', 'step away from work', 'time off between jobs'],
    seo: {
      title: 'Career Break or Sabbatical: Plan the Time Away',
      description: 'Family leave, time off or a sabbatical? Plan the break, keep your profile and network warm, and come back ready to work. Free to start.',
      h1: 'Career break or sabbatical: step away without losing your footing',
    },
  },
  {
    id: 'fractional',
    intent: 'Fractional and consulting work',
    owner: '/start/happy-with-fractional-work',
    kind: 'page',
    primary: 'fractional work',
    secondary: ['fractional executive', 'interim executive', 'portfolio career', 'independent consulting', 'keep a consulting practice full'],
    seo: {
      title: 'Fractional Work: Run Your Portfolio Like a Business',
      description: 'Happy with fractional, interim or consulting work? Keep your calendar full with a pipeline, proof of results and a profile clients can trust.',
      h1: 'Fractional work: run your portfolio like a business',
    },
  },
  {
    id: 'building-something',
    intent: 'Start something on the side',
    owner: '/start/building-something',
    kind: 'page',
    primary: 'starting something while you keep your job',
    secondary: ['side business', 'startup while keeping your job', 'start a company', 'leave a job to start a company'],
    seo: {
      title: 'Starting Something While You Keep Your Job',
      description: 'Building a business or project on the side? Keep your job, your footing and your options open while you start something of your own.',
      h1: 'Starting something while you keep your job',
    },
  },

  {
    id: 'topics-hub',
    intent: 'Browse job search and career topics',
    owner: '/topics',
    kind: 'page',
    primary: 'job search and career change topics',
    secondary: ['career topics', 'layoff topics', 'job search questions'],
    seo: {
      title: 'Job Search, Career Change and Layoff Topics',
      description: 'Plain answers on severance, resumes, job search strategy, career pivots, career exploration, executive recruiters and reverse recruiters.',
      h1: 'Job search, career change and layoff topics',
    },
  },

  // ---- Free tools and definitions --------------------------------------------------------------------------------
  {
    id: 'tools-hub',
    intent: 'Free calculators and lookups for job seekers',
    owner: '/tools',
    kind: 'page',
    primary: 'free job search and layoff tools',
    secondary: ['free job search tools online', 'layoff tools', 'job loss calculator', 'free career tools'],
    seo: {
      title: 'Free Job Search and Layoff Tools',
      description: 'Free calculators and lookups for people who lost a job or plan a move: severance calculator, unemployment benefits by state, layoff tracker, WARN Act checker.',
      h1: 'Free job search and layoff tools',
    },
  },
  {
    id: 'severance-calculator',
    intent: 'Work out a severance figure',
    owner: '/tools/severance-calculator',
    kind: 'page',
    primary: 'severance calculator',
    secondary: ['severance pay calculator', 'how much severance should I get', 'severance by years of service', 'severance weeks per year', 'severance estimate'],
    seo: {
      title: 'Severance Calculator: Pay by Years of Service',
      description: 'Free severance calculator: enter your pay and years of service to see the common one-to-two weeks per year range, and what paid health coverage adds.',
      h1: 'Severance calculator',
    },
  },
  {
    id: 'salary-converter',
    intent: 'Convert hourly pay to a yearly salary',
    owner: '/tools/salary-converter',
    kind: 'page',
    primary: 'salary converter',
    secondary: ['hourly to salary calculator', 'hourly to yearly', 'salary to hourly', 'annual salary to hourly wage', 'hourly rate to annual salary'],
    seo: {
      title: 'Salary Converter: Hourly to Yearly Pay and Back',
      description: 'Free salary converter: turn hourly pay into yearly, monthly, weekly and daily pay, or the reverse, with hours and weeks you can change for any schedule.',
      h1: 'Salary converter: hourly to yearly and back',
    },
  },
  {
    id: 'layoff-runway',
    intent: 'Work out how long money lasts after a layoff',
    owner: '/tools/layoff-runway',
    kind: 'page',
    primary: 'layoff runway calculator',
    secondary: ['how long will my savings last after a layoff', 'savings runway calculator', 'how many months of savings do I need', 'job loss budget calculator'],
    seo: {
      title: 'Layoff Runway: How Long Will Your Money Last?',
      description: 'Free calculator: enter savings, monthly spending and severance to see how many months they cover, and what your state’s unemployment benefits add.',
      h1: 'Layoff runway: how long your money will last',
    },
  },
  {
    id: 'unemployment-estimator',
    intent: 'Estimate unemployment benefits',
    owner: '/tools/unemployment-estimator',
    kind: 'page',
    primary: 'unemployment benefit estimator',
    secondary: ['unemployment calculator', 'how much unemployment will I get', 'unemployment benefits calculator by state', 'estimate unemployment pay'],
    seo: {
      title: 'Unemployment Benefit Estimator: How Much Will You Get?',
      description: 'Pick your state and enter your pay for a planning estimate of your weekly unemployment benefit, the weeks it can last and the most you could receive.',
      h1: 'Unemployment benefit estimator: about how much you could get',
    },
  },
  {
    id: 'layoff-deadlines',
    intent: 'Find the dates that matter after a layoff',
    owner: '/tools/layoff-deadlines',
    kind: 'page',
    primary: 'deadlines after a layoff',
    secondary: ['layoff deadlines', 'cobra deadline after layoff', 'when to file for unemployment after layoff', 'what to do after being laid off by when', 'layoff checklist dates'],
    seo: {
      title: 'Layoff Deadlines: What to Do and By When',
      description: 'Free layoff deadline tool: enter your last day to see when to file for unemployment and when the usual 60-day COBRA and Marketplace windows run out.',
      h1: 'Layoff deadlines: what to do and by when',
    },
  },
  {
    id: 'pay-check',
    intent: 'Check whether a salary is in line for a job title',
    owner: '/tools/pay-check',
    kind: 'page',
    primary: 'am i paid fairly',
    secondary: ['is my salary fair', 'salary check by job title', 'compare my salary to market', 'pay check tool'],
    seo: {
      title: 'Pay Check: Am I Paid Fairly for My Job Title?',
      description: 'Free pay check: enter your job title and yearly pay to see where it sits against the range employers list today, with the median and the middle half.',
      h1: 'Pay check: is your salary in line?',
    },
  },
  {
    id: 'resume-check',
    intent: 'Score my resume with a free tool',
    owner: '/tools/resume-check',
    kind: 'page',
    primary: 'free resume check',
    secondary: ['resume checker', 'resume score', 'check my resume', 'free resume score', 'resume analyzer'],
    seo: {
      title: 'Free Resume Check: Score Your Resume Out of 100',
      description: 'Paste your resume to get a free score out of 100 and see how many fixes it needs. Rule-based, no AI, and we do not save your resume.',
      h1: 'Free resume check: score your resume in a minute',
    },
  },
  {
    id: 'glossary',
    intent: 'Define a layoff or job search term',
    owner: '/glossary',
    kind: 'page',
    primary: 'layoff and job search glossary',
    secondary: ['what is a WARN notice', 'what is a reduction in force', 'laid off vs fired', 'what is COBRA', 'what is outplacement', 'what is a retained search', 'what is garden leave', 'what is an applicant tracking system', 'what is a dislocated worker', 'what is an american job center', 'what is a release agreement', 'what is fractional work', 'what are transferable skills', 'what is total compensation', 'what is a non-compete'],
    seo: {
      title: 'Layoff and Job Search Glossary: Plain Definitions',
      description: 'Plain definitions of WARN notice, reduction in force, severance, COBRA, outplacement, executive recruiter, reverse recruiter, ATS and more layoff terms.',
      h1: 'Layoff and job search glossary',
    },
  },

  // ---- Events ------------------------------------------------------------------------------------------------------
  {
    id: 'events-hub',
    intent: 'Job fairs and business events near me',
    owner: '/events',
    kind: 'page',
    primary: 'job fairs near me',
    secondary: ['career fairs near me', 'hiring events near me', 'small business workshops near me', 'startup events near me'],
    seo: {
      title: 'Job Fairs and Business Events Near You, by State',
      description: 'Upcoming job fairs, hiring events, career workshops, small-business counseling and startup events from chambers, workforce boards, SBDCs, SCORE, colleges and cities.',
      h1: 'Job fairs and business events near you',
    },
  },
  {
    id: 'events-state',
    intent: 'Job fairs and business events in one state',
    owner: '/events/:state',
    kind: 'family',
    primary: '{state} job fairs',
    secondary: ['{state} career fairs', '{state} hiring events', '{state} small business workshops', '{state} startup events'],
  },

  // ---- Local job markets -----------------------------------------------------------------------------------------
  {
    id: 'places-hub',
    intent: 'Job market in my area',
    owner: '/places',
    kind: 'page',
    primary: 'local job markets',
    secondary: ['jobs near me', 'job market by state and county', 'local unemployment rate', 'job openings by county', 'largest employers near me'],
    seo: {
      title: 'Local Job Markets: Every State, County and City',
      description: 'Jobs, layoff notices, largest employers, colleges, workforce boards and American Job Centers for every U.S. state, county and city we cover.',
      h1: 'Local job markets',
    },
  },
  {
    id: 'places-state',
    intent: 'Job market in one state',
    owner: '/places/:state',
    kind: 'family',
    primary: '{state} jobs',
    secondary: ['{state} job market', '{state} unemployment rate', '{state} largest employers', '{state} job openings'],
  },
  {
    id: 'places-county',
    intent: 'Job market in one county',
    owner: '/places/:state/county/:county',
    kind: 'family',
    primary: '{county} jobs',
    secondary: ['{county} unemployment rate', '{county} largest employers', '{county} job openings', '{county} layoffs'],
  },
  {
    id: 'places-city',
    intent: 'Job market in one city',
    owner: '/places/:state/city/:city',
    kind: 'family',
    primary: '{city} jobs',
    secondary: ['{city} layoffs', '{city} employers hiring', '{city} job center'],
  },
  {
    id: 'industries-hub',
    intent: 'Jobs, conferences and layoffs by industry',
    owner: '/industries',
    kind: 'page',
    primary: 'jobs by industry',
    secondary: ['industry job market', 'industry layoffs', 'industries hiring'],
    seo: {
      title: 'Jobs by Industry: Openings, Conferences and Layoffs',
      description: 'Every industry NextChapter tracks: open jobs, upcoming conferences, recent layoff notices, industry associations and the job functions inside it.',
      h1: 'Industries: jobs, conferences and layoffs',
    },
  },
  {
    id: 'industry-page',
    intent: 'One industry',
    owner: '/industries/:slug',
    kind: 'family',
    primary: '{industry} jobs',
    secondary: ['{industry} layoffs', '{industry} conferences', '{industry} associations'],
  },
  {
    id: 'functions-hub',
    intent: 'Jobs, conferences and layoffs by job function',
    owner: '/functions',
    kind: 'page',
    primary: 'jobs by function',
    secondary: ['job functions', 'finance jobs', 'engineering jobs', 'marketing jobs', 'legal jobs', 'function job market'],
    seo: {
      title: 'Jobs by Function: Finance, Engineering, Marketing and More',
      description: 'Every job function NextChapter tracks, from finance and engineering to marketing and legal: open jobs, conferences, associations and the industries that hire.',
      h1: 'Job functions: jobs, conferences and layoffs',
    },
  },
  {
    id: 'function-page',
    intent: 'One job function',
    owner: '/functions/:slug',
    kind: 'family',
    primary: '{function} jobs',
    secondary: ['{function} layoffs', '{function} conferences', '{function} careers'],
  },
  {
    id: 'conferences-hub',
    intent: 'Find conferences to attend or speak at',
    owner: '/conferences',
    kind: 'page',
    primary: 'conferences and trade shows',
    secondary: ['industry conferences', 'conference calendar', 'call for speakers', 'trade shows by industry', 'networking conferences'],
    seo: {
      title: 'Conferences and Trade Shows: Dates, Costs and Speaking',
      description: 'Conferences, trade shows and summits by industry and function: dates, costs, calls for speakers, the associations that run them and the employers worth meeting.',
      h1: 'Conferences and trade shows',
    },
  },
  {
    id: 'conference-page',
    intent: 'One conference',
    owner: '/conferences/:slug',
    kind: 'family',
    primary: '{conference} dates and cost',
    secondary: ['{conference} speakers', '{conference} call for speakers', '{conference} registration'],
  },
  {
    id: 'associations-hub',
    intent: 'Industry associations and organizers',
    owner: '/associations',
    kind: 'page',
    primary: 'industry associations',
    secondary: ['professional associations', 'conference organizers', 'event organizers'],
    seo: {
      title: 'Industry Associations and Conference Organizers',
      description: 'Industry associations and event organizers that run two or more conferences in the NextChapter catalog, with their dates, costs and calls for speakers.',
      h1: 'Industry associations and conference organizers',
    },
  },
  {
    id: 'association-page',
    intent: 'One association',
    owner: '/associations/:slug',
    kind: 'family',
    primary: '{association} conferences',
    secondary: ['{association} events', '{association} speaking opportunities'],
  },

  // ---- Salaries and jobs by title and type (built from the open job listings) -------------------------------------
  {
    id: 'salaries-hub',
    intent: 'What does a job pay',
    owner: '/salaries',
    kind: 'page',
    primary: 'salary by job title',
    secondary: ['average salary by job title', 'professional salaries', 'how much do jobs pay', 'job salary lookup', 'pay by profession'],
    seo: {
      title: 'Salary by Job Title: Median and Pay Range',
      description: 'What professional jobs pay, from current listings that state a pay range: the median and middle half for each job title, annual in US dollars.',
      h1: 'Salary by job title',
    },
  },
  {
    id: 'salary-page',
    intent: 'What one job title pays',
    owner: '/salaries/:slug',
    kind: 'family',
    primary: '{title} salary',
    secondary: ['{title} average salary', '{title} pay range', 'how much does a {title} make', '{title} salary by state', '{title} median pay'],
  },
  {
    id: 'jobs-title-hub',
    intent: 'Browse open jobs by title',
    owner: '/jobs/title',
    kind: 'page',
    primary: 'jobs by title',
    secondary: ['job titles', 'open jobs by job title', 'job openings by profession'],
    seo: {
      title: 'Jobs by Title: Open Professional Roles',
      description: 'Open professional jobs by job title, from employers’ own career sites and checked to still be open, with pay where listed.',
      h1: 'Jobs by title',
    },
  },
  {
    id: 'jobs-title-page',
    intent: 'Open jobs for one title',
    owner: '/jobs/title/:slug',
    kind: 'family',
    primary: '{title} jobs',
    secondary: ['{title} job openings', '{title} openings', '{title} jobs hiring now', '{title} jobs with salary'],
  },
  {
    id: 'jobs-type-page',
    intent: 'Remote, hybrid, contract, part-time or interim jobs',
    owner: '/jobs/type/:type',
    kind: 'family',
    primary: '{type} professional jobs',
    secondary: ['{type} jobs', 'remote jobs for managers', 'remote director jobs', 'contract jobs for professionals', 'part-time professional jobs', 'interim executive jobs', 'hybrid jobs'],
  },

  // ---- Coaching and recruiters (candidate side) ------------------------------------------------------------------
  {
    id: 'career-coach',
    intent: 'Find a career coach',
    owner: '/coaching',
    kind: 'page',
    primary: 'career coach',
    secondary: ['professional coach', 'executive coach', 'career coaching', 'AI career coach', 'job search coach', 'executive coaching for job seekers', 'find a career coach', 'online career coach', 'free career coach'],
    seo: {
      title: 'Career Coach: Free AI Coach and a Human Executive Coach',
      description: 'Get a free AI career coach, Victoria, and add a human executive and professional career coach matched to your background and target role. Waitlist open.',
      h1: 'Career coach: a free AI coach, and a human executive coach when you want one',
    },
  },
  {
    id: 'laid-off-over-40',
    intent: 'Laid off later in a career',
    owner: '/topics/laid-off-over-40',
    kind: 'page',
    primary: 'laid off at 50',
    secondary: ['laid off at 40', 'laid off over 50', 'laid off after 20 years', 'laid off later in life', 'age discrimination layoff', 'job search after 50'],
    seo: {
      title: 'Laid Off at 40, 50 or Older: What to Do Next',
      description: 'Laid off later in a career? The protections that apply at 40 and older, how to run the search through your network, and how to show your skills are current.',
    },
  },
  {
    id: 'laid-off-no-savings',
    intent: 'Laid off with little saved',
    owner: '/topics/laid-off-no-savings',
    kind: 'page',
    primary: 'laid off with no savings',
    secondary: ['laid off no money', 'help paying bills after layoff', 'laid off and need income now', 'laid off and a mortgage'],
    seo: {
      title: 'Laid Off With No Savings: What to Do First',
      description: 'Laid off with little saved? Start income, protect your health coverage, cut costs and find programs that pay for what you need, in the right order.',
    },
  },
  {
    id: 'explain-a-layoff',
    intent: 'Answer why you were laid off in an interview',
    owner: '/topics/explain-a-layoff',
    kind: 'page',
    primary: 'how to explain a layoff in an interview',
    secondary: ['why were you laid off interview answer', 'how to talk about a layoff', 'explain being laid off', 'interview question laid off'],
    seo: {
      title: 'How to Explain a Layoff in an Interview',
      description: 'Say it in two sentences: the role was eliminated, what you delivered, what you want next. A simple structure, what to avoid, and what to say if you were fired.',
    },
  },
  {
    id: 'how-to-lay-off',
    intent: 'Employer plans a layoff',
    owner: '/topics/how-to-lay-off-employees',
    kind: 'page',
    primary: 'how to lay off employees',
    secondary: ['layoff checklist for employers', 'layoff communication plan', 'layoff process', 'how to conduct a layoff', 'layoff meeting script'],
    seo: {
      title: 'How to Lay Off Employees: A Checklist for Employers',
      description: 'A layoff checklist for employers: check WARN notice, choose roles by documented criteria, run the conversations plainly and support the people leaving.',
    },
  },
  {
    id: 'cover-letter',
    intent: 'Write a cover letter',
    owner: '/topics/cover-letter-tips',
    kind: 'page',
    primary: 'cover letter tips',
    secondary: ['cover letter for experienced professionals', 'cover letter after layoff', 'cover letter for career change', 'how long should a cover letter be', 'do I need a cover letter'],
    seo: {
      title: 'Cover Letter Tips for Experienced Professionals',
      description: 'A good cover letter is short: why this role, two results that match it and what you will do first. When to write one and how to explain a change or a layoff.',
    },
  },
  {
    id: 'executive-recruiters',
    intent: 'Work with executive recruiters and search firms',
    owner: '/topics/executive-recruiters',
    kind: 'page',
    primary: 'executive recruiters',
    secondary: ['executive search firms', 'retained search firms', 'headhunters', 'how to work with an executive recruiter', 'how to get on a recruiter’s radar', 'contingent vs retained recruiters', 'find an executive recruiter', 'executive search'],
    seo: {
      title: 'Executive Recruiters: How to Work With Search Firms',
      description: 'How executive recruiters and search firms work, how retained and contingent recruiters differ, and how to get in front of the right ones when you are job searching.',
    },
  },
  {
    id: 'reverse-recruiter',
    intent: 'Have someone represent me to employers',
    owner: '/topics/reverse-recruiter',
    kind: 'page',
    primary: 'reverse recruiter',
    secondary: ['reverse recruiting', 'reverse recruiting services', 'candidate marketing', 'job search representation', 'someone to find jobs for me', 'recruiter that works for the candidate'],
    seo: {
      title: 'Reverse Recruiter: What It Is and How It Compares',
      description: 'A reverse recruiter represents the job seeker instead of the employer. What they do, how they charge, what to ask, and how it compares with recruiters and coaches.',
    },
  },
  {
    id: 'resume-review',
    intent: 'Get my resume reviewed',
    owner: '/topics/resume-review',
    kind: 'page',
    primary: 'free resume review',
    secondary: ['resume review', 'resume feedback', 'review my resume', 'is my resume good', 'resume critique', 'ats resume checker'],
    seo: {
      title: 'Free Resume Review: What to Check and Where to Get One',
      description: 'How to review your resume yourself in fifteen minutes, where to get a free outside review, and what a good review should tell you before you apply.',
    },
  },
  {
    id: 'interview-questions',
    intent: 'Answer common interview questions',
    owner: '/topics/interview-questions-and-answers',
    kind: 'page',
    primary: 'interview questions and answers',
    secondary: ['interview questions', 'common interview questions', 'tell me about yourself', 'behavioral interview questions', 'what is your biggest weakness', 'questions to ask the interviewer'],
    seo: {
      title: 'Common Interview Questions and How to Answer Them',
      description: 'The interview questions experienced professionals get most, how to answer each in under two minutes, a structure for behavioral questions and what to ask back.',
    },
  },
  {
    id: 'career-advice',
    intent: 'General career advice',
    owner: '/topics/career-advice',
    kind: 'page',
    primary: 'career advice',
    secondary: ['career advice for professionals', 'career guidance', 'career help', 'career development advice', 'how to advance your career', 'when to change jobs'],
    seo: {
      title: 'Career Advice for Experienced Professionals',
      description: 'Practical career advice for experienced professionals: know your market, keep proof of your results current, stay connected and decide when to stay or move.',
    },
  },
  {
    id: 'problems-at-work',
    intent: 'Deal with a problem at work',
    owner: '/topics/problems-at-work',
    kind: 'page',
    primary: 'problems at work',
    secondary: ['work problems', 'difficult boss', 'bad boss', 'micromanager', 'toxic workplace', 'burnout at work', 'passed over for promotion', 'conflict with coworker'],
    seo: {
      title: 'Problems at Work: Difficult Boss, Burnout, Passed Over',
      description: 'What to do about a difficult boss, burnout, a micromanager or a missed promotion: document it, talk first, use the formal channel and line up options early.',
    },
  },
  {
    id: 'submit-resume',
    intent: 'Put my resume in front of recruiters',
    owner: '/submit-resume',
    kind: 'page',
    primary: 'submit resume to recruiters',
    secondary: ['send my resume to recruiters', 'get recruiters to find me', 'resume submission', 'recruiter introductions'],
    seo: {
      title: 'Submit Your Resume to Recruiters: Free, No Signup',
      description: 'Send your resume and we will pass strong matches along to recruiters and search firms in our network. Free, no obligation, and no need to sign up first.',
      h1: 'Submit your resume to recruiters',
    },
  },
  {
    id: 'scam-watch',
    intent: 'Is this recruiter or job offer fake',
    owner: '/scam-watch',
    kind: 'page',
    primary: 'fake recruiter scams',
    secondary: ['job scam', 'recruiter scam', 'fake job offer', 'is this recruiter real', 'linkedin recruiter scam', 'job offer scam email'],
    seo: {
      title: 'Fake Recruiter and Job Offer Scams: How to Spot Them',
      description: 'Fake recruiters and fake job offers target people who are job hunting. NextChapter checks recruiter emails in your connected Gmail and flags the ones that look fake.',
    },
  },
  {
    id: 'give-reference',
    intent: 'Manager wants to give a reference after a layoff',
    owner: '/for-managers/give-a-reference',
    kind: 'page',
    primary: 'give a reference for an employee you let go',
    secondary: ['reference for a former employee', 'write a reference after a layoff', 'manager reference', 'recommendation for a laid off employee'],
    seo: {
      title: 'Give a Reference for an Employee You Let Go',
      description: 'You just let someone great go. Leave a reference while it is fresh so they can show future employers what they did and how they worked.',
      h1: 'Give a reference for someone you let go',
    },
  },

  // ---- Employers, outplacement, institutions ---------------------------------------------------------------------
  {
    id: 'outplacement',
    intent: 'Buy outplacement',
    owner: '/outplacement',
    kind: 'page',
    primary: 'outplacement services',
    secondary: ['outplacement', 'outplacement support', 'outplacement for employers', 'outplacement vendors', 'outplacement program', 'severance outplacement', 'layoff support for employees'],
    seo: {
      title: 'Outplacement Services for Employers and HR Teams',
      description: 'Outplacement for departing employees: a Dossier each person keeps, reporting in counts for HR and a compliance record for each seat for legal. Set up by contract.',
    },
  },
  {
    id: 'outplacement-compare',
    intent: 'Compare outplacement vendors',
    owner: '/vs',
    kind: 'page',
    primary: 'outplacement providers compared',
    secondary: ['best outplacement companies', 'outplacement providers', 'outplacement comparison', 'outplacement vendor comparison'],
    seo: {
      title: 'Outplacement Providers Compared: LHH, RiseSmart and More',
      description: 'Side-by-side comparisons of NextChapter with LHH, Randstad RiseSmart, Careerminds and INTOO, and the questions to ask each outplacement vendor.',
    },
  },
  {
    id: 'outplacement-compare-one',
    intent: 'Compare NextChapter with one vendor',
    owner: '/vs/:competitor',
    kind: 'family',
    primary: '{competitor} alternative',
    secondary: ['NextChapter vs {competitor}', '{competitor} outplacement review', '{competitor} competitors'],
  },
  {
    id: 'rfp',
    intent: 'Write an outplacement RFP',
    owner: '/rfp-template',
    kind: 'page',
    primary: 'outplacement RFP template',
    secondary: ['outplacement RFP', 'outplacement vendor scorecard', 'outplacement vendor evaluation', 'outplacement RFP questions'],
    seo: {
      title: 'Outplacement RFP Template and Vendor Scorecard',
      description: 'A free, vendor-neutral outplacement RFP template and scorecard: eight questions that separate a real evaluation from a sales pitch.',
    },
  },
  {
    id: 'insights',
    intent: 'Evaluate outplacement as an HR buyer',
    owner: '/insights',
    kind: 'page',
    primary: 'outplacement insights for HR',
    secondary: ['questions to ask an outplacement vendor', 'outplacement reporting', 'outplacement contract', 'outplacement account after contract'],
    seo: {
      title: 'Outplacement Insights for HR Buyers',
      description: 'The questions to ask an outplacement vendor, what an outplacement report should show, and what happens to your account when the contract ends.',
    },
  },
  {
    id: 'employers-hub',
    intent: 'Employer overview',
    owner: '/employers',
    kind: 'page',
    primary: 'employer solutions',
    secondary: ['HR layoff support', 'support laid off employees', 'employee lifecycle', 'hiring employees and outplacement'],
    seo: {
      title: 'Employer Solutions: Hiring, Employee Development, Outplacement',
      description: 'NextChapter for employers, by stage of the employee lifecycle: Hiring for future employees, Employees for current ones, and Outplacement for people who are leaving.',
    },
  },
  {
    id: 'employees-hub',
    intent: 'Employee development and retention',
    owner: '/employees',
    kind: 'page',
    primary: 'employee development and retention',
    secondary: ['employee retention', 'internal mobility', 'employee career development', 'skills plan for employees', 'promotion preparation'],
    seo: {
      title: 'Employee Development and Retention for HR Teams',
      description: 'Give current employees promotion and raise preparation, internal roles and a skills plan that starts with your courses. HR sees counts by team, never by person.',
    },
  },
  {
    id: 'hiring',
    intent: 'Employer wants to hire experienced professionals',
    owner: '/talent',
    kind: 'page',
    primary: 'hire experienced professionals',
    secondary: ['hire laid off professionals', 'white collar recruiting', 'post a job free', 'candidate evidence brief', 'hire executives'],
    seo: {
      title: 'Hire Experienced Professionals: Post a Role Free',
      description: 'Post a role and see candidates who chose to be seen, matched on what they say they want, with an evidence brief for each. Names stay private until they agree.',
    },
  },
  {
    id: 'recruiters-hub',
    intent: 'Recruiter wants candidates',
    owner: '/recruiters',
    kind: 'page',
    primary: 'recruiter candidate search',
    secondary: ['candidate sourcing', 'search firm tools', 'recruiting workspace', 'candidate submission packet', 'executive search candidates'],
    seo: {
      title: 'Candidate Search for Recruiters and Search Firms',
      description: 'Search candidates who chose to be found, ask for an introduction, and submit a packet in your firm’s logo built from the candidate’s Dossier. Free for now.',
    },
  },
  {
    id: 'submit-search',
    intent: 'Hand NextChapter an open search',
    owner: '/submit-search',
    kind: 'page',
    primary: 'send us a search',
    secondary: ['submit a search to recruiters', 'confidential search', 'screened shortlist of candidates', 'candidate shortlist for recruiters'],
    seo: {
      title: 'Send Us a Search: Screened Shortlist of Candidates',
      description: 'Recruiters and employers: send NextChapter an open or confidential search. We return a screened shortlist of members at the right level within days. Free.',
      h1: 'Send us a search',
    },
  },
  {
    id: 'coaches-hub',
    intent: 'Coach wants client software',
    owner: '/coaches',
    kind: 'page',
    primary: 'software for career coaches',
    secondary: ['coaching client workspace', 'career coach tools', 'coach client management', 'pre-session brief', 'coaching session notes'],
    seo: {
      title: 'Client Workspace Software for Career Coaches',
      description: 'Invite clients with a code, see what each chooses to share, get a pre-session brief and keep session notes in one place, under your practice’s name. Free for now.',
    },
  },
  {
    id: 'higher-ed-hub',
    intent: 'College buys alumni career support',
    owner: '/higher-education',
    kind: 'page',
    primary: 'alumni career services for colleges',
    secondary: ['alumni career services', 'student career services', 'college career services platform', 'alumni relations', 'career services workspace'],
    seo: {
      title: 'Alumni and Student Career Services for Colleges',
      description: 'Claim your institution’s page with a work email at your domain. A free workspace gives career services and alumni relations a page, services and basic counts.',
    },
  },
  {
    id: 'higher-ed-state',
    intent: 'Colleges in one state',
    owner: '/higher-education/:state',
    kind: 'family',
    primary: '{state} college career services',
    secondary: ['{state} colleges alumni support', '{state} colleges career services', '{state} university alumni career help'],
  },
  {
    id: 'workforce-hub',
    intent: 'Workforce agency buys job seeker support',
    owner: '/government-workforce',
    kind: 'page',
    primary: 'workforce board software',
    secondary: ['workforce development software', 'job seeker services', 'WIOA career services', 'economic development job seekers', 'chamber of commerce workforce'],
    seo: {
      title: 'Workforce Board Workspace for Job Seeker Services',
      description: 'Claim your organization’s page with a work email at your domain. A free workspace gives workforce boards and chambers a page, services and basic counts.',
    },
  },
  {
    id: 'workforce-boards-hub',
    intent: 'Find a local workforce board or job center',
    owner: '/workforce-boards',
    kind: 'page',
    primary: 'workforce development boards',
    secondary: ['american job centers', 'local workforce board near me', 'workforce board directory', 'workforce investment board', 'job center near me', 'one-stop career center'],
    seo: {
      title: 'Workforce Development Boards and Job Centers by State',
      description: 'Every local workforce development board and American Job Center by state: counties served, local unemployment, nearby colleges and recent layoff notices.',
    },
  },
  {
    id: 'workforce-boards-state',
    intent: 'Workforce boards in one state',
    owner: '/workforce-boards/:state',
    kind: 'family',
    primary: '{state} workforce development boards',
    secondary: ['{state} american job centers', '{state} workforce boards', '{state} job centers near me'],
  },
  {
    id: 'workforce-board',
    intent: 'One workforce board',
    owner: '/workforce-boards/:state/:board',
    kind: 'family',
    primary: '{board} workforce board',
    secondary: ['{board} american job center', '{board} counties served', '{board} contact'],
  },
  {
    id: 'nonprofits-hub',
    intent: 'Nonprofit buys job seeker support',
    owner: '/nonprofits',
    kind: 'page',
    primary: 'workspace for nonprofits serving job seekers',
    secondary: ['nonprofit job seeker services', 'community organization workforce', 'job readiness program software'],
    seo: {
      title: 'Workspace for Nonprofits Serving Job Seekers',
      description: 'Claim your organization’s page with a work email at your domain. A free workspace gives your nonprofit its own page, services and basic counts.',
    },
  },
  {
    id: 'organizations-hub',
    intent: 'Pick the organization portal',
    owner: '/for-organizations',
    kind: 'page',
    primary: 'NextChapter for organizations',
    secondary: ['organization portals', 'portals for colleges employers recruiters coaches'],
    seo: {
      title: 'NextChapter for Organizations: Colleges, Employers, Recruiters',
      description: 'Portals for colleges, workforce organizations, employers, recruiters and coaches. Each has its own page, its own plans and its own log in.',
    },
  },
]

// ---------------------------------------------------------------------------------------------------------------------
// Pages that deliberately target no phrase: legal, security and editorial pages. Their titles stay plain.
// ---------------------------------------------------------------------------------------------------------------------

export const NO_TARGET_PAGES = ['/privacy-policy', '/terms', '/security', '/editorial-standards', '/authors/:slug', '/reports/replication', '/news/:slug', '/reports/:edition', '/insights/:slug', '/start', '/network'] as const

// ---------------------------------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------------------------------

const BY_OWNER = new Map(KEYWORD_CLUSTERS.map((c) => [c.owner, c]))

export function clusterFor(owner: string): KeywordCluster {
  const c = BY_OWNER.get(owner)
  if (!c) throw new Error(`No keyword cluster owns ${owner}`)
  return c
}

/** The title and description a single page owns. Throws for a family (use templates.ts) or an unknown path. */
export function pageSeo(path: string): PageSeo {
  const seo = clusterFor(path).seo
  if (!seo) throw new Error(`${path} has no page-level SEO in the keyword map`)
  return seo
}

/** `{ title, description }` as page metadata: the title gets the brand only when it fits in 60 (see title.ts). */
export function pageSeoMeta(path: string): { title: Metadata['title']; description: string } {
  const { title, description } = pageSeo(path)
  return { title: titleMeta(title), description: fitDescription(description) }
}

/** The headline a page shows: the keyword map's H1 when it sets one, else the page's own. */
export function pageH1(path: string, fallback: string): string {
  return clusterFor(path).seo?.h1 ?? fallback
}

/**
 * Metadata for a page that owns a cluster: title, description, canonical and Open Graph / Twitter.
 * Spread it: `export const metadata = pageMetadata('/pricing')`.
 */
export function pageMetadata(path: string): Metadata {
  const { title, description } = pageSeo(path)
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`
  return {
    title: titleMeta(title),
    description: fitDescription(description),
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: 'NextChapter', locale: 'en_US', title, description, url },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Internal links: the anchor text each owner page is linked with, and which owner pages link to which. Descriptive
// anchors that carry the target's primary phrase, so every cluster is reachable from the pages around it.
// ---------------------------------------------------------------------------------------------------------------------

export const ANCHORS: Record<string, string> = {
  '/start/laid-off': 'Laid off? Start here',
  '/resources/72-hours': 'Your first 72 hours after a layoff',
  '/resources/unemployed': 'Job search while unemployed',
  '/resources/pre-exit': 'How to prepare for a layoff',
  '/resources/cobra-aca': 'Health insurance after a layoff: COBRA vs. marketplace',
  '/resources/bridge-income': 'Bridge income while you search',
  '/resources/interview-prep': 'Interview prep guide',
  '/resources/offer-letter': 'How to negotiate a job offer',
  '/resources/network-activation': 'How to network when job searching',
  '/resources/network-scripts': 'Networking email and message scripts',
  '/resources/narrative-workshop': 'Your career story: “tell me about yourself”',
  '/resources': 'Job search and layoff guides',
  '/salaries': 'Salary by job title',
  '/jobs/title': 'Jobs by title',
  '/tools': 'Free job search and layoff tools',
  '/tools/severance-calculator': 'Severance calculator',
  '/tools/cobra-vs-aca-calculator': 'COBRA vs ACA calculator',
  '/tools/pay-check': 'Pay check',
  '/tools/resume-check': 'Free resume check',
  '/tools/layoff-deadlines': 'Layoff deadlines',
  '/glossary': 'Layoff and job search glossary',
  '/places': 'Local job markets by state, county and city',
  '/industries': 'Jobs by industry',
  '/functions': 'Jobs by function',
  '/conferences': 'Conferences and trade shows',
  '/topics/laid-off-over-40': 'Laid off at 40, 50 or older',
  '/topics/laid-off-no-savings': 'Laid off with no savings',
  '/topics/explain-a-layoff': 'How to explain a layoff in an interview',
  '/topics/how-to-lay-off-employees': 'How to lay off employees: employer checklist',
  '/topics/cover-letter-tips': 'Cover letter tips',
  '/topics/severance': 'Severance package: what it is and how to negotiate',
  '/topics/job-search-strategy': 'Job search strategy',
  '/topics/resume-tips': 'Resume tips for experienced professionals',
  '/topics/career-pivot': 'Career pivot',
  '/topics/career-exploration': 'Career exploration',
  '/topics/executive-recruiters': 'Executive recruiters and search firms',
  '/topics/reverse-recruiter': 'Reverse recruiter',
  '/topics/resume-review': 'Free resume review',
  '/topics/interview-questions-and-answers': 'Common interview questions and answers',
  '/topics/career-advice': 'Career advice for experienced professionals',
  '/topics/problems-at-work': 'Problems at work',
  '/start/career-change': 'Career change',
  '/coaching': 'Career coach: free AI coach and human executive coach',
  '/submit-resume': 'Submit your resume to recruiters',
  '/unemployment-benefits': 'Unemployment benefits by state',
  '/layoffs': 'Layoff tracker: recent layoffs and WARN notices',
  '/jobs': 'Job search: live professional jobs',
  '/funding': 'Funding for laid-off workers',
  '/dossier': 'Executive Dossier',
  '/why-stuck': 'Why your job search isn’t working',
  '/ai-skills': 'AI skills in job postings',
  '/workforce-boards': 'Workforce development boards and American Job Centers',
  '/scam-watch': 'Fake recruiter and job scams',
  '/how-it-works': 'How NextChapter works',
  '/reports': 'White Collar Employment Report',
  '/outplacement': 'Outplacement services',
  '/vs': 'Outplacement providers compared',
  '/rfp-template': 'Outplacement RFP template',
  '/tools/warn-act-checker': 'WARN Act checker',
  '/rapid-response': 'Rapid response and layoff support for employers',
}

export const RELATED: Record<string, string[]> = {
  '/start/laid-off': ['/resources/72-hours', '/unemployment-benefits', '/topics/severance', '/resources/cobra-aca', '/coaching', '/funding'],
  '/start/thinking-about-a-move': ['/resources/pre-exit', '/topics/job-search-strategy', '/topics/career-pivot', '/coaching'],
  '/start/managing-my-career': ['/start/promotion', '/resources/offer-letter', '/topics/career-exploration', '/coaching'],
  '/start/resigned': ['/topics/job-search-strategy', '/resources/bridge-income', '/resources/cobra-aca', '/coaching'],
  '/start/returning': ['/topics/resume-tips', '/resources/narrative-workshop', '/topics/job-search-strategy', '/coaching'],
  '/start/searching-too-long': ['/why-stuck', '/topics/job-search-strategy', '/resources/network-activation', '/coaching'],
  '/start/promotion': ['/resources/offer-letter', '/resources/narrative-workshop', '/start/managing-my-career', '/coaching'],
  '/start/career-change': ['/topics/career-pivot', '/topics/career-exploration', '/funding', '/coaching'],
  '/start/new-grad': ['/topics/resume-tips', '/resources/interview-prep', '/resources/network-scripts', '/jobs'],
  '/start/next-act': ['/start/happy-with-fractional-work', '/topics/executive-recruiters', '/dossier', '/coaching'],
  '/start/taking-a-break': ['/dossier', '/resources/network-activation', '/topics/resume-tips', '/coaching'],
  '/start/happy-with-fractional-work': ['/resources/bridge-income', '/dossier', '/resources/network-activation', '/coaching'],
  '/start/building-something': ['/resources/bridge-income', '/topics/career-exploration', '/dossier', '/coaching'],
  '/resources/72-hours': ['/start/laid-off', '/unemployment-benefits', '/topics/severance', '/resources/cobra-aca', '/layoffs'],
  '/resources/unemployed': ['/topics/job-search-strategy', '/unemployment-benefits', '/resources/bridge-income', '/why-stuck'],
  '/resources/pre-exit': ['/topics/severance', '/resources/72-hours', '/resources/narrative-workshop', '/resources/network-activation'],
  '/resources/cobra-aca': ['/tools/cobra-vs-aca-calculator', '/unemployment-benefits', '/topics/severance', '/funding', '/resources/72-hours'],
  '/resources/bridge-income': ['/start/happy-with-fractional-work', '/resources/unemployed', '/unemployment-benefits', '/topics/job-search-strategy'],
  '/resources/gatekeeper': ['/topics/resume-tips', '/topics/executive-recruiters', '/resources/network-activation', '/jobs'],
  '/resources/offer-letter': ['/resources/interview-prep', '/resources/first-90-days', '/topics/severance', '/coaching'],
  '/resources/narrative-workshop': ['/topics/resume-tips', '/resources/interview-prep', '/resources/network-scripts', '/dossier'],
  '/resources/network-activation': ['/resources/network-scripts', '/resources/ask-for-help', '/topics/job-search-strategy', '/topics/executive-recruiters'],
  '/resources/ask-for-help': ['/resources/network-scripts', '/resources/network-activation', '/resources/narrative-workshop'],
  '/resources/network-scripts': ['/resources/network-activation', '/resources/ask-for-help', '/topics/executive-recruiters'],
  '/resources/interview-prep': ['/topics/interview-questions-and-answers', '/resources/post-interview', '/resources/narrative-workshop', '/resources/offer-letter', '/coaching'],
  '/resources/post-interview': ['/resources/interview-prep', '/resources/offer-letter', '/topics/job-search-strategy'],
  '/resources/thought-leadership': ['/resources/narrative-workshop', '/resources/network-activation', '/dossier'],
  '/resources/first-90-days': ['/resources/offer-letter', '/resources/interview-prep', '/coaching'],
  '/topics/laid-off-over-40': ['/start/laid-off', '/topics/severance', '/topics/executive-recruiters', '/topics/resume-tips'],
  '/topics/laid-off-no-savings': ['/unemployment-benefits', '/funding', '/resources/cobra-aca', '/resources/bridge-income'],
  '/topics/explain-a-layoff': ['/topics/resume-tips', '/resources/interview-prep', '/resources/narrative-workshop', '/coaching'],
  '/topics/how-to-lay-off-employees': ['/tools/warn-act-checker', '/rapid-response', '/outplacement', '/glossary'],
  '/topics/cover-letter-tips': ['/topics/resume-tips', '/resources/narrative-workshop', '/resources/interview-prep'],
  '/topics/severance': ['/tools/severance-calculator', '/glossary', '/unemployment-benefits', '/resources/cobra-aca', '/resources/pre-exit', '/resources/72-hours', '/coaching'],
  '/tools/layoff-deadlines': ['/unemployment-benefits', '/resources/cobra-aca', '/tools/cobra-vs-aca-calculator', '/resources/72-hours', '/tools/severance-calculator'],
  '/tools/pay-check': ['/salaries', '/tools/severance-calculator', '/jobs', '/tools'],
  '/tools/resume-check': ['/topics/resume-review', '/topics/resume-tips', '/resources/gatekeeper', '/tools/pay-check', '/tools'],
  '/tools/severance-calculator': ['/topics/severance', '/unemployment-benefits', '/resources/cobra-aca', '/tools/cobra-vs-aca-calculator', '/resources/72-hours'],
  '/tools/cobra-vs-aca-calculator': ['/resources/cobra-aca', '/tools/layoff-deadlines', '/unemployment-benefits', '/tools/severance-calculator'],
  '/topics/job-search-strategy': ['/places', '/resources/unemployed', '/why-stuck', '/resources/network-activation', '/topics/resume-tips', '/jobs', '/coaching'],
  '/topics/resume-tips': ['/topics/resume-review', '/resources/gatekeeper', '/resources/narrative-workshop', '/dossier', '/submit-resume', '/topics/job-search-strategy'],
  '/topics/career-pivot': ['/start/career-change', '/topics/career-exploration', '/funding', '/resources/narrative-workshop', '/coaching'],
  '/topics/career-exploration': ['/topics/career-pivot', '/start/career-change', '/ai-skills', '/funding', '/coaching'],
  '/topics/executive-recruiters': ['/topics/reverse-recruiter', '/submit-resume', '/resources/gatekeeper', '/resources/network-activation', '/scam-watch'],
  '/topics/reverse-recruiter': ['/topics/executive-recruiters', '/coaching', '/submit-resume', '/scam-watch', '/dossier'],
  '/topics/resume-review': ['/tools/resume-check', '/topics/resume-tips', '/resources/gatekeeper', '/dossier', '/coaching', '/submit-resume'],
  '/topics/interview-questions-and-answers': ['/resources/interview-prep', '/topics/explain-a-layoff', '/resources/narrative-workshop', '/resources/post-interview', '/coaching'],
  '/topics/career-advice': ['/start/managing-my-career', '/topics/career-exploration', '/topics/career-pivot', '/topics/job-search-strategy', '/coaching'],
  '/topics/problems-at-work': ['/start/thinking-about-a-move', '/start/promotion', '/start/managing-my-career', '/unemployment-benefits', '/coaching'],
}

/** The related links for an owner page, as { href, label } in the order the map lists them. */
export function relatedLinks(path: string): { href: string; label: string }[] {
  return (RELATED[path] ?? []).filter((h) => ANCHORS[h] || h.startsWith('/start/')).map((href) => ({ href, label: ANCHORS[href] ?? clusterFor(href).primary }))
}

/** The homepage's <meta name="keywords">: Google ignores it, some other engines read it. The home cluster's phrases. */
export const HOME_KEYWORDS = ['job transition platform', 'laid off', 'layoffs', 'unemployment benefits', 'job search', 'career change', 'career coach', 'resume', 'WARN notices', 'outplacement']

/** One line per linked owner page for llms.txt: anchor, URL and the page's description. */
export function llmsPageLines(siteUrl: string): string[] {
  return Object.keys(ANCHORS).flatMap((path) => {
    const c = KEYWORD_CLUSTERS.find((k) => k.owner === path)
    return c?.seo ? [`- [${ANCHORS[path]}](${siteUrl}${path}): ${c.seo.description}`] : []
  })
}
