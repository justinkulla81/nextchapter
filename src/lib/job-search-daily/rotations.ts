// The rotating parts of Job Search Daily besides Vic's line: one "unlock"
// nudge, one action button, one quote. Like lines.ts, ids are permanent
// (stored in JobSearchDailyItem.itemKey) — edit text freely, never reuse an
// id for different content.

export interface RotationContext {
  skillsAssessmentDone: boolean
  dossierUnlocked: boolean
  referencesMet: boolean
  gmailConnected: boolean
  recruiterDatabaseOptIn: boolean
  trackedCompanyCount: number
  checkedInToday: boolean
  hasOpenTodos: boolean
}

export interface UnlockNudge {
  id: string
  title: string
  detail: string
  path: string
  done?: (ctx: RotationContext) => boolean
}

// Things a candidate can unlock or try. Ones they've already finished are
// skipped; the rest rotate, and the same one can't come back for
// UNLOCK_REPEAT_DAYS.
export const UNLOCK_REPEAT_DAYS = 14

export const UNLOCK_NUDGES: UnlockNudge[] = [
  {
    id: 'skills-inventory',
    title: 'Take the Skills Inventory',
    detail: 'About 10 minutes. It sharpens which roles we match you to and shows where you stand out.',
    path: '/dashboard/skills-assessment',
    done: (c) => c.skillsAssessmentDone,
  },
  {
    id: 'learn-ai',
    title: 'Learn something new this week',
    detail: 'Working AI fluency is fast becoming table stakes in every function. Pick one short course.',
    path: '/dashboard/learning',
  },
  {
    id: 'interim-work',
    title: 'Look at interim and fractional work',
    detail: 'Fractional and interim roles keep your skills current, add income, and often turn into full-time offers.',
    path: '/dashboard/interim-work',
  },
  {
    id: 'board-roles',
    title: 'Explore board and advisory roles',
    detail: 'A board seat builds new experience and widens your network while you search.',
    path: '/dashboard/interim-work',
  },
  {
    id: 'references',
    title: 'Request a reference',
    detail: 'Even one or two real references raise your Market Reality Grade and help unlock your Executive Dossier.',
    path: '/dashboard/references',
    done: (c) => c.referencesMet,
  },
  {
    id: 'dossier',
    title: 'Unlock your Certified Executive Dossier',
    detail: 'It opens the A-list job board and gives recruiters a verified picture of you.',
    path: '/dashboard/recruiter-report',
    done: (c) => c.dossierUnlocked,
  },
  {
    id: 'gmail',
    title: 'Connect your email',
    detail: 'We track replies and follow-ups for you, so nobody falls through the cracks.',
    path: '/dashboard/network',
    done: (c) => c.gmailConnected,
  },
  {
    id: 'recruiter-db',
    title: 'Get seen by recruiters',
    detail: 'Opt into the recruiter database. Once you hold an A, search firms can find you.',
    path: '/dashboard/privacy',
    done: (c) => c.recruiterDatabaseOptIn,
  },
  {
    id: 'company-tracker',
    title: 'Add your target companies',
    detail: "Track 5 companies and we'll tell you the moment they post a role or their hiring changes.",
    path: '/dashboard/company-tracker',
    done: (c) => c.trackedCompanyCount >= 5,
  },
  {
    id: 'interview-prep',
    title: 'Practice one interview answer',
    detail: 'Five minutes of practice beats an hour of reading. Record one answer today.',
    path: '/dashboard/interview-prep',
  },
  {
    id: 'work-samples',
    title: 'Add a work sample',
    detail: 'One concrete example of your work makes every introduction easier.',
    path: '/dashboard/work-samples',
  },
  {
    id: 'track-record',
    title: 'Fill in your Track Record',
    detail: 'Your wins, in numbers. It feeds your Dossier and makes your story easy to repeat.',
    path: '/dashboard/track-record',
  },
  {
    id: 'webinars',
    title: 'Join a live session',
    detail: 'Short, practical sessions on searching at your level. Bring a question.',
    path: '/dashboard/webinars',
  },
]

