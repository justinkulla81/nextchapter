// Guides for the two documents most applications ask for: the résumé and the cover letter. One page each at /topics/[slug]; the title,
// description and phrases they own are in keywords.ts. The general résumé and cover letter advice lives in resume-tips and cover-letter-tips;
// these pages each answer one specific search (template, format, objective, skills, length, career change, federal, and the cover letter
// forms). Advice is general and checkable: where an employer or a posting decides, the page says to follow the posting.

import { MARKET_REALITY_START_HREF } from '@/lib/onboarding/resume-rule'
import type { TopicContent } from './explainers'

const UPDATED = '2026-11-02'

export const RESUME_TOPICS: TopicContent[] = [
  {
    slug: 'resume-template',
    h1: 'Resume template: a simple layout that gets read',
    lede: 'A good résumé template is plain: one column, a clear header, standard section names and room for results. Fancy layouts with columns, icons and graphics often read badly in the software employers use to screen résumés. Use the layout below, put your newest job first and fill each line with something you did and what it changed.',
    sections: [
      {
        h2: 'The layout, top to bottom',
        bullets: [
          'Header: your name, city and state, phone, email and the link to your LinkedIn profile. No photo, no full street address and no date of birth.',
          'Summary: two to four lines on who you are, the kind of role you want and your strongest proof. Skip it only if you are early in your career.',
          'Experience: your jobs from newest to oldest, each with employer, title, city and dates (month and year), then three to six bullets.',
          'Skills: a short list of the tools, methods and certifications that match the roles you want.',
          'Education and certifications: degree, school and year, then any current licenses or credentials.',
        ],
      },
      {
        h2: 'What a bullet should look like',
        paragraphs: [
          'Start with a verb, say what you did, and end with the result in numbers where you can. “Led a team of eight to cut month-end close from ten days to six, freeing about 400 hours a year” tells a reader more than “Responsible for month-end close.”',
          'If you do not have a number, use a scale (a budget, a team size, a number of clients) or a before and after. Our bullet rewriter helps with the wording.',
        ],
        links: [{ label: 'Résumé bullet rewriter', href: '/tools/resume-bullet-rewriter' }],
      },
      {
        h2: 'Keep it readable by software and by people',
        bullets: [
          'One column, left-aligned, with standard headings such as Experience, Education and Skills.',
          'A common font such as Arial, Calibri or Georgia at 10 to 12 points, with margins of about half an inch to an inch.',
          'No tables, text boxes, images or text inside the header or footer, because many systems skip or scramble them.',
          'Save as a Word file or a PDF with selectable text, unless the posting names the format.',
          'Name the file with your name and the role, such as Jordan-Lee-Controller.pdf, not Resume-final-v3.',
        ],
        links: [{ label: 'Résumé for ATS and AI screening', href: '/topics/resume-ats-ai-screening' }],
      },
      {
        h2: 'Sections you can add, and when',
        bullets: [
          'Selected accomplishments, three to four lines at the top, when your best results are older or spread over several jobs.',
          'Board seats, publications, patents or speaking, for senior roles where they matter.',
          'Languages or clearances, when the role asks for them.',
          'Volunteer work, when it fills a gap or shows a skill your jobs did not.',
        ],
      },
      {
        h2: 'Check it against the job',
        paragraphs: ['Change the summary and the first few bullets for each role so they use the words the posting uses for the same work. Then run the résumé check to see how it scores and what it is missing.'],
        links: [
          { label: 'Free résumé check', href: '/tools/resume-check' },
          { label: 'Résumé vs job description match', href: '/tools/resume-job-match' },
        ],
      },
    ],
    faq: [
      { q: 'What is the best resume template for experienced professionals?', a: 'A one-column, reverse-chronological layout with a short summary, results-based bullets and standard headings. Template packs with columns or graphics add little and can fail screening software.' },
      { q: 'Should I use a resume template from Word or Google Docs?', a: 'You can, if it is a single column with no tables or text boxes. Check that the text copies out cleanly and the headings are plain.' },
      { q: 'What sections should a resume have?', a: 'Header, summary, experience, skills, and education. Add certifications, accomplishments or board roles when they help for the role.' },
      { q: 'Should I put a photo on my resume?', a: 'Not for jobs in the United States. Employers generally do not want one and screening software cannot use it.' },
    ],
    cta: { title: 'See how your résumé scores', body: 'Upload it and get a score and the first three fixes in about a minute.', label: 'Check my résumé', href: '/tools/resume-check' },
    updated: UPDATED,
  },
  {
    slug: 'resume-format',
    h1: 'Resume format: chronological, functional or combination',
    lede: 'For most people the right résumé format is reverse-chronological: your jobs from newest to oldest, each with bullets. It is the one recruiters and screening software expect. Use a combination format only if you are changing fields or have a gap to manage, and avoid a purely functional résumé, because it hides your dates and many employers distrust it.',
    sections: [
      {
        h2: 'The three formats',
        bullets: [
          'Chronological: work history first, newest to oldest, with a short summary above it. It shows progression and is the default for experienced professionals.',
          'Functional: organized by skill groups with little or no job history. It hides gaps and job-hopping, but it also hides where and when you did the work.',
          'Combination: a skills or accomplishments section at the top, followed by a short chronological history. It suits career changers and people with a mix of experiences.',
        ],
      },
      {
        h2: 'Chronological vs functional',
        paragraphs: [
          'Recruiters read for titles, employers, dates and results, in that order. A chronological résumé gives them that in seconds. A functional résumé makes them hunt for it, and many assume it is covering something.',
          'Screening software also reads dates and job titles to place you. A résumé without them can be parsed badly, which lowers your match.',
        ],
      },
      {
        h2: 'Which to pick',
        bullets: [
          'Same field, steady history: chronological.',
          'Career change: combination, with the target role named in the summary and the transferable results first.',
          'Gap in work history: chronological, with the gap explained in one line or shown with what you did in that time.',
          'Many short or contract roles: chronological, grouping them under one line such as “Consulting, 2019 to 2024.”',
        ],
        links: [
          { label: 'Explain a gap in your résumé', href: '/topics/resume-gap' },
          { label: 'Résumé for a career change', href: '/topics/resume-career-change' },
        ],
      },
      {
        h2: 'Font, size and margins',
        paragraphs: [
          'Use one common font in 10 to 12 points for body text and slightly larger for your name and headings. Keep margins between half an inch and one inch, and leave white space between jobs. If you have to shrink the type below 10 points to fit, cut content instead.',
        ],
      },
      {
        h2: 'Order of sections',
        paragraphs: ['Put your summary first, then experience, then education, unless you are a recent graduate, in which case education can come before experience. Certifications go after education, or above it if the role requires one.'],
        links: [{ label: 'A simple résumé template', href: '/topics/resume-template' }],
      },
    ],
    faq: [
      { q: 'What is the best resume format?', a: 'For most experienced professionals, reverse-chronological. It is what recruiters and screening software expect.' },
      { q: 'What is a combination resume?', a: 'A résumé that opens with a skills or accomplishments section and follows it with a short chronological work history. It works for career changers.' },
      { q: 'Are functional resumes a bad idea?', a: 'Usually. They hide dates and employers, which makes employers suspicious and can confuse screening software. Use them only if a posting asks.' },
      { q: 'What font should a resume use?', a: 'A common, readable one such as Arial, Calibri or Georgia at 10 to 12 points, with margins of half an inch to an inch.' },
    ],
    cta: { title: 'Check your layout', body: 'The résumé check shows whether your format reads cleanly and what to fix first.', label: 'Check my résumé', href: '/tools/resume-check' },
    updated: UPDATED,
  },
  {
    slug: 'resume-objective',
    h1: 'Resume objective: when to use one, and what to write instead',
    lede: 'Most experienced professionals should skip the résumé objective and open with a summary instead. An objective says what you want, which the reader already knows from your application. A summary says what you offer. Use an objective only if you are changing careers or entering the workforce, and keep it to one sentence about the role you are targeting and the value you bring.',
    sections: [
      {
        h2: 'Objective vs summary',
        bullets: [
          'Objective: one or two lines on the role you want. It is about your goal.',
          'Summary: two to four lines on your experience, your strongest results and the kind of role you fit. It is about the employer’s need.',
          'If you could swap in any employer’s name and the line would still be true, it is too generic.',
        ],
      },
      {
        h2: 'When an objective makes sense',
        bullets: [
          'You are changing fields and your last title does not explain the move.',
          'You are a new graduate or returning to work and have little history to summarize.',
          'You are applying for a very specific role and your background needs a bridge.',
        ],
      },
      {
        h2: 'Examples',
        bullets: [
          'Career change: “Operations manager with eight years in healthcare logistics seeking a supply chain analyst role, applying inventory and vendor cost work to retail.”',
          'New graduate: “Finance graduate with an internship in credit analysis, seeking an analyst role in commercial banking.”',
          'Returning to work: “Marketing director returning after a caregiving break, seeking a brand role where I can apply six years of B2B launch experience.”',
        ],
      },
      {
        h2: 'What to write instead',
        paragraphs: [
          'For a summary, name your level and field, add one number that proves it, and say the kind of role you want. “Finance leader with 12 years in SaaS, led a team of 15 and a $40 million budget, now targeting a VP Finance role at a growth-stage company.”',
          'Do not use filler such as “hard-working team player” or “seeking a challenging position.” Spend the space on a result.',
        ],
        links: [{ label: 'Résumé tips for experienced professionals', href: '/topics/resume-tips' }],
      },
    ],
    faq: [
      { q: 'Should I put an objective on my resume?', a: 'Usually not. A summary is stronger for experienced professionals. An objective helps career changers and new graduates who need to state the target role.' },
      { q: 'What is the difference between a resume objective and a summary?', a: 'An objective states the job you want. A summary states what you offer, with proof. Employers read the summary first.' },
      { q: 'How long should a resume objective be?', a: 'One or two sentences, naming the role you are targeting and the value you bring.' },
      { q: 'Can I use the same objective for every application?', a: 'No. Change it to match the role. A generic one is easy to spot and adds nothing.' },
    ],
    cta: { title: 'Get the summary right', body: 'The résumé check reads your top section and tells you what to tighten.', label: 'Check my résumé', href: '/tools/resume-check' },
    updated: UPDATED,
  },
  {
    slug: 'resume-skills',
    h1: 'Resume skills: what to list and how to list it',
    lede: 'List the skills a posting asks for and that you can prove, in a short, scannable section: about eight to fifteen, grouped by type. Use the posting’s own words for each one, because screening software and recruiters search for them. Show your strongest skills in your bullets too, since a skill with a result beside it counts for more than one in a list.',
    sections: [
      {
        h2: 'What to include',
        bullets: [
          'Hard skills: tools, methods, languages, systems and certifications such as SQL, Salesforce, financial modeling or PMP.',
          'Domain knowledge: areas you know well, such as revenue recognition, clinical trials or B2B SaaS pricing.',
          'A few soft skills only if you can attach them to a result in your bullets, such as “led cross-functional launches,” not just “leadership.”',
        ],
      },
      {
        h2: 'How to list them',
        bullets: [
          'Group them with short labels: Tools, Methods, Certifications.',
          'Put the ones the posting names first, spelled the way the posting spells them (for example “Microsoft Excel,” not just “Excel” if the posting says so, and the acronym with the full term once).',
          'Skip the basics at your level: a director does not need “Microsoft Word.”',
          'Do not rate yourself with bars, stars or percentages. Readers and software ignore them.',
        ],
      },
      {
        h2: 'Match the posting',
        paragraphs: [
          'Read the job description and highlight the skills it repeats. Add those you truly have to your list and to your bullets. Never list a skill you cannot discuss in an interview.',
          'Our job match tool compares your résumé to a posting and shows which of its terms you are missing.',
        ],
        links: [{ label: 'Résumé vs job description match', href: '/tools/resume-job-match' }],
      },
      {
        h2: 'Skills for a career change',
        paragraphs: ['Lead with the transferable ones the new field asks for, and show each in a bullet from your past work. If a skill is new, say how you learned it: a course, a certification or a project.'],
        links: [{ label: 'Résumé for a career change', href: '/topics/resume-career-change' }],
      },
    ],
    faq: [
      { q: 'How many skills should I put on a resume?', a: 'About eight to fifteen, the ones that match the roles you want. A longer list dilutes the best ones.' },
      { q: 'Should I list soft skills on a resume?', a: 'Only if you back them with a result in your bullets. Words like “team player” on their own add nothing.' },
      { q: 'Where should the skills section go?', a: 'After your experience, or below the summary if the role is skills-led or you are changing careers.' },
      { q: 'Should I copy skills from the job posting?', a: 'Use the posting’s wording for skills you truly have. Do not list anything you could not discuss in an interview.' },
    ],
    cta: { title: 'See which skills you are missing', body: 'Paste a job description and your résumé and see the gap, term by term.', label: 'Match my résumé to a job', href: '/tools/resume-job-match' },
    updated: UPDATED,
  },
  {
    slug: 'resume-length',
    h1: 'How long should a resume be? One page or two',
    lede: 'One page is right for early-career roles. Two pages are fine, and usually better, for professionals with eight or more years of relevant experience. Three pages are rare outside academic, scientific and federal applications. What matters is that every line earns its place and the best material is on page one.',
    sections: [
      {
        h2: 'A simple rule',
        bullets: [
          'Under about five years of experience: one page.',
          'About five to ten years: one page if it fits cleanly, two if it does not.',
          'Ten or more years, or senior and executive roles: two pages.',
          'Academic CVs, scientific roles and federal applications: longer is normal. See the federal résumé guide.',
        ],
        links: [{ label: 'Federal résumé format', href: '/topics/federal-resume' }],
      },
      {
        h2: 'What to cut',
        bullets: [
          'Jobs older than 10 to 15 years, or reduce them to a single line with title, employer and years.',
          'Duties that every person in the job does. Keep results.',
          'An objective, “references available on request” and a full street address.',
          'Skills and tools that are out of date or beneath your level.',
        ],
      },
      {
        h2: 'Do not shrink to fit',
        paragraphs: [
          'Dropping the type below 10 points or cutting margins to nothing makes the page harder to read. Cut content before you shrink the layout. If a page 2 has only a few lines, cut back to one page or add real material.',
        ],
      },
      {
        h2: 'Put the best first',
        paragraphs: ['Many readers look only at the top third of page one. Open with a summary and your most relevant, most recent results, and keep older or lesser material toward the end.'],
        links: [{ label: 'Résumé layout that works', href: '/topics/resume-template' }],
      },
    ],
    faq: [
      { q: 'Is a two-page resume okay?', a: 'Yes, for professionals with about ten or more years of experience, or when the material is relevant. Fill most of page one and do not leave page two almost empty.' },
      { q: 'How many pages should an executive resume be?', a: 'Usually two. Some senior roles with long track records go to three, but two pages with strong results beat three with detail.' },
      { q: 'How far back should a resume go?', a: 'Generally ten to fifteen years. Older roles can be a single line, or left off if they do not help.' },
      { q: 'Does recruiter reading time affect length?', a: 'Yes. Readers skim, so the first page needs your best results. Length does not matter if the top is strong.' },
    ],
    cta: { title: 'Check your résumé', body: 'See if it is the right length and where it can be tighter.', label: 'Check my résumé', href: '/tools/resume-check' },
    updated: UPDATED,
  },
  {
    slug: 'resume-career-change',
    h1: 'Resume for a career change: how to write it',
    lede: 'A career change résumé shows an employer in the new field that you can already do the work. Name the target role in your summary, put the transferable results first, and rewrite your bullets in the new field’s words. Use a combination format with a short skills section on top, followed by a reverse-chronological history.',
    sections: [
      {
        h2: 'Start with the target',
        paragraphs: [
          'Read five postings for the role you want and list the skills and results they repeat. Those are your headings. Then open your résumé with a summary that names the new role and gives your proof: “Operations leader with ten years in healthcare logistics, now moving into supply chain analytics. Cut vendor spend 14% and built the reporting used by six hospitals.”',
        ],
      },
      {
        h2: 'Find your transferable results',
        bullets: [
          'Pull out the work you did that the new role also does: analysis, budgets, projects, client work, training, systems.',
          'Rewrite each bullet using the new field’s vocabulary, with the same real result.',
          'Move the most relevant bullets to the top of each job, even if they were a smaller part of the role.',
          'Add a short skills section that matches the posting, with any new tools you have learned.',
        ],
        links: [{ label: 'Skills to list on a résumé', href: '/topics/resume-skills' }],
      },
      {
        h2: 'Fill the gap with proof',
        bullets: [
          'A certification, a course or a project that shows you are serious about the move.',
          'A volunteer or side project in the new field, described like a job, with results.',
          'A line on why the change makes sense, in the summary or your cover letter.',
        ],
        links: [{ label: 'Cover letter for a career change', href: '/topics/cover-letter-career-change' }],
      },
      {
        h2: 'What to leave out',
        paragraphs: ['Drop duties and jargon that belong to your old field and do not carry over. Cut older, unrelated roles to a single line. Do not apologize for the change on the page; show the fit.'],
      },
      {
        h2: 'Get it in front of people',
        paragraphs: ['Applications alone have a lower hit rate for career changers. Pair them with conversations: tell people in the new field what you are doing and ask for introductions. Our career pivot guide shows how.'],
        links: [
          { label: 'Career pivot', href: '/topics/career-pivot' },
          { label: 'Résumé format guide', href: '/topics/resume-format' },
        ],
      },
    ],
    faq: [
      { q: 'How do I write a resume when changing careers?', a: 'Name the target role in your summary, lead with transferable results rewritten in the new field’s words, and use a combination format.' },
      { q: 'Should I use a functional resume to change careers?', a: 'A combination format works better. It leads with skills but keeps your dates and employers, which employers expect.' },
      { q: 'How do I explain a career change on my resume?', a: 'In the summary, in one line, and with proof: a certification, a project or results that match the new role. Add the reason in your cover letter.' },
      { q: 'Do I need new experience to change careers?', a: 'You need evidence. Transferable results, a course, a certification or a project all count.' },
    ],
    cta: { title: 'Check the fit', body: 'See how your résumé matches a job in the new field and what to add.', label: 'Match my résumé to a job', href: '/tools/resume-job-match' },
    updated: UPDATED,
  },
  {
    slug: 'federal-resume',
    h1: 'Federal resume format: how to write one for USAJOBS',
    lede: 'A federal résumé is longer and more detailed than a private-sector one. It needs each job’s title, employer, start and end dates, hours per week, salary and supervisor, plus the specific duties and results that match the announcement. It often runs two to five pages, and the job announcement states any limit. Build it from the announcement, not from a template.',
    sections: [
      {
        h2: 'What a federal résumé must include',
        bullets: [
          'Your contact information and your citizenship, veteran status and highest federal grade held, if the announcement asks.',
          'For each job: title, employer, city and state, start and end dates in month and year, hours worked per week, and salary.',
          'Your supervisor’s name and phone number, and whether you permit contact.',
          'A description of your duties and accomplishments in detail, using the words in the announcement.',
          'Education with the school, degree and graduation date, and relevant training and certifications.',
        ],
      },
      {
        h2: 'Match the announcement',
        paragraphs: [
          'Open the announcement and read “Qualifications” and “Specialized experience.” Reviewers check your résumé against them, line by line, so show each requirement in a job description with a result. If it asks for a year of experience at a specific grade, make sure your résumé shows a year at that level.',
          'Answer the questionnaire honestly. Reviewers compare your answers to what the résumé shows, and a mismatch can disqualify you.',
        ],
      },
      {
        h2: 'Length and format',
        bullets: [
          'There is no single page limit. Two to five pages is common; follow the announcement.',
          'Use plain text, short paragraphs or bullets, and standard headings. Avoid tables, graphics and special characters.',
          'You can build it in the USAJOBS résumé builder or upload your own, as long as it has every element above.',
        ],
        links: [{ label: 'USAJOBS: how to write a federal résumé', href: 'https://www.usajobs.gov/help/how-to/application/resume/' }],
      },
      {
        h2: 'If you were laid off from a federal job',
        paragraphs: ['Displaced federal employees get priority consideration for jobs they qualify for. Read our federal RIF guide for the programs and how to register.'],
        links: [{ label: 'Federal RIF rights and priority programs', href: '/topics/federal-rif' }],
      },
    ],
    faq: [
      { q: 'How long should a federal resume be?', a: 'Often two to five pages. There is no single limit, so follow the job announcement.' },
      { q: 'What is different about a federal resume?', a: 'It needs hours per week, salary, supervisor contact, month and year dates and detailed duties, and it must match the announcement’s qualifications.' },
      { q: 'Can I use my private-sector resume for USAJOBS?', a: 'Rarely as is. It usually lacks required details such as hours and salary. Add them and expand duties to match the announcement.' },
      { q: 'Does the USAJOBS resume builder help?', a: 'Yes. It prompts for the required fields, so you do not leave any out.' },
    ],
    cta: { title: 'Check your résumé against the posting', body: 'Paste a federal announcement and your résumé and see which requirements you have not shown.', label: 'Match my résumé to a job', href: '/tools/resume-job-match' },
    updated: UPDATED,
  },
  {
    slug: 'cover-letter-examples',
    h1: 'Cover letter examples you can adapt',
    lede: 'A good cover letter is short, specific and about the employer’s need. Below are three full examples, for an experienced hire, a career changer and someone returning to work, each under 300 words. Copy the structure, not the sentences, and put your own results in the brackets.',
    sections: [
      {
        h2: 'Example 1: experienced professional',
        paragraphs: [
          'Dear Ms. Alvarez,',
          'I am applying for the Director of Finance role at Northfield Health. Over the last nine years I have led finance for two regional healthcare groups, and your posting’s focus on moving from monthly to rolling forecasts is work I have done.',
          'At Cedar Health I rebuilt the forecasting process, cutting the budget cycle from 11 weeks to 6 and improving forecast accuracy to within 2%. I also led a team of 12 and managed a $60 million operating budget through a merger.',
          'I would welcome a conversation about how I can help Northfield through its next stage of growth. Thank you for your time.',
          'Sincerely, Jordan Lee',
        ],
      },
      {
        h2: 'Example 2: career changer',
        paragraphs: [
          'Dear Mr. Okafor,',
          'I am writing about the Data Analyst opening at Brightline. For ten years I have managed operations in hospital logistics, where I built the reporting my teams used every day, and I want to do that work full time.',
          'I taught myself SQL and Tableau and completed a certificate in data analytics. In my last role I built a dashboard that cut stockouts by 18% across six sites. That is the kind of problem your posting describes.',
          'I would like to talk about how my operations background and new skills fit your team. Thank you for considering me.',
          'Best regards, Priya Raman',
        ],
      },
      {
        h2: 'Example 3: returning to work',
        paragraphs: [
          'Dear Hiring Team,',
          'I am applying for the Brand Manager role. After a three-year break to care for my family, I am returning to marketing, where I spent eight years launching B2B products.',
          'Before my break I led the launch of three products, taking one from zero to $4 million in its first year. During the break I kept my skills current with a course in marketing analytics and consulted for a local non-profit.',
          'I would be glad to discuss how I can contribute to your team. Thank you.',
          'Sincerely, Maria Torres',
        ],
      },
      {
        h2: 'What they share',
        bullets: [
          'The first lines name the role and give a reason this employer, not any employer.',
          'One or two results, with numbers, that match the posting.',
          'A plain ask to talk, and no apology for what the résumé lacks.',
          'Under one page, written for one reader.',
        ],
        links: [
          { label: 'Cover letter template', href: '/topics/cover-letter-template' },
          { label: 'How to start a cover letter', href: '/topics/how-to-start-a-cover-letter' },
        ],
      },
    ],
    faq: [
      { q: 'What does a good cover letter look like?', a: 'A short letter, usually three or four paragraphs on one page, that names the role, gives one or two results that match the posting and asks for a conversation.' },
      { q: 'Can I copy a cover letter example?', a: 'Use the structure, not the sentences. A letter built from your own results and the employer’s needs reads as real and a copied one does not.' },
      { q: 'How many cover letter examples should I read?', a: 'One or two for your situation is plenty. Then write your own.' },
      { q: 'Should the cover letter repeat my resume?', a: 'No. Choose the one or two points from it that matter most for this job and add what the résumé cannot say, such as why this employer.' },
    ],
    cta: { title: 'Get your plan started', body: 'A free Market Reality Assessment shows how employers see your background and what to send.', label: 'Start my free assessment', href: MARKET_REALITY_START_HREF },
    updated: UPDATED,
  },
  {
    slug: 'cover-letter-template',
    h1: 'Cover letter template: structure, format and what goes in it',
    lede: 'A cover letter has one page, three or four short paragraphs and one purpose: to show the employer why you fit this role. The structure is simple: a header, a greeting, an opening that names the role and your reason, a middle that proves it, and a close that asks to talk. Use the outline below and fill it with your own facts.',
    sections: [
      {
        h2: 'The outline',
        bullets: [
          'Header: your name, city, email and phone, then the date, then the employer’s name and address if you have them.',
          'Greeting: the hiring manager’s name if you can find it on the posting or LinkedIn. Otherwise “Dear Hiring Team.”',
          'Paragraph 1: the role you are applying for and one line on why you and why this employer.',
          'Paragraph 2: your strongest result, with a number, that matches what the posting asks for.',
          'Paragraph 3 (optional): a second proof, or what you know about the company that draws you.',
          'Close: a plain ask to talk, a thank-you and your name.',
        ],
      },
      {
        h2: 'Fill-in template',
        paragraphs: [
          'Dear [Name],',
          'I am applying for the [role] at [company]. [One sentence on why: your match to their need or what draws you to the company.]',
          'In my role at [employer] I [result with a number] by [what you did]. [One line on how that applies to what the posting asks for.]',
          'I would welcome a conversation about how I can help [company] with [goal]. Thank you for your time.',
          'Sincerely, [Your name]',
        ],
      },
      {
        h2: 'Length and format',
        bullets: [
          'About 250 to 350 words, never more than one page.',
          'The same font and header as your résumé so the two read as a set.',
          'Send it as a PDF, or paste it into the email or application box if that is how the employer takes it.',
          'For an email, put the letter in the body, keep the subject line to the role and your name, and attach the résumé.',
        ],
      },
      {
        h2: 'Mistakes to avoid',
        bullets: [
          'Opening with “I am writing to apply for…” and nothing else. Add the reason.',
          'Repeating your résumé line by line.',
          'Sending the same letter to every employer.',
          'Wrong company or hiring manager name, left over from the last one.',
        ],
        links: [
          { label: 'Cover letter examples', href: '/topics/cover-letter-examples' },
          { label: 'Cover letter tips for experienced professionals', href: '/topics/cover-letter-tips' },
        ],
      },
    ],
    faq: [
      { q: 'What should a cover letter include?', a: 'The role you are applying for, why you are a fit with one or two results, and a plain ask to talk, in about 250 to 350 words.' },
      { q: 'How do I format a cover letter?', a: 'One page, a header with your contact details, a greeting, three or four short paragraphs, and a close. Match the font to your résumé.' },
      { q: 'Should I address the cover letter to a person?', a: 'Yes, when you can find the name. If you cannot, use “Dear Hiring Team.”' },
      { q: 'How do I write an email cover letter?', a: 'Put the short letter in the email body, use a subject line with the role and your name, and attach your résumé.' },
    ],
    cta: { title: 'Start with your résumé', body: 'The letter works best next to a strong résumé. Check yours free in a minute.', label: 'Check my résumé', href: '/tools/resume-check' },
    updated: UPDATED,
  },
  {
    slug: 'how-to-start-a-cover-letter',
    h1: 'How to start a cover letter: opening lines that work',
    lede: 'Start a cover letter by naming the role and giving one reason the employer should keep reading: a result that matches their need, a connection, or a specific thing about the company. Skip “I am writing to apply for” as a stand-alone opening. The first sentence should tell the reader what you bring.',
    sections: [
      {
        h2: 'Four openings that work',
        bullets: [
          'The result: “At Cedar Health I cut the budget cycle from 11 weeks to 6, and I would like to bring that to your Director of Finance role.”',
          'The match: “Your posting asks for someone who has taken a product from launch to $5 million. I did that twice at Brightline.”',
          'The connection: “Maya Chen on your team suggested I apply for the operations lead role after we met at the supply chain forum.”',
          'The reason you care: “I have used your platform for six years as a customer, and I want to help make it better for the next million.”',
        ],
      },
      {
        h2: 'What to avoid',
        bullets: [
          '“To whom it may concern” when you can find a name.',
          '“I am a hard-working team player,” which any applicant could write.',
          'Starting with an apology or what you lack.',
          'A first line that is only about you and not about the employer’s need.',
        ],
      },
      {
        h2: 'How to end it',
        paragraphs: [
          'Close with a short, direct ask: “I would welcome a conversation about how I can help your team,” then a thank-you and your name. Avoid “I hope to hear from you” and “please find my résumé attached” as the last line. They add nothing.',
        ],
      },
      {
        h2: 'Find the hook',
        paragraphs: ['Read the posting for the two things the employer repeats, then find the one result of yours that answers them. That result is your opening. If you know a person at the company, mention them early, with their permission.'],
        links: [
          { label: 'Cover letter template', href: '/topics/cover-letter-template' },
          { label: 'Cover letter examples', href: '/topics/cover-letter-examples' },
        ],
      },
    ],
    faq: [
      { q: 'How do you start a cover letter?', a: 'Name the role and give one reason to keep reading: a result that matches the need, a connection or something specific about the company.' },
      { q: 'What is a good opening sentence for a cover letter?', a: 'One that states your most relevant result, such as “At Cedar Health I cut the budget cycle from 11 weeks to 6,” and links it to the role.' },
      { q: 'How do I end a cover letter?', a: 'With a plain ask to talk, a thank-you and your name. Skip “I hope to hear from you.”' },
      { q: 'Should I start with “To whom it may concern”?', a: 'Only if you cannot find a name. Check the posting and LinkedIn first. “Dear Hiring Team” is better than “To whom it may concern.”' },
    ],
    cta: { title: 'Get your plan started', body: 'A free assessment shows how employers see your background and what to lead with.', label: 'Start my free assessment', href: MARKET_REALITY_START_HREF },
    updated: UPDATED,
  },
  {
    slug: 'cover-letter-career-change',
    h1: 'Cover letter for a career change: how to write it',
    lede: 'A career change cover letter does the job your résumé cannot: it explains the move. Open with the new role and your reason, show one result that transfers, and say what you have done to prepare. Keep it under one page, make it specific to the employer, and do not apologize for the change.',
    sections: [
      {
        h2: 'The structure',
        bullets: [
          'Paragraph 1: the role and why you are making the move, in one or two sentences.',
          'Paragraph 2: the result from your past work that transfers, with a number, and how it applies.',
          'Paragraph 3: what you have done to prepare: a certification, a course, a project, or volunteer work.',
          'Close: a plain ask to talk.',
        ],
      },
      {
        h2: 'Example',
        paragraphs: [
          'Dear Mr. Okafor,',
          'I am applying for the Data Analyst role at Brightline. After ten years in hospital operations, I have found that the part of my work I love most is turning messy data into decisions, and I am making that my full-time work.',
          'In my last role I built the reporting that cut stockouts by 18% across six sites, using SQL and Tableau I learned on my own. I have since completed a data analytics certificate and built three projects on public health data.',
          'I would welcome the chance to discuss how my background and new skills fit your team. Thank you for your time.',
          'Sincerely, Priya Raman',
        ],
      },
      {
        h2: 'Make the case',
        bullets: [
          'Use the new field’s words for your results.',
          'Choose the one or two that match the posting, not the whole history.',
          'Say why this employer and why now, in a sentence, so the move reads as a plan.',
          'Do not call yourself “entry level” or say you “lack experience.” Say what you have done.',
        ],
        links: [
          { label: 'Résumé for a career change', href: '/topics/resume-career-change' },
          { label: 'Career pivot', href: '/topics/career-pivot' },
        ],
      },
      {
        h2: 'Two cases to handle',
        paragraphs: [
          'If you were laid off and are moving fields, you can say so in one plain line, then go straight to your fit. If you are changing industries but keeping your function (finance to healthcare, for example), lead with your function and add why the industry.',
        ],
        links: [{ label: 'How to explain a layoff', href: '/topics/explain-a-layoff' }],
      },
    ],
    faq: [
      { q: 'How do I write a cover letter for a career change?', a: 'Name the role and your reason for the move, show one transferable result with a number, and say what you have done to prepare. Keep it to one page.' },
      { q: 'Should I mention my career change in the cover letter?', a: 'Yes, in one sentence, with the reason. Then move to your fit. The letter is where you can explain what a résumé cannot.' },
      { q: 'What if I have no experience in the new field?', a: 'Use transferable results, a certification or a project. Do not call yourself entry level; show what you have done.' },
      { q: 'How long should a career change cover letter be?', a: 'About 250 to 350 words, never more than one page.' },
    ],
    cta: { title: 'Check the fit', body: 'See how your résumé matches a job in the new field and what to add.', label: 'Match my résumé to a job', href: '/tools/resume-job-match' },
    updated: UPDATED,
  },
]
