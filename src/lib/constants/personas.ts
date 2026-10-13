import type { SituationKey } from './onboarding'

export interface Persona {
  slug: string
  label: string
  hook: string
  headline: string
  body: string[]
  situation: SituationKey
  // Old URLs that still resolve (and show this page) after a rename or merge.
  aliases?: string[]
}

export const PERSONAS: Persona[] = [
  {
    slug: 'thinking-about-a-move',
    aliases: ['worried', 'ready-to-move'],
    label: 'Thinking about a move',
    hook: 'Curious, unhappy, or sensing a layoff? Know your options before you need them.',
    headline: 'Know your market before anyone at work knows you looked.',
    situation: 'worried_let_go',
    body: [
      "You don't have to be out the door to start. Whether you're curious, ready to leave, or sensing a layoff, the best time to find out where you stand is while you still have a job and time on your side.",
      "Get your free Market Reality Assessment privately. You'll see how the market reads you, what you're worth, and a weekly plan matched to how soon you want to move. Nothing about using NextChapter is visible to your employer, your team, or your network unless you choose to share it.",
    ],
  },
  {
    slug: 'growing',
    label: 'Growing in my job',
    hook: 'Reviews, raises, new skills, and a job that holds up in a downturn.',
    headline: 'Make the job you have a stronger one.',
    situation: 'growing_in_job',
    body: [
      "You're not looking to leave, and you still shouldn't coast. The people who do best through reviews, reorganizations and downturns are the ones who know their worth, keep their skills current, and have the proof ready.",
      'Get an honest read on where you stand, a plan for your next review and pay conversation, skills worth building, and a profile that stays strong whatever the market does. Private by default.',
    ],
  },
  {
    slug: 'laid-off',
    label: 'Laid Off',
    hook: 'Ready to move forward — with structure and support.',
    headline: 'A real plan beats another job board.',
    situation: 'just_laid_off',
    body: [
      "A layoff is disorienting — the structure of your day disappears along with the job. The fastest way back is a plan that turns \"I should probably look for a job\" into specific actions with a real weekly target.",
      'Get an honest Market Reality Assessment, a Weekly Search Score you can actually move, and a community of people going through the exact same thing right now.',
    ],
  },
  {
    slug: 'resigned',
    label: 'Resigned',
    hook: "You made the leap. Now let's land it.",
    headline: "You made the hard call. Now let's make it pay off.",
    situation: 'just_resigned',
    body: [
      "Resigning without a landing spot is a real risk — but it's already made. What matters now is closing the gap fast, with a search that's structured instead of reactive.",
      'Build your plan, log real weekly progress, and put together the reference-backed proof that shows employers exactly what you bring.',
    ],
  },
  {
    slug: 'returning',
    label: 'Returning from Leave',
    hook: 'Coming back stronger, with your value clearly proven.',
    headline: "A gap on your resume isn't the whole story.",
    situation: 'reentering_workforce',
    body: [
      "Coming back after time away — for a child, a family member, your own health — often means fighting a resume gap that says nothing about who you are or what you're capable of.",
      "Build a reference-backed profile that shows employers what actually matters: how you work, not just when you worked. Your gap doesn't have to be the headline.",
    ],
  },
  {
    slug: 'searching-too-long',
    label: 'Searching too long',
    hook: 'Months in and nothing is moving? Change the plan, not just the effort.',
    headline: 'When a search stalls, you need new things to try.',
    situation: 'just_laid_off',
    body: [
      "A long search is exhausting, and the usual advice is to push harder. That's rarely the problem. A search that is stuck usually has one thing to change: the résumé, the targets, the people you're talking to, or how you interview.",
      'NextChapter reads what is actually happening, whether that is applications but no interviews, interviews but no offers, or a search that never really got going, and gives you different things to try as the weeks pass. It tells you the truth the way you ask for it, direct or gentle, and it is there for the hard weeks too.',
    ],
  },
  {
    slug: 'promotion',
    label: 'Going for a promotion',
    hook: 'Build the case for the next level, inside or outside.',
    headline: 'Walk into the promotion conversation with proof.',
    situation: 'looking_for_promotion',
    body: [
      'A promotion is won before the conversation, with a clear gap to the next level, evidence of your results, and a market price for the role.',
      "Get your Market Reality Assessment, see how your pay compares, and work a plan to close the gap, either where you are or with a step-up offer elsewhere.",
    ],
  },
  {
    slug: 'career-change',
    label: 'Changing careers',
    hook: 'Move into a new field with a plan and proof.',
    headline: 'A new field is a plan, not a leap.',
    situation: 'career_pivot',
    body: [
      "Changing fields means showing a different kind of evidence: the skills that transfer, the bridge steps that make the switch credible, and the people already doing the work.",
      'Get your Market Reality Assessment against the field you want, then a weekly plan of conversations, projects and learning that gets you there.',
    ],
  },
  {
    slug: 'new-grad',
    label: 'Student or recent grad',
    hook: 'Your first job or internship, and a strong first year.',
    headline: 'Start your career with a plan, not a pile of applications.',
    situation: 'just_graduated',
    body: [
      "Everyone starts without experience. What sets you apart is a clear target, a résumé built for it, and people willing to vouch for you.",
      'Build your first résumé, find alumni in your field, practice interviews, and keep going after you land with a plan for your first year.',
    ],
  },
  {
    slug: 'next-act',
    label: 'Planning the next act',
    hook: 'Board, fractional, consulting or part-time work that fits.',
    headline: 'Your experience is the product. Package it.',
    situation: 'next_act',
    body: [
      "After a long career, the best next move is often a mix: a board seat, fractional or consulting work, part-time roles that fit your income and your purpose.",
      'Build an advisory profile, find interim and fractional opportunities, and have the right conversations, on your terms.',
    ],
  },
]

export function getPersona(slug: string): Persona | undefined {
  return PERSONAS.find((p) => p.slug === slug || p.aliases?.includes(slug))
}