export interface ActionButton {
  id: string
  label: string
  path: string
  relevant?: (ctx: RotationContext) => boolean
}

// The email's one big button. Rotates daily among the ones that make sense
// today; check-in leads whenever they haven't checked in yet.
export const ACTION_BUTTONS: ActionButton[] = [
  { id: 'check-in', label: 'Check in for today', path: '/dashboard', relevant: (c) => !c.checkedInToday },
  { id: 'sprint', label: "Start today's first action", path: '/dashboard/sprint', relevant: (c) => c.hasOpenTodos },
  { id: 'follow-ups', label: 'Clear my follow-ups', path: '/dashboard/network/follow-ups' },
  { id: 'jobs', label: 'Review new jobs', path: '/dashboard/find-my-job' },
  { id: 'log-conversation', label: 'Log a conversation', path: '/dashboard/network' },
  { id: 'add-company', label: 'Add a target company', path: '/dashboard/company-tracker' },
  { id: 'practice', label: 'Practice an interview answer', path: '/dashboard/interview-prep' },
  { id: 'learn', label: 'Learn something in 10 minutes', path: '/dashboard/learning' },
]

export interface Quote {
  id: string
  text: string
  author: string
}

// Widely documented quotes from well-known, non-political figures —
// athletes, artists, builders. Check attribution before adding to this list;
// a misquote in a daily email undercuts the whole thing.
export const QUOTE_REPEAT_DAYS = 120

export const QUOTES: Quote[] = [
  {
    id: 'jordan-01',
    author: 'Michael Jordan',
    text: "I've failed over and over and over again in my life. And that is why I succeed.",
  },
  { id: 'gretzky-01', author: 'Wayne Gretzky', text: "You miss 100% of the shots you don't take." },
  {
    id: 'kobe-01',
    author: 'Kobe Bryant',
    text: 'Everything negative — pressure, challenges — is all an opportunity for me to rise.',
  },
  {
    id: 'tiger-01',
    author: 'Tiger Woods',
    text: "No matter how good you get, you can always get better, and that's the exciting part.",
  },
  {
    id: 'serena-01',
    author: 'Serena Williams',
    text: 'I really think a champion is defined not by their wins but by how they can recover when they fall.',
  },
  { id: 'jobs-01', author: 'Steve Jobs', text: 'The only way to do great work is to love what you do.' },
  { id: 'angelou-01', author: 'Maya Angelou', text: 'You may encounter many defeats, but you must not be defeated.' },
  { id: 'ashe-01', author: 'Arthur Ashe', text: 'Start where you are. Use what you have. Do what you can.' },
  { id: 'wooden-01', author: 'John Wooden', text: 'Do not let what you cannot do interfere with what you can do.' },
  {
    id: 'lombardi-01',
    author: 'Vince Lombardi',
    text: "It's not whether you get knocked down, it's whether you get up.",
  },
  {
    id: 'jeter-01',
    author: 'Derek Jeter',
    text: "There may be people that have more talent than you, but there's no excuse for anyone to work harder than you do.",
  },
  { id: 'kingbj-01', author: 'Billie Jean King', text: 'Champions keep playing until they get it right.' },
  {
    id: 'biles-01',
    author: 'Simone Biles',
    text: "I'd rather regret the risks that didn't work out than the chances I didn't take at all.",
  },
  {
    id: 'blakely-01',
    author: 'Sara Blakely',
    text: "Don't be intimidated by what you don't know. That can be your greatest strength.",
  },
  {
    id: 'oprah-01',
    author: 'Oprah Winfrey',
    text: 'Doing the best at this moment puts you in the best place for the next moment.',
  },
  { id: 'ruth-01', author: 'Babe Ruth', text: "It's hard to beat a person who never gives up." },
  { id: 'disney-01', author: 'Walt Disney', text: 'The way to get started is to quit talking and begin doing.' },
  {
    id: 'hamm-01',
    author: 'Mia Hamm',
    text: 'The vision of a champion is someone who is bent over, drenched in sweat, at the point of exhaustion, when no one else is watching.',
  },
]
