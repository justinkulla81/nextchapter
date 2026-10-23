// "Be found": building public visibility before you need it. Static copy in two modes, chosen by
// confidentialSearchMode. Quiet is about the member's field and says nothing about a search; public
// can say they are looking. No statistics, no generated text. Pure: src/test/be-found.test.ts.

export type BeFoundMode = 'quiet' | 'public'
export type BeFoundStepKey = 'positioning' | 'linkedin' | 'podcasts' | 'speaking' | 'articles'

export interface BeFoundStep {
  key: BeFoundStepKey
  title: string
  body: string
  /** An existing page that helps with this step. Absent when there is none to send them to. */
  href?: string
  hrefLabel?: string
}

export interface BeFoundPlan {
  mode: BeFoundMode
  title: string
  intro: string
  why: { title: string; body: string }[]
  steps: BeFoundStep[]
  coach: { title: string; why: string; reason: 'brand' }
}

export const beFoundMode = (confidentialSearchMode: boolean): BeFoundMode => (confidentialSearchMode ? 'quiet' : 'public')

const WHY = [
  { title: 'It takes months', body: 'Visibility pays off slowly. What you start today is what people find in the spring.' },
  { title: 'Starting from a layoff is harder', body: 'You write, speak and get introduced better while you are not asking for anything.' },
  { title: 'The people who get called are already known', body: 'Search firms and boards reach for names they have seen. Make yours one of them.' },
]

export function beFoundPlan(mode: BeFoundMode): BeFoundPlan {
  const quiet = mode === 'quiet'
  return {
    mode,
    title: 'Build your name before you need it',
    intro: quiet
      ? 'Do it now, while you are still in your job. Everything here is about your field and your work. None of it mentions a search or signals that you are open to offers.'
      : 'Do it now. Everything here puts your name in front of the people who hire, advise and invite, and it works whether you are searching or not.',
    why: WHY,
    steps: [
      {
        key: 'positioning',
        title: 'Write your positioning in one line',
        body: quiet
          ? 'Who you help, with what, and the result. Written about your work, not about what you want next. Every other step uses it.'
          : 'Who you help, with what, and the result, plus what you want next. Every other step uses it.',
      },
      {
        key: 'linkedin',
        title: 'Rewrite LinkedIn for a board or search-firm reader',
        body: quiet
          ? 'Lead with scope, results and the kind of problems you solve. Leave the "open to work" signal off and keep the headline about what you do.'
          : 'Lead with scope, results and what you are looking for. Turn on the "open to work" signal for recruiters if you want it.',
        href: '/dashboard/linkedin',
        hrefLabel: 'Open LinkedIn',
      },
      {
        key: 'podcasts',
        title: 'Guest on podcasts, or host one',
        body: quiet ? 'Pick shows your peers and customers listen to. Pitch a topic from your field, with one story only you can tell.' : 'Pick shows your peers and hiring leaders listen to. Pitch a topic from your field, with one story only you can tell, and say what you are doing next.',
      },
      {
        key: 'speaking',
        title: 'Speak at conferences and on panels',
        body: quiet ? 'Offer a talk on your expertise to the conferences in your industry. Organizers want practitioners with a point of view.' : 'Offer a talk on your expertise to the conferences in your industry, and let organizers know you are available.',
      },
      {
        key: 'articles',
        title: 'Publish bylined articles',
        body: quiet ? 'One piece in a trade outlet or on LinkedIn about a problem in your field. Your name on it is what people remember.' : 'One piece in a trade outlet or on LinkedIn about a problem in your field. Your name on it is what people remember.',
      },
    ],
    coach: {
      reason: 'brand',
      title: 'Most people put this off. A coach gets it done.',
      why: 'A coach picks your angle, drafts the first posts with you, and gets you onto your first panel or podcast.',
    },
  }
}
