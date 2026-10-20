// The first-week plan emailed to someone who tells us where they are (the homepage journey
// picker). Three concrete steps per situation, written plainly and positively. No AI: the
// plan is chosen by the situation they picked. Keys are the persona slugs in
// src/lib/constants/personas.ts; an unknown slug gets the DEFAULT plan.

export interface FirstWeekPlan {
  intro: string
  steps: string[]
}

export const DEFAULT_PLAN: FirstWeekPlan = {
  intro: 'Whatever is going on, the first week is about getting a clear picture and one small win.',
  steps: [
    'Write down the one job you would take tomorrow, in one sentence.',
    'Tell three people who know your work what you are looking for.',
    'Get your Market Reality Assessment so you know where you stand.',
  ],
}

export const FIRST_WEEK_PLANS: Record<string, FirstWeekPlan> = {
  'laid-off': {
    intro: 'A layoff is not a verdict on your work. The first week is about stability and a short, clear plan.',
    steps: [
      'File for unemployment benefits now. Deadlines start on your last day, not when you feel ready.',
      'Tell five people you trust, by name, that you are looking and what you want.',
      'Get your Market Reality Assessment so you know how the market reads your résumé.',
    ],
  },
  resigned: {
    intro: 'You made the move. Now make the search deliberate instead of rushed.',
    steps: [
      'Write what you want next and what you will not repeat from the last job.',
      'List ten companies you would be glad to work for, and one person at each.',
      'Get your Market Reality Assessment to see what your résumé says about you.',
    ],
  },
  'thinking-about-a-move': {
    intro: 'The best time to look is while you still have a job. Nobody at work needs to know.',
    steps: [
      'Check what people in your role are paid in your area.',
      'Reconnect with two people outside your company this week.',
      'Get your Market Reality Assessment privately, before you need it.',
    ],
  },
  'managing-my-career': {
    intro: 'Growing where you are takes evidence, not just effort.',
    steps: [
      'Write down three results from this year, each with a number.',
      'Ask your manager what the next level requires, and write down the answer.',
      'Get your Market Reality Assessment to see how your skills read outside your company.',
    ],
  },
  returning: {
    intro: 'A gap is a fact, not a flaw. The first week is about a short, honest story and a warm restart.',
    steps: [
      'Write two sentences on what you did and what you are ready for now.',
      'Message three former colleagues and ask what has changed in your field.',
      'Get your Market Reality Assessment so the gap is handled before an interviewer asks.',
    ],
  },
  'searching-too-long': {
    intro: 'A long search means something specific is not working. Find it before you change everything.',
    steps: [
      'Count your last 20 applications: how many interviews? That number says where it is stuck.',
      'Ask two people who hire to read your résumé and tell you the first thing they notice.',
      'Get your Market Reality Assessment to see what the systems that read your résumé see.',
    ],
  },
  promotion: {
    intro: 'Promotions go to people who made the case clear. Build the case this week.',
    steps: [
      'List the results that already look like the next level.',
      'Book 20 minutes with your manager to ask what is missing.',
      'Get your Market Reality Assessment to see how your skills compare for the bigger role.',
    ],
  },
  'career-change': {
    intro: 'A change works when your past is translated, not hidden.',
    steps: [
      'Pick one target role and list the five skills it asks for that you already have.',
      'Talk to two people already in that role. Ask what they would look for in you.',
      'Get your Market Reality Assessment to see which roles your experience already fits.',
    ],
  },
  'new-grad': {
    intro: 'You have less history and more room. Show what you can do, not just what you studied.',
    steps: [
      'Pick two roles you want and read ten job posts for each. Note what repeats.',
      'Message three alumni in those roles and ask for 15 minutes.',
      'Get your Market Reality Assessment so your first résumé reads like a candidate, not a student.',
    ],
  },
  'next-act': {
    intro: 'The next act is a choice. The first week is about narrowing it.',
    steps: [
      'Write what you want more of and less of in the next ten years.',
      'List three kinds of work that fit, including advisory, interim or part-time.',
      'Get your Market Reality Assessment to see where your experience is already wanted.',
    ],
  },
  'taking-a-break': {
    intro: 'Rest is fine. A small plan means the break ends when you decide it does.',
    steps: [
      'Pick the date you want to start looking. Put it on your calendar.',
      'Stay in touch with three people each month so the door stays open.',
      'Get your Market Reality Assessment now, so it is done when you are ready.',
    ],
  },
  'happy-with-fractional-work': {
    intro: 'Independent work runs on steady leads. The first week is about your pipeline.',
    steps: [
      'List your five best past clients and the one thing each hired you for.',
      'Ask two of them for an introduction to someone with the same problem.',
      'Get your Market Reality Assessment to see how a full-time role would read, as a backup.',
    ],
  },
  'building-something': {
    intro: 'Building is a job. The first week is about proof you can point to.',
    steps: [
      'Write three lines on what you built and what it achieved.',
      'Ask two people who have seen the work to write a short note on it.',
      'Get your Market Reality Assessment so your story reads clearly to employers too.',
    ],
  },
}

export function planFor(slug: string): FirstWeekPlan {
  return FIRST_WEEK_PLANS[slug] ?? DEFAULT_PLAN
}
