// Vic's opening line for Job Search Daily — a written bank, not an LLM call
// (founder decision, 2026-10-07: no per-candidate metered cost for this
// email). Variety comes from the bank's size plus the JobSearchDailyItem log:
// a line shown to a candidate isn't eligible again for LINE_REPEAT_DAYS.
//
// Lines are grouped by the candidate's situation that morning, so the right
// note lands on the right day: a candidate who already locked in their A
// shouldn't be told to push, and one who's gone quiet shouldn't get a
// pep talk about momentum.
//
// Ids are permanent — they're stored in JobSearchDailyItem.itemKey. Edit a
// line's text freely; never reuse a retired id for a different line.

export type LineMood = 'ahead' | 'onPace' | 'behind' | 'quiet' | 'firstWeek' | 'monday' | 'friday' | 'any'

export interface VicLine {
  id: string
  mood: LineMood
  text: string
}

export const LINE_REPEAT_DAYS = 60

export const VIC_LINES: VicLine[] = [
  // ahead — this week's A is already locked
  {
    id: 'ahead-01',
    mood: 'ahead',
    text: "You've already earned this week's A. Anything you do now is compounding, not catching up.",
  },
  {
    id: 'ahead-02',
    mood: 'ahead',
    text: 'Your A is locked. Use the extra room for the conversation you keep putting off.',
  },
  {
    id: 'ahead-03',
    mood: 'ahead',
    text: "You're ahead of pace. This is the week to reach a little higher on who you contact.",
  },
  {
    id: 'ahead-04',
    mood: 'ahead',
    text: 'A is in the bag. The people who land fastest keep the habit going after the score stops counting.',
  },
  {
    id: 'ahead-05',
    mood: 'ahead',
    text: "You've done the work this week. One more warm intro would make it a great week, not just a good one.",
  },
  {
    id: 'ahead-06',
    mood: 'ahead',
    text: 'Ahead of plan. Spend ten minutes today thanking someone who helped. It pays back.',
  },
  {
    id: 'ahead-07',
    mood: 'ahead',
    text: "Strong week. Don't coast. Pick the one company you'd be proudest to join and get closer to it.",
  },
  {
    id: 'ahead-08',
    mood: 'ahead',
    text: 'Your score says you showed up. Now make sure the right people noticed.',
  },
  {
    id: 'ahead-09',
    mood: 'ahead',
    text: "You're past the bar for an A. The extra effort this week is what separates a fast search from a long one.",
  },
  {
    id: 'ahead-10',
    mood: 'ahead',
    text: 'Locked in. Use today to go deep on one opportunity instead of wide on ten.',
  },
  {
    id: 'ahead-11',
    mood: 'ahead',
    text: 'Great pace. Write down what worked this week so you can repeat it on purpose.',
  },
  {
    id: 'ahead-12',
    mood: 'ahead',
    text: "You've cleared the bar. The best searches stay in motion right up to the offer.",
  },

  // onPace — on track for an A, not there yet
  {
    id: 'pace-01',
    mood: 'onPace',
    text: "You're on pace. Three focused actions today keep it that way.",
  },
  {
    id: 'pace-02',
    mood: 'onPace',
    text: "Steady beats heroic. Do today's three and you stay on track for an A.",
  },
  {
    id: 'pace-03',
    mood: 'onPace',
    text: "Searches get won in the boring middle. You're in it, and you're doing it right.",
  },
  {
    id: 'pace-04',
    mood: 'onPace',
    text: 'Right on track. One real conversation today matters more than ten applications.',
  },
  {
    id: 'pace-05',
    mood: 'onPace',
    text: "You're where you need to be. Keep the streak alive and the week takes care of itself.",
  },
  {
    id: 'pace-06',
    mood: 'onPace',
    text: 'Good rhythm. Protect one hour today for the work that actually moves your search.',
  },
  {
    id: 'pace-07',
    mood: 'onPace',
    text: "You're on pace for an A. The follow-up you send today is the one most people never send.",
  },
  {
    id: 'pace-08',
    mood: 'onPace',
    text: "Solid week so far. Pick the hardest of today's three and do it first.",
  },
  {
    id: 'pace-09',
    mood: 'onPace',
    text: 'Momentum is real. Two more conversations this week puts you ahead of most people at your level.',
  },
  {
    id: 'pace-10',
    mood: 'onPace',
    text: "You're tracking well. Make today about quality: one tailored note beats five generic ones.",
  },
  {
    id: 'pace-11',
    mood: 'onPace',
    text: "On track. The consistency you're building is exactly what hiring managers can feel.",
  },
  {
    id: 'pace-12',
    mood: 'onPace',
    text: 'Keep going. Nobody gets hired on their best day. They get hired on their tenth steady one.',
  },
  {
    id: 'pace-13',
    mood: 'onPace',
    text: "You're doing the reps. Today, make one of them a reach.",
  },
  {
    id: 'pace-14',
    mood: 'onPace',
    text: "Right where you should be. Finish today's list before lunch and the afternoon is yours.",
  },

  // behind — needs points to get an A this week
  {
    id: 'behind-01',
    mood: 'behind',
    text: "You're behind this week, and that's fixable. Today's three are the shortest path back.",
  },
  {
    id: 'behind-02',
    mood: 'behind',
    text: 'One strong day changes the week. Start with the easiest action and build from there.',
  },
  {
    id: 'behind-03',
    mood: 'behind',
    text: "There's still time for an A. Pick the action worth the most points and do it first.",
  },
  {
    id: 'behind-04',
    mood: 'behind',
    text: 'Behind is not out. Twenty focused minutes now beats a perfect plan later.',
  },
  {
    id: 'behind-05',
    mood: 'behind',
    text: "The week isn't over. Send one message to someone who already likes you. Start there.",
  },
  {
    id: 'behind-06',
    mood: 'behind',
    text: "You don't need a better plan. You need the next ten minutes. Open today's first action.",
  },
  {
    id: 'behind-07',
    mood: 'behind',
    text: 'Catching up is easier than it looks. Most of the points are in the first action you take.',
  },
  {
    id: 'behind-08',
    mood: 'behind',
    text: "Slow week so far. That's information, not judgment. Today is a clean start.",
  },
  {
    id: 'behind-09',
    mood: 'behind',
    text: 'An A is still on the table. Three actions today gets you most of the way there.',
  },
  {
    id: 'behind-10',
    mood: 'behind',
    text: "Don't try to make up the whole week today. Just win today.",
  },
  {
    id: 'behind-11',
    mood: 'behind',
    text: 'Pick one thing below, set a timer for fifteen minutes, and go. Momentum follows action.',
  },
  {
    id: 'behind-12',
    mood: 'behind',
    text: "You're closer than the number says. Every conversation counts double this late in the week.",
  },

  // quiet — no check-in in 3+ days
  {
    id: 'quiet-01',
    mood: 'quiet',
    text: "It's been a few days. No catching up needed. Do one small thing today and we restart.",
  },
  {
    id: 'quiet-02',
    mood: 'quiet',
    text: 'Searches have quiet stretches. The way out is one five-minute action, not a big comeback.',
  },
  {
    id: 'quiet-03',
    mood: 'quiet',
    text: "Haven't seen you in a few days. Pick the smallest thing below. That's the whole job today.",
  },
  {
    id: 'quiet-04',
    mood: 'quiet',
    text: 'Stepping back is allowed. Stepping back in takes one message. Send it today.',
  },
  {
    id: 'quiet-05',
    mood: 'quiet',
    text: "You don't owe anyone a streak. You just need a next step. Here's one.",
  },
  {
    id: 'quiet-06',
    mood: 'quiet',
    text: "A few quiet days doesn't undo the work you've done. Pick up where you left off.",
  },
  {
    id: 'quiet-07',
    mood: 'quiet',
    text: 'Restart small: reply to one email, or open one job below. That counts.',
  },
  {
    id: 'quiet-08',
    mood: 'quiet',
    text: "When a search stalls, the fix is almost never more effort. It's one easy win. Start there.",
  },
  {
    id: 'quiet-09',
    mood: 'quiet',
    text: 'The market kept moving while you were away, and some of it is good news for you. Take a look.',
  },
  {
    id: 'quiet-10',
    mood: 'quiet',
    text: "Welcome back, whenever today is. One thing, five minutes, and you're back in it.",
  },

  // firstWeek — candidate's first week on NextChapter
  {
    id: 'first-01',
    mood: 'firstWeek',
    text: "First week. Don't try to do everything. Get your foundation right and the rest gets easier.",
  },
  {
    id: 'first-02',
    mood: 'firstWeek',
    text: 'Week one is about setup, not results. Every hour you put in now saves three later.',
  },
  {
    id: 'first-03',
    mood: 'firstWeek',
    text: 'Welcome in. The people who land fastest treat this like a job with a daily schedule. Start yours today.',
  },
  {
    id: 'first-04',
    mood: 'firstWeek',
    text: "You're building the machine this week. Next week it starts working for you.",
  },
  {
    id: 'first-05',
    mood: 'firstWeek',
    text: 'Early days. Write down the five companies you most want to work for. Everything else gets easier.',
  },
  {
    id: 'first-06',
    mood: 'firstWeek',
    text: "Good start. Your network is bigger than you think. This week you'll see it.",
  },
  {
    id: 'first-07',
    mood: 'firstWeek',
    text: "First week done right means a clear story, a clean profile, and a short list. That's it.",
  },

  // monday
  {
    id: 'mon-01',
    mood: 'monday',
    text: 'New week, clean slate. Decide today what a great Friday looks like.',
  },
  {
    id: 'mon-02',
    mood: 'monday',
    text: 'Monday sets the week. Book one conversation today and the rest of the week has an anchor.',
  },
  {
    id: 'mon-03',
    mood: 'monday',
    text: "Fresh week. Last week's score doesn't count anymore, and neither do last week's excuses.",
  },
  {
    id: 'mon-04',
    mood: 'monday',
    text: 'Start the week with the action you most want to avoid. Everything after it is easier.',
  },
  {
    id: 'mon-05',
    mood: 'monday',
    text: 'Hiring managers clear their inboxes on Monday. Good day to land in one.',
  },
  {
    id: 'mon-06',
    mood: 'monday',
    text: 'A strong Monday is half the week. Knock out your three before noon.',
  },
  {
    id: 'mon-07',
    mood: 'monday',
    text: 'New week. Pick one company to go deep on and one person to reconnect with.',
  },
  {
    id: 'mon-08',
    mood: 'monday',
    text: "Monday. You know what to do. Here's what's new since Friday.",
  },

  // friday
  {
    id: 'fri-01',
    mood: 'friday',
    text: 'Friday. Close out the week strong. One follow-up now means a reply on Monday.',
  },
  {
    id: 'fri-02',
    mood: 'friday',
    text: 'Last workday of the week. Send the note you drafted on Tuesday.',
  },
  {
    id: 'fri-03',
    mood: 'friday',
    text: "Friday's a good day for warm outreach. People are lighter and more likely to reply.",
  },
  {
    id: 'fri-04',
    mood: 'friday',
    text: 'Finish the week on purpose. Thank one person who helped you this week.',
  },
  {
    id: 'fri-05',
    mood: 'friday',
    text: 'End of the week. Look back at what worked and do more of it next week.',
  },
  {
    id: 'fri-06',
    mood: 'friday',
    text: 'Friday push: the actions you take today are the conversations you have next week.',
  },

  // any — fits every day and every situation
  {
    id: 'any-01',
    mood: 'any',
    text: 'Most jobs at your level are filled through someone who knows someone. Be the someone people know.',
  },
  {
    id: 'any-02',
    mood: 'any',
    text: 'The market is moving every day. Today you get to move with it.',
  },
  {
    id: 'any-03',
    mood: 'any',
    text: 'Clarity is a competitive advantage. Know exactly what you want, and say it the same way every time.',
  },
  {
    id: 'any-04',
    mood: 'any',
    text: 'Rejections are data. Silence is data. Keep collecting, keep adjusting.',
  },
  {
    id: 'any-05',
    mood: 'any',
    text: "You're not looking for any job. You're looking for the right one. That takes focus, not volume.",
  },
  {
    id: 'any-06',
    mood: 'any',
    text: 'A short, specific ask gets a yes far more often than a long, vague one.',
  },
  {
    id: 'any-07',
    mood: 'any',
    text: 'The best time to follow up was yesterday. The second best is today.',
  },
  {
    id: 'any-08',
    mood: 'any',
    text: "People want to help. Make it easy: tell them exactly what you're looking for.",
  },
  {
    id: 'any-09',
    mood: 'any',
    text: "Your next role is probably one conversation away. You just don't know which one yet.",
  },
  {
    id: 'any-10',
    mood: 'any',
    text: 'Small daily actions beat big weekly sprints. Every time.',
  },
  {
    id: 'any-11',
    mood: 'any',
    text: 'Treat your search like your best project: clear goal, daily progress, honest review.',
  },
  {
    id: 'any-12',
    mood: 'any',
    text: 'Warm intros convert several times better than cold applications. Spend your time accordingly.',
  },
  {
    id: 'any-13',
    mood: 'any',
    text: "Confidence isn't a feeling you wait for. It's what shows up after you take the action.",
  },
  {
    id: 'any-14',
    mood: 'any',
    text: 'Every company below has a person who decides. Find the person, not just the posting.',
  },
  {
    id: 'any-15',
    mood: 'any',
    text: 'A good search is mostly follow-up. Nobody remembers the first email. They remember the third.',
  },
  {
    id: 'any-16',
    mood: 'any',
    text: 'Be easy to say yes to: a clear story, a specific ask, and a fast reply.',
  },
  {
    id: 'any-17',
    mood: 'any',
    text: "Layoffs elsewhere mean opportunities to reach out. Someone's network just got a lot more open.",
  },
  {
    id: 'any-18',
    mood: 'any',
    text: "Pick the one action today you'd be glad you did a month from now.",
  },
  {
    id: 'any-19',
    mood: 'any',
    text: 'Your experience is the product. Today, sharpen how you describe it.',
  },
  {
    id: 'any-20',
    mood: 'any',
    text: 'Searches feel slow from the inside. From the outside, steady effort looks like someone worth hiring.',
  },
  {
    id: 'any-21',
    mood: 'any',
    text: 'The right role usually shows up through a side door. Keep a lot of doors open.',
  },
  {
    id: 'any-22',
    mood: 'any',
    text: "You've solved harder problems than this. Bring that same discipline to today.",
  },
  {
    id: 'any-23',
    mood: 'any',
    text: 'Do the work in front of you, then ask for help with the rest.',
  },
  {
    id: 'any-24',
    mood: 'any',
    text: 'Every no gets you closer to the right yes. Keep the numbers moving.',
  },
  {
    id: 'any-25',
    mood: 'any',
    text: 'Today: one application you mean, one conversation you start, one thing you learn.',
  },
  {
    id: 'any-26',
    mood: 'any',
    text: 'Hiring is a people business. Spend more of today on people than on postings.',
  },
  {
    id: 'any-27',
    mood: 'any',
    text: 'Be specific about what you want. Vague searches stay vague.',
  },
  {
    id: 'any-28',
    mood: 'any',
    text: 'Reach out before you feel ready. Nobody ever does.',
  },
  {
    id: 'any-29',
    mood: 'any',
    text: "Progress isn't always visible. Do the work anyway. It adds up.",
  },
  {
    id: 'any-30',
    mood: 'any',
    text: "The candidates who win aren't always the most qualified. They're the most prepared and the most persistent.",
  },
]

const MOOD_SHARE = 0.75 // how often a situational line wins over a general one when both are available

// Deterministic per candidate per day (a re-run of the cron the same morning
// picks the same line), but different across candidates and days. Situation
// lines come first; general lines fill in when a situation's bank has been
// used up inside the repeat window.
export function pickVicLine(moods: LineMood[], recentlyShownIds: Set<string>, seed: string): VicLine {
  const rand = seededRandom(seed)
  const situational = VIC_LINES.filter((l) => moods.includes(l.mood) && !recentlyShownIds.has(l.id))
  const general = VIC_LINES.filter((l) => l.mood === 'any' && !recentlyShownIds.has(l.id))

  const pool =
    situational.length > 0 && (general.length === 0 || rand() < MOOD_SHARE)
      ? situational
      : general.length > 0
        ? general
        : // Every eligible line used inside the window — only possible for
          // a candidate receiving this daily for months. Fall back to the
          // whole bank rather than sending nothing.
          VIC_LINES.filter((l) => moods.includes(l.mood) || l.mood === 'any')

  return pool[Math.floor(rand() * pool.length)]
}

function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
