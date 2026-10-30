// The questions real job seekers ask AI assistants, phrased the way people type them. The weekly citation check (run.ts) asks a
// rotating share of them and records whether NextChapter is sourced or named; the gap report (gaps.ts) turns the stored answers
// into a to-do list of pages. Three groups: job search, career change and layoff, résumé and interview.
//
// Cost: the weekly run asks GENERAL_PER_RUN of these (prompts-data.ts), not all of them. A full pass over every question on every
// live assistant costs about $0.10 per question (see COST_PER_QUESTION_USD in gaps.ts), so asking all of them at once is not
// done under the monthly cap; the weekly rotation covers the whole list over time. Keys are stable ids: do not rename one, the
// history is stored under it.
//
// Each cluster names the page that should answer it (`page`, an existing NextChapter path) or what to write (`newPage`). The gap
// report prints that as the one-line brief on a row where we are absent.

export type PromptGroup = 'job-search' | 'career-change' | 'resume-interview'

export const GROUP_LABEL: Record<PromptGroup, string> = {
  'job-search': 'Job search',
  'career-change': 'Career change and layoff',
  'resume-interview': 'Résumé and interview',
}

type Entry = string | [key: string, prompt: string]
interface Cluster {
  id: string
  group: PromptGroup
  /** An existing page that should answer these questions. */
  page?: string
  /** When no page fits: what to build. */
  newPage?: string
  prompts: Entry[]
}

