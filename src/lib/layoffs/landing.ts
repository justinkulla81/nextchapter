// The shared top of every company layoff, buyout and "changes at" page: the situation questions, the plain headline,
// the search-time facts and the rotating coach photo. Pure data and small helpers, so the page, the dev preview and the tests read the same thing.

export type LandingVariant = 'layoff' | 'buyout' | 'neither'

export interface Q1Answer {
  key: string
  label: string
  hint: string
  /** The journey (src/lib/constants/personas.ts) the answer starts. */
  persona: 'laid-off' | 'thinking-about-a-move' | 'managing-my-career'
  tone: 'sun' | 'mint' | 'sky' | 'plum'
  heading: string
  bullets: string[]
  /** A box under the bullets (buyout and unemployment). */
  note?: string
  cta: string
}

export const Q1: Record<LandingVariant, Q1Answer[]> = {
  layoff: [
    { key: 'laid-off', label: 'I was laid off', hint: 'This week or recently', persona: 'laid-off', tone: 'sun',
      heading: 'Take the first week one step at a time.',
      bullets: ['File for unemployment in the state where you worked, in your first week.', 'Ask in writing about severance, health coverage and your last day.', 'Tell three people you trust that you are looking, with the kind of role you want.'],
      cta: 'Email me my first-week plan' },
    { key: 'leaving', label: 'Not laid off, thinking of leaving', hint: 'Looking around', persona: 'thinking-about-a-move', tone: 'sky',
      heading: 'Moving before the crowd does is an advantage.',
      bullets: ['Look at what peers are hiring for now, and what they pay.', 'Line up references and a short answer to why you are moving.', 'Keep your résumé within an hour of ready.'],
      cta: 'Email me a plan for moving' },
    { key: 'staying', label: 'Not laid off, staying', hint: 'Planning ahead', persona: 'managing-my-career', tone: 'plum',
      heading: 'Good. Planning ahead is the quiet advantage.',
      bullets: ['Know your market value in case things change.', 'Keep your résumé and your list of wins current.', 'Get alerts when your team or peers change.'],
      cta: 'Email me career alerts and a plan' },
  ],
  buyout: [
    { key: 'offered', label: 'I was offered a buyout, or I am taking it', hint: 'Offered, deciding or accepted', persona: 'laid-off', tone: 'sun',
      heading: 'Before you answer, get it in writing.',
      bullets: ['Ask for the full terms and the date you must answer.', 'Ask how health coverage and equity are treated.', 'Ask whether accepting counts as quitting or as a layoff for unemployment benefits.'],
      note: 'Buyouts and unemployment depend on your state. In many states a voluntary package can be treated as quitting, which can affect benefits. A package offered in place of a layoff is often treated differently. Check your state agency’s rules before you sign.',
      cta: 'Email me my first-week plan' },
    { key: 'offered-stay', label: 'I was offered a buyout and I am staying', hint: 'Declining or not sure yet', persona: 'managing-my-career', tone: 'mint',
      heading: 'Staying is a real choice. Keep your options warm.',
      bullets: ['Update your profile while nothing is at stake.', 'See what peers are hiring for, so you know your market value.', 'Ask what happens to your role if many colleagues accept.'],
      cta: 'Email me a plan for staying ready' },
    { key: 'leaving', label: 'No buyout, and I am thinking of leaving', hint: 'Looking around', persona: 'thinking-about-a-move', tone: 'sky',
      heading: 'Move before the crowd does.',
      bullets: ['If many people take offers, the market gets busier. Starting now puts you ahead of them.', 'Look at peers hiring now and what they pay.', 'Line up your references and a short story about why you are moving.'],
      cta: 'Email me my first-week plan' },
    { key: 'staying', label: 'No buyout, and I am staying', hint: 'Happy here, planning ahead', persona: 'managing-my-career', tone: 'plum',
      heading: 'Good. Planning ahead is the quiet advantage.',
      bullets: ['Know your market value in case things change.', 'Keep your résumé within an hour of ready.', 'Get alerts when your team or peers change.'],
      cta: 'Email me career alerts and a plan' },
  ],
  neither: [
    { key: 'let-go', label: 'I was let go', hint: 'Recently', persona: 'laid-off', tone: 'sun',
      heading: 'Take the first week one step at a time.',
      bullets: ['File for unemployment in the state where you worked, in your first week.', 'Ask in writing about pay owed, health coverage and your last day.', 'Tell three people you trust that you are looking.'],
      cta: 'Email me my first-week plan' },
    { key: 'leaving', label: 'Thinking of leaving', hint: 'Looking around', persona: 'thinking-about-a-move', tone: 'sky',
      heading: 'Looking while you have a job is the strongest place to look from.',
      bullets: ['See what peers are hiring for now, and what they pay.', 'Line up references and a short answer to why you are moving.', 'Keep your résumé within an hour of ready.'],
      cta: 'Email me a plan for moving' },
    { key: 'staying', label: 'Happily staying', hint: 'Planning ahead', persona: 'managing-my-career', tone: 'plum',
      heading: 'Good. Planning ahead is the quiet advantage.',
      bullets: ['Know your market value in case things change.', 'Keep your résumé and your list of wins current.', 'Get alerts when your team or peers change.'],
      cta: 'Email me career alerts and a plan' },
  ],
}

