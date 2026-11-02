// Guides for the mechanics of a job search: finding roles, choosing where to look, applying, asking for a referral, writing to a recruiter,
// answering the salary question and following up. One page each at /topics/[slug]; the title, description and phrases they own are in
// keywords.ts. The overall approach lives in job-search-strategy; these pages each answer one specific search. Advice is general and
// checkable, with no claims about outcomes we cannot source.

import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import type { TopicContent } from './explainers'

const UPDATED = '2026-11-02'

export const JOB_SEARCH_TOPICS: TopicContent[] = [
  {
    slug: 'how-to-find-a-job',
    h1: 'How to find a job: a plan for the next 30 days',
    lede: 'Finding a job comes down to three things done every week: know which roles you are targeting, get your résumé and profile ready for them, and put your name in front of people and postings at the same time. Do not rely on applications alone. Use the 30-day plan below and track each step.',
    sections: [
      {
        h2: 'Week 1: decide what you are going for',
        bullets: [
          'Pick one to three target roles and the kind of employer you want. A search for “anything” is hard to explain and hard to help.',
          'Read ten postings for those roles and list the skills and results they repeat.',
          'Write your one-paragraph pitch: who you are, what you do best and the kind of role you want.',
          'Set your weekly schedule and a simple way to track it.',
        ],
        links: [{ label: 'Job application tracker', href: '/topics/job-search-tracker' }],
      },
      {
        h2: 'Week 2: get ready to be found',
        bullets: [
          'Update your résumé for the target roles, with results in numbers.',
          'Rewrite your LinkedIn headline and summary to name the role you want, and turn on the setting that tells recruiters you are open to work.',
          'Make a list of 30 to 50 people who could help: former colleagues, bosses, clients and peers.',
        ],
        links: [
          { label: 'Free résumé check', href: '/tools/resume-check' },
          { label: 'Networking message templates', href: '/resources/network-scripts' },
        ],
      },
      {
        h2: 'Weeks 3 and 4: apply and talk to people, both',
        bullets: [
          'Apply to a handful of well-matched roles each week, on the employer’s own site, with your résumé adjusted to the posting.',
          'Reach out to several people on your list each week: ask for a short conversation, not a job.',
          'Tell recruiters in your field what you want and send each a short note.',
          'Follow up on every application and every conversation. Most searches stall at the follow-up.',
        ],
        links: [
          { label: 'Where to look for jobs', href: '/topics/best-job-sites' },
          { label: 'How to apply for a job', href: '/topics/how-to-apply-for-a-job' },
        ],
      },
      {
        h2: 'How long it takes',
        paragraphs: ['A job search for a professional role usually takes months, not weeks, and longer at senior levels. A plan that keeps you moving every week matters more than any one application. If it has stalled, our guide on why a search stalls shows what to check.'],
        links: [
          { label: 'How long a job search takes', href: '/topics/how-long-job-search-takes' },
          { label: 'Why your job search isn’t working', href: '/why-stuck' },
        ],
      },
      {
        h2: 'If you were just laid off',
        paragraphs: ['Do the paperwork first (benefits, unemployment, severance), then start this plan. The first 72 hours checklist covers it.'],
        links: [{ label: 'First 72 hours after a layoff', href: '/resources/72-hours' }],
      },
    ],
    faq: [
      { q: 'How do I find a job fast?', a: 'Narrow to one to three target roles, get your résumé and profile ready for them, and apply and network at the same time every week. Speed comes from a clear target and steady follow-up.' },
      { q: 'Where do I start when looking for a job?', a: 'Decide which roles you are going for, then update your résumé and LinkedIn for them. Start conversations with people you know before you start applying widely.' },
      { q: 'How many jobs should I apply to a week?', a: 'A handful of well-matched ones, tailored to each posting, plus several conversations. Quality and follow-up matter more than volume.' },
      { q: 'How long does it take to find a job?', a: 'For professional roles, usually a few months. It tends to take longer at senior levels, so plan your money for the length.' },
    ],
    cta: { title: 'Get your plan started', body: 'A free Market Reality Assessment shows how employers see your background and gives you a weekly plan.', label: 'Start my free assessment', href: MARKET_REALITY_START_HREF },
    updated: UPDATED,
  },
  {
    slug: 'best-job-sites',
    h1: 'Best job sites for experienced professionals',
    lede: 'No single site has every job, so use a short mix: employers’ own career sites, one or two large job boards, LinkedIn, a niche board for your field and recruiters who place people like you. The employer’s own site is the most reliable source, because the posting is theirs and it is the first place a job appears.',
    sections: [
      {
        h2: 'Where jobs come from',
        bullets: [
          'Employer career sites: the posting is original, current and free of middlemen. Make a list of 30 target employers and check them weekly.',
          'Large job boards such as Indeed, LinkedIn and ZipRecruiter: wide coverage and alerts, but heavy competition and duplicate or stale listings.',
          'Google’s job search: it gathers postings from many sources and links back to the original.',
          'Niche boards and association sites: smaller, with a relevant audience, such as boards run by professional groups in finance, law, healthcare or technology.',
          'Recruiters and search firms: many roles at senior levels are filled this way and never posted.',
        ],
        links: [
          { label: 'Executive recruiters and search firms', href: '/topics/executive-recruiters' },
          { label: 'Best job sites for executives', href: '/topics/best-job-sites-for-executives' },
        ],
      },
      {
        h2: 'What to look for in a site',
        bullets: [
          'Postings link to the employer’s own application page.',
          'Salary ranges shown, where the employer provides them.',
          'Old postings are removed, so you do not apply to jobs that are filled.',
          'Alerts for your target roles, so you hear about new openings early.',
        ],
      },
      {
        h2: 'Our job board',
        paragraphs: ['NextChapter’s job board lists professional roles collected from employers’ own career sites, and shows the pay the employer posted where there is one. We re-check postings to confirm they are still open. You can filter by title, level, location and remote.'],
        links: [{ label: 'Search jobs', href: '/jobs' }],
      },
      {
        h2: 'Protect yourself',
        paragraphs: ['Fake postings and fake recruiters are common. Never pay to apply, never share bank details or an ID before an offer, and check that the apply link goes to the employer’s real domain. We track the scams we see.'],
        links: [
          { label: 'Spot a fake job posting', href: '/topics/fake-job-postings' },
          { label: 'Scam watch', href: '/scam-watch' },
        ],
      },
    ],
    faq: [
      { q: 'What is the best job site?', a: 'There is no single best one. Use employers’ own career sites, one or two large boards, LinkedIn and a niche board for your field, plus recruiters for senior roles.' },
      { q: 'Are job boards or company websites better?', a: 'Company career sites are the most reliable source because the posting is original and current. Boards add reach and alerts.' },
      { q: 'How do I find jobs that are not posted?', a: 'Through people. Tell your network and recruiters in your field what you want, and ask for conversations. Many senior roles are filled that way.' },
      { q: 'How do I know a job posting is real?', a: 'Check that the apply link goes to the employer’s own domain, that the company and role appear on its career page, and that no one asks for money or an ID before an offer.' },
    ],
    cta: { title: 'See the open jobs', body: 'Professional roles from employers’ own career sites, with posted pay where the employer gives it.', label: 'Search jobs', href: '/jobs' },
    updated: UPDATED,
  },
  {
    slug: 'how-to-apply-for-a-job',
    h1: 'How to apply for a job: the steps that get you read',
    lede: 'To apply for a job well, find the posting on the employer’s own site, match your résumé to what it asks for, apply through the official page, and follow up with a person. A tailored application to a good-fit role is worth more than ten generic ones, so spend your time where the match is strongest.',
    sections: [
      {
        h2: 'The steps',
        bullets: [
          'Read the whole posting and mark the requirements and the repeated words. Decide honestly whether you fit at least the core ones.',
          'Apply on the employer’s career page when you can, not through a third party that re-posts it.',
          'Adjust your résumé: use the posting’s terms for the same work, move the most relevant bullets up and cut what does not apply.',
          'Add a short cover letter when the application allows it or the role is a strong match.',
          'Answer every required question. Incomplete applications are often dropped.',
          'Save the posting and the version you sent, so you can prepare for the interview.',
        ],
        links: [
          { label: 'Résumé vs job description match', href: '/tools/resume-job-match' },
          { label: 'Cover letter template', href: '/topics/cover-letter-template' },
        ],
      },
      {
        h2: 'Apply early, and then reach a person',
        paragraphs: [
          'Many employers start reviewing as applications arrive, so applying in the first days can help. After you apply, find someone connected to the role, such as the recruiter, the hiring manager or a person on the team, and send a short note. Our guide to emailing a recruiter shows how.',
        ],
        links: [{ label: 'How to email a recruiter', href: '/topics/how-to-email-a-recruiter' }],
      },
      {
        h2: 'How many to apply to',
        paragraphs: ['There is no magic number. For a full-time search, a handful of tailored applications and several conversations a week is a pace most people can keep. If you are applying to dozens and hearing nothing, narrow your targets and fix the match rather than sending more.'],
        links: [{ label: 'Why applications go nowhere', href: '/why-stuck' }],
      },
      {
        h2: 'Online forms and screening',
        bullets: [
          'Most applications go through an applicant tracking system that stores your answers and résumé. Use plain formatting and standard headings.',
          'If the form asks to retype your history after uploading, do it. Some systems do not use the upload.',
          'Salary questions: give a range, or write “negotiable” where it allows. Our salary guide shows how.',
        ],
        links: [
          { label: 'Getting past ATS screens', href: '/resources/gatekeeper' },
          { label: 'Salary expectations', href: '/topics/salary-expectations' },
        ],
      },
    ],
    faq: [
      { q: 'How do I apply for a job online?', a: 'Find the posting on the employer’s career page, tailor your résumé to it, complete every required field, submit, and then reach out to a person connected to the role.' },
      { q: 'Should I apply through the company website?', a: 'Yes when you can. It goes straight to the employer’s system, and it confirms the job is real and open.' },
      { q: 'How many jobs should I apply to a day?', a: 'Not many. A few tailored applications a week, with outreach and follow-up, beat a daily volume of generic ones.' },
      { q: 'Do I need a cover letter?', a: 'If the application asks for one, yes. If it is optional, a short, specific letter can help for a strong-match role.' },
    ],
    cta: { title: 'Match your résumé to a job', body: 'Paste a posting and your résumé and see which of its terms you are missing.', label: 'Match my résumé to a job', href: '/tools/resume-job-match' },
    updated: UPDATED,
  },
  {
    slug: 'how-to-ask-for-a-job-referral',
    h1: 'How to ask for a job referral (and get one)',
    lede: 'The best way to get a referral is to ask for a conversation first, not a favor. Find someone who works at the company, ask for 15 minutes about the team and the role, and then, if it goes well, ask whether they would be willing to refer you. Make it easy: send your résumé, the posting link and two lines they can pass on.',
    sections: [
      {
        h2: 'Who to ask',
        bullets: [
          'Former colleagues, bosses and clients who now work at the company.',
          'People you know through school, alumni groups, professional associations or past projects.',
          'Second-degree connections on LinkedIn. Ask a mutual connection for an introduction first.',
          'People on the team that is hiring, even if you do not know them. A short, specific note works.',
        ],
        links: [{ label: 'Networking when you are job searching', href: '/resources/network-activation' }],
      },
      {
        h2: 'Ask in two steps',
        paragraphs: [
          'Step one: ask to talk. “I am exploring roles in supply chain and noticed your team at Brightline is hiring. Would you have 15 minutes this week to tell me what the team is like?” Most people say yes to a short conversation.',
          'Step two: after the call, if you still want the job, ask. “Based on what we discussed, I would like to apply for the planner role. Would you be willing to refer me? I can send my résumé and a two-line summary you can forward.”',
        ],
        links: [{ label: 'Networking message templates', href: '/resources/network-scripts' }],
      },
      {
        h2: 'Make it easy to say yes',
        bullets: [
          'Send your résumé, the job link and a short blurb in one email.',
          'Say you understand if they cannot, so there is no pressure.',
          'Apply through the official page too, and tell them when you have, so they can add the referral to your application.',
          'Thank them, and keep them updated, whatever happens.',
        ],
      },
      {
        h2: 'Why employees say yes',
        paragraphs: ['Many employers pay employees a bonus when a referred candidate is hired, and a good referral reflects well on the person who makes it. Asking is a normal part of hiring, as long as you are a credible fit.'],
      },
    ],
    faq: [
      { q: 'How do I ask someone for a job referral?', a: 'Ask for a short conversation first. After it goes well, ask if they would be willing to refer you and make it easy with your résumé, the posting link and a short summary.' },
      { q: 'What if I do not know anyone at the company?', a: 'Look for second-degree connections and ask a mutual contact to introduce you, or write to someone on the hiring team with a short, specific note.' },
      { q: 'Should I apply first or ask for the referral first?', a: 'Either. Many people have the conversation first and then apply and tell the person so they can add the referral.' },
      { q: 'Is it okay to ask a stranger for a referral?', a: 'Ask for a conversation, not a referral. A referral from someone who has not talked to you is rare and not worth pushing for.' },
    ],
    cta: { title: 'Find the right words', body: 'Message templates for asking for a conversation, an introduction and a referral.', label: 'See the templates', href: '/resources/network-scripts' },
    updated: UPDATED,
  },
  {
    slug: 'how-to-email-a-recruiter',
    h1: 'How to email a recruiter: a short note that gets a reply',
    lede: 'A good email to a recruiter is short: say which role or kind of role you want, give two or three lines that prove you fit, and make the next step easy. Keep it under 120 words, send it to a recruiter who works in your field, and attach your résumé. Follow up once after a week.',
    sections: [
      {
        h2: 'What a recruiter wants to see',
        bullets: [
          'The kind of role you are targeting, in the recruiter’s language.',
          'Two or three facts that show fit: level, industry, a result and a scale.',
          'Location, work arrangement and, if you are comfortable, a pay range.',
          'Your résumé attached and your LinkedIn link.',
        ],
      },
      {
        h2: 'A template',
        paragraphs: [
          'Subject: Finance director, SaaS, open to roles in Chicago or remote',
          'Hi [Name], I saw that you place finance leaders in software. I am a finance director with 12 years in SaaS who led a team of 15 and a $40 million budget, and I took forecast accuracy to within 2%. I am looking for a VP or director role at a growth-stage company, in Chicago or remote. My résumé is attached. Would you have 15 minutes this week or next? Thank you, [Your name], [phone], [LinkedIn]',
        ],
      },
      {
        h2: 'Find the right recruiter',
        bullets: [
          'Search LinkedIn for recruiters who post roles like yours, or who work at companies you target.',
          'Look at the recruiter’s recent postings to see their specialty.',
          'For senior roles, use a search firm that covers your industry.',
        ],
        links: [{ label: 'Executive recruiters and search firms', href: '/topics/executive-recruiters' }],
      },
      {
        h2: 'LinkedIn message version',
        paragraphs: ['Keep it to three or four sentences: who you are, the role you want, one proof point and the ask. “Hi Dana, I lead supply chain for a $300M manufacturer and I am looking for a VP role in the Midwest. I saw you recruit in this space. Could I send you my résumé?”'],
      },
      {
        h2: 'Follow up, once',
        paragraphs: ['If there is no reply in five to seven business days, send one short follow-up that restates the role you want. Then move on. Do not send the same note to many recruiters at one firm.'],
        links: [{ label: 'Follow up on an application', href: '/topics/follow-up-after-applying' }],
      },
    ],
    faq: [
      { q: 'How do I email a recruiter?', a: 'Keep it under 120 words: the role you want, two or three facts that prove fit, your location and an ask for a short call. Attach your résumé.' },
      { q: 'What do I say in a message to a recruiter on LinkedIn?', a: 'Who you are, the kind of role you want, one result and a simple ask, in three or four sentences.' },
      { q: 'How long should I wait before following up with a recruiter?', a: 'About five to seven business days, once. After that, move on.' },
      { q: 'Should I include salary expectations in an email to a recruiter?', a: 'You can give a range if you are comfortable. It saves both sides time, but it is not required in the first note.' },
    ],
    cta: { title: 'Get the résumé ready first', body: 'Check your résumé free before you send it to anyone.', label: 'Check my résumé', href: '/tools/resume-check' },
    updated: UPDATED,
  },
  {
    slug: 'salary-expectations',
    h1: 'Salary expectations: how to answer without underselling',
    lede: 'When an employer asks for your salary expectations, give a researched range, not a single number and not your current pay. Base it on what the role pays in your market, put the number you would be happy with toward the lower middle, and say it depends on the full package. If you can, learn the employer’s range first.',
    sections: [
      {
        h2: 'Do the research first',
        bullets: [
          'Look at pay for the same title, level and location in the salary lookup and in postings that show ranges.',
          'Check the employer’s own posting: a growing number of states require employers to post a pay range.',
          'Add what matters to you beyond base pay: bonus, equity, benefits, flexibility and title.',
        ],
        links: [
          { label: 'Salary by job title', href: '/salaries' },
          { label: 'Pay check: is your salary in line?', href: '/tools/pay-check' },
        ],
      },
      {
        h2: 'What to say',
        bullets: [
          'In a conversation: “Based on the role and what I see in the market, I am looking at $130,000 to $150,000, depending on the full package. What range did you have in mind?”',
          'Early in the process: “I would like to learn more about the role first. Can you tell me the range for the position?”',
          'On a form that requires a number: enter a range, or “negotiable” if it allows.',
          'In a cover letter: leave it out unless the posting asks. If it does, give a range in one line.',
        ],
      },
      {
        h2: 'Your current salary',
        paragraphs: ['You do not have to give your pay history, and many states and cities bar employers from asking. If asked, you can say you are focused on the pay for this role and give your range. Check your state’s rule if it comes up.'],
      },
      {
        h2: 'After you get an offer',
        paragraphs: ['The range you give is a starting point. When an offer arrives, you can still negotiate. Our guides cover how.'],
        links: [
          { label: 'Negotiate a job offer', href: '/topics/negotiate-a-job-offer' },
          { label: 'Is this salary fair?', href: '/topics/is-this-salary-fair' },
        ],
      },
    ],
    faq: [
      { q: 'How do I answer “what are your salary expectations?”', a: 'Give a researched range for the role and market, say it depends on the full package, and ask what range the employer has in mind.' },
      { q: 'Should I give a number or a range?', a: 'A range, with the amount you would be happy with toward the lower middle of it.' },
      { q: 'What do I put for desired salary on an application?', a: 'A range, or “negotiable” if the field allows. If it must be a number, use the middle of your researched range.' },
      { q: 'Do I have to tell an employer my current salary?', a: 'No. Many states and cities bar employers from asking. You can decline and state your range for the role.' },
    ],
    cta: { title: 'Check what the role pays', body: 'Compare your salary and the range you are quoting with the market.', label: 'Open pay check', href: '/tools/pay-check' },
    updated: UPDATED,
  },
  {
    slug: 'follow-up-after-applying',
    h1: 'How to follow up on a job application',
    lede: 'Follow up one to two weeks after you apply, or on the date the posting gives, with a short email to the recruiter or hiring manager that restates the role and why you fit. If you do not hear back, follow up once more a week later, then move on. A follow-up is one of the few things that can move an application from the pile to a person.',
    sections: [
      {
        h2: 'When to follow up',
        bullets: [
          'If the posting gives a timeline, wait until it passes, then write.',
          'If it does not, wait about a week to two after applying.',
          'After a conversation or an interview, send a thank-you within a day and follow up on the timeline you were given.',
          'Two follow-ups at most for one application. After that, stop.',
        ],
        links: [{ label: 'Follow up after an interview', href: '/resources/post-interview' }],
      },
      {
        h2: 'Who to write to',
        bullets: [
          'The recruiter named in the posting, if any.',
          'The hiring manager, which you can often find on LinkedIn by searching the team and title.',
          'A person you know at the company, who can tell you who is handling it.',
        ],
      },
      {
        h2: 'A template',
        paragraphs: ['Subject: Director of Finance application, Jordan Lee', 'Hi [Name], I applied last week for the Director of Finance role. With nine years leading finance for regional healthcare groups and a rebuilt forecasting process that cut the budget cycle from 11 weeks to 6, I believe I can help. I would welcome a chance to talk about the role. Thank you, Jordan Lee, [phone]'],
      },
      {
        h2: 'If you hear nothing',
        paragraphs: ['Silence usually means the role is on hold, filled or in a slow process. Keep applying and talking to people. If it keeps happening, the problem may be your fit for the roles you are choosing or your résumé; our guide shows what to check.'],
        links: [
          { label: 'Why your job search isn’t working', href: '/why-stuck' },
          { label: 'Track your applications', href: '/topics/job-search-tracker' },
        ],
      },
    ],
    faq: [
      { q: 'How long should I wait to follow up on a job application?', a: 'Until the posted timeline passes, or about one to two weeks if none is given.' },
      { q: 'How do I follow up on a job application by email?', a: 'Send a short email to the recruiter or hiring manager that names the role, restates your fit in one or two lines and asks for the next step.' },
      { q: 'How many times should I follow up?', a: 'Up to two times for one application. After that, move on.' },
      { q: 'What if I never hear back?', a: 'Treat it as a no and keep going. If it happens often, check your target roles and your résumé.' },
    ],
    cta: { title: 'Keep track', body: 'A simple way to track applications, contacts and follow-up dates.', label: 'Open the tracker guide', href: '/topics/job-search-tracker' },
    updated: UPDATED,
  },
]