const CLUSTERS: Cluster[] = [
  // ───────────── Job search ─────────────
  {
    id: 'sites', group: 'job-search', page: '/jobs',
    prompts: [
      ['executive-job-sites', 'What are the best job sites for senior executives and directors?'],
      'best job boards for professionals with 15 years of experience',
      'which job site has the most director level jobs',
      'are there job boards that only list white collar jobs',
      'what job sites do recruiters actually use to find senior people',
      'is LinkedIn the best place to look for management jobs or are there better ones',
      'job sites that show salary on every posting',
      'where can I find vice president jobs that are not on Indeed',
      'best free job search sites for experienced professionals in 2026',
    ],
  },
  {
    id: 'senior-hiring', group: 'job-search', page: '/top-employers',
    prompts: [
      ['companies-hiring-senior', 'Which companies are hiring senior managers and directors right now?'],
      'which companies are hiring the most professionals this month',
      'who is hiring in finance right now for experienced people',
      'which employers have the most open jobs for marketing managers',
      'what companies are hiring product managers after the layoffs',
      'list of companies that are actively hiring operations leaders',
      'biggest employers hiring in healthcare administration',
      'which industries are hiring the most experienced professionals in 2026',
      'which companies hire laid off workers from big tech',
    ],
  },
  {
    id: 'hidden', group: 'job-search', page: '/topics/hidden-job-market',
    prompts: [
      ['hidden-job-market', 'How do I find jobs that are never posted publicly?'],
      'what percent of jobs are filled without being posted',
      'how do I get a job through a referral when I do not know anyone at the company',
      'how do I reach a hiring manager directly without applying online',
      'how do I get recruiters to find me',
      'how do executives find their next job',
      'is cold emailing a hiring manager worth it and what should it say',
      'how do I use alumni networks to find a job',
      'how do I ask someone for a job referral without being awkward',
    ],
  },
  {
    id: 'ai-search', group: 'job-search', newPage: 'A guide to running a job search with AI assistants: prompts to try, what to check, and where our data answers what the assistant cannot',
    prompts: [
      'how do I use ChatGPT to find a job',
      'can AI find me jobs that fit my experience',
      'what is the best AI tool for job searching',
      'can I trust AI job recommendations',
      'how do I use Claude or ChatGPT to plan my job search',
      'is there an AI that applies to jobs for me and is it a good idea',
      'which AI job search tools are worth paying for',
      'how do I ask an AI assistant to find companies that are hiring in my field',
      'can AI tell me which companies are about to lay people off',
    ],
  },
  {
    id: 'scams', group: 'job-search', page: '/scam-watch',
    prompts: [
      ['job-search-scams', 'How do I spot fake job postings and recruiter scams?'],
      'is this recruiter message on LinkedIn a scam',
      'what are ghost jobs and how do I tell if a posting is one',
      'why do companies post jobs they are not hiring for',
      'job offer asks me to buy equipment with a check, is it a scam',
      'how do I verify a company is real before I interview',
      'how do I know if a remote job offer is legitimate',
      'fake job interview on Telegram or WhatsApp, what should I do',
      'how do I report a job scam',
    ],
  },
  {
    id: 'tracker', group: 'job-search', page: '/topics/job-search-tracker',
    prompts: [
      ['job-search-tracker', 'What is a good way to track my job applications and follow-ups?'],
      'best spreadsheet template for tracking job applications',
      'how many applications should I send per week',
      'how do I organize a job search when I am applying to 50 companies',
      'is there a free CRM for a job search',
      'how often should I follow up after applying',
      'what should I do each day of a job search to stay on track',
      'how do I stay motivated during a long job search',
      'how do I measure whether my job search is working',
    ],
  },
  {
    id: 'pay', group: 'job-search', page: '/tools/pay-check',
    prompts: [
      ['salary-check', 'How do I know if a job offer pays fairly for my level and city?'],
      'how much should a director of marketing make in Chicago',
      'what is the average salary for a senior product manager',
      'where can I see real salary data for my job title',
      'how do I find out what a company pays before I apply',
      'how much does a VP of finance make',
      'does a job posting without a salary mean it pays less',
      'how do I compare a job offer in one city to my salary in another',
      'what states require salary on job postings',
    ],
  },
  {
    id: 'places', group: 'job-search', page: '/places',
    prompts: [
      ['relocate-job-search', 'How do I compare cities to relocate for a new job?'],
      'which cities have the most professional jobs right now',
      'best cities for finance careers outside New York',
      'is it a good time to move for a job',
      'how do I search for jobs in a city I do not live in yet',
      'cities with low cost of living and a strong job market for professionals',
      'how much salary do I need to move from Seattle to Austin',
      'what are the best states for tech jobs after layoffs',
      'should I look for remote jobs or move to where the jobs are',
    ],
  },
  {
    id: 'age-level', group: 'job-search', page: '/topics/laid-off-over-40',
    prompts: [
      ['jobs-over-50', 'How do I find a job after 50 when companies seem to prefer younger candidates?'],
      'how do I avoid age discrimination in a job search',
      'should I remove old jobs from my resume to look younger',
      'am I overqualified for jobs and how do I handle it',
      'how do I get hired as a 55 year old executive',
      'is it harder to find a job at 45',
      'how do I get an entry level job as a career changer',
      'how do I compete with younger candidates who know AI tools',
      'should I take a step down in title to get hired',
    ],
  },
  {
    id: 'strategy', group: 'job-search', page: '/topics/job-search-strategy',
    prompts: [
      'how long does it take to find a job at the director level',
      'what is the best job search strategy for 2026',
      'how do I run a job search while I still have a job',
      'how many interviews does it take to get an offer',
      'should I apply to jobs I am not fully qualified for',
      'how do I find a job in a bad market',
      'is it normal to get no responses to applications',
      'how do I get more interviews from the same number of applications',
      'what should I do when I have been searching for six months',
    ],
  },

  // ───────────── Career change and layoff ─────────────
  {
    id: 'first-steps', group: 'career-change', page: '/resources/72-hours',
    prompts: [
      ['laid-off-first-steps', 'I was just laid off from a senior role. What should I do in the first two weeks?'],
      'I just got laid off, what do I do first',
      'what should I do in the first 72 hours after a layoff',
      'what do I say when my boss tells me I am laid off',
      'what should I ask HR in my layoff meeting',
      'checklist for after being laid off',
      'how do I tell my family I was laid off',
      'should I sign the separation agreement right away',
      'what do I do with my work laptop and files after a layoff',
    ],
  },
  {
    id: 'severance', group: 'career-change', page: '/resources/severance-pay',
    prompts: [
      ['severance-negotiate', 'How do I negotiate a better severance package after a layoff?'],
      'how much severance should I get after 10 years',
      'is severance taxable and how much will I keep',
      'is severance pay required by law',
      'can I collect unemployment while on severance',
      'what is a typical severance package for a vice president',
      'should I hire a lawyer to review my severance agreement',
      'what is in a separation agreement and what should I not sign',
      'how long do I have to sign a severance agreement',
    ],
  },
  {
    id: 'unemployment', group: 'career-change', page: '/unemployment-benefits',
    prompts: [
      ['unemployment-benefits-job-search', 'How do I balance collecting unemployment with a job search, and what are the work search rules?'],
      'how much unemployment will I get in my state',
      'how do I apply for unemployment after a layoff',
      'how long can I collect unemployment',
      'can high earners get unemployment benefits',
      'do I have to accept any job offer to keep unemployment',
      'what counts as work search activity for unemployment',
      'can I do freelance work while on unemployment',
      'how soon after a layoff should I file for unemployment',
    ],
  },
  {
    id: 'warn', group: 'career-change', page: '/layoffs',
    prompts: [
      ['warn-notices', 'How do I look up WARN Act layoff notices for my state?'],
      ['layoff-tracker', 'Where can I see which companies are doing layoffs this month?'],
      'which companies have announced layoffs this week',
      'what is a WARN notice and what are my rights',
      'is my employer required to give 60 days notice before a layoff',
      'where do I find a list of companies that filed WARN notices in California',
      'how can I tell if my company is about to do layoffs',
      'how many layoffs have there been in 2026',
      'which industries have the most layoffs right now',
    ],
  },
  {
    id: 'benefits', group: 'career-change', page: '/resources/cobra-aca',
    prompts: [
      ['benefits-after-layoff', 'What benefits and assistance programs can I get after a layoff?'],
      ['workforce-center', 'How do American Job Centers and workforce boards help laid-off professionals?'],
      'COBRA or marketplace insurance after a layoff, which is cheaper',
      'how long does COBRA last and what does it cost',
      'what happens to my 401k after a layoff',
      'what happens to my stock options and RSUs if I am laid off',
      'what is the Trade Adjustment Assistance program and who qualifies',
      'what government help is there for laid off white collar workers',
      'how do I get health insurance after losing my job',
    ],
  },
  {
    id: 'ai-careers', group: 'career-change', page: '/tools/ai-job-check',
    prompts: [
      ['career-change-ai', 'Which careers are safe from AI, and how do I move into one mid-career?'],
      ['ai-skills-jobs', 'Which AI skills are employers paying a premium for right now?'],
      ['entry-level-ai', 'Is AI eliminating entry-level jobs, and what does the data say?'],
      'is my job going to be replaced by AI',
      'which jobs are most exposed to AI',
      'which professional jobs are growing despite AI',
      'what percent of jobs will AI replace',
      'does knowing AI tools increase salary',
      'how many job postings ask for AI skills',
    ],
  },
  {
    id: 'retrain', group: 'career-change', page: '/ai-training',
    prompts: [
      ['ai-retraining', 'What is the best way to retrain for an AI-related job after being laid off?'],
      'what AI courses should a marketing manager take',
      'which AI certifications are worth it for non-technical professionals',
      'how do I learn AI skills for my current job',
      'is it worth going back to school after a layoff',
      'free ways to learn AI tools for work',
      'can a finance professional move into an AI role without coding',
      'how long does it take to retrain for a new career',
      'what skills should I learn to stay employable over the next five years',
    ],
  },
  {
    id: 'pivot', group: 'career-change', page: '/topics/career-pivot',
    prompts: [
      ['skills-gap', 'How do I figure out what skills I am missing for the jobs I want?'],
      'how do I change careers at 40',
      'what jobs can I do with my management experience in a different industry',
      'how do I switch industries without taking a pay cut',
      'what are my transferable skills and how do I show them',
      'how do I choose a new career after a layoff',
      'what careers are similar to mine that pay more',
      'is a career test worth it',
      'how do I explain a career change to employers',
    ],
  },
  {
    id: 'business', group: 'career-change', page: '/topics/buy-a-business-vs-job',
    prompts: [
      ['buy-a-business', 'Should I buy a small business instead of looking for another job?'],
      'how do I buy a small business with severance money',
      'is consulting a good option after a layoff',
      'how do I start freelancing after a corporate career',
      'how do I find fractional executive work',
      'franchise or small business after a layoff, which is smarter',
      'how much money do I need to buy a business',
      'what is a search fund and is it for me',
      'how do I get my first consulting client',
    ],
  },
  {
    id: 'coaches', group: 'career-change', page: '/topics/what-is-a-job-transition-platform',
    prompts: [
      ['job-transition-platform', 'What is the best platform to help me through a mid-career job transition?'],
      ['career-coach-transition', 'Should I hire a career coach for a job transition, and what should it cost?'],
      'what is outplacement and does my employer have to offer it',
      'what is the best outplacement service for executives',
      'how do I choose a career coach',
      'is a career coach worth the money',
      'are there free career coaching services',
      'what do outplacement firms actually do',
      'should I pay for an executive search firm',
    ],
  },
  {
    id: 'networking', group: 'career-change', page: '/topics/networking-after-layoff',
    prompts: [
      ['networking-laid-off', 'How do I network effectively when I have been laid off and feel embarrassed?'],
      'what do I say when someone asks what I am doing now',
      'how do I tell my network I was laid off',
      'how do I reach out to former colleagues for help finding a job',
      'how do I deal with the stress of a layoff',
      'how do I stay positive after being laid off',
      'what do I say in a networking coffee chat',
      'how do I find a mentor during a job transition',
      'how do I ask for a recommendation after a layoff',
    ],
  },

  // ───────────── Résumé and interview ─────────────
  {
    id: 'ats', group: 'resume-interview', page: '/topics/resume-ats-ai-screening',
    prompts: [
      ['resume-ai-ats', 'How do I write a resume that gets past AI applicant tracking systems?'],
      'does an ATS reject resumes automatically',
      'what resume format is best for applicant tracking systems',
      'should I use keywords from the job description in my resume',
      'can I check if my resume will pass an ATS for free',
      'do two column resumes work with ATS',
      'is it okay to use a PDF resume for ATS',
      'why am I not getting interviews even though I am qualified',
      'how do recruiters use AI to screen resumes',
    ],
  },
  {
    id: 'resume-gap', group: 'resume-interview', page: '/topics/resume-gap',
    prompts: [
      ['resume-after-layoff', 'How should I explain a layoff on my resume and in interviews?'],
      'how do I explain a gap in my resume',
      'should I put a layoff on my resume',
      'how do I explain being laid off twice in a row',
      'how do I explain a six month employment gap in an interview',
      'what do I say when asked why I left my last job after a layoff',
      'do employers care about a gap of a year or more',
      'how do I list contract or consulting work on a resume during a gap',
      'should I say I was laid off or that the position was eliminated',
    ],
  },
  {
    id: 'bullets', group: 'resume-interview', page: '/tools/resume-bullet-rewriter',
    prompts: [
      'how do I write strong resume bullet points',
      'how do I add numbers to resume bullets when I do not have exact figures',
      'resume bullet point examples for a project manager',
      'resume bullet points for a finance director',
      'what is the STAR format for resume bullets',
      'how many bullet points per job on a resume',
      'how do I rewrite duties into achievements on my resume',
      'resume action verbs for leadership roles',
      'how do I quantify results in marketing for a resume',
    ],
  },
  {
    id: 'senior-resume', group: 'resume-interview', page: '/topics/resume-examples',
    prompts: [
      ['resume-help-senior', 'Where can I get help rewriting my resume for a senior leadership role?'],
      'how long should an executive resume be',
      'executive resume examples for a VP of operations',
      'what is the difference between a resume and a CV for executives',
      'should a senior resume include everything I have done',
      'how do I write an executive summary on my resume',
      'what should a C-suite resume include',
      'who can review my resume for free',
      'how much does a professional resume writer cost',
    ],
  },
  {
    id: 'ai-resume', group: 'resume-interview', page: '/tools/resume-check',
    prompts: [
      'can ChatGPT write my resume',
      'how do I use AI to tailor my resume to a job description',
      'will recruiters know my resume was written by AI',
      'best AI resume builder',
      'how do I improve a resume with Claude',
      'is it okay to use AI to write resume bullets',
      'prompt to make my resume better',
      'what are the mistakes AI makes when it writes a resume',
      'is there a free AI resume checker that gives a score',
    ],
  },
  {
    id: 'cover-letters', group: 'resume-interview', page: '/topics/cover-letter-tips',
    prompts: [
      ['cover-letter-ai', 'Can AI write a good cover letter, and how should I use it for my job search?'],
      'do I still need a cover letter in 2026',
      'how long should a cover letter be',
      'cover letter example for a career changer',
      'how do I start a cover letter without saying I am writing to apply',
      'how do I address a layoff in a cover letter',
      'cover letter for a director level job',
      'should I send a cover letter if the application does not ask for one',
      'how do I write a cover letter when I have no direct experience',
    ],
  },
  {
    id: 'linkedin', group: 'resume-interview', page: '/topics/linkedin-after-layoff',
    prompts: [
      ['linkedin-laid-off', 'How should I update my LinkedIn profile after a layoff?'],
      'should I use the open to work banner on LinkedIn',
      'how do I write a LinkedIn headline when I am between jobs',
      'what should I post on LinkedIn after being laid off',
      'how do I get recruiters to message me on LinkedIn',
      'how do I write a LinkedIn about section for an executive',
      'should I announce a layoff on LinkedIn',
      'how do I make my LinkedIn profile match my resume',
      'is LinkedIn Premium worth it for a job search',
    ],
  },
  {
    id: 'interview-prep', group: 'resume-interview', page: '/resources/interview-prep',
    prompts: [
      'how do I prepare for a job interview in one day',
      'how do I research a company before an interview',
      'what should I wear to a video interview',
      'how do I practice interview answers with AI',
      'what questions should I ask at the end of an interview',
      'how do I handle a panel interview',
      'how do I prepare for a final round interview',
      'how many interview rounds are normal for a director role',
      'is there a free tool to practice interview answers',
    ],
  },
  {
    id: 'interview-questions', group: 'resume-interview', page: '/topics/interview-questions-and-answers',
    prompts: [
      'how do I answer tell me about yourself',
      'how do I answer why did you leave your last job',
      'how do I answer what is your biggest weakness',
      'how do I answer where do you see yourself in five years',
      'best answer to why should we hire you',
      'how do I answer a question about being laid off',
      'how do I answer salary expectation questions',
      'common behavioral interview questions for managers with sample answers',
      'how do I answer questions about AI in an interview',
    ],
  },
  {
    id: 'interview-senior', group: 'resume-interview', page: '/topics/interview-after-career-gap',
    prompts: [
      ['interview-prep-senior', 'How do I prepare for a senior executive interview after a long gap?'],
      'how do I interview with a CEO or board',
      'how do I show executive presence in an interview',
      'what do search firms ask executive candidates',
      'how do I prepare a 30 60 90 day plan for an interview',
      'how do I interview for a job where I would be older than my boss',
      'what do I say if I am asked why I am leaving a stable job',
      'how do I answer questions about my leadership style',
      'how do I handle an interview after a long time away from interviewing',
    ],
  },
  {
    id: 'offers', group: 'resume-interview', page: '/resources/offer-letter',
    prompts: [
      'how do I negotiate a job offer',
      'how do I counter a low salary offer',
      'is it okay to negotiate after accepting an offer',
      'how do I negotiate when I have been unemployed',
      'what should I look at in an offer besides salary',
      'how do I negotiate equity at a startup',
      'how do I ask for a higher salary without losing the offer',
      'how do I decide between two job offers',
      'how long should I take to respond to a job offer',
    ],
  },
  {
    id: 'follow-up', group: 'resume-interview', page: '/topics/thank-you-email-after-interview',
    prompts: [
      'how do I write a thank you email after an interview',
      'how long should I wait to follow up after an interview',
      'what do I say when a recruiter ghosts me after an interview',
      'who should I use as references after a layoff',
      'how do I ask a former boss to be a reference',
      'what do I do if my old employer gives a bad reference',
      'how do I follow up on an application with no response',
      'how do I withdraw from a job process politely',
      'what do I do after getting rejected from a job I really wanted',
    ],
  },
]

