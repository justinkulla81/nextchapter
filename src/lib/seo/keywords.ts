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
    id: 'first-two-weeks-after-layoff',
    intent: 'Know what to do in the first two weeks after a layoff',
    owner: '/topics/first-two-weeks-after-layoff',
    kind: 'page',
    primary: 'what to do after being laid off',
    secondary: ['laid off what to do first', 'first steps after a layoff', 'after a layoff checklist'],
    seo: {
      title: 'Laid Off: What to Do in the First Two Weeks',
      description: 'The first two weeks after a layoff, in order: unemployment, severance review, health coverage, then your network. What has a deadline and what can wait.',
    },
  },
  {
    id: 'resume-ats-ai-screening',
    intent: 'Write a resume that parses in applicant tracking and AI screening',
    owner: '/topics/resume-ats-ai-screening',
    kind: 'page',
    primary: 'resume for ats and ai screening',
    secondary: ['resume ats', 'ats friendly resume', 'resume for applicant tracking system', 'beat ats', 'resume ai screening'],
    seo: {
      title: 'ATS Resume: How to Get Through AI Screening',
      description: 'How to format an ATS-friendly resume, match a job posting without stuffing keywords, and what AI resume screening can and cannot do.',
    },
  },
  {
    id: 'hidden-job-market',
    intent: 'Find jobs that are never posted publicly',
    owner: '/topics/hidden-job-market',
    kind: 'page',
    primary: 'hidden job market',
    secondary: ['unadvertised jobs', 'jobs not posted online', 'how to find unposted jobs', 'hidden jobs'],
    seo: {
      title: 'The Hidden Job Market: How to Find Unposted Jobs',
      description: 'Four ways into the hidden job market: referrals, recruiters, direct outreach and early alerts, plus a simple weekly rhythm to keep it going.',
    },
  },
  {
    id: 'linkedin-after-layoff',
    intent: 'Update LinkedIn after a layoff',
    owner: '/topics/linkedin-after-layoff',
    kind: 'page',
    primary: 'linkedin after layoff',
    secondary: ['update linkedin after being laid off', 'linkedin open to work after layoff', 'linkedin headline after layoff'],
    seo: {
      title: 'LinkedIn After a Layoff: What to Change First',
      description: 'What to change on LinkedIn after a layoff: headline, About, open-to-work settings and the one post that brings introductions.',
    },
  },
  {
    id: 'career-coach-cost',
    intent: 'Decide whether a career coach is worth the cost',
    owner: '/topics/career-coach-cost',
    kind: 'page',
    primary: 'is a career coach worth it',
    secondary: ['career coach cost', 'how much does a career coach cost', 'career coach for job transition', 'should i hire a career coach'],
    seo: {
      title: 'Is a Career Coach Worth It? Cost and What to Ask',
      description: 'When a career coach is worth paying for, what to ask before you buy, and the free options to try first, including outplacement.',
    },
  },
  {
    id: 'unemployment-and-job-search',
    intent: 'Understand work search rules while collecting unemployment',
    owner: '/topics/unemployment-and-job-search',
    kind: 'page',
    primary: 'unemployment work search requirements',
    secondary: ['job search while on unemployment', 'collect unemployment and look for work', 'unemployment weekly certification', 'work search log'],
    seo: {
      title: 'Unemployment and Your Job Search: The Rules',
      description: 'What most states require to keep collecting unemployment: weekly certification, a work-search record, reporting earnings and severance.',
    },
  },
  {
    id: 'best-job-sites-for-executives',
    intent: 'Find senior and executive jobs',
    owner: '/topics/best-job-sites-for-executives',
    kind: 'page',
    primary: 'executive job search',
    secondary: ['best job sites for executives', 'senior executive job search', 'director level jobs', 'how to find executive jobs'],
    seo: {
      title: 'Executive Job Search: Where Senior Roles Are Found',
      description: 'Where senior and executive roles are found: search firms, LinkedIn, career pages and your network, and how to work each channel.',
    },
  },
  {
    id: 'networking-after-layoff',
    intent: 'Network after a layoff without feeling embarrassed',
    owner: '/topics/networking-after-layoff',
    kind: 'page',
    primary: 'networking after layoff',
    secondary: ['how to network when laid off', 'networking when unemployed', 'reach out to contacts after layoff', 'embarrassed to network'],
    seo: {
      title: 'Networking After a Layoff: A Message That Works',
      description: 'How to network after a layoff: the message to send, who to contact first and how to keep conversations going.',
    },
  },
  {
    id: 'mcp-server',
    intent: 'Connect an AI assistant to NextChapter job search',
    owner: '/mcp',
    kind: 'page',
    primary: 'job search mcp server',
    secondary: ['mcp server for jobs', 'job search api for ai assistants'],
    seo: {
      title: 'NextChapter MCP Server for Job Search',
      description: 'A free, read-only MCP server that lets an AI assistant search current professional job openings and find career guides on layoffs and job search.',
    },
  },
  {
    id: 'job-search-tracker',
    intent: 'Organize job applications and follow-ups',
    owner: '/topics/job-search-tracker',
    kind: 'page',
    primary: 'job application tracker',
    secondary: ['track job applications', 'job search spreadsheet'],
    seo: {
      title: 'Job Search Tracker: Organize Applications and Follow-Ups',
      description: 'What to record for every application and contact, the habits that keep a job search tracker useful, and how to read it when the search stalls.',
    },
  },
  {
    id: 'skills-gap-analysis',
    intent: 'Find the skills gap for a target role',
    owner: '/topics/skills-gap-analysis',
    kind: 'page',
    primary: 'skills gap analysis',
    secondary: ['find my skills gap', 'skills gap for jobs', 'what skills am i missing', 'skills i need for a job'],
    seo: {
      title: 'Skills Gap Analysis: Find What You Are Missing',
      description: 'A five-step method to find your skills gap from real job postings, what counts as proof, and which gaps are only wish lists.',
    },
  },
  {
    id: 'is-this-salary-fair',
    intent: 'Check whether a job offer pays fairly',
    owner: '/topics/is-this-salary-fair',
    kind: 'page',
    primary: 'is this job offer fair',
    secondary: ['check salary for my level', 'compare job offer pay', 'what should i be paid'],
    seo: {
      title: 'Is This Job Offer Fair? How to Check Pay',
      description: 'Where to find pay for your role and city, how to compare the whole package, and what to do if an offer is low.',
    },
  },
  {
    id: 'fake-job-postings',
    intent: 'Spot fake job postings and recruiter scams',
    owner: '/topics/fake-job-postings',
    kind: 'page',
    primary: 'fake job postings',
    secondary: ['job posting scam', 'how to spot a fake job', 'is this job real', 'fake recruiter'],
    seo: {
      title: 'Fake Job Postings: How to Spot Recruiter Scams',
      description: 'Warning signs of a job scam, how to check a posting and a recruiter, and what to do if you shared money or details.',
    },
  },
  {
    id: 'ai-and-entry-level-jobs',
    intent: 'Understand how AI affects entry-level jobs',
    owner: '/topics/ai-and-entry-level-jobs',
    kind: 'page',
    primary: 'ai and entry-level jobs',
    secondary: ['is ai eliminating entry level jobs', 'ai entry level hiring', 'entry level jobs ai', 'ai replacing junior jobs'],
    seo: {
      title: 'Is AI Eliminating Entry-Level Jobs? Reading the Evidence',
      description: 'What to look at to judge how AI affects entry-level hiring in your field, what tends to hold up, and what early-career workers can do.',
    },
  },
  {
    id: 'ai-cover-letters',
    intent: 'Use AI to write a cover letter well',
    owner: '/topics/ai-cover-letters',
    kind: 'page',
    primary: 'ai cover letter',
    secondary: ['cover letter with ai', 'chatgpt cover letter', 'write a cover letter with ai'],
    seo: {
      title: 'AI Cover Letter: Use It Without Sounding Like AI',
      description: 'A process for drafting a cover letter with AI, what to check before you send, and when a short note works better.',
    },
  },
  {
    id: 'relocating-for-a-job',
    intent: 'Compare cities before relocating for work',
    owner: '/topics/relocating-for-a-job',
    kind: 'page',
    primary: 'relocating for a job',
    secondary: ['move for a job', 'compare cities to move', 'relocate for work', 'moving for a new job'],
    seo: {
      title: 'Relocating for a Job: How to Compare Cities',
      description: 'The four things to compare before a move for work, checks to make before you commit, and how remote work changes it.',
    },
  },
  {
    id: 'benefits-after-layoff',
    intent: 'Know which benefits and help apply after a layoff',
    owner: '/topics/benefits-after-layoff',
    kind: 'page',
    primary: 'benefits after a layoff',
    secondary: ['benefits after being laid off', 'what benefits do i get when laid off', 'snap after layoff'],
    seo: {
      title: 'Benefits and Help After a Layoff: What You May Qualify For',
      description: 'Unemployment, health coverage, workforce services and other help you may qualify for after a layoff, in the order that matters.',
    },
  },
  {
    id: 'american-job-centers',
    intent: 'Use an American Job Center after a layoff',
    owner: '/topics/american-job-centers',
    kind: 'page',
    primary: 'american job center',
    secondary: ['one stop career center', 'workforce center near me', 'dislocated worker program'],
    seo: {
      title: 'American Job Centers: Free Help for Laid-Off Workers',
      description: 'What American Job Centers offer for free, how to use one, and how dislocated worker training funds work.',
    },
  },
  {
    id: 'buy-a-business-vs-job',
    intent: 'Decide between buying a business and a job',
    owner: '/topics/buy-a-business-vs-job',
    kind: 'page',
    primary: 'buy a business instead of a job',
    secondary: ['should i buy a business', 'buying a business after layoff', 'buy a small business or get a job'],
    seo: {
      title: 'Buy a Business or Find a Job? How to Decide',
      description: 'Questions to answer before buying a business, checks to run before you sign, and a middle path that keeps your options open.',
    },
  },
  {
    id: 'interview-after-career-gap',
    intent: 'Interview well after a career gap',
    owner: '/topics/interview-after-career-gap',
    kind: 'page',
    primary: 'interview after a career gap',
    secondary: ['career gap interview', 'interviewing after time off', 'returning to work interview'],
    seo: {
      title: 'Interviewing After a Career Gap',
      description: 'How to answer for a career gap in a sentence or two, show you are current, and practice so it does not derail the interview.',
    },
  },
  {
    id: 'resume-gap',
    intent: 'Explain a gap on a resume',
    owner: '/topics/resume-gap',
    kind: 'page',
    primary: 'explain a resume gap',
    secondary: ['explain a gap in my resume', 'employment gap on resume', 'gap in work history'],
    seo: {
      title: 'How to Explain a Resume Gap',
      description: 'How to show a gap on a resume honestly in one line, what to say in a cover note or interview, and what never to do.',
    },
  },
  {
    id: 'negotiate-a-job-offer',
    intent: 'Negotiate a job offer',
    owner: '/topics/negotiate-a-job-offer',
    kind: 'page',
    primary: 'negotiate a job offer',
    secondary: ['how to negotiate salary', 'negotiate salary offer', 'counter offer salary', 'negotiating a new job offer'],
    seo: {
      title: 'How to Negotiate a Job Offer',
      description: 'What to do before you reply, how to make the counter, and how to negotiate the whole package when base pay will not move.',
    },
  },
  {
    id: 'references-after-layoff',
    intent: 'Line up references after a layoff',
    owner: '/topics/references-after-layoff',
    kind: 'page',
    primary: 'references after a layoff',
    secondary: ['job references after being laid off', 'who to ask for a reference', 'reference after layoff'],
    seo: {
      title: 'References After a Layoff: Who to Ask and What to Say',
      description: 'Who to ask for a reference after a layoff, how to ask, and what to request from your former employer.',
    },
  },
  {
    id: 'how-long-job-search-takes',
    intent: 'Know how long a job search takes',
    owner: '/topics/how-long-job-search-takes',
    kind: 'page',
    primary: 'how long does a job search take',
    secondary: ['job search timeline'],
    seo: {
      title: 'How Long Does a Job Search Take?',
      description: 'What shapes the length of a job search, how to plan your money and week, and what to change when it takes long.',
    },
  },
  {
    id: 'job-search-while-employed',
    intent: 'Search for a job while employed',
    owner: '/topics/job-search-while-employed',
    kind: 'page',
    primary: 'job search while employed',
    secondary: ['looking for a job while employed', 'job hunting while working', 'search for a new job in secret'],
    seo: {
      title: 'Looking for a Job While You Still Have One',
      description: 'How to keep a job search private, manage your time, handle references, and know when to tell your employer.',
    },
  },
  {
    id: '401k-after-layoff',
    intent: 'Decide what to do with a 401(k) after a layoff',
    owner: '/topics/401k-after-layoff',
    kind: 'page',
    primary: '401k after a layoff',
    secondary: ['what to do with 401k after layoff', '401k rollover after layoff', 'cash out 401k after losing job'],
    seo: {
      title: 'Your 401(k) After a Layoff: Keep, Roll Over or Cash Out',
      description: 'Your options for a 401(k) after a layoff, tax and penalty details to check, and what to compare before you decide.',
    },
  },
  {
    id: 'freelance-after-layoff',
    intent: 'Freelance or consult after a layoff',
    owner: '/topics/freelance-after-layoff',
    kind: 'page',
    primary: 'freelance after a layoff',
    secondary: ['freelancing after losing job', 'start freelancing after layoff'],
    seo: {
      title: 'Freelancing or Consulting After a Layoff',
      description: 'How to get first clients, run the business side, report income if you collect unemployment, and keep your options open.',
    },
  },
  {
    id: 'informational-interviews',
    intent: 'Ask for and run informational interviews',
    owner: '/topics/informational-interviews',
    kind: 'page',
    primary: 'informational interview questions',
    secondary: ['how to ask for an informational interview'],
    seo: {
      title: 'Informational Interviews: How to Ask and What to Say',
      description: 'How to ask for a short conversation, what to ask, and how to follow up without asking for a job.',
    },
  },
  {
    id: 'thank-you-email-after-interview',
    intent: 'Send a thank-you email after an interview',
    owner: '/topics/thank-you-email-after-interview',
    kind: 'page',
    primary: 'interview thank you email',
    secondary: ['thank you note after interview', 'follow up after interview'],
    seo: {
      title: 'Thank-You Email After an Interview',
      description: 'What to include in a short thank-you email after an interview, practical points, and what to do if you forgot something.',
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
    id: 'severance-pay-explainer',
    intent: 'Understand how severance is taxed, how long I have to sign, and what to ask for',
    owner: '/resources/severance-pay',
    kind: 'page',
    primary: 'is severance taxed',
    secondary: ['severance pay taxes', 'severance tax withholding', 'is severance taxed at 22%', 'is severance taxed at a higher rate', 'how long do i have to sign a severance agreement', 'do i have to sign a severance agreement', 'severance agreement over 40', 'severance agreement 21 days 7 days', 'lump sum severance or salary continuation', 'what to ask for in a severance package', 'is severance pay required by law'],
    seo: {
      title: 'Severance Pay: Taxes, Your Agreement, What Is Typical',
      description: 'How severance is taxed, how many days you have to review and sign an agreement, what to ask for, and how it affects unemployment in your state. Sourced.',
      h1: 'Severance pay: taxes, your agreement and what is typical',
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
    secondary: ['{state} unemployment', 'file for unemployment in {state}', '{state} weekly unemployment benefit', '{state} unemployment eligibility', '{state} unemployment weeks', 'does severance affect unemployment in {state}', 'can i collect unemployment if i get severance in {state}', '{state} severance and unemployment'],
  },

  // ---- Layoff tracking -------------------------------------------------------------------------------------------
  {
    id: 'layoffs-hub',
    intent: 'Which companies are laying off, and where',
    owner: '/layoffs',
    kind: 'page',
    primary: 'layoff tracker',
    secondary: ['layoffs', 'recent layoffs', 'layoffs today', 'companies laying off', 'layoff list', 'mass layoffs', 'WARN notices', 'WARN notice list', 'WARN Act layoffs', 'who is laying off'],
    seo: {
      title: 'Layoff Tracker: Recent Layoffs and WARN Notices by State',
      description: 'Recent layoffs from WARN Act notices filed with state labor departments, collected daily: totals, the latest filings, and a page for every state and employer.',
    },
  },
  {
    id: 'layoffs-2026',
    intent: 'How many layoffs there have been this year, by month, state and company',
    owner: '/layoffs/2026',
    kind: 'page',
    primary: 'layoffs 2026',
    secondary: ['layoffs in 2026', '2026 layoffs', 'layoff statistics 2026', 'layoffs by month 2026', 'companies laying off 2026', 'biggest layoffs 2026', 'layoff list 2026', 'how many layoffs in 2026'],
    seo: {
      title: 'Layoffs 2026: Every WARN Notice by Month, State and Company',
      description: 'Layoffs in 2026 from WARN notices filed with state labor departments: totals by month, state, industry and company, a free CSV, and a line to cite.',
      h1: 'Layoffs 2026: every WARN notice, month by month',
    },
  },
  {
    id: 'layoffs-2026-month',
    intent: 'Layoffs in one month of 2026',
    owner: '/layoffs/2026/:month',
    kind: 'family',
    primary: '{month} 2026 layoffs',
    secondary: ['layoffs in {month} 2026', '{month} 2026 layoff notices', '{month} 2026 WARN notices'],
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
    id: 'press-data',
    intent: 'Cite and download our labor-market data',
    owner: '/press',
    kind: 'page',
    primary: 'white-collar unemployment data to cite',
    secondary: ['white-collar long-search index', 'long-term unemployment white-collar data', 'how to cite layoff data'],
    seo: {
      title: 'Press and Data: Cite Our Labor-Market Figures',
      description: 'The White-Collar Long-Search Index, layoff counts and AI-skill pay premium, each with its method, margin of error, license, citation and download.',
      h1: 'Press and data',
    },
  },
  {
    id: 'feeds',
    intent: 'Subscribe to layoff notices by RSS',
    owner: '/feeds',
    kind: 'page',
    primary: 'layoff notices rss feed',
    secondary: ['WARN notices rss', 'layoff alerts by state rss', 'layoff news feed', 'WARN notice feed'],
    seo: {
      title: 'Layoff Notice RSS Feeds by State and Industry',
      description: 'Free RSS and JSON feeds of new WARN layoff notices by state, industry and size, each with the state record, how it compares, and help for affected workers.',
      h1: 'Layoff and conference feeds',
    },
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
    secondary: ['AI jobs', 'AI skills by function', 'in-demand AI skills', 'which jobs need AI skills', 'AI-proof careers', 'careers that use AI skills', 'AI jobs pay'],
    seo: {
      title: 'AI Skills in Job Postings: How Common and What They Pay',
      description: 'Which jobs ask for AI skills, how much more those postings advertise, and what research says about seniority. Measured on live U.S. job postings, limits stated.',
    },
  },
  {
    id: 'ai-skills-pay-premium',
    intent: 'Do AI skills increase pay (explainer with a citable table)',
    owner: '/resources/ai-skills-pay-premium',
    kind: 'page',
    primary: 'AI skills salary premium',
    secondary: ['do AI skills increase salary', 'AI skills salary increase', 'AI skills non tech jobs salary', 'how much do AI skills pay', 'AI pay premium by function', 'AI skills pay marketing'],
    seo: {
      title: 'AI Skills Salary Premium: What U.S. Postings Advertise',
      description: 'The AI skills salary premium by function: how much more U.S. postings that ask for an AI skill advertise, matched on level and industry, with sample sizes and a CSV.',
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
      title: 'AI Training for Employees, Colleges and Workforce Boards',
      description: 'AI training programs for employees and the people you serve: we measure the AI-skill gap and build short courses for budgets that already pay for training.',
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
    secondary: ['severance pay calculator', 'how much severance should I get', 'severance by years of service', 'severance weeks per year', 'severance estimate', 'severance calculator after taxes', 'severance pay tax calculator', 'net severance pay'],
    seo: {
      title: 'Severance Calculator: Pay by Years of Service',
      description: 'Free severance calculator: the common one-to-two weeks per year range from your pay, what is left after withholding, and your state’s unemployment rule.',
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
    id: 'job-loss-readiness',
    intent: 'Check how ready I am if my job ended, while still employed',
    owner: '/tools/job-loss-readiness',
    kind: 'page',
    primary: 'layoff readiness check',
    secondary: ['am i prepared for a layoff', 'what if i lose my job', 'what happens to my benefits if i get laid off', 'what happens to my life insurance if i lose my job', 'layoff preparedness'],
    seo: {
      title: 'Layoff Readiness Check: If Your Job Ended Tomorrow',
      description: 'Still employed and nervous? See how long your money would last, what unemployment would pay, and what ends with your health, life and disability cover.',
      h1: 'Layoff readiness check: if your job ended tomorrow',
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
    id: 'layoff-risk-check',
    intent: 'See whether there are warning signs of a layoff at an employer',
    owner: '/tools/layoff-risk-check',
    kind: 'page',
    primary: 'layoff risk calculator',
    secondary: ['layoff risk assessment', 'am I going to be laid off', 'signs of layoffs', 'my layoff risk', 'layoff risk check', 'is my job safe from layoffs'],
    seo: {
      title: 'Layoff Risk Check: Are There Warning Signs at Your Employer?',
      description: 'Check five warning signs against public layoff records: your employer’s WARN notices, your industry’s trend and AI exposure. Free, nothing saved, not a prediction.',
      h1: 'Layoff risk check: are there warning signs where you work?',
    },
  },
  {
    id: 'ai-job-check',
    intent: 'A worker asks whether AI will affect their job and what to do about it',
    owner: '/tools/ai-job-check',
    kind: 'page',
    primary: 'is my job safe from AI',
    secondary: ['will AI replace my job', 'AI exposure by job', 'jobs most exposed to AI', 'AI job risk by occupation', 'how much of my job can AI do', 'AI job check'],
    seo: {
      title: 'Is My Job Safe from AI? Free AI Exposure Check by Job Title',
      description: 'Type your job title to see how much of the work AI already does, which related jobs pay more or are less exposed, and the skills to build. Free, from real usage.',
      h1: 'Is my job safe from AI? Free AI exposure check',
    },
  },
  {
    id: 'resume-bullet-rewriter',
    intent: 'A job seeker wants stronger résumé bullet points',
    owner: '/tools/resume-bullet-rewriter',
    kind: 'page',
    primary: 'resume bullet point rewriter',
    secondary: ['rewrite resume bullets', 'resume bullet points generator', 'improve resume bullet points', 'resume bullet point examples', 'AI resume bullet rewriter', 'resume bullet points checker'],
    seo: {
      title: 'Free Résumé Bullet Rewriter: Stronger Bullets, Your Facts',
      description: 'Paste up to four résumé bullet points and get stronger versions that keep your facts, plus a prompt for the number worth adding. Free, no account, nothing saved.',
      h1: 'Free résumé bullet rewriter',
    },
  },
  {
    id: 'interview-answer-coach',
    intent: 'A job seeker wants feedback on an interview answer before the interview',
    owner: '/tools/interview-answer-coach',
    kind: 'page',
    primary: 'interview answer feedback',
    secondary: ['practice interview answers', 'interview answer coach', 'how to answer why were you laid off', 'how to answer tell me about yourself', 'AI interview practice', 'interview answer checker'],
    seo: {
      title: 'Free Interview Answer Coach: Feedback and a Stronger Answer',
      description: 'Pick a common interview question, write your answer, and get honest feedback and a stronger version built from what you said. Free, no account, nothing saved.',
      h1: 'Free interview answer coach',
    },
  },
  {
    id: 'warn-notice-explained',
    intent: 'A worker asks what a WARN notice means and what an employer owes',
    owner: '/resources/warn-act',
    kind: 'page',
    primary: 'WARN Act rights',
    secondary: ['WARN notice meaning', 'what is the WARN Act', 'WARN Act severance', 'WARN Act pay', 'WARN Act exceptions', 'WARN Act for employees', 'state WARN laws'],
    seo: {
      title: 'WARN Notice Explained: 60 Days, Who Is Covered, Your Rights',
      description: 'The federal WARN Act in plain language: who is covered, when 60 days of notice is due, the three exceptions, what is owed if notice is skipped, and five state laws.',
      h1: 'The WARN Act in plain language: 60 days’ notice and what it means for you',
    },
  },
  {
    id: 'warn-notices-by-state',
    intent: 'Find every state’s WARN layoff notices in one place',
    owner: '/layoffs/by-state',
    kind: 'page',
    primary: 'WARN notices by state',
    secondary: ['WARN notice list by state', 'layoffs by state 2026', 'state WARN notice database', 'WARN notices by state 2026'],
    seo: {
      title: 'WARN Notices by State: Layoffs Filed in the Last 12 Months',
      description: 'Every state’s WARN layoff notices in one table: notices and workers named in the last 12 months, the latest filing and the state’s own record. Free to download.',
      h1: 'WARN notices by state: what each state’s record shows',
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
    secondary: ['what is a WARN notice', 'what is a reduction in force', 'what is COBRA', 'what is a retained search', 'what is garden leave', 'what is an applicant tracking system', 'what is a dislocated worker', 'what is an american job center', 'what is a release agreement', 'what is fractional work', 'what are transferable skills', 'what is total compensation', 'what is a non-compete'],
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
    id: 'what-to-say-when-laid-off',
    intent: 'Know what to say and ask in the layoff meeting and right after',
    owner: '/topics/what-to-say-when-laid-off',
    kind: 'page',
    primary: 'what to say when you get laid off',
    secondary: ['what to say in a layoff meeting', 'what to say to hr when laid off', 'how to respond when you are laid off', 'what to ask when you are laid off', 'laid off what to say', 'how to react to being laid off'],
    seo: {
      title: 'What to Say When You Get Laid Off: Scripts and Questions',
      description: 'Word-for-word lines for the layoff meeting, the questions to ask before you leave the room, what not to say, how to ask for better terms and the first 24 hours.',
    },
  },
  {
    id: 'acquisition-layoffs',
    intent: 'Judge the risk of layoffs after my company is acquired',
    owner: '/topics/acquisition-layoffs',
    kind: 'page',
    primary: 'layoffs after an acquisition',
    secondary: ['will i be laid off after an acquisition', 'company acquired what happens to my job', 'layoffs after a merger', 'merger layoffs', 'acquisition layoffs timeline', 'what to ask if your company is acquired', 'worried about layoffs after acquisition'],
    seo: {
      title: 'Layoffs After an Acquisition: What to Expect and Ask',
      description: 'Why roles are cut after a deal, how the timing usually runs, the questions to ask your manager and HR, and what to do now to protect your severance and your options.',
    },
  },
  {
    id: 'should-i-take-the-buyout',
    intent: 'Decide whether to accept a voluntary buyout offer',
    owner: '/topics/should-i-take-the-buyout',
    kind: 'page',
    primary: 'should i take the buyout',
    secondary: ['voluntary buyout', 'voluntary separation package', 'voluntary separation program', 'buyout offer from employer', 'voluntary severance', 'deferred resignation', 'is a buyout worth it'],
    seo: {
      title: 'Should I Take the Buyout? What to Weigh Before You Answer',
      description: 'What a voluntary buyout is, the answers to get in writing, a simple way to compare it with staying, when it makes sense and how to ask for more time or money.',
    },
  },
  {
    id: 'fired-vs-laid-off',
    intent: 'Understand the difference between being fired and laid off',
    owner: '/topics/fired-vs-laid-off',
    kind: 'page',
    primary: 'fired vs laid off',
    secondary: ['difference between fired and laid off', 'laid off vs fired', 'terminated vs laid off', 'laid off or fired unemployment', 'fired vs let go', 'can i collect unemployment if i was fired'],
    seo: {
      title: 'Fired vs Laid Off: The Difference and Why It Matters',
      description: 'How a layoff differs from a firing, what each means for unemployment, severance and COBRA, what the paperwork should say and how to explain either in an interview.',
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
    id: 'what-is-job-transition-platform',
    intent: 'Understand what a job transition platform is',
    owner: '/topics/what-is-a-job-transition-platform',
    kind: 'page',
    primary: 'what is a job transition platform',
    secondary: ['job transition platform meaning', 'job transition services', 'what is job transition', 'job transition help'],
    seo: {
      title: 'What Is a Job Transition Platform? A Plain Definition',
      description: 'A job transition platform helps people move from one job to the next after a layoff or career change. What it includes, who pays for it and how to choose one.',
    },
  },
  {
    id: 'platforms-for-laid-off',
    intent: 'Pick a service to help after a layoff',
    owner: '/topics/job-transition-platforms-for-laid-off-professionals',
    kind: 'page',
    primary: 'best job transition platform for laid-off professionals',
    secondary: ['best outplacement services', 'outplacement for laid off professionals', 'job transition services for laid off workers', 'where to get help after a layoff'],
    seo: {
      title: 'Job Transition Platforms for Laid-Off Professionals',
      description: 'If your severance offers outplacement, use it first. Then free public help, then free-to-start tools. How the options compare and how to choose between them.',
    },
  },
  {
    id: 'what-is-outplacement',
    intent: 'Understand outplacement as a laid-off employee',
    owner: '/topics/what-is-outplacement',
    kind: 'page',
    primary: 'what is outplacement',
    secondary: ['outplacement meaning', 'what does outplacement include', 'how to get outplacement', 'is outplacement worth it'],
    seo: {
      title: 'What Is Outplacement? What It Includes and How to Get It',
      description: 'Outplacement is job search help an employer pays for when it ends your job. What it includes, how to ask HR for it and what to do if it is not offered.',
    },
  },
  {
    id: 'career-test',
    intent: 'Find what career fits me',
    owner: '/topics/career-test',
    kind: 'page',
    primary: 'career test',
    secondary: ['career assessment', 'career quiz', 'career test for adults', 'best career for me', 'free career test'],
    seo: {
      title: 'Career Test: How to Find the Right Next Career',
      description: 'A career test can suggest jobs to explore, but it cannot tell you what employers will hire you for. How to use one, a free option and how to check the market.',
    },
  },
  {
    id: 'resume-examples',
    intent: 'See resume examples',
    owner: '/topics/resume-examples',
    kind: 'page',
    primary: 'resume examples for experienced professionals',
    secondary: ['resume examples', 'resume bullet examples', 'resume summary examples', 'resume samples', 'good resume bullet points'],
    seo: {
      title: 'Resume Examples for Experienced Professionals',
      description: 'Before-and-after resume bullet and summary examples for experienced professionals, how to write a layoff line and how to check your own resume for free.',
      h1: 'Resume examples for experienced professionals: before and after',
    },
  },
  {
    id: 'choose-career-coach',
    intent: 'Choose a career coach',
    owner: '/topics/how-to-choose-a-career-coach',
    kind: 'page',
    primary: 'how to choose a career coach',
    secondary: ['ai career coach vs human', 'how to find a career coach', 'what to ask a career coach'],
    seo: {
      title: 'How to Choose a Career Coach: AI or Human',
      description: 'Choose a career coach by what you need: a plan, accountability, interview practice or a career change. AI or human, what to ask and what to avoid.',
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
    id: 'rapid-response-landing',
    intent: 'Rapid Response team or workforce board looks for layoff response support',
    owner: '/for-rapid-response',
    kind: 'page',
    primary: 'layoff response for workforce boards',
    secondary: ['rapid response team software', 'dislocated worker services software', 'laid-off worker sign-up page'],
    seo: {
      title: 'Layoff Response for Workforce Boards and Rapid Response Teams',
      description: 'One sign-up page for the workers in a layoff: local jobs ranked at the top, career support and AI skills, with counts of who stayed in your region.',
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
  '/topics/what-to-say-when-laid-off': 'What to say when you get laid off',
  '/topics/acquisition-layoffs': 'Layoffs after an acquisition',
  '/topics/should-i-take-the-buyout': 'Should I take the buyout?',
  '/topics/fired-vs-laid-off': 'Fired vs laid off',
  '/topics/cover-letter-tips': 'Cover letter tips',
  '/topics/severance': 'Severance package: what it is and how to negotiate',
  '/topics/job-search-strategy': 'Job search strategy',
  '/topics/resume-tips': 'Resume tips for experienced professionals',
  '/topics/career-pivot': 'Career pivot',
  '/topics/career-exploration': 'Career exploration',
  '/topics/executive-recruiters': 'Executive recruiters and search firms',
  '/topics/reverse-recruiter': 'Reverse recruiter',
  '/topics/resume-review': 'Free resume review',
  '/topics/what-is-a-job-transition-platform': 'What is a job transition platform?',
  '/topics/job-transition-platforms-for-laid-off-professionals': 'Job transition platforms for laid-off professionals',
  '/topics/what-is-outplacement': 'What is outplacement?',
  '/topics/career-test': 'Career test',
  '/topics/resume-examples': 'Resume examples for experienced professionals',
  '/topics/how-to-choose-a-career-coach': 'How to choose a career coach',
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
  '/resources/ai-skills-pay-premium': 'AI skills salary premium',
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
  '/start/laid-off': ['/topics/job-transition-platforms-for-laid-off-professionals', '/resources/72-hours', '/topics/what-to-say-when-laid-off', '/unemployment-benefits', '/topics/severance', '/resources/cobra-aca', '/coaching', '/funding'],
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
  '/resources/pre-exit': ['/tools/job-loss-readiness', '/topics/severance', '/resources/72-hours', '/resources/narrative-workshop', '/resources/network-activation'],
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
  '/topics/explain-a-layoff': ['/topics/fired-vs-laid-off', '/topics/resume-tips', '/resources/interview-prep', '/resources/narrative-workshop', '/coaching'],
  '/topics/how-to-lay-off-employees': ['/tools/warn-act-checker', '/rapid-response', '/outplacement', '/glossary'],
  '/topics/cover-letter-tips': ['/topics/resume-tips', '/resources/narrative-workshop', '/resources/interview-prep'],
  '/topics/severance': ['/tools/severance-calculator', '/topics/what-to-say-when-laid-off', '/topics/should-i-take-the-buyout', '/glossary', '/unemployment-benefits', '/resources/cobra-aca', '/resources/pre-exit', '/resources/72-hours', '/coaching'],
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
  '/topics/what-to-say-when-laid-off': ['/topics/severance', '/tools/layoff-deadlines', '/topics/explain-a-layoff', '/resources/72-hours', '/unemployment-benefits', '/coaching'],
  '/topics/acquisition-layoffs': ['/tools/layoff-runway', '/topics/severance', '/topics/what-to-say-when-laid-off', '/resources/pre-exit', '/layoffs', '/coaching'],
  '/topics/should-i-take-the-buyout': ['/tools/severance-calculator', '/tools/layoff-runway', '/topics/severance', '/resources/cobra-aca', '/unemployment-benefits', '/coaching'],
  '/topics/fired-vs-laid-off': ['/unemployment-benefits', '/topics/explain-a-layoff', '/topics/severance', '/resources/cobra-aca', '/glossary', '/coaching'],
  '/topics/reverse-recruiter': ['/topics/executive-recruiters', '/coaching', '/submit-resume', '/scam-watch', '/dossier'],
  '/topics/what-is-a-job-transition-platform': ['/topics/job-transition-platforms-for-laid-off-professionals', '/start/laid-off', '/topics/what-is-outplacement', '/coaching', '/glossary'],
  '/topics/job-transition-platforms-for-laid-off-professionals': ['/topics/what-is-outplacement', '/unemployment-benefits', '/workforce-boards', '/topics/severance', '/start/laid-off'],
  '/topics/what-is-outplacement': ['/topics/job-transition-platforms-for-laid-off-professionals', '/topics/severance', '/resources/72-hours', '/glossary', '/start/laid-off'],
  '/topics/career-test': ['/topics/career-exploration', '/topics/career-pivot', '/start/career-change', '/coaching'],
  '/topics/resume-examples': ['/topics/resume-review', '/tools/resume-check', '/topics/resume-tips', '/topics/cover-letter-tips'],
  '/topics/how-to-choose-a-career-coach': ['/coaching', '/topics/interview-questions-and-answers', '/topics/career-advice', '/topics/job-search-strategy'],
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
