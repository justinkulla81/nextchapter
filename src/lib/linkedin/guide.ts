// The LinkedIn profile guide: one source for the public page (/resources/linkedin-profile), the member page (/dashboard/linkedin)
// and the weekly tip. Our own wording. Limits are LinkedIn's published ones; the rest is advice, and each item says why.

export const LINKEDIN_GUIDE_UPDATED = '2026-11-05'
export const LINKEDIN_GUIDE_PATH = '/resources/linkedin-profile'

export const HEADLINE_LIMIT = 220
export const ABOUT_LIMIT = 2600

export interface GuideCheck {
  id: string
  /** The thing to do, as an action. */
  title: string
  /** Why it matters, one sentence. */
  why: string
  /** Minutes it takes, rounded. */
  minutes: number
  group: 'found' | 'trusted' | 'seen' | 'reached'
}

export const GROUPS: { key: GuideCheck['group']; label: string; line: string }[] = [
  { key: 'found', label: 'Get found', line: 'Recruiters search by keyword. Say what they type.' },
  { key: 'trusted', label: 'Be believed', line: 'Proof beats adjectives.' },
  { key: 'seen', label: 'Stay visible', line: 'A few minutes a day beats one big post.' },
  { key: 'reached', label: 'Be easy to reach', line: 'Make the next step obvious.' },
]

export const CHECKS: GuideCheck[] = [
  { id: 'headline', group: 'found', minutes: 10, title: 'Replace the default headline', why: 'LinkedIn fills it with your last job title. That is the line shown beside your name in every search and comment, so it should say what you do and for whom.' },
  { id: 'keywords', group: 'found', minutes: 20, title: 'Put the words from your target jobs in four places', why: 'Search matches the words on your profile. Copy the repeated phrases from five postings you want, then use them in your headline, About, job descriptions and skills.' },
  { id: 'skills', group: 'found', minutes: 10, title: 'List at least five skills, then order them', why: 'Recruiters filter by skill. Lead with the ones the postings you want ask for, and tie each to a job in Experience.' },
  { id: 'url', group: 'found', minutes: 3, title: 'Claim a plain custom web address', why: 'Your name in the address reads cleaner on a résumé and in an email signature, and it is easier for people to find you by name.' },
  { id: 'location', group: 'found', minutes: 2, title: 'Set your location and industry to where you are looking', why: 'Recruiters filter by both. A stale city drops you from searches in the place you want to work.' },
  { id: 'about-hook', group: 'trusted', minutes: 20, title: 'Write an About that earns the “see more” click', why: 'Only the first few lines show before the fold. Open with the problem you solve or a result, not “Results-driven professional”.' },
  { id: 'numbers', group: 'trusted', minutes: 30, title: 'Add one number to each of your last three jobs', why: 'Revenue, time saved, people led, volume handled. A number is the quickest way to make a claim believable.' },
  { id: 'current', group: 'trusted', minutes: 10, title: 'Make title, dates and summary match your résumé', why: 'A hiring manager will open both. Differences read as carelessness or worse.' },
  { id: 'gap', group: 'trusted', minutes: 5, title: 'Name a gap or a layoff plainly, in one line', why: 'A blank stretch invites guesses. “Role eliminated in a company-wide reduction; now focused on X” answers the question before it is asked.' },
  { id: 'recommendations', group: 'trusted', minutes: 15, title: 'Ask two former colleagues for a recommendation', why: 'Someone else saying it is stronger than you saying it. Ask for one specific project so it does not come back generic.' },
  { id: 'photo', group: 'trusted', minutes: 10, title: 'Use a recent, clear headshot', why: 'It is the first thing people see and the thing that tells them the profile is current and yours.' },
  { id: 'featured', group: 'trusted', minutes: 10, title: 'Pin one piece of work in Featured', why: 'A deck, a write-up or a result gives a visitor something to look at besides your say-so.' },
  { id: 'comment', group: 'seen', minutes: 15, title: 'Leave three useful comments this week', why: 'A comment shows your name to the author’s whole audience, and to the right people for the cost of two sentences. It is the cheapest reach there is.' },
  { id: 'follow', group: 'seen', minutes: 10, title: 'Follow ten people and five companies in your target field', why: 'Your feed becomes a list of who is hiring, who is talking and what they care about.' },
  { id: 'post', group: 'seen', minutes: 30, title: 'Post once about something you did or learned', why: 'A short post about real work tells people what to ask you about. A few paragraphs is plenty.' },
  { id: 'contact', group: 'reached', minutes: 3, title: 'Put an email or phone number where non-connections can see it', why: 'If a recruiter cannot reach you without sending a request, many will move on to the next person.' },
  { id: 'open-to-work', group: 'reached', minutes: 5, title: 'Decide who sees you are looking, then set it on purpose', why: 'LinkedIn lets you tell recruiters only, or everyone with a photo frame. Pick the one that fits your situation, and check it is not showing to your current employer if you are still employed.' },
  { id: 'notes', group: 'reached', minutes: 10, title: 'Send three connection requests with a note', why: 'A line about why you are reaching out gets accepted more often than a blank request, and starts the conversation.' },
]

