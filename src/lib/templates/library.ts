// The template library behind /templates: short emails, letters and posts people need around a layoff or a job search.
// Each template is plain text with {{field}} slots. Filling happens in the browser (fillTemplate), nothing is sent.
// Search wording for each page (title, description, primary phrase) lives here so the page, the sitemap and the test
// read one source; src/test/templates-library.test.ts checks lengths and that no phrase clashes with the keyword map.

export interface TemplateField {
  id: string
  label: string
  placeholder: string
  /** A multi-line box instead of a single line. */
  long?: boolean
  /** Used when the field is left empty, so an optional field never leaves a gap in the text. */
  fallback?: string
}

export interface TemplateFaq { q: string; a: string }

export type TemplateCategory = 'Layoff' | 'Job search' | 'Interviews' | 'Offers' | 'Employers'

export interface Template {
  slug: string
  category: TemplateCategory
  /** Short name used in lists and breadcrumbs. */
  name: string
  /** The phrase the page is written around. Must not be owned by another page in the keyword map. */
  primary: string
  secondary: string[]
  /** 18-62 characters, no brand suffix. */
  title: string
  /** 80-165 characters. */
  description: string
  h1: string
  lede: string
  fields: TemplateField[]
  /** Optional subject line, for emails. */
  subject?: string
  body: string
  tips: string[]
  faq: TemplateFaq[]
  /** Slugs of other templates worth reading next. */
  related: string[]
}

const you: TemplateField = { id: 'you', label: 'Your name', placeholder: 'Jordan Rivera' }

