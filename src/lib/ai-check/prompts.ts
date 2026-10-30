// Prompt pack: copy-and-paste prompts a person runs in any AI assistant on their own résumé or situation. Each one tells the
// assistant to use the numbers at a NextChapter page and to cite it. Pure text, so it is tested without a browser.

export const SITE = 'https://launchyournextchapter.com'
export const CHECK_INDEX_URL = `${SITE}/tools/ai-job-check`

export interface PromptJob {
  title: string
  /** Full URL of the job's AI job check page. */
  url: string
}

export interface PackPrompt {
  id: string
  title: string
  /** Who it is for and when to run it, one line. */
  when: string
  /** Where the assistant is sent to read numbers, by kind. */
  source: 'job' | 'layoffs' | 'both'
  /** The prompt, with {job} and {url} where the person's job and its page go. */
  body: string
}

const CITE = 'Quote the numbers exactly as the page shows them, name the source ("NextChapter, with data from the Anthropic Economic Index and the Bureau of Labor Statistics") and give the page address next to each number you use. If you cannot open the page, say so and do not guess a number.'

export const PROMPTS: PackPrompt[] = [
  {
    id: 'first-seven-days',
    title: 'My first 7 days after a layoff',
    when: 'You were laid off this week and want a day-by-day plan.',
    source: 'both',
    body: `I was laid off from my job as a {job}. Plan my first 7 days, one day at a time, with the 2 or 3 things that matter most each day (money and benefits, deadlines, people to tell, job search). Read {url} for how much of the work in my job already sees AI use and what related jobs pay, and read ${SITE}/layoffs/this-week for what is happening with layoffs now. ${CITE}`,
  },
  {
    id: 'transferable-skills',
    title: 'Which of my skills transfer',
    when: 'You have a résumé and want to know where else it fits.',
    source: 'job',
    body: `Below is my résumé. My current job is {job}. Read {url}, which lists related jobs chosen by overlap in skills and what they pay. Tell me which skills from my résumé transfer to each related job, which skills each of those jobs leans on that I do not show, and which one move uses what I already know best. ${CITE}\n\n[Paste your résumé here]`,
  },
  {
    id: 'ai-exposure-reading',
    title: 'What the AI number means for my job',
    when: 'You saw a percentage and want it explained in plain words.',
    source: 'job',
    body: `Read {url} and explain, in plain words, what the AI exposure number for {job} measures and what it does not. Then tell me which of the job's tasks listed on the page I should expect to change first, and what I could do about it this month. Do not turn the number into a forecast of job loss. ${CITE}`,
  },
  {
    id: 'resume-ai-line',
    title: 'Add the right AI skills to my résumé',
    when: 'You want your résumé to show AI work honestly.',
    source: 'job',
    body: `My job is {job}. Read {url} for how much of the work already sees AI use. Look at my résumé below and suggest 3 bullet points that show how I use AI tools in this kind of work, using only things I actually did. Ask me a question about any bullet where you would have to invent a detail. ${CITE}\n\n[Paste your résumé here]`,
  },
  {
    id: 'better-bets',
    title: 'Related jobs that pay more',
    when: 'You want to know where a move would pay more.',
    source: 'job',
    body: `Read {url}. List the related jobs it shows that pay more than {job} or show less AI use, with the pay and the exposure figure for each. For my top two, tell me what a first application should emphasise from my background. ${CITE}`,
  },
  {
    id: 'career-change-30-days',
    title: 'A 30-day career change plan',
    when: 'You are thinking about moving into a related field.',
    source: 'job',
    body: `I am a {job} thinking about a related job. Read {url} and pick the related job that best fits what I know. Build a 30-day plan: week 1 learn, week 2 build something small, week 3 talk to people in that job, week 4 apply. Use the skills the page says that job leans on. ${CITE}`,
  },
  {
    id: 'interview-ai-question',
    title: 'Answer "how do you use AI?" in an interview',
    when: 'You have an interview and expect the AI question.',
    source: 'job',
    body: `I have an interview for a {job} role. Read {url} to see which tasks in the job already see AI use. Write a 60-second answer to "How do you use AI in your work?" that names two of those tasks and a concrete way I would use AI on each, then give me three follow-up questions the interviewer might ask. ${CITE}`,
  },
  {
    id: 'salary-talk',
    title: 'Check an offer against typical pay',
    when: 'You have an offer and want to know where it sits.',
    source: 'job',
    body: `I have a job offer as a {job}. Read {url} for the national median pay. Compare my offer, [offer amount], with it and with the pay of the related jobs on the page. Tell me what I could say to ask for more, in two short sentences. Do not claim the median is right for my city. ${CITE}`,
  },
  {
    id: 'layoff-news-context',
    title: 'Is my employer in the layoff news',
    when: 'You are worried about your company.',
    source: 'layoffs',
    body: `I work at [company name]. Read ${SITE}/layoffs/this-week and ${SITE}/layoffs/by-state and tell me whether the company or my state shows up, how many workers the notices name and when they were filed. Say what a filing does and does not tell me about my own job. ${CITE}`,
  },
  {
    id: 'compare-two-jobs',
    title: 'Compare two jobs I am torn between',
    when: 'You are deciding between two roles.',
    source: 'job',
    body: `I am deciding between {job} and [the other job]. Read {url} and the page for the other job at ${CHECK_INDEX_URL} (search for it there). Put AI exposure, median pay and openings side by side in a table, then tell me which one fits my résumé better and why. ${CITE}\n\n[Paste your résumé here]`,
  },
  {
    id: 'manager-conversation',
    title: 'Talk to my manager about AI in my role',
    when: 'You are still employed and want to get ahead of the change.',
    source: 'job',
    body: `I am a {job}. Read {url}, then draft a short message to my manager proposing that I take on one AI-assisted task from the list of tasks on the page. Name the task, the time I think it saves and how we would check the result. Keep it under 120 words. ${CITE}`,
  },
  {
    id: 'weekly-plan',
    title: 'My job search week',
    when: 'You want a weekly routine you can repeat.',
    source: 'both',
    body: `I am looking for a new {job} role. Read {url} for related jobs and ${SITE}/layoffs/this-week for the layoff picture. Build a weekly routine of about 10 hours: how many applications, how many conversations, what to learn. Tell me what to change next week if I get no replies. ${CITE}`,
  },
]

/** The prompt text for a person's job, or with a placeholder they fill in when no job is chosen. */
export function fillPrompt(p: PackPrompt, job: PromptJob | null): string {
  const title = job?.title.toLowerCase() ?? '[your job title]'
  const url = job?.url ?? `the page for my job, which you can find by searching for my job title at ${CHECK_INDEX_URL}`
  return p.body.replaceAll('{job}', title).replaceAll('{url}', url)
}