export interface CitationPromptDef {
  key: string
  prompt: string
  group: PromptGroup
  clusterId: string
}

const keyOf = (c: Cluster, i: number): string => `${c.id}-${i + 1}`

const defs: CitationPromptDef[] = CLUSTERS.flatMap((c) =>
  c.prompts.map((e, i) => {
    const [key, prompt] = typeof e === 'string' ? [keyOf(c, i), e] : e
    return { key, prompt, group: c.group, clusterId: c.id }
  }),
)

// Interleaved across clusters, so any run of consecutive questions (the weekly rotation takes a block of 20) touches many topics
// and all three groups instead of exhausting one topic a week.
function interleave(items: CitationPromptDef[]): CitationPromptDef[] {
  // Clusters alternate between the three groups, then take one question from each in turn.
  const groups = (Object.keys(GROUP_LABEL) as PromptGroup[]).map((g) => CLUSTERS.filter((c) => c.group === g))
  const order: Cluster[] = []
  for (let i = 0; groups.some((l) => i < l.length); i++) for (const l of groups) if (i < l.length) order.push(l[i])
  const byCluster = order.map((c) => items.filter((d) => d.clusterId === c.id))
  const out: CitationPromptDef[] = []
  for (let i = 0; byCluster.some((l) => i < l.length); i++) for (const l of byCluster) if (i < l.length) out.push(l[i])
  return out
}

export const CITATION_PROMPT_DEFS: CitationPromptDef[] = interleave(defs)

/** What run.ts asks: key and question. */
export const CITATION_PROMPTS: { key: string; prompt: string }[] = CITATION_PROMPT_DEFS.map(({ key, prompt }) => ({ key, prompt }))

/** The one-line brief for a question we are absent from: the existing page that should answer it, or the page to write. */
export function pageBriefFor(key: string): { page: string | null; brief: string } {
  const d = CITATION_PROMPT_DEFS.find((x) => x.key === key)
  const c = d && CLUSTERS.find((x) => x.id === d.clusterId)
  if (!c) return { page: null, brief: 'Question is not in the tracked list any more.' }
  if (c.page) return { page: c.page, brief: `Answer this question near the top of ${c.page}, in the words people use, with our own figure beside it.` }
  return { page: null, brief: `New page: ${c.newPage}.` }
}
