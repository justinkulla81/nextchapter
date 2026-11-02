// Guides for the decision to leave a job and how to do it well: resignation letter, how to quit, whether to quit, a counteroffer, hating your
// job, and changing careers in midlife. One page each at /topics/[slug]; the title, description and phrases they own are in keywords.ts.
// Boss, burnout and toxic-workplace phrases belong to problems-at-work; these pages link to it instead of claiming them.

import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import type { TopicContent } from './explainers'

const UPDATED = '2026-11-02'

export const JOB_CHANGE_TOPICS: TopicContent[] = [
  {
    slug: 'resignation-letter',
    h1: 'Resignation letter: a template and what to say',
    lede: 'A resignation letter is short and professional: say you are resigning, give your last day, thank them and offer to help with the handover. Keep it to a few sentences and leave out complaints. In the United States two weeks’ notice is the custom, unless your contract says otherwise, and you should tell your manager in person before you send the letter.',
    sections: [
      {
        h2: 'Template',
        paragraphs: [
          'Dear [Manager’s name],',
          'Please accept this letter as notice of my resignation from my position as [title] at [company]. My last day will be [date, two weeks from today].',
          'Thank you for the opportunity to work here and for your support. I will do all I can to make the transition smooth and I am glad to help train a replacement or document my work before I go.',
          'Sincerely, [Your name]',
        ],
      },
      {
        h2: 'What to include',
        bullets: [
          'A clear statement that you are resigning, with your title and the company name.',
          'Your last day, as a date.',
          'A brief thank-you.',
          'An offer to help with the handover.',
        ],
      },
      {
        h2: 'What to leave out',
        bullets: [
          'Complaints, blame or criticism of anyone. The letter goes in your file.',
          'Where you are going, unless you want to share it.',
          'A long explanation. You do not owe one.',
          'Anything you would not want your next employer to read, since they may ask for a reference.',
        ],
      },
      {
        h2: 'How to deliver it',
        bullets: [
          'Tell your manager in person or on a call first, then hand over or email the letter the same day.',
          'Send a copy to HR, and ask in writing about your final pay, unused vacation, benefits end date and 401(k).',
          'For a resignation email, use the same text with a clear subject line, such as “Resignation: [Your name].”',
        ],
        links: [
          { label: 'How to quit a job', href: '/topics/how-to-quit-a-job' },
          { label: 'Should I accept a counteroffer?', href: '/topics/should-i-accept-a-counteroffer' },
        ],
      },
      {
        h2: 'Short version',
        paragraphs: ['“Dear [Name], I am resigning from my position as [title], effective [date]. Thank you for the opportunity. I will help with the transition. Sincerely, [Your name].”'],
      },
    ],
    faq: [
      { q: 'How do I write a resignation letter?', a: 'State that you are resigning, give your last day, thank your employer and offer to help with the handover. Keep it to a few sentences.' },
      { q: 'How much notice should I give?', a: 'Two weeks is customary in the United States, unless your contract or offer letter requires more. Senior roles often give more.' },
      { q: 'Do I have to give a reason in my resignation letter?', a: 'No. A reason is optional, and a short, neutral letter is safest.' },
      { q: 'Should I send a resignation email or a letter?', a: 'Tell your manager first. Then send the letter by email or as a document, whichever your employer uses, and copy HR.' },
    ],
    cta: { title: 'Line up the next job first', body: 'Search professional roles from employers’ own career sites.', label: 'Search jobs', href: '/jobs' },
    updated: UPDATED,
  },
  {
    slug: 'how-to-quit-a-job',
    h1: 'How to quit a job professionally',
    lede: 'Quit well by having the next step settled, telling your manager first and in person, giving the notice your contract or custom calls for, putting it in a short letter and handing over your work. How you leave decides whether your old employer is a good reference later, so keep it calm and specific.',
    sections: [
      {
        h2: 'Before you resign',
        bullets: [
          'Have the new offer in writing, and wait for background checks and any contingencies to clear before you resign.',
          'Read your offer letter and any employment agreement for notice periods, non-compete and non-solicit terms, and bonus or equity conditions.',
          'Check when your bonus, vesting or retirement match pays out, and whether leaving earlier costs you.',
          'Decide what you would say if offered a counteroffer.',
        ],
        links: [{ label: 'Should I accept a counteroffer?', href: '/topics/should-i-accept-a-counteroffer' }],
      },
      {
        h2: 'The conversation',
        bullets: [
          'Ask for a short private meeting with your manager, in person or on video.',
          'Say it plainly: “I have accepted another opportunity and my last day will be [date].”',
          'Thank them for something real. Do not criticize.',
          'Offer a handover plan and ask what they need from you.',
        ],
      },
      {
        h2: 'Notice and handover',
        bullets: [
          'Two weeks is the custom. Some employers ask you to leave sooner, so be ready for that.',
          'Write down what you own: projects, contacts, passwords you are allowed to share, files and next steps.',
          'Keep working at your usual level. People remember the last weeks.',
        ],
        links: [{ label: 'Resignation letter template', href: '/topics/resignation-letter' }],
      },
      {
        h2: 'Money, benefits and records',
        bullets: [
          'Ask HR in writing for your last paycheck date and vacation payout. State law sets both.',
          'Note when your health coverage ends, and what COBRA would cost if there is a gap.',
          'Plan what to do with your 401(k): leave it, roll it to the new plan or to an IRA.',
          'Keep copies of your performance reviews and accomplishments, as far as company rules allow.',
          'Quitting without a job lined up usually removes unemployment benefits, so plan your money first.',
        ],
        links: [
          { label: 'Unemployment after quitting', href: '/topics/unemployment-after-quitting-or-firing' },
          { label: 'Layoff runway: how long your money lasts', href: '/tools/layoff-runway' },
        ],
      },
      {
        h2: 'The exit interview',
        paragraphs: ['Be honest and constructive and keep it short. Name one or two things that would help others, without turning it into a list of grievances. Your comments may be read later.'],
      },
    ],
    faq: [
      { q: 'How do I quit a job professionally?', a: 'Have the next job in writing, tell your manager in person, give the notice customary or required, send a short letter and hand over your work.' },
      { q: 'How do I tell my boss I am quitting?', a: 'Ask for a private meeting and say it plainly: you have accepted another opportunity and your last day is a given date. Thank them and offer to help with the transition.' },
      { q: 'Can I quit without notice?', a: 'In most U.S. jobs you can, since employment is at will, unless your contract says otherwise. It can cost you a reference, so give notice when you can.' },
      { q: 'Should I quit before I have a new job?', a: 'Only with a plan and savings to cover the search. Unemployment benefits are generally not available if you quit without good cause.' },
    ],
    cta: { title: 'Plan the gap', body: 'See how long your money lasts if you leave before the next job starts.', label: 'Open the runway tool', href: '/tools/layoff-runway' },
    updated: UPDATED,
  },
  {
    slug: 'should-i-quit-my-job',
    h1: 'Should I quit my job? A way to decide',
    lede: 'Decide by asking three things: is the problem fixable, do you have money and a plan, and would a different job actually solve it? If the problem is a boss or a project, a change inside the company may work. If it is pay, growth or the whole direction, plan an exit, and do it while you are still employed if you can.',
    sections: [
      {
        h2: 'Signs it may be time',
        bullets: [
          'You have asked for the change you need, such as pay, scope or a new manager, and nothing has moved after a reasonable time.',
          'There is no path to the next level for you here, and you can see it.',
          'The work no longer fits where you want your career to go.',
          'Your health, sleep or relationships are suffering because of the job.',
          'The company is changing in ways that put the role at risk, such as layoffs or a sale.',
        ],
        links: [{ label: 'Problems at work: difficult boss, burnout, passed over', href: '/topics/problems-at-work' }],
      },
      {
        h2: 'Questions to ask yourself',
        bullets: [
          'Could a conversation, a transfer or a changed role fix this?',
          'What exactly do I want instead: pay, growth, a better manager, a different field?',
          'Is the same thing likely at the next employer?',
          'How many months of expenses do I have saved?',
          'What would I be glad I did in a year?',
        ],
        links: [{ label: 'Layoff runway: how long your money lasts', href: '/tools/layoff-runway' }],
      },
      {
        h2: 'Quit with a job, or without',
        paragraphs: [
          'It is usually easier to find a job while you have one, and offers look better to employers when you are not out of work. Searching while employed takes planning, and our guide covers it.',
          'If you have to leave without a job, have six months of expenses saved if you can, a clear target and a search plan. Be aware that quitting usually costs you unemployment benefits.',
        ],
        links: [
          { label: 'Job search while employed', href: '/topics/job-search-while-employed' },
          { label: 'Quit without another job lined up', href: '/start/resigned' },
        ],
      },
      {
        h2: 'If you are staying a bit longer',
        paragraphs: ['Set a date to decide, keep a record of what changes, and use the time to build your résumé and your network so you can leave on your terms.'],
      },
    ],
    faq: [
      { q: 'How do I know if I should quit my job?', a: 'If the problem is not fixable, you have asked for the change you need without result, the role does not fit where you are going, or it is harming your health, it may be time. Check your finances and a plan first.' },
      { q: 'Should I quit without another job lined up?', a: 'Only if you have savings for a long search and a plan. Otherwise search while employed.' },
      { q: 'Will I get unemployment if I quit?', a: 'Usually not, unless you have good cause under your state’s rules, such as unsafe conditions or a major pay cut.' },
      { q: 'How long should I stay before I leave a job?', a: 'There is no fixed time. A short stay can be explained if you have a clear reason and results.' },
    ],
    cta: { title: 'See how employers see you', body: 'A free assessment shows your market value and gives you a weekly plan.', label: 'Start my free assessment', href: MARKET_REALITY_START_HREF },
    updated: UPDATED,
  },
  {
    slug: 'should-i-accept-a-counteroffer',
    h1: 'Should I accept a counteroffer from my current employer?',
    lede: 'Accept a counteroffer only if it fixes the reason you were leaving, in writing, and you would take the new job’s offer off the table without regret. If you were leaving for pay alone, it may be worth a look. If you were leaving for growth, a boss or the direction of the work, extra money rarely changes those, and many people leave anyway.',
    sections: [
      {
        h2: 'Why a counteroffer is tempting',
        bullets: [
          'It confirms you are valued, and often comes with a raise or a new title.',
          'Staying is easier than starting over.',
          'You skip the risk of a new employer.',
        ],
      },
      {
        h2: 'Why to be careful',
        bullets: [
          'The reasons you decided to leave are probably still there.',
          'Your employer may now see you as a flight risk, and plan around it.',
          'A raise given only after you resign may come from next year’s budget or be a one-time fix.',
          'Turning down an employer who has hired you or is about to is hard on that relationship.',
        ],
      },
      {
        h2: 'A test',
        bullets: [
          'List the three reasons you were leaving. Does the counteroffer solve each one?',
          'Is it in writing, with the pay, title, scope and date?',
          'Would you stay if it were the same offer without the competing one?',
          'Would you be as happy in a year as you would be at the new job?',
        ],
        links: [{ label: 'Negotiate a job offer', href: '/topics/negotiate-a-job-offer' }],
      },
      {
        h2: 'How to respond',
        paragraphs: [
          'Thank them and ask for time: “I appreciate this. I will think about it and answer by tomorrow.” Decide using the test. If you decline, say so kindly: “I have decided to take the new role, and I am grateful for the offer.” If you accept, tell the other employer promptly and honestly.',
          'Decide before you resign what you will do if you get a counteroffer, so you are not deciding under pressure.',
        ],
        links: [
          { label: 'Offer letter: what to check', href: '/resources/offer-letter' },
          { label: 'How to quit a job', href: '/topics/how-to-quit-a-job' },
        ],
      },
    ],
    faq: [
      { q: 'Should I accept a counteroffer?', a: 'Only if it fixes the reasons you were leaving, in writing. If you were leaving for something money cannot fix, it usually will not last.' },
      { q: 'Is it a mistake to take a counteroffer?', a: 'Not always. If pay was the only issue and the new terms are in writing, it can work. The risk is that the other reasons stay.' },
      { q: 'How do I respond to a counteroffer?', a: 'Thank them, ask for a day to think, and decide using your original reasons for leaving.' },
      { q: 'Should I tell my new employer about the counteroffer?', a: 'If you decline it, there is no need. If you are considering it, be honest with the new employer promptly.' },
    ],
    cta: { title: 'Check the pay', body: 'Compare the offer and your current pay with the market.', label: 'Open pay check', href: '/tools/pay-check' },
    updated: UPDATED,
  },
  {
    slug: 'i-hate-my-job',
    h1: 'I hate my job: what to do about it',
    lede: 'If you hate your job, start by naming what exactly you hate: the work, the boss, the pay, the culture or the hours. Each has a different fix. Then take small steps while you plan the exit: write down what is wrong, try one fix, build your runway and start a quiet search. You do not have to quit this week to start changing it.',
    sections: [
      {
        h2: 'Name the problem',
        bullets: [
          'The work itself: boring, wrong fit, no growth.',
          'The boss or coworkers: a manager who undermines you, conflict or a toxic team.',
          'The pay or the path: underpaid, passed over, no promotion in sight.',
          'The culture or the hours: always on, no say, no flexibility.',
          'Burnout: exhausted whatever the job, or dread on Sunday night.',
        ],
        links: [{ label: 'Difficult boss, burnout, passed over', href: '/topics/problems-at-work' }],
      },
      {
        h2: 'Try one fix first',
        bullets: [
          'Talk to your manager about the change you want: scope, pay, a project or hours.',
          'Ask about a transfer or a different team.',
          'If the problem is a person, document it and use the formal channel if it is serious.',
          'If it is stress, use the time off and the support you have, such as an employee assistance program, and see a doctor if it is affecting your health.',
        ],
      },
      {
        h2: 'Plan the exit while you stay',
        bullets: [
          'Update your résumé and LinkedIn, and keep a list of your results.',
          'Save a runway: six months of expenses is the usual goal.',
          'Talk to people outside the company about what is out there.',
          'Apply for roles that fix the specific problem, not just any role.',
        ],
        links: [
          { label: 'Job search while employed', href: '/topics/job-search-while-employed' },
          { label: 'How to find a job', href: '/topics/how-to-find-a-job' },
        ],
      },
      {
        h2: 'Decide on a date',
        paragraphs: ['Set a date to decide, such as 90 days, and write what would make you stay. If nothing changes by then, you have your answer, and a search already under way.'],
        links: [{ label: 'Should I quit my job?', href: '/topics/should-i-quit-my-job' }],
      },
    ],
    faq: [
      { q: 'What should I do if I hate my job?', a: 'Name what you hate, try one fix, and start a quiet search and save a runway while you decide.' },
      { q: 'Should I quit if I hate my job?', a: 'Not without a plan. Searching while employed is easier, and quitting usually costs you unemployment benefits.' },
      { q: 'What if I hate my boss?', a: 'Document what happens, raise it through the proper channel if it is serious, and ask about a transfer. If nothing changes, plan your exit.' },
      { q: 'Is it normal to hate your job?', a: 'It is common, and it is a sign to act, not to wait. Small steps now make a change easier later.' },
    ],
    cta: { title: 'See what is out there', body: 'A free assessment shows how employers see your background and what roles fit.', label: 'Start my free assessment', href: MARKET_REALITY_START_HREF },
    updated: UPDATED,
  },
  {
    slug: 'career-change-at-40',
    h1: 'Career change at 40: how to do it and what to expect',
    lede: 'Changing careers at 40 is common and workable. You bring a decade or more of results, judgment and contacts that a newcomer does not. The task is to show how that experience transfers, fill any real skill gap with a certification or project, and plan the money for a search that can take months. The same approach holds at 30 or 50.',
    sections: [
      {
        h2: 'Why it can work',
        bullets: [
          'Experience: you can manage projects, people, budgets and clients, and employers in many fields need that.',
          'Network: you know people who can introduce you to the new field.',
          'Clarity: you know what you like and do not like, which is the hardest part of a change.',
        ],
      },
      {
        h2: 'A plan',
        bullets: [
          'List what you do best and enjoy, and the results you can prove.',
          'Pick two or three target fields and talk to people in each, with short informational conversations.',
          'Find the gap between your skills and the roles and close it with a certificate, a course or a project.',
          'Rewrite your résumé and your story for the new field.',
          'Plan your money. A change can mean a pay cut at first or a longer search.',
        ],
        links: [
          { label: 'Informational interviews', href: '/topics/informational-interviews' },
          { label: 'Career pivot', href: '/topics/career-pivot' },
        ],
      },
      {
        h2: 'Deal with age directly',
        paragraphs: [
          'Some employers assume older candidates will be expensive or slow to adapt. Answer that with evidence: recent tools you use, current results, and an eagerness to learn. Keep your résumé to the last 10 to 15 years and leave off graduation dates if they are not needed.',
        ],
        links: [{ label: 'Laid off at 40, 50 or older', href: '/topics/laid-off-over-40' }],
      },
      {
        h2: 'Tell the story',
        paragraphs: ['Your résumé and cover letter should name the target role, show the results that transfer and say in one line why you are making the move.'],
        links: [
          { label: 'Résumé for a career change', href: '/topics/resume-career-change' },
          { label: 'Cover letter for a career change', href: '/topics/cover-letter-career-change' },
        ],
      },
      {
        h2: 'The money',
        paragraphs: ['Work out how long you can search and what a pay cut would mean. Keep your current job while you test the new field, if you can, and look at funding for retraining.'],
        links: [
          { label: 'Layoff runway', href: '/tools/layoff-runway' },
          { label: 'Funding for retraining', href: '/funding' },
        ],
      },
    ],
    faq: [
      { q: 'Is it too late to change careers at 40?', a: 'No. Many people change careers in their 40s and 50s. The task is to show how your experience transfers and to close any real skill gap.' },
      { q: 'How do I change careers at 40 with no experience in the new field?', a: 'Use transferable results, a certification or a project, and conversations with people in the field. Experience in the new field is built, not given.' },
      { q: 'What are the best careers to switch to at 40?', a: 'The ones where your skills carry over and demand is strong. Check postings and pay in the fields you are considering before you commit.' },
      { q: 'How do I handle age bias in a career change?', a: 'Show current tools and recent results, keep your résumé to the last 10 to 15 years, and be eager to learn.' },
    ],
    cta: { title: 'See where your skills fit', body: 'A free assessment shows how employers see your background and which roles fit.', label: 'Start my free assessment', href: MARKET_REALITY_START_HREF },
    updated: UPDATED,
  },
]
