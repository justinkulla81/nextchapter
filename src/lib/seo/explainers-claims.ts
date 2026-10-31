// Guides for two moments after a job ends: a reduction in force (a RIF, in the private sector and the federal government), and an unemployment
// claim that is denied, slow, taxed, about to run out, or filed after quitting, being fired or working for yourself. One page each at
// /topics/[slug]; the title, description and phrases they own are in keywords.ts. Keep every statement general and checkable: where a rule
// differs by state, say so and send the reader to the state page rather than quote one state's rule as the rule.

import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import type { TopicContent } from './explainers'

const UPDATED = '2026-10-31'

export const CLAIM_TOPICS: TopicContent[] = [
  {
    slug: 'reduction-in-force',
    h1: 'Reduction in force (RIF): what it means and what to do next',
    lede: 'A reduction in force, or RIF, is a layoff in which the employer permanently eliminates jobs, usually to cut cost or reorganize. It is about the position, not your performance. If you got a RIF letter, the first week matters most: read what it offers before you sign anything, and file for unemployment as soon as you are separated.',
    sections: [
      {
        h2: 'What a RIF is, and how it differs from a layoff',
        paragraphs: [
          'In ordinary use, RIF and layoff mean the same thing: the job is cut for business reasons. Employers and the federal government use “RIF” for a permanent elimination of positions, and use “furlough” or “temporary layoff” when the job is expected to return.',
          'A RIF is not a firing. The reason is the role or the headcount, not conduct or performance. That matters for unemployment, for severance and for how you explain it to the next employer.',
        ],
      },
      {
        h2: 'What a RIF letter should tell you',
        bullets: [
          'Your last day, and whether you work through it or are paid to stay home.',
          'The date your pay and your health coverage end. These are often different dates.',
          'Whether a severance offer comes with it, and what you must sign to get it.',
          'What happens to unused vacation, bonuses, equity and your 401(k) match.',
          'Who to call with questions, and any outplacement or job search help the employer provides.',
        ],
      },
      {
        h2: 'The first week',
        bullets: [
          'Do not sign the release the day you get it. Ask for the full agreement and the deadline in writing.',
          'File for unemployment the week you are separated. Severance may delay or reduce benefits in some states, but filing starts the clock. Our state pages show the rule for each state.',
          'Mark your health coverage dates. You have 60 days to elect COBRA, and coverage is retroactive once you elect it, so compare it with a marketplace plan before you pay.',
          'Ask in writing for the reason for separation, your final pay date and your unused-vacation payout. State law sets the final pay deadline.',
          'Save what you are allowed to keep: your performance reviews, your list of accomplishments and the names of people who will vouch for you. Do not take confidential files.',
        ],
      },
      {
        h2: 'How employers choose who goes',
        paragraphs: [
          'There is no single formula. Employers usually decide which roles or teams are cut first, then choose within them using documented criteria such as skills the business still needs, performance record, seniority and location. Many employers write the criteria down because a written reason is easier to defend.',
          'The choice cannot be based on a protected trait such as race, sex, age (40 and over), disability or religion, or be a reprisal for a complaint or a leave. If the people selected skew older or fit a pattern, that can be evidence of discrimination even when no one meant it. If you suspect this, talk to an employment lawyer quickly: the time limit to file a charge with the federal EEOC is 180 days, and 300 in many states.',
        ],
      },
      {
        h2: 'Notice, severance and your rights',
        bullets: [
          'The federal WARN Act requires 60 days’ notice from employers with 100 or more employees when a closing or a mass layoff reaches enough workers at one site. If the notice was short, the employer may owe up to 60 days of pay and benefits. Some states, including New York, New Jersey and California, have their own notice laws.',
          'Severance is not required by federal law. It comes from a contract, a policy or a negotiation. In a RIF it is usually offered in exchange for a release of legal claims.',
          'If you are 40 or older and are asked to sign a release as part of a group layoff, federal law (the Older Workers Benefit Protection Act) gives you 45 days to consider it, 7 days to revoke after signing, and a written list of the job titles and ages of everyone selected and not selected. For a single person the period is 21 days.',
          'Your final paycheck and any vacation payout follow your state’s law, whatever the letter says.',
        ],
        links: [
          { label: 'WARN Act rights and what to do with a notice', href: '/resources/warn-act' },
          { label: 'Severance package: what it is and how to negotiate it', href: '/topics/severance' },
          { label: 'Federal employee? Read the federal RIF guide', href: '/topics/federal-rif' },
        ],
      },
      {
        h2: 'Can I come back, and what do I say next',
        paragraphs: [
          'Ask HR whether you are marked eligible for rehire and get it in writing. Some employers recall people when the work returns, and union contracts often give recall rights in order of seniority.',
          'On your résumé, state it plainly: “Position eliminated in company restructuring.” In an interview, keep it to one sentence about the company and move on to your results. Our guide on explaining a layoff gives the wording.',
        ],
        links: [{ label: 'How to explain a layoff in an interview', href: '/topics/explain-a-layoff' }],
      },
    ],
    faq: [
      { q: 'What is a RIF?', a: 'A reduction in force is a layoff in which an employer permanently eliminates positions for business reasons such as cost or reorganization. It is about the job, not the person’s performance.' },
      { q: 'Is a RIF the same as being fired?', a: 'No. A firing is for conduct or performance. A RIF removes the position. For unemployment benefits, a RIF is treated as a job loss through no fault of your own in nearly every state.' },
      { q: 'Can I collect unemployment after a RIF?', a: 'Usually yes, if you meet your state’s earnings and work requirements. File the week you are separated. In some states severance pay delays or reduces benefits, so check your state’s rule.' },
      { q: 'Do I have to sign the severance agreement?', a: 'No, but the severance is usually conditional on signing. Read the release, ask for time, and have a lawyer look at it if you have any concern. Workers 40 and older get 21 days, or 45 days in a group layoff.' },
      { q: 'How long after a RIF notice is my last day?', a: 'It depends on the employer and on notice laws. Under the WARN Act, covered employers give 60 days’ notice of a closing or mass layoff, but many individual layoffs take effect sooner.' },
    ],
    cta: { title: 'Get your plan started', body: 'A free Market Reality Assessment shows how employers see your background and a weekly plan that starts with the deadlines.', label: 'Start my free assessment', href: MARKET_REALITY_START_HREF },
    updated: UPDATED,
  },
  {
    slug: 'federal-rif',
    h1: 'Federal RIF: your rights, notice, severance and appeal',
    lede: 'A federal reduction in force (RIF) follows rules set by the Office of Personnel Management (OPM), not the agency’s discretion. You are owed written notice, your place in line is set by tenure, veterans’ preference, length of service and performance, and you can appeal to the Merit Systems Protection Board. Read the notice for the effective date and your retention standing.',
    sections: [
      {
        h2: 'How a federal RIF works',
        paragraphs: [
          'An agency uses a RIF when it must release employees from their positions because of a lack of work, a shortage of funds, a reorganization or a similar reason. The release can be a separation, a demotion, a furlough of more than 30 days or a reassignment that displaces someone.',
          'The agency draws a competitive area and competitive levels, then ranks everyone in each level on a retention register. Court orders and new rules have changed what agencies can do at times, so read your own notice and the OPM page on RIFs for the current rules.',
        ],
      },
      {
        h2: 'Notice',
        bullets: [
          'You must get a specific written notice, generally at least 60 days before the RIF takes effect. OPM can approve a shorter period, but not less than 30 days, in unforeseeable circumstances.',
          'The notice states the effective date, the reason, your competitive area and level, your retention standing and your appeal rights.',
          'If something in it looks wrong, such as your service computation date or your veterans’ preference, tell your HR office in writing right away.',
        ],
      },
      {
        h2: 'Who stays: the retention order',
        paragraphs: [
          'Employees in a competitive level are ranked first by tenure group (career employees ahead of career-conditional or probationary ones), then by veterans’ preference, then by length of federal service, adjusted for performance ratings. The lowest-ranked employee is released first.',
          'Higher-ranked employees displaced from their own position can have rights to take another position: “bumping” a lower-ranked employee in a position they qualify for, or “retreating” to a position they held before. Ask HR which options you have, and by when.',
        ],
      },
      {
        h2: 'Severance, retirement and health coverage',
        bullets: [
          'Severance pay: employees separated by a RIF who are not eligible for an immediate annuity generally get one week of basic pay for each of the first 10 years of service and two weeks for each year beyond 10, plus an age adjustment of 2.5% for each full three months over age 40, capped at 52 weeks. OPM’s severance pay fact sheet has the details.',
          'Retirement: if you are involuntarily separated and are at least 50 with 20 years of service, or any age with 25 years, you may qualify for an immediate pension under discontinued service retirement. Ask your HR retirement specialist for an estimate before your last day.',
          'Health coverage: Federal Employees Health Benefits coverage continues for 31 days after separation at no cost to you. After that you can choose Temporary Continuation of Coverage for up to 18 months, paying the full premium, or compare marketplace plans.',
          'Thrift Savings Plan: your account stays with the plan unless you choose to move it.',
        ],
        links: [
          { label: 'OPM: reductions in force', href: 'https://www.opm.gov/policy-data-oversight/workforce-restructuring/reductions-in-force/' },
          { label: 'OPM: severance pay fact sheet', href: 'https://www.opm.gov/policy-data-oversight/pay-leave/pay-administration/fact-sheets/severance-pay/' },
        ],
      },
      {
        h2: 'Unemployment for federal employees',
        paragraphs: [
          'Federal employees file for Unemployment Compensation for Federal Employees (UCFE) through the state unemployment agency, the same office as everyone else. The state uses Standard Form 8 (the notice of unemployment insurance rights that your agency gives you) and your separation personnel action (Standard Form 50) to confirm your federal pay.',
          'Benefit amounts and weeks follow the state’s rules, so use our state page to see them. Severance can affect when benefits begin, so file the week you are separated and report the severance when asked.',
        ],
        links: [{ label: 'Unemployment benefits by state', href: '/unemployment-benefits' }],
      },
      {
        h2: 'Appeals and priority for other federal jobs',
        bullets: [
          'You can appeal a RIF action to the Merit Systems Protection Board, generally within 30 days of the effective date. If your union contract covers RIFs, it may offer a grievance route instead; you generally choose one or the other, so check before you file.',
          'Priority programs: the Career Transition Assistance Plan (CTAP) and Interagency CTAP (ICTAP) give displaced employees priority consideration for vacancies they are well qualified for, in your agency and in others. The Reemployment Priority List (RPL) does the same for jobs in the agency that separated you. Register for each as soon as you are eligible. The eligibility periods are limited.',
          'Update your résumé in the federal format, keep your SF-50s and your last three performance ratings, and start searching before your last day.',
        ],
        links: [
          { label: 'Merit Systems Protection Board', href: 'https://www.mspb.gov/' },
          { label: 'Reduction in force for private-sector employees', href: '/topics/reduction-in-force' },
        ],
      },
    ],
    faq: [
      { q: 'How much notice does a federal RIF require?', a: 'Generally at least 60 days’ written notice before the effective date. OPM can approve a shorter period, but not less than 30 days, in unforeseeable circumstances.' },
      { q: 'How is federal RIF severance calculated?', a: 'Basic severance is one week of basic pay for each of the first 10 years of service and two weeks for each year after that, with an age adjustment of 2.5% for each full three months over 40, up to 52 weeks. Employees eligible for an immediate annuity do not get it.' },
      { q: 'Can federal employees collect unemployment after a RIF?', a: 'Yes. Federal employees file for UCFE through the state unemployment agency and the state’s benefit rules apply. Bring the SF-8 from your agency and your SF-50.' },
      { q: 'How long do I have to appeal a federal RIF?', a: 'Generally 30 days from the effective date of the action, to the Merit Systems Protection Board. If a union contract covers your position, check whether the grievance route is available instead.' },
      { q: 'Do I keep my health insurance after a federal RIF?', a: 'FEHB coverage continues for 31 days after separation at no cost to you. After that you can pay the full premium under Temporary Continuation of Coverage for up to 18 months, or buy a marketplace plan.' },
    ],
    cta: { title: 'Plan the next 30 days', body: 'The dates that matter after a layoff: coverage, claim filing, appeal and COBRA, in one list.', label: 'Open the deadline list', href: '/tools/layoff-deadlines' },
    updated: UPDATED,
  },
  {
    slug: 'unemployment-denied-appeal',
    h1: 'Unemployment denied: how to appeal and what to do now',
    lede: 'A denial is a decision you can appeal, and many people win. The notice you received has a deadline, usually between 10 and 30 days from the mailing date, and missing it can end your case. Appeal first, keep filing your weekly claims while you wait, and prepare for a hearing where you tell your side with documents.',
    sections: [
      {
        h2: 'The first three things to do',
        bullets: [
          'Find the deadline on the determination notice and file the appeal before it. A short appeal that says “I disagree” is enough to start in most states; you can add detail at the hearing.',
          'Keep requesting benefits every week. In nearly every state you must keep filing weekly claims during an appeal, because if you win you are paid only for weeks you claimed.',
          'Save everything: the notice, the employer’s statement, your emails and texts about the job ending, and your own notes with dates.',
        ],
      },
      {
        h2: 'Why claims are denied',
        bullets: [
          'The employer says you were fired for misconduct, or that you quit without good cause.',
          'The state decided you are not able, available or looking for work, often because of a missed work search entry or an unreported absence.',
          'Not enough earnings in the base period, the first four of the last five completed quarters in most states. A state may count a later quarter if you ask.',
          'An identity check or a document was not completed in time.',
          'A question on your claim was answered differently from the employer’s record. Answer every question accurately, because a mismatch, even an innocent one, delays or denies a claim.',
        ],
      },
      {
        h2: 'The hearing',
        paragraphs: [
          'The first appeal is usually a hearing by phone or video before an appeals referee or administrative law judge. Both you and your employer can speak, bring documents and call witnesses. It is more informal than court, but it is a record.',
          'Read the notice that schedules the hearing, send your documents to the office by the date it gives, and call in on time. Tell what happened in order, with dates, answer only the question asked, and do not guess. If you need a witness who will not come voluntarily, ask the office whether it can issue a subpoena.',
          'You can bring a representative. Many state legal aid offices handle unemployment appeals at no cost; search for legal aid in your state. If you lose, a second appeal to a board of review is available in most states, and after that, court.',
        ],
      },
      {
        h2: 'An overpayment notice',
        paragraphs: [
          'An overpayment notice means the state says it paid you more than you were due. It is a separate decision from a denial and has its own appeal deadline, so read it and appeal on time if you disagree with the amount or the reason.',
          'If you were paid by mistake and did nothing wrong, most states allow a waiver of repayment when repaying would be unfair or a hardship; the standard varies by state. If you must repay, ask for a payment plan, and do not ignore it: states can withhold tax refunds and future benefits. If the notice accuses you of fraud, get legal help before answering.',
        ],
      },
      {
        h2: 'While you wait',
        paragraphs: [
          'Appeals can take weeks to months. Plan the money part now with the layoff runway calculator, look at the other help you may qualify for in the funding guide, and keep your job search going. A hearing win is back pay, not a reason to pause.',
        ],
        links: [
          { label: 'Funding for laid-off workers', href: '/funding' },
          { label: 'Unemployment benefits by state', href: '/unemployment-benefits' },
        ],
      },
    ],
    faq: [
      { q: 'How long do I have to appeal an unemployment denial?', a: 'The deadline is printed on your determination notice. It is usually between 10 and 30 days from the mailing date, depending on the state, so file as soon as you can.' },
      { q: 'Do I keep filing weekly claims while I appeal?', a: 'Yes. In nearly every state you must keep requesting benefits each week. If you win, you are paid only for the weeks you claimed.' },
      { q: 'Do I need a lawyer to appeal?', a: 'No. Many people appeal without one, and legal aid offices often help for free. A lawyer helps most when the issue is misconduct, fraud or a large overpayment.' },
      { q: 'What happens at an unemployment hearing?', a: 'A referee or judge hears you and your former employer, usually by phone. You can submit documents and call witnesses. The decision comes in writing, usually within a few weeks.' },
      { q: 'What if I received an overpayment notice?', a: 'Read the reason and the appeal deadline. If the mistake was not yours, ask for a waiver. If you owe it, ask about a payment plan so the state does not take your tax refund.' },
    ],
    cta: { title: 'See your state’s rules', body: 'How much, how many weeks, where to file and what your state counts, for every state.', label: 'Find your state', href: '/unemployment-benefits' },
    updated: UPDATED,
  },
  {
    slug: 'unemployment-after-quitting-or-firing',
    h1: 'Unemployment after quitting or being fired',
    lede: 'You can sometimes collect unemployment after quitting or being fired, and the state decides, not your employer. If you were fired, the question is whether it was misconduct, which is more than poor performance. If you quit, you generally need “good cause,” and the facts you document decide it.',
    sections: [
      {
        h2: 'If you were fired',
        paragraphs: [
          'Most states disqualify you only for misconduct: a willful or deliberate breach of a rule or duty the employer had a right to expect. Poor performance, being a bad fit, honest mistakes and an inability to do the job are generally not misconduct.',
          'Examples that often are: theft, serious safety violations, repeated no-call no-shows after warnings, and violating a clear written policy on purpose. The employer’s label does not decide it. The state weighs both sides.',
        ],
      },
      {
        h2: 'If you quit',
        paragraphs: [
          'Quitting without good cause generally disqualifies you. Good cause is a reason that would push a reasonable person to leave. The rule differs by state, but these are commonly accepted when documented:',
        ],
        bullets: [
          'Unsafe or illegal working conditions.',
          'A substantial cut in pay or hours, or a major change in the terms of the job you accepted.',
          'Harassment or discrimination you reported without a fix.',
          'Unpaid wages.',
          'A medical reason supported by a doctor, or a family emergency that you tried to resolve first.',
          'In some states, moving with a spouse or partner for their job.',
        ],
      },
      {
        h2: 'Asked to resign, or resigned instead of being fired',
        paragraphs: [
          'If you were told to resign or be fired, many states treat that as a discharge, not a quit, and look at whether the underlying reason was misconduct. Say exactly what happened. Write down who said what and when, and keep the email if there is one.',
          'The same applies when an employer changes a job so much that staying is not reasonable (“constructive discharge”) or pushes people out. It is a hard case to prove alone; legal aid or an employment lawyer can help.',
        ],
      },
      {
        h2: 'What a disqualification looks like',
        paragraphs: [
          'In some states a quit or a misconduct finding delays benefits for a set number of weeks. In others it denies benefits until you have worked for a period and earned a minimum amount at a new job. A few reduce the total you can collect. Check your state page to see which applies.',
        ],
      },
      {
        h2: 'How to file',
        bullets: [
          'File right away and answer every question truthfully. A false statement can lead to a repayment demand and penalties that last longer than the denial would have.',
          'Give the real reason in the plainest words you can. Do not argue on the form.',
          'If the state denies you, you can appeal. Keep filing weekly claims while you do.',
          'Whatever the outcome, start the job search. Benefits you may not get should never be the plan.',
        ],
        links: [
          { label: 'Fired vs laid off: the difference and why it matters', href: '/topics/fired-vs-laid-off' },
          { label: 'How to appeal a denial', href: '/topics/unemployment-denied-appeal' },
        ],
      },
    ],
    faq: [
      { q: 'Can I collect unemployment if I was fired?', a: 'Often, yes. The usual bar is misconduct, a deliberate breach of a rule, and weak performance or a poor fit does not meet it. File and let the state decide.' },
      { q: 'Can I collect unemployment if I quit?', a: 'Only if you had good cause under your state’s rules, such as unsafe conditions, a major pay cut or harassment you reported. Quitting for a better job or because you were unhappy generally does not qualify.' },
      { q: 'What if I was forced to resign?', a: 'Many states treat a forced resignation as a discharge and ask whether you were let go for misconduct. Document what was said and file.' },
      { q: 'Will my employer’s answer stop my claim?', a: 'No. Your employer gets to respond and the state decides using both accounts. A mismatch leads to a fact-finding call, not an automatic denial.' },
      { q: 'How long is the penalty after quitting?', a: 'It depends on the state: a delay of a set number of weeks in some, a requirement to work and earn a minimum at a new job in others. Check your state.' },
    ],
    cta: { title: 'See your state’s rules', body: 'How each state treats severance, what you can claim and where to file.', label: 'Find your state', href: '/unemployment-benefits' },
    updated: UPDATED,
  },
  {
    slug: 'unemployment-taxes-1099g',
    h1: 'Is unemployment taxable? How the 1099-G and withholding work',
    lede: 'Yes: unemployment benefits are taxable income on your federal return, and many states tax them too. Your state reports what it paid you on Form 1099-G, which it must send by the end of January. You can have 10% withheld from each payment, or pay estimated tax yourself, so that you do not owe a bill in April.',
    sections: [
      {
        h2: 'Federal tax',
        paragraphs: [
          'Unemployment compensation counts as income on your federal return. The IRS lists it as taxable, and you report it with your other income when you file. The temporary federal exclusion that applied to part of 2020 benefits has ended.',
        ],
        links: [{ label: 'IRS: unemployment compensation', href: 'https://www.irs.gov/taxtopics/tc418' }],
      },
      {
        h2: 'State tax',
        paragraphs: [
          'Whether your state taxes the benefits depends on the state. States with no income tax do not. A few states that have an income tax exempt unemployment benefits, including California, New Jersey and Pennsylvania. Most others follow the federal rule and include them. Check your state’s tax agency for the current rule.',
        ],
      },
      {
        h2: 'Withholding',
        bullets: [
          'You can ask the state to withhold 10% of each payment for federal tax. Choose it when you file, or in your account afterward. The state may also offer a state tax withholding option.',
          'If you do not withhold, you can make quarterly estimated tax payments to the IRS and your state. Without either, you may owe the whole amount at filing, and a penalty for underpayment.',
          'Severance is taxed separately as wages. Employers generally withhold 22% federally from it, and more if the payment is over $1 million.',
        ],
        links: [{ label: 'Is severance taxed? Rates and what to expect', href: '/resources/severance-pay' }],
      },
      {
        h2: 'The 1099-G',
        bullets: [
          'The state sends Form 1099-G by January 31 for the year before. Box 1 shows the unemployment you were paid. Box 4 shows federal tax withheld.',
          'Most states also post it in your online account. Look there first if the mail is late.',
          'If your amount looks wrong, call the state agency. If you got a 1099-G for benefits you never claimed, someone may have filed in your name; report it to the state, which can issue a corrected form, and follow the IRS identity-theft steps.',
          'If you repaid benefits in the same year, ask for a corrected form. Repayments in a later year are handled differently on your return; ask a tax preparer.',
        ],
        links: [{ label: 'IRS: about Form 1099-G', href: 'https://www.irs.gov/forms-pubs/about-form-1099-g' }],
      },
      {
        h2: 'Plan for it',
        paragraphs: [
          'If you did not withhold, set aside about a fifth to a quarter of each payment until you know your bracket. Our unemployment estimator shows what a claim is likely to pay, and the layoff runway tool shows how long your money lasts after tax.',
        ],
      },
    ],
    faq: [
      { q: 'Is unemployment income taxable?', a: 'Yes, on your federal return. Many states tax it too, though states without an income tax and a few with one, such as California, New Jersey and Pennsylvania, do not.' },
      { q: 'How do I have taxes withheld from unemployment?', a: 'Ask the state when you file or in your online account to withhold 10% for federal tax. Without it, make estimated payments or you may owe at filing.' },
      { q: 'When do I get my 1099-G for unemployment?', a: 'States mail it by January 31 for the previous year. Most post it in your online account first.' },
      { q: 'I got a 1099-G for unemployment I never received. What do I do?', a: 'Report it to the state right away. It may be identity fraud, and the state can correct the form. Do not report income you did not receive.' },
      { q: 'Is severance taxed differently from unemployment?', a: 'Yes. Severance is wages, with payroll taxes and typically 22% federal withholding. Unemployment has no payroll tax and 10% optional withholding.' },
    ],
    cta: { title: 'Estimate what you could get', body: 'About how much unemployment pays in your state, before tax.', label: 'Open the estimator', href: '/tools/unemployment-estimator' },
    updated: UPDATED,
  },
  {
    slug: 'unemployment-extension',
    h1: 'Unemployment extension: what happens when benefits run out',
    lede: 'Regular state unemployment lasts 26 weeks in most states and fewer in a few, and there is no automatic extension. Extra weeks come only when a federal–state program turns on because of high unemployment, or when Congress passes a temporary one. Check whether your state is paying extended weeks now, and line up other help before your last payment.',
    sections: [
      {
        h2: 'How many weeks you get',
        paragraphs: [
          'Most states pay up to 26 weeks. Some pay fewer, and a few tie the number of weeks to the state unemployment rate, so the maximum falls when the labor market is strong. Your state page shows the weeks for your state, and your claim shows your remaining balance.',
        ],
        links: [{ label: 'Unemployment benefits by state', href: '/unemployment-benefits' }],
      },
      {
        h2: 'Extended Benefits',
        paragraphs: [
          'Extended Benefits (EB) is a permanent federal–state program that adds weeks when a state’s unemployment crosses set thresholds. It adds up to 13 weeks, and up to 20 in a state with a very high rate. It switches on and off with the rate, so many months pass with no state paying it.',
          'The Department of Labor posts which states are in an EB period. If yours is, your state agency should notify you when your regular benefits end. If you do not hear, ask.',
        ],
        links: [{ label: 'U.S. Department of Labor: unemployment insurance', href: 'https://oui.doleta.gov/unemploy/' }],
      },
      {
        h2: 'Temporary federal programs',
        paragraphs: [
          'Congress added weeks in recessions, most recently in 2020 and 2021. Those pandemic programs, including the extra $600 and $300 weekly payments and coverage for the self-employed, ended in 2021. Unless Congress passes a new one, no temporary extension is available.',
        ],
      },
      {
        h2: 'Before your benefits end',
        bullets: [
          'Count the weeks left on your claim and mark the date. Plan for a gap of a few weeks between the last payment and the first paycheck.',
          'Ask your state agency whether it offers a training extension. Some states keep paying benefits to people in approved retraining, without work search.',
          'Contact your American Job Center. It can connect you to training funds under WIOA for dislocated workers, and to help with the job search.',
          'Look at health coverage, food and housing help you may qualify for. The benefits guide lists what applies after a layoff.',
          'Consider bridge income: contract or interim work in your field while you search. Report earnings on your weekly claim if you are still claiming.',
        ],
        links: [
          { label: 'Benefits after a layoff', href: '/topics/benefits-after-layoff' },
          { label: 'American Job Centers', href: '/topics/american-job-centers' },
          { label: 'Bridge income while you search', href: '/resources/bridge-income' },
        ],
      },
      {
        h2: 'Can I file a new claim?',
        paragraphs: [
          'Not on the same wages. A new claim needs new earnings in the new base period. If you work again for long enough and lose that job, you may qualify for a new claim, and a state can tell you when. Restarting by filing again without new work usually does not pay.',
        ],
      },
    ],
    faq: [
      { q: 'How long does unemployment last?', a: 'Up to 26 weeks in most states and fewer in some. A few states set the number of weeks by the state’s unemployment rate, so it can change.' },
      { q: 'Is there an unemployment extension right now?', a: 'Extended Benefits switch on in a state only when its unemployment passes set levels. The Department of Labor posts which states qualify. Congress has not passed a general temporary extension since the 2020–2021 programs ended.' },
      { q: 'What can I do when unemployment runs out?', a: 'Check for a training extension in your state, contact an American Job Center for WIOA training funds, apply for other benefits you qualify for, and take interim or contract work while you search.' },
      { q: 'Can I reapply for unemployment after benefits end?', a: 'Not on the same wages. You need new work and new earnings to qualify for a new claim.' },
    ],
    cta: { title: 'See what your state pays and for how long', body: 'The weekly maximum, weeks, waiting week and where to file, by state.', label: 'Find your state', href: '/unemployment-benefits' },
    updated: UPDATED,
  },
  {
    slug: 'unemployment-payment-timing',
    h1: 'How long until your first unemployment payment, and why it is late',
    lede: 'Most people get their first unemployment payment two to three weeks after filing, and it can take longer. In states with an unpaid waiting week, the first week you claim is not paid. Delays usually come from an unfinished identity check, an employer response, a missed weekly claim or a flagged question on the claim.',
    sections: [
      {
        h2: 'A normal timeline',
        bullets: [
          'You file the claim. The state sends a notice of your weekly benefit and a date to start requesting payments.',
          'Many states have an unpaid waiting week, the first week you are eligible, so the first paid week is the second.',
          'You request benefits every week (certify) after each week ends. The payment then arrives by direct deposit in a few days, or on a debit card mailed to you.',
          'Plan on about two to three weeks from filing to the first deposit if nothing is flagged.',
        ],
        links: [{ label: 'Which states have a waiting week', href: '/unemployment-benefits' }],
      },
      {
        h2: 'Why a payment is late',
        bullets: [
          'The state is waiting on your employer’s response about why you left. A call or letter to you may be needed.',
          'An identity check has not been completed. Many states use an online verification service. Finish it the day you are asked.',
          'You missed a weekly request. A week skipped is generally not paid later unless the state lets you backdate.',
          'A question on your claim does not match the employer’s record, so an adjudicator is reviewing it. The status says “pending.”',
          'A bank account number is wrong, or the debit card was mailed to an old address.',
        ],
      },
      {
        h2: 'What to do if it is late',
        bullets: [
          'Log in and read the status message and any task listed. Many holds clear when you complete a form.',
          'Check mail and email for a notice, including spam.',
          'Keep requesting benefits every week while it is pending. Back pay is only for the weeks you requested.',
          'Call the state line early in the day and write down the date, the name and what you were told. If a claim sits without any movement for several weeks, ask for the specific reason it is held.',
          'If you are in hardship, ask your American Job Center about emergency help while you wait.',
        ],
      },
      {
        h2: 'The money in the meantime',
        paragraphs: [
          'Assume a gap. Use the layoff runway calculator to see how many weeks your savings, severance and unemployment cover, and ask lenders about hardship plans early. Our guide to benefits after a layoff lists other help.',
        ],
        links: [
          { label: 'Layoff runway: how long your money will last', href: '/tools/layoff-runway' },
          { label: 'Benefits after a layoff', href: '/topics/benefits-after-layoff' },
        ],
      },
    ],
    faq: [
      { q: 'How long does it take to get your first unemployment check?', a: 'Usually two to three weeks after you file, if nothing is flagged. Delays of several weeks happen when the state is reviewing the claim.' },
      { q: 'What does “pending” mean on an unemployment claim?', a: 'The state has not decided your eligibility for a week or for the claim. It usually means it is waiting for information from you or your employer. Keep requesting benefits each week.' },
      { q: 'What is the waiting week?', a: 'In many states the first eligible week is unpaid. Some states have none. Your state page says which.' },
      { q: 'Will I get back pay if my claim is delayed?', a: 'Yes, for the weeks you requested and were found eligible. Weeks you did not request are generally not paid, so keep requesting every week.' },
      { q: 'Why was my payment less than I expected?', a: 'Common reasons are the waiting week, severance or earnings you reported, a tax withholding choice, or an overpayment being repaid.' },
    ],
    cta: { title: 'Estimate your weekly benefit', body: 'About how much unemployment pays in your state, before tax.', label: 'Open the estimator', href: '/tools/unemployment-estimator' },
    updated: UPDATED,
  },
  {
    slug: 'unemployment-self-employed',
    h1: 'Unemployment for the self-employed, contractors and gig workers',
    lede: 'Regular unemployment insurance covers employees, not the self-employed. If you are a sole proprietor, a 1099 contractor or a gig worker, you generally cannot collect it on that income. The special federal program that did cover you ended in 2021. Two exceptions can matter: earlier W-2 wages that you can use, and a worker who is an employee in law although called a contractor.',
    sections: [
      {
        h2: 'Why you are usually not covered',
        paragraphs: [
          'Unemployment is funded by payroll taxes your employer pays on your wages. Self-employed people and independent contractors do not have an employer paying those taxes, so income from that work does not count toward a claim.',
          'Pandemic Unemployment Assistance covered the self-employed from 2020 to September 2021. It has ended, and no standing replacement exists.',
        ],
      },
      {
        h2: 'Wages that can still count',
        bullets: [
          'If you had W-2 wages in the base period, usually the first four of the last five completed quarters, they can qualify you for a claim even if you are self-employed now.',
          'If you had both a W-2 job and freelance income, only the W-2 wages count toward the amount. The state still requires you to report the freelance income each week you claim.',
          'If your last employer let you go and you then started freelancing, you can still claim based on the earlier job if you meet the other rules: you must be able and available for full-time work and actively looking.',
        ],
      },
      {
        h2: 'Misclassified: called a contractor but treated as an employee',
        paragraphs: [
          'Some employers classify workers as contractors when the work is controlled like a job: set hours, tools provided, work done on the company’s terms. States apply their own tests, and some, including California, New Jersey and Massachusetts, use a strict “ABC” test that presumes you are an employee unless the employer proves otherwise.',
          'If that describes you, file anyway and say how the work was done. The state decides your status, and a finding that you were an employee can open both unemployment and back wage claims.',
        ],
      },
      {
        h2: 'Working while you claim',
        paragraphs: [
          'You must report any earnings, including gig and freelance income, for the week you earn them, not when you are paid. Most states reduce the benefit by part of your earnings and stop it at a limit. Not reporting is fraud. Ask the state how it treats freelance income before you take a gig.',
        ],
      },
      {
        h2: 'What to use instead',
        bullets: [
          'Interim and contract work in your field to bridge a search.',
          'Funding for retraining and relocation for people who lost income, if you qualify.',
          'Health coverage through the marketplace, with a special enrollment window after the loss of other coverage.',
          'A savings runway plan, so the search does not run on credit.',
        ],
        links: [
          { label: 'Bridge income while you search', href: '/resources/bridge-income' },
          { label: 'Freelance after a layoff', href: '/topics/freelance-after-layoff' },
          { label: 'Funding for laid-off workers', href: '/funding' },
        ],
      },
    ],
    faq: [
      { q: 'Can self-employed people get unemployment?', a: 'Not on self-employment income. The federal program that covered them ended in 2021. Earlier W-2 wages in the base period can still qualify you.' },
      { q: 'Can gig workers or 1099 contractors file for unemployment?', a: 'You can file, and the state decides whether you were an employee in law. If the company controlled how and when you worked, you may be found an employee. Otherwise 1099 income does not count.' },
      { q: 'Can I collect unemployment while freelancing?', a: 'Yes, if you meet the rules, but you must report freelance earnings for the week you earn them. Benefits are reduced by part of the earnings.' },
      { q: 'I was a W-2 employee and now freelance. Do I qualify?', a: 'You can, based on the W-2 wages, if you are able to work full time, available and looking for employment.' },
    ],
    cta: { title: 'See what your state pays', body: 'Weekly amounts, weeks, the waiting week and where to file, for every state.', label: 'Find your state', href: '/unemployment-benefits' },
    updated: UPDATED,
  },
]
