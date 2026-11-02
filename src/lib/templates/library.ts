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

export type TemplateCategory = 'Layoff' | 'Job search' | 'Interviews' | 'Offers'

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
]

export const TEMPLATE_CATEGORIES: TemplateCategory[] = ['Layoff', 'Job search', 'Interviews', 'Offers']

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
