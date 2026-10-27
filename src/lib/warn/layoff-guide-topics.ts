// The parts of a layoff or buyout guide that are the same wherever you work: what to settle before the last day, the
// agreement terms to read, company property, and word-for-word scripts. Plain guidance in our own words, pure and tested
// (src/test/layoff-guide.test.ts). Where the answer depends on the state or the plan, the line says to ask, never states a rule
// it cannot stand behind.

export interface TopicGroup {
  id: string
  heading: string
  items: string[]
}

export interface Script {
  id: string
  when: string
  text: string
}

export const TOPIC_GROUPS: TopicGroup[] = [
  {
    id: 'before-last-day',
    heading: 'Settle these before your last day',
    items: [
      'Health FSA: spend what is left on eligible expenses before coverage ends. Unused balances are usually forfeited, and after your last day you can generally claim only costs from before coverage ended. Ask the plan administrator whether FSA coverage can continue through COBRA.',
      'Dependent care FSA: ask what you can still claim and the deadline to submit receipts.',
      'HSA: the account is yours and stays open after you leave. Check the balance and how to keep using it.',
      'Book appointments, fill prescriptions and use dental and vision benefits while you are still covered.',
      'Paid time off: ask whether unused days are paid out. State law and company policy decide, and both vary.',
      'Expense reports, commissions and any bonus you have earned: ask for the amount and the pay date in writing.',
      'Copies of what belongs to you: pay stubs, your offer letter, performance reviews, equity and benefits statements, and your personal contacts. Do not take confidential company files.',
      'Make sure the employer has your current home address, so tax forms reach you.',
    ],
  },
  {
    id: 'retirement',
    heading: '401(k) and retirement accounts',
    items: [
      'Your own contributions are always yours. Employer contributions are yours only as far as they have vested. Ask for the vesting schedule and whether your last day changes it.',
      'A large layoff can trigger full vesting under the plan-termination rules. Ask the plan administrator whether it applies.',
      'You can usually leave the money in the plan, roll it over to an IRA or a new employer’s plan, or take it as cash. A direct rollover avoids withholding and tax.',
      'Taking cash is taxed as income, plus a 10% penalty if you are under 59½, with exceptions. One exception can apply if you leave the employer in or after the year you turn 55, for that employer’s plan only.',
      'An unpaid 401(k) loan is usually due, or treated as a withdrawal, when you leave. You can generally roll over the amount of the offset until the tax filing deadline for that year. Ask the plan administrator how yours is handled.',
      'Plans can move small balances out automatically. Ask before your last day so it does not surprise you.',
    ],
  },
  {
    id: 'agreements',
    heading: 'Agreements to read before you sign',
    items: [
      'Non-compete: check whether you already signed one. Whether it can be enforced depends on your state, and some states, including California, void most of them. Ask for it to be waived in writing as part of any separation agreement.',
      'Non-solicitation: it limits recruiting colleagues or contacting clients. Ask how it is defined and how long it lasts.',
      'Confidentiality (NDA): keep trade secrets private, and ask exactly what is covered and for how long. Ask to confirm in writing that you can describe your own role and results when you interview.',
      'Non-disparagement: ask whether it runs both ways and what it covers. Agreements generally cannot stop you from filing for unemployment or a charge with a government agency. If the wording is unclear, have a lawyer read it.',
      'Release of claims: severance is often paid in exchange for giving up legal claims. Read what you are giving up. A one-time consult with an employment lawyer before you sign is common.',
      'References: ask for an agreed reference line and how your departure will be described, such as “position eliminated.”',
    ],
  },
  {
    id: 'property',
    heading: 'Company property and access',
    items: [
      'List what you hold: laptop, phone, badge, cards and any files. Ask where and how to return each item, and get a receipt.',
      'Do not wipe or delete company devices or accounts unless you are told to, and do not keep company files.',
      'Move your own files (photos, personal documents) off company devices before access ends. If you are unsure whether something is yours, ask.',
      'Take your personal accounts off your work email and move any two-step codes to your own phone.',
      'Ask when email and system access ends and how colleagues will be told.',
      'Ask when your final paycheck is due and how it will be paid. The deadline is set by state law.',
    ],
  },
]

const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Word-for-word lines for the moments that come up, with the employer’s name filled in. */
export function buildScripts(name: string, kind: 'layoff' | 'buyout', when: Date | null): Script[] {
  const when_ = when ? month(when) : 'this month'
  if (kind === 'buyout') {
    return [
      { id: 'buyout-receive', when: 'When you get the offer', text: `Thank you for the offer. I need the full terms in writing, and I need until [date] to decide.` },
      { id: 'buyout-ask', when: 'When you ask for more', text: `Before I decide, can we talk about [more weeks of pay / health coverage through a set date / a neutral reference]? That would make this easier to accept.` },
      { id: 'buyout-network', when: 'If you accept and tell your network', text: `I have decided to leave ${name} and I am looking for [role] in [field]. If you know someone I should talk to, I would be grateful for an introduction.` },
    ]
  }
  return [
    { id: 'layoff-meeting', when: 'In the meeting', text: `Thank you for telling me. I would like the details in writing: my last day, severance terms and when my benefits end. I will review them and answer by [date].` },
    { id: 'layoff-ask', when: 'When you ask for more', text: `I would like to ask for [more weeks of severance / health coverage through a set date / a neutral reference]. Can we discuss that before I sign?` },
    { id: 'layoff-network', when: 'When you tell your network', text: `My role at ${name} was eliminated. I am looking for [role] in [field]. If you know a team that is hiring, I would appreciate an introduction.` },
    { id: 'layoff-interview', when: 'In an interview', text: `${name} reduced its workforce in ${when_}, and my role was part of that. I am proud of [result]. What I want next is [role], where I can [strength].` },
  ]
}