export const TEMPLATES: Template[] = [
  {
    slug: 'laid-off-linkedin-post',
    category: 'Layoff',
    name: 'LinkedIn post about being laid off',
    primary: 'laid off linkedin post',
    secondary: ['linkedin post after layoff', 'how to announce a layoff on linkedin', 'i was laid off post example', 'announcing layoff on linkedin'],
    title: 'Laid Off LinkedIn Post: Template and Examples',
    description: 'Write a LinkedIn post about being laid off in two minutes: a fill-in template that says what happened, what you do and how people can help. Free.',
    h1: 'Laid off LinkedIn post template',
    lede: 'A post that says plainly what happened and exactly what help you want gets far more useful replies than a vague one. Fill in the blanks and copy it.',
    fields: [
      { id: 'company', label: 'Company you were laid off from', placeholder: 'Northwind Logistics' },
      { id: 'role', label: 'Your job title', placeholder: 'Senior operations manager' },
      { id: 'years', label: 'Time there', placeholder: 'six years' },
      { id: 'proud', label: 'One thing you are proud of', placeholder: 'cut average delivery time by 18% across four regions', long: true },
      { id: 'target', label: 'What you want next', placeholder: 'operations or supply chain leadership roles' },
      { id: 'place', label: 'Where (city or remote)', placeholder: 'Columbus, Ohio, or remote' },
      { id: 'ask', label: 'The specific help you want', placeholder: 'introductions to people hiring in supply chain' },
    ],
    body: `My role as {{role}} at {{company}} was recently eliminated in a layoff.

After {{years}} there, I am grateful for the people I worked with, and proud that we {{proud}}.

I am now looking for {{target}} in {{place}}.

If you can help, this is what would make the biggest difference: {{ask}}. A message or a comment here is all it takes.

Thank you to everyone who has already reached out.`,
    tips: [
      'Post within a week while the news is fresh and people want to help. Waiting a month makes it feel like an announcement instead of a request.',
      'Name one specific kind of help. “Introductions to people hiring in supply chain” gets answers; “let me know if you hear of anything” does not.',
      'Say what you are proud of in a result, not a trait. A number or an outcome gives readers something to repeat when they recommend you.',
      'Turn on LinkedIn’s “Open to work” setting for recruiters only if you do not want a public banner. The banner is visible to everyone; the recruiter-only setting is not.',
      'Do not criticize the company. Prospective employers read the post and think about how you would talk about them.',
    ],
    faq: [
      { q: 'Should I post about being laid off on LinkedIn?', a: 'Most career coaches say yes. A layoff is common and carries little stigma, and a post turns your network into people who know what to look out for. The post works best when it states a target and one clear ask.' },
      { q: 'How long should the post be?', a: 'Under 150 words. People read it on a phone between meetings. State what happened in one line, give one proud result, say what you want and how to help.' },
      { q: 'Should I mention the company by name?', a: 'Yes, if the layoff was announced or reported. Naming it helps former coworkers find and tag you. Leave out anything about severance, management or the reasons behind the decision.' },
      { q: 'Should I tag former coworkers?', a: 'A short thank-you to a few named colleagues helps the post travel. Tag people who would be glad to be mentioned, and leave out anyone still at the company who might not want attention.' },
    ],
    related: ['networking-email-after-layoff', 'layoff-goodbye-email-to-coworkers', 'recruiter-outreach-email'],
  },
  {
    slug: 'layoff-goodbye-email-to-coworkers',
    category: 'Layoff',
    name: 'Goodbye email to coworkers after a layoff',
    primary: 'layoff goodbye email to coworkers',
    secondary: ['goodbye email after being laid off', 'farewell email layoff', 'last day email to coworkers', 'how to say goodbye to coworkers after layoff'],
    title: 'Layoff Goodbye Email to Coworkers: Template',
    description: 'A short, warm goodbye email to coworkers after a layoff that keeps your contacts and your reputation. Fill in the blanks, copy it and send.',
    h1: 'Goodbye email to coworkers after a layoff',
    lede: 'Your coworkers are your best references and your first leads. A brief, kind note with a personal address to reach you keeps them.',
    fields: [
      you,
      { id: 'team', label: 'Team or company', placeholder: 'the finance team at Northwind' },
      { id: 'memory', label: 'One thing you will remember', placeholder: 'closing the books in three days during the audit' },
      { id: 'email', label: 'Personal email or phone', placeholder: 'jordan.rivera@gmail.com' },
      { id: 'looking', label: 'What you are looking for', placeholder: 'finance leadership roles' },
    ],
    subject: 'Moving on from {{team}}',
    body: `Hi all,

Today is my last day, as my position was part of the layoffs. I wanted to say thank you before I go.

Working with {{team}} has been the best part of this job. I will remember {{memory}}, and I learned something from nearly every one of you.

I am looking for {{looking}}. If you hear of anything, or want to stay in touch, I am at {{email}}. I would be glad to be a reference for any of you.

Take care of each other.

{{you}}`,
    tips: [
      'Send it from your work address only if you still have access, and put your personal address in the body. Your work address stops working the day you leave.',
      'Keep it under 120 words and leave out anything about the decision or the company. This note will be forwarded.',
      'Offer to be a reference. Coworkers who are also looking will often do the same for you.',
      'Before access is cut, ask your manager whether it is fine to send a note to your team. If not, send it individually from your personal account the next day.',
    ],
    faq: [
      { q: 'Should I send a goodbye email after a layoff?', a: 'Yes, to people you worked with closely, and keep it short. A goodbye note is how most people keep in touch with former colleagues, and it costs you nothing.' },
      { q: 'Can I send it to the whole company?', a: 'Only if that is normal where you worked and your manager is fine with it. Otherwise send it to your team and the people you worked with.' },
      { q: 'What should I leave out?', a: 'Anything about the layoff decision, management or severance. Keep it positive and forward-looking; it may be forwarded to people you have never met.' },
    ],
    related: ['laid-off-linkedin-post', 'networking-email-after-layoff', 'reference-request-email'],
  },
  {
    slug: 'severance-negotiation-email',
    category: 'Layoff',
    name: 'Severance negotiation email',
    primary: 'severance negotiation email',
    secondary: ['how to negotiate severance email', 'severance counteroffer email', 'asking for more severance', 'severance negotiation letter sample'],
    title: 'Severance Negotiation Email: Free Template',
    description: 'Ask for more severance in writing with an email that is polite, specific and gives the company an easy yes. Fill in the blanks, copy and send.',
    h1: 'Severance negotiation email template',
    lede: 'Most severance offers have room in them. A calm email that names a specific ask and one reason is how most people get more.',
    fields: [
      you,
      { id: 'hr', label: 'Name of the HR contact', placeholder: 'Dana' },
      { id: 'weeks', label: 'Weeks of severance offered', placeholder: '8' },
      { id: 'years', label: 'Years of service', placeholder: '9' },
      { id: 'askWeeks', label: 'Weeks you are asking for', placeholder: '14' },
      { id: 'benefit', label: 'Other ask (optional)', placeholder: 'six months of company-paid COBRA premiums', fallback: 'continued health coverage through COBRA at the company’s cost' },
      { id: 'deadline', label: 'Your deadline to sign', placeholder: 'November 14' },
      { id: 'reason', label: 'One reason', placeholder: 'I was leading the migration that is due to launch next month' },
    ],
    subject: 'Questions about my separation agreement',
    body: `Hi {{hr}},

Thank you for walking me through the separation agreement. I appreciate how this was handled and I want to resolve it quickly.

After {{years}} years with the company, the offer of {{weeks}} weeks does not reflect my service. {{reason}}. I am asking for {{askWeeks}} weeks of pay and {{benefit}}.

If you can confirm that in writing, I am ready to sign well before the {{deadline}} deadline. Please also let me know if I should send this to someone else.

Thank you,
{{you}}`,
    tips: [
      'Never sign on the day you receive the agreement. Many agreements for workers over 40 must give 21 days to consider (45 in a group layoff) and 7 days to revoke; check yours.',
      'Ask for a number, not “more.” A specific figure with one reason is something HR can approve without escalating.',
      'Benefits are often easier to get than cash: COBRA premiums, outplacement, a longer end date, accrued vacation pay, and a neutral reference.',
      'Stay polite and in writing. A calm email can be forwarded to the person who decides; an angry one cannot.',
      'If the amount is large or the agreement waives claims, have an employment lawyer read it first. Many offer a free first call.',
    ],
    faq: [
      { q: 'Is severance negotiable?', a: 'Often, yes, especially when you ask politely, give a reason and pick something specific. A group layoff may have fixed formulas, but benefits, timing and reference language can still move.' },
      { q: 'How much severance should I ask for?', a: 'A common range is one to two weeks of pay per year of service. Use the severance calculator on this site to see where your offer sits, then ask for the next step up.' },
      { q: 'Can I still file for unemployment if I take severance?', a: 'In most states yes, though some count severance paid as wages for the weeks it covers. Check your state’s rules before you sign.' },
      { q: 'What if they say no?', a: 'You can sign what was offered, or ask for a few non-cash items that cost them little. If the agreement asks you to waive legal claims, a short consult with an employment lawyer is worth the time.' },
    ],
    related: ['reference-request-email', 'networking-email-after-layoff', 'salary-negotiation-email'],
  },
  {
    slug: 'reference-request-email',
    category: 'Job search',
    name: 'Reference request email',
    primary: 'reference request email',
    secondary: ['how to ask for a reference', 'email asking for a reference', 'ask former manager to be a reference', 'reference request template'],
    title: 'Reference Request Email: Template and Tips',
    description: 'Ask a former manager or colleague to be your reference with an email that makes it easy to say yes. Free fill-in template you can copy.',
    h1: 'Reference request email template',
    lede: 'People say yes more often when you tell them what the role needs and what to highlight. This email does both and gives them an easy way out.',
    fields: [
      you,
      { id: 'name', label: 'Their first name', placeholder: 'Marcus' },
      { id: 'worked', label: 'How you worked together', placeholder: 'on the Northwind finance team from 2019 to 2024' },
      { id: 'role', label: 'Role you are applying for', placeholder: 'finance director' },
      { id: 'company', label: 'Company', placeholder: 'Contoso' },
      { id: 'highlight', label: 'What you hope they will mention', placeholder: 'the audit cleanup and the team I built' },
    ],
    subject: 'Would you be a reference for me?',
    body: `Hi {{name}},

I hope you are doing well. I am applying for a {{role}} role at {{company}} and I am moving toward the final round. Would you be willing to be a reference for me?

We worked together {{worked}}. If it helps, I would suggest touching on {{highlight}}. I can send my résumé and the job description so you know what they are looking for.

If the timing is not right, I completely understand. Thank you either way.

{{you}}`,
    tips: [
      'Ask before you list anyone. A surprised reference is a weak one.',
      'Give them an easy way to decline. People who feel free to say no say yes more warmly.',
      'Send the job description and your current résumé so they can speak to what the role needs.',
      'Thank them and tell them how it turned out. They are a reference for life.',
    ],
    faq: [
      { q: 'Who should I ask to be a reference?', a: 'A manager who saw your best work, a peer you collaborated with and, if you manage people, someone who reported to you. Recent beats senior.' },
      { q: 'When should I ask?', a: 'When you reach the final round, or earlier if you are leaving a job and your manager may be hard to reach. You can also ask now and use them later.' },
      { q: 'What if I was laid off and my manager is gone?', a: 'Ask a former peer or another leader who knows your work. Layoffs are common and employers expect references from people who have since moved on.' },
      { q: 'Should I send a thank-you?', a: 'Yes, after they speak with the employer and again when you start. Two lines is enough.' },
    ],
    related: ['linkedin-recommendation-request', 'thank-you-email-after-interview', 'networking-email-after-layoff'],
  },
  {
    slug: 'linkedin-recommendation-request',
    category: 'Job search',
    name: 'LinkedIn recommendation request',
    primary: 'linkedin recommendation request message',
    secondary: ['how to ask for a linkedin recommendation', 'linkedin recommendation request template', 'ask for a recommendation on linkedin', 'request recommendation message'],
    title: 'LinkedIn Recommendation Request Message Template',
    description: 'Ask a former boss or coworker for a LinkedIn recommendation with a short message that tells them what to write about. Free, copy and send.',
    h1: 'LinkedIn recommendation request message',
    lede: 'The reason most people skip your request is that writing one from scratch feels like work. Tell them what to cover and it becomes five minutes.',
    fields: [
      you,
      { id: 'name', label: 'Their first name', placeholder: 'Priya' },
      { id: 'project', label: 'A project you shared', placeholder: 'the 2023 systems migration' },
      { id: 'topic', label: 'What you would like them to mention', placeholder: 'how I handled the vendor negotiation and led the cutover' },
    ],
    body: `Hi {{name}},

I am updating my LinkedIn profile and thinking about the people I enjoyed working with most. Would you be open to writing a short recommendation?

If it helps, I would be grateful if you touched on {{topic}} from {{project}}. A few sentences is plenty, and I am happy to write one for you in return.

Thanks for considering it.

{{you}}`,
    tips: [
      'Send it as a personal message with a short note, not the default request button text. Personal requests are answered far more often.',
      'Offer to write one in return. Many people reciprocate.',
      'Mention the project and the quality you want highlighted. That is the part they would otherwise have to think about.',
      'Aim for two or three recommendations from managers or clients in the last five years, not a long list.',
    ],
    faq: [
      { q: 'How long should a recommendation be?', a: 'Three to five sentences. A specific result with a name or number beats general praise.' },
      { q: 'Can I write it for them?', a: 'Offering a draft is fine if they ask for one. Never post anything under someone else’s name without them reading and approving it.' },
      { q: 'Who is the best person to ask?', a: 'A manager or client who saw you deliver. If you were laid off and your manager left, a peer or cross-team partner works.' },
    ],
    related: ['reference-request-email', 'laid-off-linkedin-post', 'networking-email-after-layoff'],
  },
  {
    slug: 'networking-email-after-layoff',
    category: 'Job search',
    name: 'Networking email after a layoff',
    primary: 'networking email after layoff',
    secondary: ['reaching out to contacts after layoff', 'email to former colleagues looking for work', 'how to ask for job leads', 'networking message template'],
    title: 'Networking Email After a Layoff: Free Template',
    description: 'A short email to ask your network for introductions and job leads after a layoff, with a specific ask that gets replies. Fill in and send.',
    h1: 'Networking email after a layoff',
    lede: 'The people who help are the ones who know exactly what to look for. Your email is short, specific and easy to forward.',
    fields: [
      you,
      { id: 'name', label: 'Their first name', placeholder: 'Sam' },
      { id: 'connection', label: 'How you know them', placeholder: 'we worked on the Contoso rollout together' },
      { id: 'target', label: 'What you are looking for', placeholder: 'product operations leadership roles' },
      { id: 'companies', label: 'Companies or fields (optional)', placeholder: 'logistics software and marketplaces', fallback: 'a company where that work matters' },
      { id: 'ask', label: 'The ask', placeholder: 'a 15-minute call, or an introduction to someone on your team' },
    ],
    subject: 'Quick question from {{you}}',
    body: `Hi {{name}},

I hope you are well. {{connection}}, and I wanted to ask your advice.

My role was cut in a recent layoff, and I am looking for {{target}}, ideally in {{companies}}. Because you know that world better than I do, could I ask for {{ask}}?

I will keep it short and I am glad to send a one-paragraph summary you can forward.

Thank you,
{{you}}`,
    tips: [
      'Ask for advice or an introduction, not for a job. People answer advice requests; they hesitate on job requests.',
      'Attach nothing. Offer a one-paragraph summary instead, and send it when they say yes.',
      'Send five to ten of these a day to people you actually know before reaching out to strangers.',
      'Follow up once after five business days with one line. Most replies come on the second try.',
    ],
    faq: [
      { q: 'Is it awkward to email former colleagues after a layoff?', a: 'No. Layoffs are common and people expect to hear from you. What matters is a specific, easy ask.' },
      { q: 'How many people should I contact?', a: 'Aim for ten to fifteen conversations a week in the first month. A short email a day to someone you know is enough to keep that going.' },
      { q: 'What if no one replies?', a: 'Send one follow-up after five business days. If there is still silence, move on and try someone else.' },
    ],
    related: ['laid-off-linkedin-post', 'recruiter-outreach-email', 'reference-request-email'],
  },
  {
    slug: 'recruiter-outreach-email',
    category: 'Job search',
    name: 'Email to a recruiter',
    primary: 'email to a recruiter template',
    secondary: ['how to email a recruiter', 'reaching out to recruiters', 'cold email to recruiter', 'recruiter outreach message'],
    title: 'Email to a Recruiter: Template That Gets Replies',
    description: 'A short email to a recruiter that says who you are, what you want and why you fit, so they can place you quickly. Fill in the blanks and send.',
    h1: 'Email to a recruiter template',
    lede: 'Recruiters scan emails in seconds. Lead with the role, then one proof that you fit, and make the next step obvious.',
    fields: [
      you,
      { id: 'name', label: 'Recruiter’s first name', placeholder: 'Alex' },
      { id: 'role', label: 'Role you want', placeholder: 'senior financial analyst' },
      { id: 'proof', label: 'One proof you fit', placeholder: 'I run forecasting for a $400M business unit and cut close time by 30%' },
      { id: 'where', label: 'Where you can work', placeholder: 'Chicago or remote' },
      { id: 'link', label: 'Your LinkedIn or portfolio link', placeholder: 'linkedin.com/in/jordanrivera' },
    ],
    subject: '{{role}} candidate: {{you}}',
    body: `Hi {{name}},

I am looking for {{role}} roles and noticed you recruit for this area. In my current role, {{proof}}.

I can work from {{where}} and I am available to start soon. My profile is here: {{link}}.

If it makes sense, could we talk for 15 minutes this week? I am happy to send my résumé before then.

Thank you,
{{you}}`,
    tips: [
      'Put the role in the subject line so the email is filed in the right place.',
      'Name one measurable result. Recruiters need a reason to forward you.',
      'Say where you can work and when you can start. It removes two questions.',
      'Contact recruiters who place your kind of role, not every recruiter. Search the job title with “recruiter” on LinkedIn.',
    ],
    faq: [
      { q: 'Should I email a recruiter if there is no open role?', a: 'Yes, if the recruiter works in your field. They keep a list of candidates for roles that open later.' },
      { q: 'Should I attach my résumé?', a: 'Offer it and attach it if they ask or if their site says to. Many filters block unrequested attachments.' },
      { q: 'How often should I follow up?', a: 'Once after a week. After that, check in every month or two with a short update.' },
    ],
    related: ['networking-email-after-layoff', 'thank-you-email-after-interview', 'salary-negotiation-email'],
  },
  {
    slug: 'thank-you-email-after-interview',
    category: 'Interviews',
    name: 'Thank-you email after an interview',
    primary: 'interview thank you email template',
    secondary: ['thank you email after job interview', 'interview follow up thank you', 'thank you note after interview example', 'post interview thank you email sample'],
    title: 'Interview Thank You Email Template, Free',
    description: 'A thank-you email after an interview that mentions one specific thing you discussed and restates why you fit. Fill in the blanks, copy and send.',
    h1: 'Thank-you email after an interview',
    lede: 'Send it within a day. Mention one real thing from the conversation, say why you fit, and keep it under 120 words.',
    fields: [
      you,
      { id: 'name', label: 'Interviewer’s first name', placeholder: 'Taylor' },
      { id: 'role', label: 'Role', placeholder: 'operations manager' },
      { id: 'company', label: 'Company', placeholder: 'Contoso' },
      { id: 'topic', label: 'Something specific you discussed', placeholder: 'the plan to consolidate your three fulfillment sites' },
      { id: 'fit', label: 'Why you fit, in one line', placeholder: 'I led a similar consolidation and saved $1.2M in the first year' },
    ],
    subject: 'Thank you for speaking with me',
    body: `Hi {{name}},

Thank you for taking the time to talk with me about the {{role}} role at {{company}}. I especially enjoyed hearing about {{topic}}.

Our conversation made me more excited about the role. {{fit}}, and I would like to bring that to your team.

Please let me know if I can send anything else. I look forward to the next step.

Best,
{{you}}`,
    tips: [
      'Send it the same day or the next morning. After two days it reads as an afterthought.',
      'Mention something only this interviewer said. It proves you listened and keeps the note from looking copied.',
      'If you met more than one person, send each a separate note with a different detail.',
      'Fix one thing you forgot to say, but briefly. A thank-you is not a second interview.',
    ],
    faq: [
      { q: 'Is a thank-you email after an interview necessary?', a: 'It is not required, but it helps. It keeps you in mind and gives you a chance to add a point you missed.' },
      { q: 'How soon should I send it?', a: 'Within 24 hours. The same evening is ideal.' },
      { q: 'Email or handwritten?', a: 'Email. It arrives before a hiring decision is made.' },
      { q: 'What if I was interviewed by a panel?', a: 'Send each person a short note, changing the detail in each so they do not look identical.' },
    ],
    related: ['interview-follow-up-no-response', 'reference-request-email', 'salary-negotiation-email'],
  },
  {
    slug: 'interview-follow-up-no-response',
    category: 'Interviews',
    name: 'Follow-up email when you have not heard back',
    primary: 'follow up email after no response',
    secondary: ['follow up after interview no response', 'how to follow up on a job application', 'checking in on application status', 'interview follow up email example'],
    title: 'Follow-Up Email After No Response: Template',
    description: 'A short, polite follow-up for when an employer has not replied after an interview or application. Fill in the blanks, copy and send it today.',
    h1: 'Follow-up email after no response',
    lede: 'Silence usually means the process is slow, not that you are out. One polite note after the right wait is normal and often gets an answer.',
    fields: [
      you,
      { id: 'name', label: 'Their first name', placeholder: 'Taylor' },
      { id: 'role', label: 'Role', placeholder: 'operations manager' },
      { id: 'when', label: 'When you spoke or applied', placeholder: 'October 21' },
      { id: 'add', label: 'Something new to share (optional)', placeholder: 'I finished the supply chain certificate this week', fallback: 'The conversation made me more interested, not less' },
    ],
    subject: 'Following up on the {{role}} role',
    body: `Hi {{name}},

I wanted to follow up on the {{role}} role. We spoke on {{when}} and I am still very interested.

{{add}}. If there is anything I can send to help with your decision, I would be glad to.

I understand these processes take time. Could you tell me where things stand and when I should expect to hear?

Thank you,
{{you}}`,
    tips: [
      'Wait the time they gave you, or about a week if they gave none. Follow up once, then once more a week later.',
      'Add one new fact if you have it: a certificate, a result, an article. It turns a nag into an update.',
      'Ask for the timeline, not the answer. “When should I expect to hear?” is easy to reply to.',
      'Keep applying while you wait. Most offers come from the process you were not waiting on.',
    ],
    faq: [
      { q: 'How long should I wait before following up?', a: 'A week after the interview or the date they gave you. If you applied online with no contact, two weeks.' },
      { q: 'How many times can I follow up?', a: 'Twice, a week or more apart. After that, assume the process moved on, and keep your options open.' },
      { q: 'What if they said they would call me?', a: 'Wait until the day after their date, then email. Phone calls are easy to miss.' },
    ],
    related: ['thank-you-email-after-interview', 'recruiter-outreach-email', 'withdraw-application-email'],
  },
  {
    slug: 'salary-negotiation-email',
    category: 'Offers',
    name: 'Salary negotiation email',
    primary: 'salary negotiation email',
    secondary: ['negotiate salary email template', 'counteroffer email example', 'how to ask for higher salary offer', 'email to negotiate job offer'],
    title: 'Salary Negotiation Email: Counteroffer Template',
    description: 'Counter a job offer in writing with an email that is warm, specific and backed by one reason. Fill in the blanks, copy and send it.',
    h1: 'Salary negotiation email template',
    lede: 'Employers expect a counter. A friendly email that names a number and one reason usually gets a better offer without hurting the relationship.',
    fields: [
      you,
      { id: 'name', label: 'Recruiter or hiring manager’s first name', placeholder: 'Alex' },
      { id: 'role', label: 'Role', placeholder: 'senior analyst' },
      { id: 'offer', label: 'Offered salary', placeholder: '$118,000' },
      { id: 'ask', label: 'What you are asking for', placeholder: '$130,000' },
      { id: 'reason', label: 'One reason', placeholder: 'the scope matches what I do today at $128,000 plus bonus' },
    ],
    subject: 'Thank you for the offer',
    body: `Hi {{name}},

Thank you for the offer for the {{role}} role. I am excited about the team and I would like to say yes.

Before I do, I would like to talk about compensation. The offer is {{offer}}. {{reason}}, and I would be comfortable accepting at {{ask}}.

Is there flexibility? If this is the right number, I am ready to accept.

Thank you,
{{you}}`,
    tips: [
      'Always say you are excited first. Warmth makes the counter feel like part of closing, not a fight.',
      'Name a number, not a range. A range lets them pick the bottom.',
      'Give a reason tied to the job or the market, not to your expenses.',
      'If salary is fixed, ask for a signing bonus, extra vacation, a title or an earlier review. Each costs them less.',
      'Never reveal a bottom line, and in states that bar salary-history questions you do not have to share your current pay.',
    ],
    faq: [
      { q: 'Is it OK to negotiate a job offer?', a: 'Yes. Employers expect it, and most build room into the first offer. A polite counter rarely costs you the offer.' },
      { q: 'How much more should I ask for?', a: 'Often 5 to 15 percent above the offer, backed by pay data. Use the pay check on this site to compare your offer with listed pay.' },
      { q: 'What if they say it is their best offer?', a: 'Ask for non-salary items: a sign-on bonus, vacation, a title, an earlier review or a remote day. If none are possible, decide whether the role is worth it as offered.' },
    ],
    related: ['accept-job-offer-email', 'decline-job-offer-email', 'severance-negotiation-email'],
  },
  {
    slug: 'accept-job-offer-email',
    category: 'Offers',
    name: 'Accept a job offer email',
    primary: 'accept job offer email',
    secondary: ['job offer acceptance email', 'how to accept a job offer by email', 'accepting a job offer example', 'offer acceptance letter'],
    title: 'Accept a Job Offer Email: Free Template',
    description: 'Accept a job offer in writing with a clear, warm email that confirms salary, start date and the next steps. Fill in the blanks, copy and send.',
    h1: 'Email to accept a job offer',
    lede: 'Put the details in writing: title, pay and start date. A clear acceptance prevents misunderstandings later.',
    fields: [
      you,
      { id: 'name', label: 'Their first name', placeholder: 'Alex' },
      { id: 'role', label: 'Role', placeholder: 'senior analyst' },
      { id: 'company', label: 'Company', placeholder: 'Contoso' },
      { id: 'salary', label: 'Salary', placeholder: '$130,000' },
      { id: 'start', label: 'Start date', placeholder: 'December 2' },
    ],
    subject: 'Accepting the {{role}} offer',
    body: `Hi {{name}},

Thank you for the offer. I am pleased to accept the {{role}} role at {{company}} at a salary of {{salary}}, with a start date of {{start}}.

Please let me know what you need from me before then, including paperwork, a background check or equipment details. I look forward to joining the team.

Best,
{{you}}`,
    tips: [
      'Wait for the written offer before you accept, and confirm pay, title, start date and benefits in it.',
      'Do not resign from your current job until the written offer is signed and any checks are complete.',
      'Ask when the paperwork and first-day details will arrive so the days before the start are not a guess.',
      'Tell other employers you are in process that you have accepted. Do it promptly and kindly.',
    ],
    faq: [
      { q: 'Should I accept a job offer by email?', a: 'Yes. It gives both sides a written record, and most employers prefer it. Follow with a call if they asked for one.' },
      { q: 'Can I take time before I accept?', a: 'Yes, asking for a few days is normal. Say when you will answer and keep to it.' },
      { q: 'What if I need to negotiate first?', a: 'Do it before you accept. Once you say yes, the offer is settled.' },
    ],
    related: ['salary-negotiation-email', 'decline-job-offer-email', 'resignation-letter'],
  },
  {
    slug: 'decline-job-offer-email',
    category: 'Offers',
    name: 'Decline a job offer email',
    primary: 'decline job offer email',
    secondary: ['how to decline a job offer politely', 'turning down a job offer', 'rejecting a job offer email example', 'declining a job offer template'],
    title: 'Decline a Job Offer Email: Polite Template',
    description: 'Turn down a job offer politely, keep the relationship and leave the door open. Fill in the blanks, copy the email and send it today.',
    h1: 'Email to decline a job offer',
    lede: 'Be quick, kind and short. You may want this recruiter or company again, and the way you say no is what they remember.',
    fields: [
      you,
      { id: 'name', label: 'Their first name', placeholder: 'Alex' },
      { id: 'role', label: 'Role', placeholder: 'senior analyst' },
      { id: 'company', label: 'Company', placeholder: 'Contoso' },
      { id: 'reason', label: 'A brief, honest reason (optional)', placeholder: 'I accepted a role closer to home', fallback: 'It was not the right fit for me at this time' },
    ],
    subject: 'Thank you for the {{role}} offer',
    body: `Hi {{name}},

Thank you for offering me the {{role}} role at {{company}}, and for the time you and the team spent with me.

After careful thought, I have decided not to accept. {{reason}}. This was a hard decision because I was impressed by the team.

I hope our paths cross again, and I would be glad to stay in touch.

Best wishes,
{{you}}`,
    tips: [
      'Decline as soon as you know. Others are waiting, and a fast no is a kindness.',
      'You do not owe a long explanation. One honest sentence is enough, and you can skip it.',
      'Thank the people who interviewed you by name if you can.',
      'Connect on LinkedIn afterward. The people who made the offer often move to other companies.',
    ],
    faq: [
      { q: 'Do I have to give a reason?', a: 'No. A short, honest one is fine, and leaving it out is also fine.' },
      { q: 'Should I call instead?', a: 'A call is a nice touch for a recruiter you know well; follow it with this email so there is a written record.' },
      { q: 'Can I accept later if the other offer falls through?', a: 'It is hard once you decline. If you are unsure, ask for more time instead of declining.' },
    ],
    related: ['accept-job-offer-email', 'salary-negotiation-email', 'withdraw-application-email'],
  },
  {
    slug: 'withdraw-application-email',
    category: 'Job search',
    name: 'Withdraw a job application email',
    primary: 'withdraw job application email',
    secondary: ['how to withdraw an application', 'withdrawing from the hiring process', 'email to withdraw candidacy', 'pull out of interview process'],
    title: 'Withdraw a Job Application: Email Template',
    description: 'Withdraw from a hiring process politely, whether you accepted another job or changed your mind. Fill in the blanks, copy and send the email.',
    h1: 'Email to withdraw a job application',
    lede: 'A short note that closes the loop is the professional move, and it keeps you in the recruiter’s good books.',
    fields: [
      you,
      { id: 'name', label: 'Their first name', placeholder: 'Taylor' },
      { id: 'role', label: 'Role', placeholder: 'operations manager' },
      { id: 'company', label: 'Company', placeholder: 'Contoso' },
    ],
    subject: 'Withdrawing my application for {{role}}',
    body: `Hi {{name}},

Thank you for considering me for the {{role}} role at {{company}} and for the time you have spent with me.

I have decided to withdraw from the process. I appreciate your time and I was impressed by the team.

I would be glad to stay in touch, and I wish you every success in filling the role.

Best,
{{you}}`,
    tips: [
      'Send it as soon as you decide. Interview slots and offers are held for you.',
      'No explanation is needed. If you accepted something else, one line is fine.',
      'Thank the recruiter. They are the person most likely to call you about a future role.',
    ],
    faq: [
      { q: 'Is it rude to withdraw an application?', a: 'No. Withdrawing early is far better than ghosting, and employers prefer a clear answer.' },
      { q: 'Can I apply again later?', a: 'Yes. A polite withdrawal does not count against you.' },
    ],
    related: ['decline-job-offer-email', 'interview-follow-up-no-response', 'accept-job-offer-email'],
  },
  {
    slug: 'resignation-letter',
    category: 'Offers',
    name: 'Resignation letter',
    primary: 'resignation letter template',
    secondary: ['two weeks notice letter', 'how to write a resignation letter', 'resignation email sample', 'simple resignation letter'],
    title: 'Resignation Letter Template: Two Weeks’ Notice',
    description: 'A short, professional resignation letter with your last day and an offer to help with the handover. Fill in the blanks, copy and send it.',
    h1: 'Resignation letter template',
    lede: 'Keep it brief, positive and dated. The letter is for the record. The reasons belong in a conversation.',
    fields: [
      you,
      { id: 'manager', label: 'Manager’s name', placeholder: 'Maria' },
      { id: 'role', label: 'Your job title', placeholder: 'senior analyst' },
      { id: 'company', label: 'Company', placeholder: 'Northwind' },
      { id: 'last', label: 'Last day', placeholder: 'December 6' },
      { id: 'help', label: 'How you will help with the handover', placeholder: 'document my projects and train a successor' },
    ],
    subject: 'Resignation: {{you}}',
    body: `Dear {{manager}},

Please accept this letter as notice that I am resigning from my position as {{role}} at {{company}}. My last day will be {{last}}.

Thank you for the opportunity and for everything I have learned here. During my remaining time I will {{help}}, so the transition is smooth.

Sincerely,
{{you}}`,
    tips: [
      'Tell your manager in person or on a call first. The letter confirms it.',
      'Check your offer letter, contract or handbook for the notice period. Two weeks is typical, not a rule.',
      'Do not criticize anyone in writing. Save feedback for the exit interview, if you choose to give any.',
      'Do not resign until the new offer is signed and any background checks are done.',
      'Ask HR in writing about final pay, unused vacation, benefits end dates and your 401(k) before your last day.',
    ],
    faq: [
      { q: 'How much notice should I give?', a: 'Two weeks is standard in the United States, unless your contract says otherwise. Senior roles often give four.' },
      { q: 'Do I have to give a reason?', a: 'No. “To pursue another opportunity” is enough, or no reason at all.' },
      { q: 'Should I send a letter or an email?', a: 'Either works. Most people tell their manager first and then email the letter to them and HR.' },
    ],
    related: ['accept-job-offer-email', 'layoff-goodbye-email-to-coworkers', 'reference-request-email'],
  },
  {
    slug: 'layoff-announcement-email-to-employees',
    category: 'Employers',
    name: 'Layoff announcement email to employees',
    primary: 'layoff announcement email to employees',
    secondary: ['layoff email template for employers', 'how to announce layoffs to employees', 'layoff communication template', 'announcing a reduction in force email'],
    title: 'Layoff Announcement Email to Employees: Template',
    description: 'A clear, humane layoff announcement email for employers: what is happening, who is affected, what happens next and where to get help. Free template.',
    h1: 'Layoff announcement email to employees',
    lede: 'The announcement should say what is happening in the first two sentences, then tell each person what happens next. Vague emails travel faster than the facts.',
    fields: [
      { id: 'sender', label: 'Your name and title', placeholder: 'Dana Whitfield, CEO' },
      { id: 'company', label: 'Company', placeholder: 'Northwind' },
      { id: 'count', label: 'Roles affected', placeholder: '42 roles, about 8% of the company' },
      { id: 'reason', label: 'Reason, in plain words', placeholder: 'we are reducing costs after two quarters of lower demand' },
      { id: 'when', label: 'When affected people hear', placeholder: 'today, in individual conversations by 3 p.m.' },
      { id: 'support', label: 'Support offered', placeholder: 'severance, extended health coverage and outplacement support', fallback: 'severance, health coverage information and job search support' },
      { id: 'contact', label: 'Who to ask', placeholder: 'people@northwind.com' },
    ],
    subject: 'An important update about our company',
    body: `Team,

Today I have difficult news. {{reason}}, and as a result we are eliminating {{count}}.

People whose roles are affected will hear {{when}}. If you have not heard from your manager or HR by then, your role is not affected.

We are offering affected colleagues {{support}}. These decisions were about roles and business needs, not about the quality of anyone’s work, and I am sorry for the impact on people who have given so much to {{company}}.

I know this raises questions. Managers will be available today, and you can write to {{contact}} at any time. I will hold an all-hands tomorrow to answer what I can.

{{sender}}`,
    tips: [
      'Tell people who is affected before you tell everyone else. Nobody should learn their job is gone from a company email.',
      'Say plainly that affected people have already been told, and how the rest will know they are safe. It stops a day of fear.',
      'Give the reason honestly and briefly. Avoid “rightsizing” and similar words; people read them as evasion.',
      'Check notice rules before you send. A plant closing or mass layoff may require 60 days’ written notice under the federal WARN Act, and some states ask for more.',
      'Prepare managers with a script and an FAQ first. The conversation matters more than the email.',
    ],
    faq: [
      { q: 'What should a layoff announcement email include?', a: 'What is happening, how many roles, the reason, when affected people will be told, what support is offered, and where to ask questions. Keep it under 250 words.' },
      { q: 'Should the announcement come before or after the individual conversations?', a: 'After, or at the same time. Affected people should hear it from their manager first, never from a company-wide email.' },
      { q: 'Does an employer have to give notice before a layoff?', a: 'Often, yes. The federal WARN Act requires 60 days’ written notice of a plant closing or mass layoff at covered employers, and some states add their own rules. Check before you decide the date.' },
      { q: 'Should we offer outplacement?', a: 'It is common, and it helps people land faster and protects your employer brand with those who stay. Many employers offer it for 60 to 90 days.' },
    ],
    related: ['layoff-letter-to-employee', 'layoff-goodbye-email-to-coworkers', 'severance-negotiation-email'],
  },
  {
    slug: 'layoff-letter-to-employee',
    category: 'Employers',
    name: 'Layoff letter to an employee',
    primary: 'layoff letter template',
    secondary: ['layoff notice letter to employee', 'sample layoff letter', 'position elimination letter', 'employee layoff letter example'],
    title: 'Layoff Letter Template for Employers (Free)',
    description: 'A plain, complete layoff letter to give an employee: effective date, reason, final pay, benefits, severance and who to contact. Fill in the blanks and copy.',
    h1: 'Layoff letter template',
    lede: 'The letter confirms what was said in the conversation: the date, what the person is owed, what happens to benefits and who to call. A lawyer should read your final version.',
    fields: [
      { id: 'employee', label: 'Employee’s name', placeholder: 'Jordan Rivera' },
      { id: 'company', label: 'Company', placeholder: 'Northwind' },
      { id: 'role', label: 'Their role', placeholder: 'senior analyst' },
      { id: 'last', label: 'Last day of work', placeholder: 'December 6' },
      { id: 'pay', label: 'Final pay and accrued time off', placeholder: 'your final paycheck and accrued vacation, paid on December 6' },
      { id: 'severance', label: 'Severance, if any', placeholder: 'eight weeks of base pay, described in the attached agreement', fallback: 'no severance pay' },
      { id: 'benefits', label: 'Benefits information', placeholder: 'Your health coverage ends December 31, and a separate notice explains COBRA continuation coverage', fallback: 'A separate notice explains your health coverage and COBRA continuation coverage' },
      { id: 'contact', label: 'HR contact', placeholder: 'Dana Whitfield, people@northwind.com, 555-0100' },
      { id: 'sender', label: 'Signed by', placeholder: 'Dana Whitfield, VP People' },
    ],
    body: `Dear {{employee}},

This letter confirms our conversation today. Your position as {{role}} at {{company}} is being eliminated as part of a reduction in force. Your last day of work will be {{last}}.

Final pay: you will receive {{pay}}.
Severance: {{severance}}.
Benefits: {{benefits}}.

Please return company property, including your laptop and badge, by your last day. You may keep copies of your pay records and benefits documents.

If you have questions about any of this, please contact {{contact}}. We are grateful for your work and sorry that it has come to this. We will provide a neutral reference on request.

Sincerely,
{{sender}}`,
    tips: [
      'Give the letter after the conversation, not instead of it. Read it again to be sure it matches what was said.',
      'State final pay and the pay date. Many states set when final wages and accrued vacation are due; check your state before you promise a date.',
      'Include the unemployment information your state requires. Many states require a notice or a link on separation.',
      'If you offer severance in exchange for a release, use a lawyer’s agreement. Workers over 40 have review periods (21 days, or 45 in a group layoff, plus 7 to revoke).',
      'Check WARN rules first. A mass layoff may need 60 days’ written notice, and the notices have their own required contents.',
    ],
    faq: [
      { q: 'Is a layoff letter required?', a: 'Not by federal law for an individual layoff, but many states require written notice of separation or unemployment information, and a letter protects both sides. Check your state.' },
      { q: 'What should a layoff letter say?', a: 'The position, the last day, final pay, severance if any, what happens to health and other benefits, how to return property and who to contact. Keep the reasons short and factual.' },
      { q: 'Should the letter mention performance?', a: 'No. If the layoff is a reduction in force, say the role was eliminated. Mixing in performance confuses the reason and invites disputes.' },
      { q: 'Do we need a lawyer to review it?', a: 'For anything beyond a plain letter, yes, especially with severance, a release or a group layoff. This template is a starting draft, not legal advice.' },
    ],
    related: ['layoff-announcement-email-to-employees', 'severance-negotiation-email', 'hr-questions-after-layoff-email'],
  },
  {
    slug: 'unemployment-appeal-letter',
    category: 'Layoff',
    name: 'Unemployment appeal letter',
    primary: 'unemployment appeal letter',
    secondary: ['how to appeal unemployment denial', 'unemployment denial appeal letter sample', 'appeal letter for unemployment benefits', 'unemployment appeal template'],
    title: 'Unemployment Appeal Letter: Free Template',
    description: 'If your unemployment claim was denied, write a clear appeal letter that states the facts and what you want. Free fill-in template; check your deadline.',
    h1: 'Unemployment appeal letter template',
    lede: 'A denial is often wrong or based on missing facts. Appeal quickly: the deadline is short and it is printed on your denial notice.',
    fields: [
      { id: 'you', label: 'Your name', placeholder: 'Jordan Rivera' },
      { id: 'claim', label: 'Claim or case number', placeholder: 'on your determination notice' },
      { id: 'agency', label: 'Agency name', placeholder: 'Ohio Department of Job and Family Services' },
      { id: 'date', label: 'Date of the denial notice', placeholder: 'November 3, 2026' },
      { id: 'employer', label: 'Last employer', placeholder: 'Northwind' },
      { id: 'facts', label: 'What actually happened', placeholder: 'My position was eliminated in a layoff on October 18; I did not quit and was not fired for cause', long: true },
      { id: 'want', label: 'What you are asking for', placeholder: 'that the determination be reversed and benefits paid from October 21', fallback: 'that the determination be reversed and my benefits be paid' },
    ],
    body: `{{you}}
Claim number: {{claim}}

To {{agency}}:

I am appealing the determination dated {{date}} on my unemployment claim. I disagree with the decision for these reasons.

I worked for {{employer}}. {{facts}}.

I am asking {{want}}. I will attend any hearing and can provide documents, including my separation letter, pay records and messages from my employer.

Thank you for your review.

{{you}}`,
    tips: [
      'Find the appeal deadline on the denial notice. In many states it is short (often 10 to 30 days), and missing it can end your claim.',
      'Keep claiming weekly benefits while you appeal. In most states you must continue to certify to be paid if you win.',
      'Stick to facts, dates and documents. Avoid arguing about the employer’s character.',
      'Gather the separation letter, pay stubs, emails and the names of any witnesses before the hearing.',
      'Many states have free help for appeals: legal aid or the agency’s own hearing office. Ask when you file.',
    ],
    faq: [
      { q: 'How long do I have to appeal an unemployment denial?', a: 'It depends on the state, and the date is printed on your determination notice. It is often between 10 and 30 days, so file as soon as you can.' },
      { q: 'Do I have to keep filing weekly claims while I appeal?', a: 'In most states, yes. Keep certifying each week so you can be paid for those weeks if the appeal succeeds.' },
      { q: 'Do I need a lawyer to appeal?', a: 'No. Many people appeal on their own. Legal aid offices often help with unemployment hearings for free.' },
      { q: 'What happens after I file?', a: 'Most states schedule a hearing, often by phone, where you and your employer can each explain and show documents. A decision follows in writing.' },
    ],
    related: ['hr-questions-after-layoff-email', 'severance-negotiation-email', 'networking-email-after-layoff'],
  },
  {
    slug: 'hr-questions-after-layoff-email',
    category: 'Layoff',
    name: 'Email to HR with questions after a layoff',
    primary: 'questions to ask hr after layoff',
    secondary: ['email to hr after being laid off', 'what to ask hr when laid off', 'layoff paperwork request email', 'request final pay and benefits information'],
    title: 'Questions to Ask HR After a Layoff: Email Template',
    description: 'Send HR one email that gets everything in writing after a layoff: final pay, benefits end date, COBRA, severance, references and unemployment papers.',
    h1: 'Email to HR with questions after a layoff',
    lede: 'Layoff meetings are a blur. One clear email gets the answers in writing, and you can use them later for unemployment, COBRA and your severance decision.',
    fields: [
      { id: 'you', label: 'Your name', placeholder: 'Jordan Rivera' },
      { id: 'hr', label: 'HR contact’s first name', placeholder: 'Dana' },
      { id: 'last', label: 'Your last day', placeholder: 'December 6' },
      { id: 'extra', label: 'Anything else you need to know', placeholder: 'whether my stock options vest before my last day', fallback: 'whether any bonus or equity vests before my last day' },
    ],
    subject: 'Questions about my separation',
    body: `Hi {{hr}},

Thank you for meeting with me. So that I have everything in writing, could you confirm the following?

1. My last day ({{last}}) and the date I will be paid for it.
2. How much accrued vacation or paid time off I will be paid, and when.
3. The date my health, dental and vision coverage ends, and how and when I receive the COBRA election notice.
4. The severance offered, how it is paid, and how long I have to review and sign the agreement.
5. What happens to my 401(k), and any retirement or savings plan, and whom to contact.
6. Whether you will provide a separation letter for my unemployment claim.
7. Who will give a reference for me, and what the company will confirm.
8. {{extra}}.

Thank you for your help.

{{you}}`,
    tips: [
      'Ask for answers in writing even if you got them in the meeting. Verbal answers are hard to prove later.',
      'Request a separation letter or the state’s unemployment form; most states ask for the last day and the reason.',
      'Do not sign the severance agreement the day you receive it. Take the time the agreement gives you, and have it reviewed if it waives claims.',
      'COBRA has a short election window (60 days) once you receive the notice. Put the dates in your calendar.',
      'Save every email and take screenshots of your pay stubs and benefits pages before your access ends.',
    ],
    faq: [
      { q: 'What should I ask HR after being laid off?', a: 'Final pay and accrued time off, when benefits end, COBRA details, severance terms and the time to review them, the retirement plan, an unemployment letter, and the reference policy.' },
      { q: 'Should I email HR or ask in person?', a: 'Email. A written question gets a written answer, and you can forward it to your lawyer or the unemployment office.' },
      { q: 'How long do I have to decide on COBRA?', a: 'Usually 60 days from the date of the election notice or the loss of coverage, whichever is later. Use the COBRA vs ACA calculator on this site to compare options.' },
    ],
    related: ['severance-negotiation-email', 'unemployment-appeal-letter', 'reference-request-email'],
  },
  {
    slug: 'informational-interview-request-email',
    category: 'Job search',
    name: 'Informational interview request email',
    primary: 'informational interview request email',
    secondary: ['request an informational interview by email', 'informational interview email template', 'coffee chat request message', 'asking for a career advice call'],
    title: 'Informational Interview Request Email: Template',
    description: 'Ask someone for a 15-minute informational interview with a short email that is specific, flattering and easy to say yes to. Fill in and send.',
    h1: 'Informational interview request email',
    lede: 'People are more generous than you expect when the ask is small and specific. Ask for 15 minutes and one question you cannot answer by yourself.',
    fields: [
      { id: 'you', label: 'Your name', placeholder: 'Jordan Rivera' },
      { id: 'name', label: 'Their first name', placeholder: 'Priya' },
      { id: 'hook', label: 'Why you picked them', placeholder: 'I read your piece on supply chain resilience and saw you moved from consulting into operations' },
      { id: 'goal', label: 'What you are exploring', placeholder: 'a move from consulting into operations leadership' },
      { id: 'question', label: 'One question you want to ask', placeholder: 'what you would do differently in your first year in the role' },
    ],
    subject: '15 minutes of advice?',
    body: `Hi {{name}},

{{hook}}, and I wanted to reach out. I am exploring {{goal}}.

Would you be open to a 15-minute call in the next couple of weeks? The one thing I most want to ask is {{question}}.

If you are too busy, I understand completely, and I would be grateful for a pointer to someone else to ask.

Thank you,
{{you}}`,
    tips: [
      'Be specific about why you chose them. Generic flattery gets ignored.',
      'Ask for 15 minutes and keep to it. Offer a few time slots and a call or a video chat, whichever is easier for them.',
      'Come with three questions and follow up with a thank-you the same day.',
      'Ask at the end who else you should talk to. That one question builds a network.',
    ],
    faq: [
      { q: 'What is an informational interview?', a: 'A short conversation with someone in a role or company you are curious about, to learn about the work, not to ask for a job. It builds your network and your sense of the market.' },
      { q: 'Will people really say yes?', a: 'Many do, especially when the request is short, specific and flexible. Expect a reply from roughly one in three. Follow up once after a week.' },
      { q: 'Should I ask for a job in the call?', a: 'No. Ask for advice and for names. If there is an opening, the person will usually tell you.' },
    ],
    related: ['networking-email-after-layoff', 'recruiter-outreach-email', 'thank-you-to-reference-email'],
  },
  {
    slug: 'linkedin-headline-examples',
    category: 'Job search',
    name: 'LinkedIn headline generator',
    primary: 'linkedin headline for job seekers',
    secondary: ['linkedin headline examples', 'best linkedin headline when laid off', 'linkedin headline template', 'how to write a linkedin headline'],
    title: 'LinkedIn Headline for Job Seekers: Examples',
    description: 'Write a LinkedIn headline recruiters search for: your target role, your strongest skills and one proof. Free fill-in builder with examples to copy.',
    h1: 'LinkedIn headline for job seekers',
    lede: 'Your headline is what recruiters see in search results. Lead with the role you want, add two skills they search, and end with a proof.',
    fields: [
      { id: 'role', label: 'Role you want', placeholder: 'Senior Operations Manager' },
      { id: 'skills', label: 'Two skills recruiters search for', placeholder: 'Supply Chain | Process Improvement' },
      { id: 'proof', label: 'One proof', placeholder: 'Cut delivery times 18% across four regions' },
    ],
    body: `{{role}} | {{skills}} | {{proof}}`,
    tips: [
      'Use the title you want next, not the one you just left. Recruiters search for the title they are hiring.',
      'Include two or three keywords from postings you want. Use the résumé vs job description tool on this site to find them.',
      'Add a result with a number. It stands out in a list of identical headlines.',
      'Avoid “seeking opportunities” and “open to work” in the headline; use LinkedIn’s own Open to Work setting for that.',
      'You have 220 characters. Put the most important words first, because search results cut them off.',
    ],
    faq: [
      { q: 'What is a good LinkedIn headline when you are laid off?', a: 'The role you want, two skills and one proof, for example “Senior Operations Manager | Supply Chain | Process Improvement | Cut delivery times 18%.” It should read like a job title, not a status.' },
      { q: 'Should my headline say I was laid off?', a: 'No. Put it in your post or your About section if you want. The headline should sell what you do next.' },
      { q: 'How long can a headline be?', a: 'Up to 220 characters. Only the first 60 or so show in search, so put the target role first.' },
    ],
    related: ['linkedin-about-section', 'laid-off-linkedin-post', 'linkedin-recommendation-request'],
  },
  {
    slug: 'linkedin-about-section',
    category: 'Job search',
    name: 'LinkedIn About section template',
    primary: 'linkedin about section template',
    secondary: ['linkedin summary examples', 'how to write a linkedin about section', 'linkedin about me for job seekers', 'linkedin summary template'],
    title: 'LinkedIn About Section Template and Examples',
    description: 'Write a LinkedIn About section that says who you help, what you have done and how to reach you. Free fill-in template for job seekers.',
    h1: 'LinkedIn About section template',
    lede: 'The About section is where a recruiter decides whether to message you. Say what you do, prove it in two results, and tell them what you want next.',
    fields: [
      { id: 'role', label: 'What you do', placeholder: 'an operations leader' },
      { id: 'years', label: 'Years of experience', placeholder: '12' },
      { id: 'for', label: 'Who you help or what you build', placeholder: 'logistics companies that want faster, cheaper delivery' },
      { id: 'proof1', label: 'First result', placeholder: 'Cut delivery times 18% across four regions' },
      { id: 'proof2', label: 'Second result', placeholder: 'Led a $4M supply chain redesign that saved $1.2M a year' },
      { id: 'next', label: 'What you want next', placeholder: 'an operations leadership role at a growing logistics company' },
      { id: 'contact', label: 'How to reach you', placeholder: 'jordan.rivera@gmail.com' },
    ],
    body: `For {{years}} years I have worked as {{role}}, helping {{for}}.

What I have done:
• {{proof1}}.
• {{proof2}}.

I am now looking for {{next}}. If you are hiring, or know someone who is, I would love to talk: {{contact}}.`,
    tips: [
      'Write in the first person. It reads like a person, not a résumé.',
      'Put the best result first; only the first three lines show before “see more.”',
      'Use real numbers. They make the results believable and searchable.',
      'End with the exact next step you want, and an email so people do not need to message through LinkedIn.',
      'Keep it under 1,500 characters, and update it as soon as you land.',
    ],
    faq: [
      { q: 'How long should a LinkedIn About section be?', a: 'Between 600 and 1,500 characters. The first three lines are what shows without a click.' },
      { q: 'Should I write in first or third person?', a: 'First person. It is warmer and easier to read.' },
      { q: 'Should I mention that I was laid off?', a: 'Not required. State what you want next. If you do mention a layoff, one factual line is enough.' },
    ],
    related: ['linkedin-headline-examples', 'laid-off-linkedin-post', 'recruiter-outreach-email'],
  },
  {
    slug: 'request-more-time-for-job-offer-email',
    category: 'Offers',
    name: 'Ask for more time to decide on a job offer',
    primary: 'ask for more time to decide on job offer',
    secondary: ['request extension on job offer', 'need more time to consider job offer email', 'how to ask for time to think about an offer', 'job offer deadline extension email'],
    title: 'Ask for More Time on a Job Offer: Email Template',
    description: 'Ask an employer for more time to decide on a job offer with a polite email that keeps the offer warm. Free fill-in template to copy and send.',
    h1: 'Email to ask for more time on a job offer',
    lede: 'Asking for a few days is normal and employers expect it. Say you are excited, give a date, and say what you need.',
    fields: [
      { id: 'you', label: 'Your name', placeholder: 'Jordan Rivera' },
      { id: 'name', label: 'Their first name', placeholder: 'Alex' },
      { id: 'role', label: 'Role', placeholder: 'senior analyst' },
      { id: 'date', label: 'Date you will answer', placeholder: 'Friday, November 14' },
      { id: 'need', label: 'What you need before deciding', placeholder: 'to speak with my family and finish a final-round interview elsewhere', fallback: 'to finish a decision I am making with my family' },
    ],
    subject: 'Thank you for the offer',
    body: `Hi {{name}},

Thank you for the offer for the {{role}} role. I am very excited about it and about the team.

I would like a little more time to decide, because I need {{need}}. Could I give you my answer by {{date}}?

If you need a decision sooner, please tell me and I will do my best.

Thank you again,
{{you}}`,
    tips: [
      'Ask as soon as you get the offer, not on the deadline day.',
      'Give a date, not “a few days.” A specific date feels responsible and easy to approve.',
      'Be honest if you are waiting on another offer; you do not need to name the company.',
      'If you are waiting on another employer, ask them for a decision date. A real offer in hand speeds things up.',
    ],
    faq: [
      { q: 'Is it okay to ask for more time on a job offer?', a: 'Yes. Most employers allow three to five business days, and a longer wait is possible if you ask kindly.' },
      { q: 'How much time can I ask for?', a: 'A week is common. More than a week for a non-senior role is unusual; explain why.' },
      { q: 'Can the employer withdraw the offer?', a: 'It is possible but unusual. Being polite and giving a date keeps the risk low.' },
    ],
    related: ['salary-negotiation-email', 'accept-job-offer-email', 'decline-job-offer-email'],
  },
  {
    slug: 'thank-you-to-reference-email',
    category: 'Job search',
    name: 'Thank-you email to a reference',
    primary: 'thank you email to a reference',
    secondary: ['thank you note to a reference', 'thank a reference after job offer', 'how to thank someone who gave you a reference', 'reference thank you message'],
    title: 'Thank You Email to a Reference: Free Template',
    description: 'Thank the person who gave you a reference with a short note that tells them how it turned out. Fill in the blanks, copy and send it today.',
    h1: 'Thank-you email to a reference',
    lede: 'References are a favor with no payoff for them. A short note with the outcome is what they remember, and what keeps them on your side next time.',
    fields: [
      { id: 'you', label: 'Your name', placeholder: 'Jordan Rivera' },
      { id: 'name', label: 'Their first name', placeholder: 'Marcus' },
      { id: 'company', label: 'Company', placeholder: 'Contoso' },
      { id: 'outcome', label: 'How it turned out', placeholder: 'I got the offer and I start on December 2', fallback: 'it went well' },
    ],
    subject: 'Thank you',
    body: `Hi {{name}},

I wanted to thank you for being a reference for me with {{company}}. {{outcome}}, and I know your support helped.

I would be glad to return the favor, on a reference or an introduction. Please keep in touch.

With thanks,
{{you}}`,
    tips: [
      'Send it within a day of the outcome. Good news or not, they want to know.',
      'Mention one specific thing if you know what they said. It shows you value it.',
      'Offer to be a reference for them in return and keep the relationship active with a note every few months.',
    ],
    faq: [
      { q: 'Should I thank a reference even if I did not get the job?', a: 'Yes. They gave you their time, and a thank-you keeps them willing to help again.' },
      { q: 'Is an email enough or should I send a gift?', a: 'A sincere email is enough. If you want to add something, a coffee or a LinkedIn recommendation is plenty.' },
    ],
    related: ['reference-request-email', 'linkedin-recommendation-request', 'accept-job-offer-email'],
  },
]

export const TEMPLATE_CATEGORIES: TemplateCategory[] = ['Layoff', 'Job search', 'Interviews', 'Offers', 'Employers']

export function templateBySlug(slug: string): Template | undefined {
  return TEMPLATES.find((t) => t.slug === slug)
}

/** Replaces {{id}} with the typed value, or with “[label]” while a field is still empty so the gap is visible. */
export function fillTemplate(text: string, fields: TemplateField[], values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, id: string) => {
    const v = (values[id] ?? '').trim()
    if (v) return v
    const f = fields.find((x) => x.id === id)
    if (f?.fallback) return f.fallback
    return `[${f ? f.label.replace(/\s*\(optional\)/i, '').toLowerCase() : id}]`
  })
}

/** Field ids a template's text uses, to check every slot has a field. */
export function slotsIn(t: Template): string[] {
  return [...new Set([...(t.subject ?? '').matchAll(/\{\{(\w+)\}\}/g), ...t.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))]
}
