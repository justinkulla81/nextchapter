// Answer-first explainers for the questions job seekers put to AI assistants and search (the list in
// src/lib/ai-visibility/prompts.ts). Same rules as explainers.ts: every statement general and checkable, no invented
// numbers. Each leads with the answer in the first two sentences, because that is the part an assistant quotes.

import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import type { TopicContent } from './explainers'

export const QUESTION_TOPICS: TopicContent[] = [
  {
    slug: 'first-two-weeks-after-layoff',
    h1: 'Laid off: what to do in the first two weeks',
    lede: 'In the first two weeks after a layoff, file for unemployment, read your severance agreement before you sign anything, sort out health coverage, and tell your network. Do those four things before you rewrite a resume, because three of them have deadlines and the fourth gets you leads.',
    sections: [
      {
        h2: 'Days 1 to 3: protect your money and your deadlines',
        bullets: [
          'File for unemployment the same day or the next. In most states benefits count from the week you file, not the week you were laid off.',
          'Do not sign a severance agreement on the spot. Ask for it in writing, note the deadline and read what you are releasing.',
          'Get your paperwork: final pay date, accrued vacation payout, benefits end date, 401(k) and equity statements, and a letter confirming the layoff.',
          'Ask whether outplacement or job search help is included. Employers often offer it if you ask.',
        ],
      },
      {
        h2: 'Days 3 to 7: health coverage and cash flow',
        bullets: [
          'Compare COBRA with an ACA Marketplace plan. Losing job-based coverage opens a special enrollment window, generally 60 days from the loss of coverage, and COBRA has an election window of at least 60 days.',
          'List fixed monthly costs and what you can pause or reduce. Call lenders early if a payment will be hard.',
          'Leave retirement accounts where they are until you have compared rollover options. Early withdrawals can carry taxes and penalties.',
        ],
      },
      {
        h2: 'Days 7 to 14: start the search with people, not applications',
        bullets: [
          'Tell your network in plain words what happened and what you want next. Short and specific beats long and vague.',
          'Ask three former colleagues for a reference line and a 15-minute call.',
          'Update your LinkedIn headline and turn on the setting that tells recruiters you are open to work.',
          'Set a weekly plan: a number of conversations, applications and follow-ups you can keep up for months.',
        ],
      },
    ],
    faq: [
      { q: 'Should I apply for jobs right away?', a: 'Start, but do the money and coverage steps first. Applications can wait a few days; benefit deadlines and a severance review window cannot.' },
      { q: 'How soon should I file for unemployment?', a: 'Immediately. Most states pay from the date you file, so each day of delay can cost a week of benefits.' },
      { q: 'Do I have to accept the severance offer?', a: 'No. Offers are often negotiable, and a signed release usually waives claims against the employer. Read it and ask questions before you sign.' },
      { q: 'What should I tell people who ask what happened?', a: 'Say it briefly and without apology: your role was eliminated, what you did well, and what you are looking for next.' },
    ],
    cta: { title: 'Get a plan that starts with the deadlines', body: 'A free Market Reality Assessment and a weekly plan: unemployment, health coverage, references, then the search.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-28',
  },
  {
    slug: 'resume-ats-ai-screening',
    h1: 'How to write a resume that gets through ATS and AI screening',
    lede: 'To get through applicant tracking and AI screening, use a plain single-column resume with standard headings, put real text (not images or text boxes) in a .docx or text-based PDF, and use the same words the job posting uses for skills and titles you truly have. Software reads the file first and a person usually decides second, so write for both.',
    sections: [
      {
        h2: 'Format so the software can read it',
        bullets: [
          'One column. Tables, text boxes, headers and footers can scramble or drop content when a system extracts the text.',
          'Standard headings: Summary, Experience, Education, Skills. Creative labels can leave a section unread.',
          'Standard fonts and normal bullets. Skip icons, rating bars and graphics for skills.',
          'A .docx or a PDF exported from a word processor. A scanned image of a page has no text for the system to read.',
          'Put each job in the same order: title, employer, dates, then results.',
        ],
      },
      {
        h2: 'Match the posting without stuffing it',
        bullets: [
          'Use the posting’s own terms for tools, certifications and titles where they are true for you. If it says “financial planning and analysis”, do not only write “FP&A”.',
          'Spell out an acronym once, then use it.',
          'Do not paste hidden keyword text. Recruiters see it and it can get a resume rejected.',
          'Lead each bullet with the result, then how: “Cut month-end close from 9 days to 5 by automating reconciliations.”',
        ],
      },
      {
        h2: 'What AI screening can and cannot do',
        paragraphs: [
          'Many systems store, search and rank resumes, and some use AI to summarize or score them. Rules about their use are changing, and some places require notice or audits. In most hiring a recruiter or manager still makes the decision, so a resume that parses cleanly and reads clearly in thirty seconds serves you with either reader.',
        ],
      },
    ],
    faq: [
      { q: 'Is a PDF or a Word file better for ATS?', a: 'Either works if the PDF is text-based. When a posting asks for a format, use that one. If unsure, a .docx is the safest.' },
      { q: 'Should I tailor my resume for every job?', a: 'Lightly. Adjust the summary, the order of bullets and the key terms for the posting. Do not claim skills you do not have.' },
      { q: 'Can I use AI to write my resume?', a: 'Yes for drafting and tightening, but check every fact and number yourself. Your resume must be something you can defend in an interview.' },
      { q: 'How long should the resume be?', a: 'One to two pages for most experienced professionals. Put the most relevant results first.' },
    ],
    cta: { title: 'See how your resume reads', body: 'Get a free read on how the market sees your background, with the changes that matter most.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-28',
  },
  {
    slug: 'hidden-job-market',
    h1: 'The hidden job market: how to find jobs that are not posted',
    lede: 'The hidden job market is the set of roles filled through referrals, recruiters and direct contact before or without a public posting. You reach it by telling specific people what you want, contacting hiring managers directly, and checking company career pages and job alerts early, since many roles are filled quickly.',
    sections: [
      {
        h2: 'Four ways in',
        bullets: [
          'Referrals: ask former colleagues and managers who they know at your target companies. A named introduction beats a cold application.',
          'Recruiters: retained and contingency recruiters hold searches the public never sees. Send a short note naming your function, level and target roles.',
          'Direct outreach: write to the hiring manager, not HR, with one line about the problem you would solve and one proof point.',
          'Early alerts: set alerts on company career pages and job boards so you can apply in the first days a role is open.',
        ],
      },
      {
        h2: 'Where the people are',
        bullets: [
          'Alumni networks and your college career office.',
          'Professional associations and industry conferences, where you can meet decision-makers in person.',
          'Former employers, vendors, customers and board members.',
        ],
      },
      {
        h2: 'A simple weekly rhythm',
        paragraphs: ['Aim for a fixed number of real conversations each week, not a number of applications. Keep a list of people, the date you wrote, and the next step. Follow up once after a week or two.'],
      },
    ],
    faq: [
      { q: 'Is the hidden job market real?', a: 'Yes. Many roles are filled through people the employer already knows or trusts, and some are never posted. The exact share varies by field and level, so treat any single percentage with caution.' },
      { q: 'How do I ask for a referral without being awkward?', a: 'Name the company and role, say why you fit in one sentence, and make it easy: offer a short note they can forward.' },
      { q: 'Should I still apply to posted jobs?', a: 'Yes, but pair each application with a person: a referral, or a message to the hiring manager.' },
      { q: 'Do recruiters charge job seekers?', a: 'Legitimate recruiters are paid by employers. Be wary of anyone asking you for a fee to find you a job.' },
    ],
    cta: { title: 'Find the events where your hiring managers go', body: 'Browse conferences by industry and function, with dates, cost and cheaper ways to attend.', label: 'Browse conferences', href: '/conferences' },
    updated: '2026-10-28',
  },
  {
    slug: 'linkedin-after-layoff',
    h1: 'How to update LinkedIn after a layoff',
    lede: 'After a layoff, rewrite your LinkedIn headline around the role you want next, turn on the open-to-work setting for recruiters, and refresh your About section with two or three results. You do not need to announce the layoff in your headline; a short post saying what you are looking for is enough.',
    sections: [
      {
        h2: 'Profile changes that matter',
        bullets: [
          'Headline: your target role and two strengths, not “seeking opportunities”.',
          'About: three or four sentences on what you do, who you do it for and one or two results with numbers.',
          'Current role: it is fine to end it. Enter the real end date and keep the result bullets.',
          'Skills: pin the ones in the postings you want. Ask a few colleagues to endorse them.',
          'Photo and banner: a clear recent photo makes outreach feel safe to answer.',
        ],
      },
      {
        h2: 'Open to work: pick the audience',
        paragraphs: ['LinkedIn lets you share that you are open to work with recruiters only, or with everyone through a photo frame. Recruiters-only keeps it off your public profile, which some people prefer while they are still employed or want less visibility.'],
      },
      {
        h2: 'One post that does the work',
        bullets: [
          'Say your role was eliminated, in one sentence and without blame.',
          'Name the roles and companies you want, and the kind of introduction that would help.',
          'Thank someone specific. It reads as confident rather than anxious.',
        ],
      },
    ],
    faq: [
      { q: 'Should I put “laid off” in my headline?', a: 'Usually not. Lead with what you offer. The layoff is context, not your headline.' },
      { q: 'Should I turn on the green open-to-work frame?', a: 'It is a choice. The recruiters-only setting is more private; the public frame signals urgency to everyone who sees your photo.' },
      { q: 'Should I post about the layoff?', a: 'A short, specific post often brings introductions. Keep it factual and forward-looking.' },
      { q: 'How often should I be active?', a: 'A few comments or posts a week on your field keeps you visible to recruiters and former colleagues.' },
    ],
    cta: { title: 'Know what the market sees', body: 'A free read on how the market sees your background, so your profile leads with your strongest case.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-28',
  },
  {
    slug: 'career-coach-cost',
    h1: 'Is a career coach worth it? What it costs and what to ask',
    lede: 'A career coach is worth it when you have a specific problem a coach can solve, such as a senior search, a pivot, interview practice or a salary negotiation, and not worth it if you are looking for someone to find the job for you. Prices vary widely, from single sessions to multi-month packages, so ask exactly what is included before you pay.',
    sections: [
      {
        h2: 'What a coach can do for you',
        bullets: [
          'Sharpen your story and resume for the level you want.',
          'Run mock interviews and give direct feedback.',
          'Plan a search for a senior or unusual role, including how to approach recruiters and boards.',
          'Help you prepare a negotiation for pay, title and severance terms.',
        ],
      },
      {
        h2: 'Questions to ask before you buy',
        bullets: [
          'What exactly is included: number of sessions, resume work, interview practice, time between sessions?',
          'Who has the coach worked with at my level and in my field?',
          'Is there a contract, and what happens if I stop early?',
          'What is the total price, in writing?',
          'Will the coach guarantee a job? A promise of a job is a warning sign.',
        ],
      },
      {
        h2: 'Free and low-cost options first',
        bullets: [
          'Ask whether your severance includes outplacement. Many employers pay for it if asked.',
          'American Job Centers and state workforce agencies offer free career help.',
          'College alumni career offices often serve graduates at no charge.',
          'Free AI coaching and assessments can cover the basics before you pay for a person.',
        ],
      },
    ],
    faq: [
      { q: 'How much does a career coach cost?', a: 'It depends on the coach, the level of the work and the length of the engagement. Ask for the total price of a defined package and compare it with what is included.' },
      { q: 'Can a coach get me a job?', a: 'No. A coach improves your materials, preparation and strategy. The job offer depends on the market and your fit.' },
      { q: 'Coach, recruiter or resume writer?', a: 'A recruiter is paid by an employer to fill a role. A resume writer produces a document. A coach works with you on strategy, preparation and decisions.' },
      { q: 'Can my employer pay for it?', a: 'Sometimes, through outplacement in a severance package. Ask during the exit conversation, before you sign.' },
    ],
    cta: { title: 'Start with the free coach', body: 'Our AI career coach and a free assessment cover the basics, with a human coach on top if you want one.', label: 'See coaching', href: '/coaching' },
    updated: '2026-10-28',
  },
  {
    slug: 'unemployment-and-job-search',
    h1: 'Unemployment benefits and your job search: the rules to know',
    lede: 'To collect unemployment while you search, file right away, certify every week, do the job search activities your state requires and report any pay you receive. Rules and amounts differ by state, so read your state’s instructions and keep a log of each contact you make.',
    sections: [
      {
        h2: 'What most states require',
        bullets: [
          'File as soon as you lose your job; benefits generally start from the date you file.',
          'Certify each week that you were able and available for work and actively looking.',
          'Keep a work-search record: date, employer, how you applied and the result. Many states require a minimum number of contacts per week.',
          'Report earnings, including part-time and freelance work, and severance if your state counts it.',
          'Accept suitable work that is offered. Turning it down can end benefits.',
        ],
      },
      {
        h2: 'Common mistakes',
        bullets: [
          'Waiting to file because you expect severance. Check your state’s rule instead; in many states you should still file.',
          'Missing a weekly certification, which can delay payment.',
          'Not reporting small earnings. It can create an overpayment you must repay.',
        ],
      },
      {
        h2: 'Make the required activity count',
        paragraphs: ['Most states accept networking, interviews, job fairs and workforce center workshops along with applications. Use the minimum to build real conversations, not just to fill the log.'],
      },
    ],
    faq: [
      { q: 'How long do unemployment benefits last?', a: 'It varies by state, from a few months to about half a year in most. Our state pages list the maximum weeks.' },
      { q: 'Does severance stop unemployment?', a: 'In some states severance delays or reduces benefits for the weeks it covers; in others it does not. File anyway and report it as asked.' },
      { q: 'Can I work part-time and still collect?', a: 'Often, with a reduced payment. You must report the earnings each week.' },
      { q: 'Do I have to look for work in my own field?', a: 'Early on, many states allow a search in your usual field. Over time you may have to widen it.' },
    ],
    cta: { title: 'See your state’s rules', body: 'Maximum weekly benefit, how many weeks, the waiting week, how severance counts and where to file, state by state.', label: 'Find your state', href: '/unemployment-benefits' },
    updated: '2026-10-28',
  },
  {
    slug: 'best-job-sites-for-executives',
    h1: 'The best ways to find senior and executive jobs',
    lede: 'Senior and executive roles are found mostly through networks, executive recruiters and company career pages, with job boards as a supplement. Use LinkedIn for visibility and outreach, register with retained search firms in your field, and set alerts on the career pages of your target employers.',
    sections: [
      {
        h2: 'Where senior roles are found',
        bullets: [
          'Executive search firms: retained searches for director and above are often not advertised. Contact firms that recruit in your function and industry.',
          'LinkedIn: use it to be found and to reach hiring managers and recruiters directly.',
          'Company career pages: roles often appear here first, so set alerts on your target employers.',
          'Senior-focused boards: some boards list only higher-paying roles, and some charge job seekers, so read the terms first.',
          'Professional associations, boards of directors and investors, who hear of leadership searches early.',
        ],
      },
      {
        h2: 'How to work each channel',
        bullets: [
          'Recruiters: send a short note with function, level, target industries and location, then be available and responsive.',
          'Boards: apply early and pair the application with a message to a person.',
          'Network: ask for introductions to a named hiring manager, not for “any openings”.',
        ],
      },
      {
        h2: 'Check the source of every posting',
        paragraphs: ['Executive roles attract scams. Confirm the posting on the employer’s own career site and never pay a fee to be placed. See our guide to spotting fake postings.'],
      },
    ],
    faq: [
      { q: 'Should I pay for a premium job board?', a: 'Only if you can see what it lists and it matches your level. Compare the roles it shows against the free sources first.' },
      { q: 'How do I get on an executive recruiter’s radar?', a: 'Send a short, specific note, keep your LinkedIn current and ask contacts for introductions to recruiters they trust.' },
      { q: 'Do executive roles get posted publicly?', a: 'Some do and many do not. A strong network and recruiter relationships reach roles the public never sees.' },
      { q: 'How long does a senior search take?', a: 'Longer than a mid-level search, often several months. Plan your finances and your weekly rhythm for that.' },
    ],
    cta: { title: 'See open senior roles', body: 'Browse verified professional openings at the director level and above, checked against employer career sites.', label: 'Browse jobs', href: '/jobs' },
    updated: '2026-10-28',
  },
  {
    slug: 'networking-after-layoff',
    h1: 'How to network after a layoff when you feel embarrassed',
    lede: 'Network after a layoff by asking people for a short conversation about your field, not for a job. Say what happened in one sentence, ask for their view or an introduction, and follow up. Most people want to help, and a layoff carries less stigma than it feels like it does.',
    sections: [
      {
        h2: 'A message that works',
        bullets: [
          'Open with the connection: “We worked together on X.”',
          'One sentence on the change: “My role was eliminated in a restructuring.”',
          'One clear ask: “Could we talk for 15 minutes about how [company or field] is hiring for [role]?”',
          'Make it easy: offer two times, or say you will work around theirs.',
        ],
      },
      {
        h2: 'Who to contact, in order',
        bullets: [
          'People who know your work best: former managers and close colleagues.',
          'People who have been through a layoff themselves.',
          'People at your target companies, through someone you share.',
          'Recruiters in your function.',
        ],
      },
      {
        h2: 'Keeping it going',
        bullets: [
          'End each call by asking who else you should talk to.',
          'Send a thank-you the same day with a one-line summary of what you will do next.',
          'Update the person when something comes of their advice. It is the best reason to write again.',
        ],
      },
    ],
    faq: [
      { q: 'Is it okay to tell people I was laid off?', a: 'Yes. Layoffs are common, and a plain statement without blame is respected.' },
      { q: 'How many conversations should I have each week?', a: 'A number you can sustain, often five to ten for an active search. Consistency matters more than volume.' },
      { q: 'What if people do not reply?', a: 'Follow up once after a week or two. Many replies come on the second note.' },
      { q: 'Should I ask directly for a job?', a: 'Ask for advice and introductions first. Specific requests for a role come naturally once the person understands what you want.' },
    ],
    cta: { title: 'Get a weekly plan', body: 'A free Market Reality Assessment and a weekly Search Sprint that builds conversations into your week.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-28',
  },
]