export const TOTAL_MINUTES = CHECKS.reduce((n, c) => n + c.minutes, 0)

export interface HeadlinePart { label: string; example: string; tone: 'sky' | 'sun' | 'mint' | 'plum' }

/** The headline formula, with a worked example. Used by the anatomy graphic. */
export const HEADLINE_PARTS: HeadlinePart[] = [
  { label: 'What you do', example: 'Finance director', tone: 'sky' },
  { label: 'For whom', example: 'mid-size manufacturers', tone: 'sun' },
  { label: 'Proof', example: 'cut close from 12 days to 5', tone: 'mint' },
  { label: 'Keywords', example: 'FP&A · forecasting · M&A integration', tone: 'plum' },
]

export interface RhythmDay { day: string; task: string; minutes: number }

/** Fifteen minutes a day. */
export const WEEK: RhythmDay[] = [
  { day: 'Mon', task: 'Follow three people in your field', minutes: 5 },
  { day: 'Tue', task: 'Comment on two posts', minutes: 10 },
  { day: 'Wed', task: 'Message one person you commented with', minutes: 10 },
  { day: 'Thu', task: 'Comment on one post by a company you want', minutes: 10 },
  { day: 'Fri', task: 'Post one short note about your work', minutes: 20 },
  { day: 'Sat', task: 'Rest', minutes: 0 },
  { day: 'Sun', task: 'Pick next week’s three people', minutes: 5 },
]

export const SKIP_LIST = [
  'More than one or two emoji in the headline',
  'Strings of buzzwords with no proof behind them',
  'Abbreviations a recruiter would not type',
  'Running the headline together with no separators (use “|” or “·”)',
  'Third person. It reads as someone else wrote your profile',
]

export const FAQ = [
  { q: 'How long can a LinkedIn headline be?', a: `${HEADLINE_LIMIT} characters. The first part is what shows in search results and beside your comments, so put the role and the proof first and the keywords after.` },
  { q: 'How long can the About section be?', a: `${ABOUT_LIMIT.toLocaleString('en-US')} characters, but only the first few lines show before “see more”. Put the hook there and the detail below.` },
  { q: 'Should I write my LinkedIn profile in first person?', a: 'Yes, for most people. It reads as you talking to a reader, which is what the page is for. Keep it plain and specific.' },
  { q: 'How many skills should I list?', a: 'LinkedIn allows up to 50. List at least five, put the ones your target jobs ask for first, and tie each to a role in Experience so it is backed by something.' },
  { q: 'Is it better to comment or to message a recruiter?', a: 'Do both, in that order. A thoughtful comment on something they posted makes your name familiar, so the message that follows is not cold.' },
  { q: 'How do I explain a layoff or a gap on LinkedIn?', a: 'In one plain line in your About or in the role itself: what happened, in neutral words, and what you are focused on now. Do not apologize or explain at length.' },
  { q: 'How often should I post?', a: 'Consistency matters more than volume. One short post a week and a few comments is a rhythm most people can keep while they search.' },
]

/** The tip that goes into the Tuesday email. The line is ours; the link goes to the guide. */
export const WEEKLY_TIP = {
  title: 'LinkedIn profile checklist: 18 checks, and why each one matters',
  summary: 'Four groups of checks you can do in any order, with the reason for each, and a 15-minutes-a-day plan for the week after.',
  url: `https://launchyournextchapter.com${LINKEDIN_GUIDE_PATH}`,
}
