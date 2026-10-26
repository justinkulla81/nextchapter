// Plain-language explainers for the search phrases no other page answers: severance, career pivot, career exploration,
// executive recruiters, reverse recruiter, job search strategy, resume tips. One page each at /topics/[slug]; the
// title, description and phrases they own are in keywords.ts. Keep every statement general and checkable.

import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'

export interface TopicSection {
  h2: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface TopicContent {
  slug: string
  /** The page's H1. Carries the primary phrase. */
  h1: string
  /** First paragraph: answers the query in two or three sentences. */
  lede: string
  sections: TopicSection[]
  faq: { q: string; a: string }[]
  /** The one action at the end: where it goes and what it says. */
  cta: { title: string; body: string; label: string; href: string }
  updated: string
}

export const TOPICS: TopicContent[] = [
  {
    slug: 'severance',
    h1: 'Severance package: what it is and how to negotiate it',
    lede: 'A severance package is the pay and benefits an employer offers when it ends your job. Federal law does not require severance, so what you get depends on your contract, company policy and what you negotiate. Most packages are offered in exchange for a signed release, so read the agreement before you sign it.',
    sections: [
      {
        h2: 'What a severance package usually includes',
        bullets: [
          'Severance pay, often calculated from years of service. One to two weeks of pay per year is a common formula, but it varies widely by employer and level.',
          'Health coverage: a subsidy toward COBRA premiums for some number of months.',
          'Payout of unused vacation or paid time off, where state law or company policy provides it.',
          'Treatment of bonuses, unvested equity and retirement plan matches.',
          'Outplacement or job search help, and an agreed reference or announcement wording.',
        ],
      },
      {
        h2: 'What you can negotiate',
        paragraphs: [
          'Employers expect questions about an offer, especially when it asks you to release legal claims. The items people most often ask for are a longer pay period, more months of health coverage, a bonus or equity vest that is close to paying out, a narrower non-compete, and agreed wording for references and for how your departure is described.',
          'Ask in writing, ask for the whole agreement before the deadline, and ask for any extra time you need. Workers 40 and older who are asked to sign a release under the federal Older Workers Benefit Protection Act generally get at least 21 days to consider it (45 days in a group layoff) and 7 days to revoke after signing.',
        ],
      },
      {
        h2: 'Severance, unemployment and health insurance',
        paragraphs: [
          'Whether severance reduces unemployment benefits depends on the state. Some states count severance as income for the weeks it covers and some do not. Our state pages show how each state treats it, and when to file.',
          'Your COBRA election window is 60 days from the date you lose coverage or get the notice, whichever is later, and coverage is retroactive once elected. Compare it with marketplace plans before you choose.',
        ],
      },
    ],
    faq: [
      { q: 'Is an employer required to give severance?', a: 'Generally not. Federal law does not require severance pay. It can be required by an employment contract, a union agreement, a company plan, or in some mass layoffs by the terms the employer chooses to offer.' },
      { q: 'Does severance affect unemployment benefits?', a: 'In some states, yes. Some count severance as income and delay or reduce benefits for the weeks it covers; others do not. Check your state’s page, and file for unemployment right away either way.' },
      { q: 'Can I negotiate a severance offer?', a: 'Yes. Offers are often negotiable, particularly the amount, months of health coverage, timing of bonus or equity, and reference wording. Ask in writing before the deadline on the agreement.' },
      { q: 'How long do I have to sign a severance agreement?', a: 'It is set by the agreement. For workers 40 and older signing a release, federal law generally requires at least 21 days to consider it (45 in a group layoff) and 7 days to revoke.' },
    ],
    cta: { title: 'Plan the first weeks after a layoff', body: 'Get a free Market Reality Assessment and a weekly plan that starts with the deadlines: unemployment, health coverage, references.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-25',
  },
  {
    slug: 'job-search-strategy',
    h1: 'Job search strategy: a weekly plan that gets interviews',
    lede: 'A job search works best when it is run like a project: a target list, a weekly plan with set hours, a record of every contact, and a rule for when to change course. Applying alone, without direct outreach to people, is the most common reason a strong candidate’s search stalls.',
    sections: [
      {
        h2: 'Set the target first',
        paragraphs: ['Write down the two or three roles you want, the industries that hire for them, and a list of 30 to 50 employers you would be glad to join. A vague target produces scattered applications; a list gives you something to research, follow and reach into.'],
      },
      {
        h2: 'Split your week across three kinds of work',
        bullets: [
          'Applications: roles that fit, with the resume pointed at the posting.',
          'Direct outreach: messages to people who work at your target employers or who know someone who does.',
          'Visibility: posting, commenting and conversations that keep you findable to recruiters and former colleagues.',
        ],
        paragraphs: ['Roughly a third of your time on each is a sensible starting point. Move time toward whichever one produces conversations.'],
      },
      {
        h2: 'Track it and change the plan when it stalls',
        paragraphs: [
          'Keep one list with the date, the contact, what you sent and when to follow up. Count conversations and interviews each week, not only applications sent.',
          'If you have applied to 20 or more roles with no interviews, the problem is usually the resume, the targeting or the lack of a referral, not volume. Change one of those before sending more.',
        ],
      },
    ],
    faq: [
      { q: 'How many hours a week should a job search take?', a: 'There is no single number. A full-time search is often 20 to 30 focused hours a week; more than that tends to produce diminishing returns. What matters is a set schedule and a mix of applications, outreach and visibility.' },
      { q: 'How many jobs should I apply to each week?', a: 'Fewer, better fits. Ten well-targeted applications paired with outreach to people at those employers usually beat fifty quick ones.' },
      { q: 'What is the first thing to fix when there are no interviews?', a: 'Check that the resume matches the roles you are applying to, then add direct outreach to a person at each employer. See why searches stall for the common causes.' },
    ],
    cta: { title: 'Get a plan built for your background', body: 'The free Market Reality Assessment shows how the market reads your background and gives you a weekly Search Sprint to follow.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-25',
  },
  {
    slug: 'resume-tips',
    h1: 'Resume tips for experienced professionals after a layoff',
    lede: 'An experienced professional’s resume has to do three things in about thirty seconds: show the role you want, prove you have done it with results, and get through an applicant tracking system. A layoff needs one line, not an explanation.',
    sections: [
      {
        h2: 'Lead with the target role and results',
        paragraphs: ['Put a short headline and summary at the top that names the role you want, then fill each position with outcomes: what changed because of your work, with numbers where you have them. Duties describe the job; results describe you.'],
      },
      {
        h2: 'Handle a layoff or a gap in one line',
        paragraphs: ['A layoff is common and not a mark against you. If you want to mention it, one plain line is enough, such as “Position eliminated in a company-wide reduction in force.” For a gap, say what you did in it: consulting, study, caregiving, a project. Then move on to your results.'],
      },
      {
        h2: 'Get through the screen',
        bullets: [
          'Use a simple layout with standard headings (Experience, Education, Skills) and real text, not images or text boxes.',
          'Use the words from the posting where they are true, especially job titles and tools.',
          'Save as a PDF or a Word file, whichever the application asks for.',
          'Two pages is normal for a long career; put the strongest material on page one.',
        ],
      },
      {
        h2: 'Prove it beyond the page',
        paragraphs: ['A resume is a claim. An Executive Dossier backs it with the people who worked with you, which is what hiring managers check next.'],
      },
    ],
    faq: [
      { q: 'How do I explain a layoff on my resume?', a: 'One line is enough: the date and that the position was eliminated. Spend the rest of the space on results from the role.' },
      { q: 'How long should a resume be for an experienced professional?', a: 'Two pages is common for a long career. Keep the most relevant and recent material on the first page.' },
      { q: 'Should I list every job I have had?', a: 'No. Detail the last 10 to 15 years and the roles that support your target; list earlier jobs briefly or leave them off.' },
    ],
    cta: { title: 'See how the market reads your resume', body: 'The free Market Reality Assessment reads your background the way recruiters do and shows what to fix first.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-25',
  },
  {
    slug: 'career-pivot',
    h1: 'Career pivot: how to move to a new role or industry',
    lede: 'A career pivot keeps what you already do well and points it at a different role, function or industry. It is easier than starting over because the skills carry across; the work is showing an employer that they do.',
    sections: [
      {
        h2: 'Find the pivot that fits',
        paragraphs: ['List the tasks in your past roles that you did well and wanted to keep doing. Then look for roles where those same tasks are most of the job. Common pivots keep one thing constant: the same function in a new industry, the same industry in a new function, or the same skills in an adjacent role.'],
      },
      {
        h2: 'Prove the skills transfer',
        bullets: [
          'Translate your results into the new field’s language, using the words in its job postings.',
          'Close the one or two real gaps with a course, a certification or a small project you can show.',
          'Collect evidence a hiring manager can check: results, references, work samples.',
        ],
      },
      {
        h2: 'Test it before you commit',
        paragraphs: ['Talk to three or four people already doing the job and ask what the first year looks like and what hires are missing. Check demand in the live job listings and what the role pays. Then reposition your resume and story around the new target and apply.'],
      },
    ],
    faq: [
      { q: 'What is the difference between a career pivot and a career change?', a: 'A pivot moves on a skill you already have, such as the same function in a new industry. A change usually means a new field with new skills to build. The steps overlap; a pivot is faster because the gap is smaller.' },
      { q: 'How long does a career pivot take?', a: 'It depends on the size of the gap. A pivot that reuses most of your skills can be done inside a normal job search; one that needs a credential takes longer.' },
      { q: 'Will I have to take a pay cut?', a: 'Not always. Check posted pay for the new role in the job listings before you decide, and weigh it against what the move opens up.' },
    ],
    cta: { title: 'See which roles your background fits', body: 'The free Market Reality Assessment shows how the market reads your background and which roles are within reach.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-25',
  },
  {
    slug: 'career-exploration',
    h1: 'Career exploration: find your next direction',
    lede: 'Career exploration is working out what to do next before you commit to a search. For an experienced professional the best starting point is your own work history: what you did well, what you want more or less of, and what the market pays for it.',
    sections: [
      {
        h2: 'Start with what you already know',
        bullets: [
          'The tasks you did best and the ones you would do again.',
          'The kind of problems, people and pace you want from the next job.',
          'The pay, location and schedule you need.',
        ],
      },
      {
        h2: 'Look at the real options',
        paragraphs: ['Most next steps fall into four groups: the same role at a different employer, the same function in a different industry, an adjacent role that uses your skills in a new way, or independent work such as consulting. For each, check how many openings there are, what they pay and what they ask for. Our job listings show posted pay and requirements.'],
      },
      {
        h2: 'Test before you commit',
        paragraphs: ['Have a few conversations with people doing the work, try a short project or course, and see whether you still want it. Then pick one or two targets and build the search around them, using a career pivot plan if the move is across fields.'],
      },
    ],
    faq: [
      { q: 'How do I figure out what career to pursue next?', a: 'Start from your own history: what you did well and want more of. Then compare the options on openings, pay and requirements, and test the best one or two with conversations or a small project.' },
      { q: 'Is career exploration only for people changing fields?', a: 'No. It is useful anyone who is unsure what to do next, including people staying in the same field but changing employer, level or type of work.' },
      { q: 'Can AI skills change my options?', a: 'They can. Our AI skills data shows which functions ask for them and what those postings pay.' },
    ],
    cta: { title: 'Start with how the market sees you', body: 'The free Market Reality Assessment reads your background and shows where it is strongest.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-25',
  },
  {
    slug: 'executive-recruiters',
    h1: 'Executive recruiters: how to work with search firms',
    lede: 'Executive recruiters, also called headhunters or search firms, are hired by employers to fill senior roles. They are paid by the employer, so they work for the company, not for you. A legitimate recruiter does not charge candidates a fee.',
    sections: [
      {
        h2: 'Retained and contingent recruiters',
        paragraphs: [
          'A retained search firm is paid up front to run a search for one role, usually a senior or hard-to-fill one, and works it exclusively. A contingent recruiter is paid only if the employer hires someone they present, and may work many roles at once. Retained searches tend to be for more senior positions.',
        ],
      },
      {
        h2: 'How to get on a recruiter’s radar',
        bullets: [
          'Keep a current profile that states the role you want and your results.',
          'Find the firms that work your function and industry, and send a short note with your resume.',
          'Answer quickly when one reaches out, even if the role is not right; ask them to keep you in mind.',
          'Ask former colleagues and bosses for an introduction to the recruiters they trust.',
        ],
      },
      {
        h2: 'What a recruiter can and cannot do',
        paragraphs: ['A recruiter places people against open searches. They cannot create a role for you, and most will not keep in touch with someone who does not fit a search. Treat them as one channel next to direct applications and your own network, and watch for fake recruiters who ask for money or personal information.'],
      },
    ],
    faq: [
      { q: 'Do executive recruiters charge candidates?', a: 'Legitimate ones do not. They are paid by the employer. Be cautious of anyone who asks you for a fee to place you.' },
      { q: 'What is the difference between a retained and a contingent recruiter?', a: 'A retained firm is paid to run a search whether or not it is filled; a contingent recruiter is paid only when their candidate is hired.' },
      { q: 'How do I find an executive recruiter?', a: 'Look for firms that specialize in your function and industry, ask people in your network which recruiters they trust, and send your resume.' },
    ],
    cta: { title: 'Put your resume in front of recruiters', body: 'Send your resume and we pass strong matches along to recruiters and search firms in our network. Free, no signup.', label: 'Submit my resume', href: '/submit-resume' },
    updated: '2026-10-25',
  },
  {
    slug: 'reverse-recruiter',
    h1: 'Reverse recruiter: what it is and how it compares',
    lede: 'A reverse recruiter, also called reverse recruiting or candidate marketing, works for the job seeker instead of the employer. The service finds openings, contacts employers or applies for you, and the job seeker pays. That is the opposite of a regular recruiter, who is paid by the employer.',
    sections: [
      {
        h2: 'What a reverse recruiter does',
        bullets: [
          'Rewrites your resume and LinkedIn profile.',
          'Searches for openings that fit and, depending on the service, applies for you.',
          'Contacts hiring managers and recruiters on your behalf.',
          'Schedules or prepares you for interviews.',
        ],
      },
      {
        h2: 'What to ask before you pay',
        bullets: [
          'Exactly what they do each week, and what you still have to do yourself.',
          'Whether they apply in your name and whether you approve each one.',
          'How they charge: a flat fee, a monthly fee or a share of your pay, and what happens if you stop.',
          'What they have done for people at your level and in your field, and whether you can talk to them.',
        ],
        paragraphs: ['No one can guarantee a job. Treat a promise of one as a warning sign.'],
      },
      {
        h2: 'How it compares with other help',
        paragraphs: ['A career coach teaches you how to run the search and does not do it for you. An executive recruiter fills an employer’s role and is paid by the employer. A reverse recruiter does part of the work for you, for a fee. NextChapter is free for job seekers: a Market Reality Assessment, a weekly plan, an AI career coach, and a way to send your resume to recruiters in our network.'],
      },
    ],
    faq: [
      { q: 'What is a reverse recruiter?', a: 'A person or service that represents the job seeker to employers, usually for a fee paid by the job seeker, instead of being paid by the employer.' },
      { q: 'Is a reverse recruiter worth it?', a: 'It depends on what they actually do and what you would otherwise do yourself. Ask for the weekly work, the fee structure and examples at your level before you pay.' },
      { q: 'How is a reverse recruiter different from a career coach?', a: 'A coach advises you and you do the search. A reverse recruiter does some of the search for you.' },
    ],
    cta: { title: 'Get recruiters to see your resume', body: 'Send your resume and we pass strong matches to recruiters in our network. Free, no obligation.', label: 'Submit my resume', href: '/submit-resume' },
    updated: '2026-10-25',
  },
]

export const TOPIC_SLUGS = TOPICS.map((t) => t.slug)

export function getTopic(slug: string): TopicContent | undefined {
  return TOPICS.find((t) => t.slug === slug)
}
