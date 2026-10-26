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
    slug: 'laid-off-over-40',
    h1: 'Laid off at 40, 50 or older: what to do next',
    lede: 'Being laid off later in a career is common, and the law gives workers 40 and older specific protections. The job search itself changes in a few ways: you lean more on your network, you lead with results and you show that your skills are current.',
    sections: [
      {
        h2: 'Know the protections that apply at 40 and older',
        paragraphs: ['The federal Age Discrimination in Employment Act protects workers 40 and older from age-based discrimination in layoffs and hiring. When an employer asks a worker 40 or older to sign a release in exchange for severance, the Older Workers Benefit Protection Act generally requires at least 21 days to consider it (45 in a group layoff) and 7 days to revoke after signing, and the agreement must be written in plain language.'],
      },
      {
        h2: 'Run the search through people, not only applications',
        bullets: [
          'Tell former colleagues, bosses and clients exactly what role you want, and ask who they would introduce you to.',
          'Reach executive recruiters and search firms in your function with a short note and your resume.',
          'Use your depth: pitch the problems you have solved, with numbers.',
        ],
      },
      {
        h2: 'Show that your skills are current',
        paragraphs: ['Put current tools, methods and recent results near the top of your resume, trim roles older than 15 years to a line, and name the AI and software tools you work with. A recent course or project is a concrete signal.'],
      },
    ],
    faq: [
      { q: 'Is it harder to find a job after 50?', a: 'Searches for senior professionals often take longer, and they depend more on referrals. Direct outreach to people who know your work usually shortens it.' },
      { q: 'How long do I have to sign a severance agreement at 50?', a: 'Federal law generally gives workers 40 and older at least 21 days to consider a release (45 days in a group layoff) and 7 days to revoke it after signing.' },
      { q: 'Should I remove old jobs from my resume?', a: 'Detail the last 10 to 15 years. List earlier roles briefly or leave them off.' },
    ],
    cta: { title: 'See how the market reads your background', body: 'The free Market Reality Assessment shows where your experience is strongest and gives you a weekly plan.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-26',
  },
  {
    slug: 'laid-off-no-savings',
    h1: 'Laid off with no savings: what to do first',
    lede: 'If you were laid off and have little saved, the order matters: get income started, keep your health coverage from lapsing, cut the costs you can and look for programs that pay for what you need. Do these in the first week, in parallel with your search.',
    sections: [
      {
        h2: 'Start income in the first days',
        bullets: [
          'File for unemployment the day you lose the job; benefits generally begin from the date you file.',
          'Ask the employer for final pay, accrued vacation payout where your state requires it, and any severance in writing.',
          'Look at interim, contract or part-time work to bridge the gap while you search.',
        ],
      },
      {
        h2: 'Protect your health coverage',
        paragraphs: ['You have 60 days to elect COBRA, and coverage is retroactive once you elect it. Compare it with marketplace plans, where losing job-based coverage opens a special enrollment period, and with coverage through a spouse.'],
      },
      {
        h2: 'Find help that pays for things',
        paragraphs: ['Your local American Job Center and workforce board can point you to training money, and some programs cover relocation, tuition and certifications for laid-off workers. Call your lenders early; many have hardship options.'],
      },
    ],
    faq: [
      { q: 'What should I do first if I have no savings after a layoff?', a: 'File for unemployment immediately, confirm your final pay, and get your health coverage decision made before the 60-day COBRA deadline.' },
      { q: 'Can I get help paying bills after a layoff?', a: 'Contact your lenders and utilities about hardship options, and ask your local American Job Center about programs for dislocated workers.' },
      { q: 'Should I take any job right away?', a: 'A bridge job that covers essentials can be a good call if it leaves time to search. Keep it from crowding out the search itself.' },
    ],
    cta: { title: 'Find money and programs you qualify for', body: 'Join NextChapter free and see relocation, tuition and training funding ranked for you.', label: 'See funding for me', href: '/funding' },
    updated: '2026-10-26',
  },
  {
    slug: 'explain-a-layoff',
    h1: 'How to explain a layoff in an interview',
    lede: 'Say it in two sentences: the company cut your role, what you did before and after, and what you want next. Interviewers hear about layoffs often; what they listen for is a calm, factual answer that moves on to your work.',
    sections: [
      {
        h2: 'A simple structure',
        bullets: [
          'The fact: “My role was eliminated when the company reduced its team by about a fifth.”',
          'Your result: one line on what you delivered before that.',
          'The turn: what you are looking for next and why this role fits.',
        ],
      },
      {
        h2: 'What to avoid',
        bullets: [
          'Criticizing the former employer or colleagues.',
          'Over-explaining or apologizing; a layoff is not a performance event.',
          'Vague language that makes it sound like a firing. Say “laid off” or “role eliminated.”',
        ],
      },
      {
        h2: 'If you were fired, not laid off',
        paragraphs: ['Keep it just as short and honest: what did not work, what you learned and what you do differently. Then return to your results.'],
      },
    ],
    faq: [
      { q: 'Should I bring up the layoff or wait to be asked?', a: 'Mention it briefly when you walk through your work history, so it does not seem hidden, and then move on.' },
      { q: 'What do I say if the company lays off many people?', a: 'Say so. “The company cut about 20 percent of staff” shows the layoff was not about you.' },
      { q: 'How do I put a layoff on a resume?', a: 'One line is enough, such as “Position eliminated in a reduction in force.” See the resume tips guide.' },
    ],
    cta: { title: 'Practice with a coach', body: 'Victoria, the free AI career coach, can run you through the question and tighten your answer.', label: 'Meet the coach', href: '/coaching' },
    updated: '2026-10-26',
  },
  {
    slug: 'how-to-lay-off-employees',
    h1: 'How to lay off employees: a checklist for employers',
    lede: 'A layoff goes best with decisions made once, communicated plainly and backed by support for the people leaving. Check legal notice first, then plan the conversations, the paperwork and the help you offer.',
    sections: [
      {
        h2: 'Before you announce',
        bullets: [
          'Check whether the federal WARN Act applies: generally employers with 100 or more employees and a mass layoff or plant closing, which requires 60 days’ written notice. Some states have their own rules.',
          'Choose the roles by documented, job-related criteria and review the list for disparate impact.',
          'Decide severance, benefits continuation and the release terms, and the dates that apply.',
        ],
      },
      {
        h2: 'The day',
        bullets: [
          'Tell each person directly, privately and early in the day, with their manager and an HR representative present.',
          'Say the decision is made, give the facts and the dates, and hand over a written summary of pay, benefits and next steps.',
          'Tell the remaining team the same day what happened and what changes.',
        ],
      },
      {
        h2: 'Support for people leaving',
        paragraphs: ['Point people to unemployment filing, COBRA and their state’s rapid response team, and consider outplacement. Giving a reference and a clear explanation of what you will say to future employers helps them most.'],
      },
    ],
    faq: [
      { q: 'Do I need to give 60 days’ notice of a layoff?', a: 'Under the federal WARN Act, covered employers must give 60 days’ written notice of a plant closing or mass layoff. Use the WARN Act checker to see whether yours is likely covered.' },
      { q: 'What is rapid response?', a: 'A state service that helps employers and workers when a layoff is planned. Every state has a team; see the rapid response page for yours.' },
      { q: 'Should I offer outplacement?', a: 'It is common and helps departing employees find work faster, and it can be part of the severance package.' },
    ],
    cta: { title: 'Check whether WARN notice applies', body: 'Enter your headcount and the jobs being cut to see whether 60 days’ notice is likely required.', label: 'Open the WARN Act checker', href: '/tools/warn-act-checker' },
    updated: '2026-10-26',
  },
  {
    slug: 'cover-letter-tips',
    h1: 'Cover letter tips for experienced professionals',
    lede: 'A good cover letter is short: three or four paragraphs that say why this role, why you and what you will do first. Write one when the application invites it, when you are changing fields or when you can name a real connection.',
    sections: [
      {
        h2: 'A structure that works',
        bullets: [
          'Opening: the role, and one sentence on why this employer.',
          'Evidence: two results from your past work that match what the job needs, with numbers.',
          'Close: what you would do in the first months, and a plain request for a conversation.',
        ],
      },
      {
        h2: 'Use it to explain what the resume cannot',
        paragraphs: ['A cover letter is the place to explain a career change, a relocation, a layoff or a gap in two sentences, and to tie your background to the role in your own words.'],
      },
      {
        h2: 'Keep it short',
        paragraphs: ['Stay under one page, address a person where you can find one, and do not repeat the resume line by line.'],
      },
    ],
    faq: [
      { q: 'Do I need a cover letter?', a: 'Not always. If the application makes it optional and you have a strong resume, a referral is worth more. Write one when you are changing fields or can add something the resume cannot.' },
      { q: 'How long should a cover letter be?', a: 'Under one page: three or four short paragraphs.' },
      { q: 'How do I mention a layoff in a cover letter?', a: 'One factual sentence, then move to what you offer.' },
    ],
    cta: { title: 'See how the market reads your background', body: 'The free Market Reality Assessment shows where your experience fits best.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-26',
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
  {
    slug: 'resume-review',
    h1: 'Free resume review: what to check and where to get one',
    lede: 'A resume review answers four questions: does the resume name the role you want, does each job show results, does it get through an applicant tracking system, and can a recruiter read it in thirty seconds. You can do a first pass yourself in fifteen minutes, then get an outside read from a person who hires in your field.',
    sections: [
      {
        h2: 'A fifteen-minute review you can do yourself',
        bullets: [
          'Read only the top third of page one. Can you tell which role you are after, and at what level?',
          'Check each job for outcomes: what changed because of your work, with a number where you have one. Replace “responsible for” lines with results.',
          'Compare the resume with two postings you want. Where a skill or tool is true for you and missing from the page, add it in the same words.',
          'Look at the layout. Standard headings, real text instead of images or text boxes, one font, and a file type the application accepts.',
          'Cut what does not support the target role: jobs older than 10 to 15 years, duties that every person in the role has.',
        ],
      },
      {
        h2: 'Where to get an outside review',
        bullets: [
          'A former manager or a peer in your field. They know what good looks like in your role and will tell you if a result sounds weak.',
          'A recruiter or hiring manager you already know. Ask one question: “What role would you put me forward for after reading this?”',
          'Public communities such as r/resumes, where volunteers comment on anonymized resumes. Remove your contact details first.',
          'Automated checkers. These measure keyword match and formatting. They do not judge whether your story is strong, and many offer a free scan and charge for the rest.',
          'A career coach. NextChapter’s free Market Reality Assessment reads your background the way recruiters do and shows what to fix first. Victoria, the free AI career coach, is available to every candidate, and a human executive coach is an optional addition.',
        ],
      },
      {
        h2: 'What a good review tells you',
        paragraphs: ['A useful review names the role the reader thinks you are targeting, the three changes that matter most, and what to cut. A review that only fixes grammar or only says “looks great” has not told you whether the resume will get you interviews.'],
      },
      {
        h2: 'Warning signs in paid reviews',
        bullets: [
          'A “free review” that is really a sales call for a rewrite package.',
          'A promise of interviews or a job. No one can guarantee either.',
          'Feedback that is the same for every resume: the same template paragraph, with your name inserted.',
        ],
      },
    ],
    faq: [
      { q: 'Is a free resume review worth it?', a: 'Yes, if it comes from someone who hires or recruits in your field and tells you which role the resume points to. Generic feedback on formatting and grammar is less useful.' },
      { q: 'Do ATS resume checkers work?', a: 'They are reliable for formatting problems and for how well your wording matches a posting. They cannot tell you whether your results are strong or whether a recruiter will find them convincing.' },
      { q: 'How often should I update my resume?', a: 'Each time you finish a project or change something measurable at work, add the result to a running list. Then tailor the resume to each application from that list.' },
    ],
    cta: { title: 'See how the market reads your resume', body: 'The free Market Reality Assessment reads your background the way recruiters do and shows what to fix first.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-26',
  },
  {
    slug: 'interview-questions-and-answers',
    h1: 'Common interview questions and how to answer them',
    lede: 'Most interviews for experienced professionals draw on the same handful of questions asked in different words. Answer each in under two minutes, with one specific example and its result, and end by connecting it to the job you are interviewing for.',
    sections: [
      {
        h2: 'The questions that come up most',
        bullets: [
          '“Tell me about yourself.” Give a one-minute story: what you do now, two results that matter for this role, and why this job is the next step. Do not recite your resume.',
          '“Why this role and this company?” Name something specific about the work or the team, and tie it to what you have already done.',
          '“Tell me about a time you…” (led a project, handled conflict, failed, changed someone’s mind). Use the structure below.',
          '“Why did you leave, or why are you leaving?” Keep it short, factual and forward-looking. For a layoff, see how to explain a layoff in an interview.',
          '“What is your biggest weakness?” Pick a real one that does not undercut the job, and say what you do about it.',
          '“What are your salary expectations?” Where the law allows, ask about the range for the role first. If you must give a number, give a range based on what the market pays for the role.',
          '“Do you have any questions for us?” Always have three ready. See below.',
        ],
      },
      {
        h2: 'A structure for behavioral questions',
        paragraphs: ['For any “tell me about a time” question, answer in three parts: the situation in one or two sentences, what you personally did, and the result with a number or a clear outcome. Choose examples from the last few years, and have five ready that between them cover leading others, a conflict, a failure, a deadline and a change you drove.'],
      },
      {
        h2: 'Questions to ask the interviewer',
        bullets: [
          'What would success look like in the first six months?',
          'What is the hardest part of this role that is not in the posting?',
          'How does the team make decisions when people disagree?',
          'What happened to the person who held this role before?',
        ],
      },
      {
        h2: 'How to practice',
        paragraphs: ['Say your answers out loud and time them. Record one practice run and listen for rambling and filler. Practice the first minute of “tell me about yourself” until it is smooth, since it sets the tone for everything after it.'],
      },
    ],
    faq: [
      { q: 'How long should an interview answer be?', a: 'Aim for one to two minutes. Long enough to give an example and its result, short enough that the interviewer can ask a follow-up.' },
      { q: 'How do I answer “tell me about yourself”?', a: 'Give a one-minute story: your current work, two results relevant to this role, and why this job is the logical next step.' },
      { q: 'What do I do if I blank on a question?', a: 'Say “let me think about that for a moment”, take a breath, and answer. A short pause reads as careful. If nothing comes, offer a related example and ask if that helps.' },
    ],
    cta: { title: 'Practice with a coach', body: 'Get a free AI career coach, Victoria, and add a human executive coach when you want one.', label: 'See career coaching', href: '/coaching' },
    updated: '2026-10-26',
  },
  {
    slug: 'career-advice',
    h1: 'Career advice for experienced professionals',
    lede: 'The career advice that holds up in every industry is a short list: know what the market pays and wants for your skills before you need to, keep proof of your results current, keep your network warm, and make moves on a plan rather than a mood.',
    sections: [
      {
        h2: 'Know your market before you need it',
        paragraphs: ['Look at postings for the role you hold and the one above it every few months. Note the titles, the skills that repeat, and the pay where it is posted. If your skills are drifting away from what employers ask for, you want to find out while you still have a job.'],
      },
      {
        h2: 'Keep proof of your results current',
        paragraphs: ['Keep a running list of what you shipped, saved, grew or fixed, with numbers. Add to it monthly. It makes your resume, a raise conversation and a sudden job search far easier, and people who can show results are chosen over those who can only describe duties.'],
      },
      {
        h2: 'Keep your network warm',
        paragraphs: ['Reach out to former colleagues and managers when you have nothing to ask for: congratulate, share an article, make an introduction. Most senior roles are filled through someone who knew the person, and those relationships are hard to build in a hurry after a layoff.'],
      },
      {
        h2: 'When to stay and when to go',
        bullets: [
          'Stay when you are still learning, your manager backs you and the pay is within the market range.',
          'Start looking quietly when growth has stopped, you have been passed over twice, or the company’s direction worries you.',
          'Move fast when the problem is your health, safety or ethics.',
          'Whatever you decide, decide with offers or market data in hand, not only how last week felt.',
        ],
      },
      {
        h2: 'When advice is not enough',
        paragraphs: ['If you are weighing a change of field, a layoff is near or a search has stalled, a plan built for your background is more useful than general advice. A career coach can pressure-test the plan.'],
      },
    ],
    faq: [
      { q: 'What is the most important career advice?', a: 'Build and document results you can point to, and keep relationships alive with people who have seen you work. Both make every later move easier.' },
      { q: 'How often should I look at the job market?', a: 'Every few months, even when you are happy. It takes about an hour and tells you whether your pay and skills are still competitive.' },
      { q: 'Is it too late to change careers at 45 or 50?', a: 'No. Most people who change fields in mid-career reuse what they already know. See the career pivot guide for how to choose the target and tell the story.' },
    ],
    cta: { title: 'See where you stand', body: 'The free Market Reality Assessment shows how the market reads your background and what to work on first.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-26',
  },
  {
    slug: 'problems-at-work',
    h1: 'Problems at work: a difficult boss, burnout, being passed over',
    lede: 'Most work problems follow one path: write down what is happening, raise it directly, use the formal channel if it continues, and quietly line up your options in case it does not get better. Harassment, discrimination, retaliation and safety problems are different and go straight to HR in writing.',
    sections: [
      {
        h2: 'First steps for any problem',
        bullets: [
          'Keep dated notes: what happened, who was there, what was said. Keep them on your own device, not a work one.',
          'Raise it directly and specifically, once, in a calm conversation. Name the behavior and the effect on the work, not the person’s character.',
          'If it continues, bring it to your manager’s manager or HR, in writing, with your notes.',
          'Keep doing good work and keep copies of positive feedback and results.',
        ],
      },
      {
        h2: 'A difficult boss or micromanager',
        paragraphs: ['Ask what a good outcome looks like and how they want to be updated. Many micromanagers relax when they get a predictable summary before they ask. If the pattern is insulting, unfair or retaliatory rather than just irritating, document it and use the formal channel.'],
      },
      {
        h2: 'Burnout and overload',
        paragraphs: ['Write down everything you own, rank it, and take the list to your manager with a request to drop or delay specific items. If the load does not change, or your health is suffering, treat it as a reason to start a quiet search and talk to a doctor. In the United States, the Family and Medical Leave Act may give eligible employees job-protected leave for a serious health condition.'],
      },
      {
        h2: 'Passed over for a promotion',
        paragraphs: ['Ask what specifically stood between you and the role and what the next opportunity looks like. If the answer is vague or the timeline keeps moving, check what the market offers at the next level. Moving outside is often the faster route.'],
      },
      {
        h2: 'Harassment, discrimination or retaliation',
        paragraphs: ['Report it to HR in writing and keep a copy. In the United States you can also file a charge with the Equal Employment Opportunity Commission, and the deadlines are short, so speak to an employment lawyer early. Retaliation for reporting is itself unlawful.'],
      },
      {
        h2: 'When to start looking',
        paragraphs: ['Start a confidential search when the problem has lasted months, the formal channel has not fixed it or your health is affected. Search while you are still employed, if you can, and check your state’s unemployment rules before you resign, because quitting can affect eligibility.'],
      },
    ],
    faq: [
      { q: 'Should I quit a job because of a bad boss?', a: 'Try a direct conversation and the formal channel first, and start a quiet search in parallel. Searching while employed gives you more leverage and more time.' },
      { q: 'Can I get unemployment if I quit?', a: 'It depends on the state and the reason. Many states pay only when you left for “good cause”, so check your state’s rules before you resign.' },
      { q: 'How do I document problems at work?', a: 'Write the date, what happened, who was present and any messages. Keep it factual and keep it on your own device.' },
    ],
    cta: { title: 'Know your options before you decide', body: 'See how the market reads your background, privately, before anyone at work knows you looked. Free.', label: 'Get my free assessment', href: MARKET_REALITY_START_HREF },
    updated: '2026-10-26',
  },
]

export const TOPIC_SLUGS = TOPICS.map((t) => t.slug)

export function getTopic(slug: string): TopicContent | undefined {
  return TOPICS.find((t) => t.slug === slug)
}
