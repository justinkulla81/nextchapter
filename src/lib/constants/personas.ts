export interface Persona {
  slug: string
  label: string
  hook: string
  headline: string
  body: string[]
}

export const PERSONAS: Persona[] = [
  {
    slug: 'worried',
    label: 'Worried',
    hook: "You sense something's coming. Get ready before you have to.",
    headline: 'You can prepare without anyone knowing.',
    body: [
      "If you sense a layoff coming, the worst thing you can do is wait until it's official to start moving. You don't need to post \"open to work\" or tell your team — you just need a clear read on where you actually stand and a plan for what's next.",
      "Get your free Hireability Grade privately. Nothing about using NextChapter is visible to your employer, your team, or anyone in your network unless you choose to share it.",
    ],
  },
  {
    slug: 'laid-off',
    label: 'Laid Off',
    hook: 'Ready to move forward — with structure and support.',
    headline: 'A real plan beats another job board.',
    body: [
      "A layoff is disorienting — the structure of your day disappears along with the job. The fastest way back is a plan that turns \"I should probably look for a job\" into specific actions with a real weekly target.",
      'Get an honest Hireability Grade, a weekly Search Score you can actually move, and a community of people going through the exact same thing right now.',
    ],
  },
  {
    slug: 'resigned',
    label: 'Resigned',
    hook: "You made the leap. Now let's land it.",
    headline: "You made the hard call. Now let's make it pay off.",
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
    body: [
      "Coming back after time away — for a child, a family member, your own health — often means fighting a resume gap that says nothing about who you are or what you're capable of.",
      "Build a reference-backed profile that shows employers what actually matters: how you work, not just when you worked. Your gap doesn't have to be the headline.",
    ],
  },
]

export function getPersona(slug: string): Persona | undefined {
  return PERSONAS.find((p) => p.slug === slug)
}