export interface Q2Answer { key: 'field' | 'pivot' | 'school' | 'move'; label: string; hint: string; tone: 'sun' | 'mint' | 'sky' | 'plum'; heading: string; text: string }
export const Q2: Q2Answer[] = [
  { key: 'field', label: 'Stay in my field', hint: 'A better seat in the same work', tone: 'sky', heading: 'A better seat in the same work.', text: 'We will match jobs in your line of work and show how your pay compares.' },
  { key: 'pivot', label: 'Pivot to something new', hint: 'A different kind of work', tone: 'plum', heading: 'Your skills travel further than your title.', text: 'We will show which fields use what you already do, and what the gap is.' },
  { key: 'school', label: 'Go back to school or retrain', hint: 'A degree, certificate or course', tone: 'sky', heading: 'Which school?', text: 'Type your college. We take you to its page and list you with its alumni.' },
  { key: 'move', label: 'Move somewhere new', hint: 'A different city or state', tone: 'mint', heading: 'A new place can change the whole picture.', text: 'We will compare cost of living, pay and openings in the places you pick.' },
]

export interface Q3Answer { key: 'market' | 'ai' | 'network' | 'coach'; label: string; hint: string; title: string; text: string }
export const Q3: Q3Answer[] = [
  { key: 'market', label: 'See where I stand in the market', hint: 'Market reality check', title: 'Market reality check', text: 'How your experience matches what employers are hiring for, the jobs open near you, and your pay range.' },
  { key: 'ai', label: 'I worry my skills or AI will leave me behind', hint: 'Skills and AI check', title: 'Skills and AI check', text: 'Which of your skills AI is changing, which hold their value, and the shortest courses to close a gap.' },
  { key: 'network', label: 'Help with networking', hint: 'Who to reach and what to say', title: 'Networking help', text: 'People at the companies you want, who you already know there, and a short note to send each one.' },
  { key: 'coach', label: 'Talk to a coach', hint: 'One-to-one help with my plan', title: 'A session with a coach', text: 'One-to-one time to sort out your plan, your story and your next three moves.' },
]

/** Plain headlines: what happened and what the reader can do. No alarm, no vague lines. */
export function landingHeadline(variant: LandingVariant, name: string, latestWorkers: number | null, hasNotices = true): string {
  if (variant === 'buyout') return `${name} is offering buyouts. Here is how to decide, and what to do either way.`
  if (variant === 'layoff') {
    if (!hasNotices) return `${name} layoffs have been reported. Here is what to do this week.`
    return `${name} filed layoffs${latestWorkers ? ` for ${latestWorkers.toLocaleString('en-US')} workers` : ''}. Here is what to do this week.`
  }
  return `Thinking about your next move from ${name}? Start by seeing what is out there.`
}

/** Which version of the page a company gets: a recent buyout announcement wins, then any layoff or WARN notice, otherwise neither. */
export function landingVariant(o: { hasRecentBuyout: boolean; hasNoticesOrLayoffReport: boolean }): LandingVariant {
  if (o.hasRecentBuyout) return 'buyout'
  return o.hasNoticesOrLayoffReport ? 'layoff' : 'neither'
}

export type PhotoPerson = 'vic' | 'chris' | 'sarah'
export interface PagePhoto { src: string; alt: string; who: PhotoPerson }

/** The pictures on the company pages, alternating Vic with the site's two story personas (Chris and Sarah, shown without names: they are
 *  fictional, not members). All warm and candid. chris-home-office.webp is left out on purpose: he reads tense, and the page is not meant to. */
export const PAGE_PHOTOS: readonly PagePhoto[] = [
  { who: 'vic', src: '/marketing/vic-office-charcoal.webp', alt: 'A woman laughing in an open-plan office' },
  { who: 'chris', src: '/marketing/chris-coffee-shop.webp', alt: 'A man smiling as he talks with someone over a laptop in a café' },
  { who: 'vic', src: '/marketing/vic-conference-room.webp', alt: 'A woman in a green cardigan in a glass conference room' },
  { who: 'sarah', src: '/marketing/sarah-kitchen-laptop.webp', alt: 'A woman smiling at her laptop at a kitchen counter, notebook beside her' },
  { who: 'vic', src: '/marketing/vic-desk-burgundy.webp', alt: 'A woman in a burgundy blazer at her desk' },
  { who: 'chris', src: '/marketing/chris-interview-ready.webp', alt: 'A man in a grey blazer walking through an office lobby with a folder' },
  { who: 'vic', src: '/marketing/vic-hallway.webp', alt: 'A woman in a grey blazer in an office hallway' },
  { who: 'sarah', src: '/marketing/sarah-walking-outside.webp', alt: 'A woman laughing as she walks down a city street with a coffee' },
  { who: 'vic', src: '/marketing/vic-video-call.webp', alt: 'A woman on a video call in a home office' },
  { who: 'sarah', src: '/marketing/sarah-conference-room.webp', alt: 'A woman in a cream blazer smiling in a glass conference room' },
  { who: 'vic', src: '/marketing/vic-coffee-chat.webp', alt: 'A woman talking over coffee in a café' },
  { who: 'chris', src: '/marketing/chris-office-laugh.webp', alt: 'A man in a green shirt laughing with a coworker in a bright office' },
  { who: 'sarah', src: '/marketing/sarah-coworking.webp', alt: 'A woman in a mustard cardigan smiling as she talks at a shared table in a coworking space' },
]

/** A stable pick from a company slug (a simple string hash), so no flicker and the same picture for search engines. */
export function pickPagePhoto(slug: string): PagePhoto {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return PAGE_PHOTOS[h % PAGE_PHOTOS.length]
}

/** Federal figures on people who were unemployed in September 2026 (BLS, not seasonally adjusted; NextChapter calculation from Census CPS).
 *  Spells in progress: how long looking has taken so far, not how long it takes to find work. */
export const SEARCH_TIME_FACTS = {
  asOf: 'September 2026',
  averageWeeksAll: 25.4,
  averageWeeks5564: 34.9,
  share27PlusWeeks5564: 31,
  source: 'BLS, September 2026, not seasonally adjusted; NextChapter calculation from Census CPS.',
} as const
