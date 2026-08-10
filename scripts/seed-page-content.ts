// One-time seed script: creates a starter "Why It Matters" and "Daily
// Message" row for every page in the sitewide 3-box header. Safe to re-run —
// skips any (pageKey, boxType, title) combo that already exists.
//
// Run: npm run seed:page-content

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SeedRow {
  pageKey: string
  boxType: 'DAILY_MESSAGE' | 'WHY_IT_MATTERS'
  title: string
  leadIn?: string
  bullets: string[]
  footer?: string
}

const ROWS: SeedRow[] = [
  {
    pageKey: 'dashboard',
    boxType: 'DAILY_MESSAGE',
    title: 'Welcome back',
    bullets: ["Check today's Sprint below and pick one thing to move forward."],
  },
  {
    pageKey: 'network',
    boxType: 'WHY_IT_MATTERS',
    title: 'Networking is the single best way to find a job',
    leadIn:
      "The people most likely to help you find your next role probably aren't your closest friends — they're the people you sort of know.",
    bullets: [
      "It's the highest-leverage work in your search — don't let it sit untouched.",
      "A real conversation moves a relationship further than any message.",
      'The people who already know you are your fastest path to a warm introduction.',
    ],
  },
  {
    pageKey: 'network',
    boxType: 'DAILY_MESSAGE',
    title: 'Start a conversation today',
    bullets: ['Even one outreach message keeps your search moving.'],
  },
  {
    pageKey: 'find-my-job',
    boxType: 'WHY_IT_MATTERS',
    title: 'Consistent searching is the job right now',
    leadIn: 'This is where the applications actually happen — the more relevant ones you send, the sooner you land.',
    bullets: [
      'Track every application here so nothing falls through the cracks.',
      'A negotiation ask is only useful once you have an offer to weigh it against.',
    ],
  },
  {
    pageKey: 'find-my-job',
    boxType: 'DAILY_MESSAGE',
    title: 'This is one of the most important things you can do',
    bullets: [
      "Check what's new, find roles that fit, and apply.",
      'Then see if anyone in your network can help you get in the door.',
    ],
  },
  {
    pageKey: 'resume',
    boxType: 'WHY_IT_MATTERS',
    title: 'A sharper resume gets you past the first screen',
    leadIn: 'Most recruiters spend seconds on a first pass — specific, evidence-backed bullets are what get a second look.',
    bullets: ['Keep it current every time you learn something new about your target role.'],
  },
  {
    pageKey: 'resume',
    boxType: 'DAILY_MESSAGE',
    title: 'Review your resume',
    bullets: ['A quick pass now saves you from a rushed edit later.'],
  },
  {
    pageKey: 'interview-prep',
    boxType: 'WHY_IT_MATTERS',
    title: "Interviews are hard to come by — don't screw it up",
    leadIn: 'Every interview is a limited opportunity, so preparation matters more than it feels like it should.',
    bullets: [
      'Practice out loud, not just in your head — it changes what you notice.',
      'A coach can meaningfully increase your odds if you get stuck here.',
    ],
  },
  {
    pageKey: 'interview-prep',
    boxType: 'DAILY_MESSAGE',
    title: 'Practice makes it automatic',
    bullets: ['Run through one behavioral question today.'],
  },
  {
    pageKey: 'marketing-plan',
    boxType: 'WHY_IT_MATTERS',
    title: 'Sharing more gets you noticed',
    leadIn: "You're the product right now — staying visible is how recruiters and your network see you're active before you ever apply.",
    bullets: ['Consistent posting shows up on your Executive Dossier as a real, visible signal, not a resume claim.'],
  },
  {
    pageKey: 'marketing-plan',
    boxType: 'DAILY_MESSAGE',
    title: 'Post something this week',
    bullets: ['Pick one idea, draft it, and make it sound like you.'],
  },
  {
    pageKey: 'learning',
    boxType: 'WHY_IT_MATTERS',
    title: 'A new skill keeps you relevant',
    leadIn: 'Learning new skills helps you stay competitive and current with what employers are actually asking for.',
    bullets: ['Even a small amount of consistent learning compounds over a search.'],
  },
  {
    pageKey: 'learning',
    boxType: 'DAILY_MESSAGE',
    title: 'Keep building',
    bullets: ['Spend 15 minutes on a module or a new tool today.'],
  },
  {
    pageKey: 'linkedin',
    boxType: 'WHY_IT_MATTERS',
    title: 'Recruiters check this before they ever call you',
    leadIn: 'Your LinkedIn profile is often the first real look someone gets at you beyond a resume.',
    bullets: ['Keep it consistent with your resume and your current target role.'],
  },
  {
    pageKey: 'linkedin',
    boxType: 'DAILY_MESSAGE',
    title: 'Polish your profile',
    bullets: ['A small edit today can make a real difference to how you show up in search.'],
  },
  {
    pageKey: 'interim-work',
    boxType: 'WHY_IT_MATTERS',
    title: 'Interim work fills the gap and keeps you sharp',
    leadIn: 'Fractional or interim work bridges the resume gap, gives you income while you search, and keeps you engaged and not rusty.',
    bullets: ['It also builds a real, current story to tell in interviews.'],
  },
  {
    pageKey: 'interim-work',
    boxType: 'DAILY_MESSAGE',
    title: 'Worth a look today',
    bullets: ['Browse listings even if you are not sure yet — it costs nothing to look.'],
  },
  {
    pageKey: 'work-samples',
    boxType: 'WHY_IT_MATTERS',
    title: 'Evidence beats claims',
    leadIn: 'Work samples differentiate you and back up what your resume says with something a hiring manager can actually see.',
    bullets: ['Pick the piece of work you are proudest of, not the most recent.'],
  },
  {
    pageKey: 'work-samples',
    boxType: 'DAILY_MESSAGE',
    title: 'Add a work sample',
    bullets: ['One strong example is worth more than several thin ones.'],
  },
  {
    pageKey: 'community',
    boxType: 'WHY_IT_MATTERS',
    title: "It's accountability, not a leaderboard",
    leadIn: 'Support Network keeps you engaged with other people going through the same search, not just tracking your own progress.',
    bullets: ['Helping someone else is often the fastest way to feel unstuck yourself.'],
  },
  {
    pageKey: 'community',
    boxType: 'DAILY_MESSAGE',
    title: 'Check in with the community',
    bullets: ['See what others are working through this week.'],
  },
  {
    pageKey: 'profile',
    boxType: 'WHY_IT_MATTERS',
    title: 'Personalization depends on this being accurate',
    leadIn: 'The right jobs and skills get matched to you based on what is confirmed here — an outdated profile means worse matches.',
    bullets: ['Takes a couple of minutes and pays off across the whole platform.'],
  },
  {
    pageKey: 'profile',
    boxType: 'DAILY_MESSAGE',
    title: 'Keep your profile current',
    bullets: ['Update anything that has changed since you last looked.'],
  },
  {
    pageKey: 'privacy',
    boxType: 'WHY_IT_MATTERS',
    title: "You control what employers see",
    leadIn: 'Your privacy tier decides exactly what is visible and when — nothing shows up without your say.',
    bullets: ['Revisit this any time your comfort level changes.'],
  },
  {
    pageKey: 'portfolio',
    boxType: 'WHY_IT_MATTERS',
    title: 'A place to point people that is more than a resume',
    leadIn: 'Your portfolio pulls together your narrative and work samples into something you can actually send someone.',
    bullets: ['Worth revisiting once you have added a new work sample or reference.'],
  },
  {
    pageKey: 'references',
    boxType: 'WHY_IT_MATTERS',
    title: 'Real testimony is one of the strongest signals a hiring manager sees',
    leadIn: 'A specific, credible reference carries more weight than almost anything else in your search.',
    bullets: ['Ask people who can speak to specifics, not just "great to work with."'],
  },
  {
    pageKey: 'skills-assessments',
    boxType: 'WHY_IT_MATTERS',
    title: 'These personalize everything else on the platform',
    leadIn: 'Your Job Recommendations, Skills Recommendations, and Hireability Report all read straight from these two quizzes.',
    bullets: [
      'How I Work Best drives coaching notes and how your fit is described to recruiters.',
      'Skills Assessment drives which jobs and courses get matched to you — keep it current.',
    ],
  },
  {
    pageKey: 'skills-assessments',
    boxType: 'DAILY_MESSAGE',
    title: 'Still accurate?',
    bullets: ['If your confidence in a skill has changed, retake the Skills Assessment — it only takes a few minutes.'],
  },
  {
    pageKey: 'search-strategy',
    boxType: 'WHY_IT_MATTERS',
    title: 'This is what everything else is aimed at',
    leadIn: 'Your target role, industries, and comp expectations here are what job matching, guidance, and coaching notes are calibrated against.',
    bullets: ['Revisit it whenever your situation or targets change — it is not a one-time form.'],
  },
  {
    pageKey: 'stats',
    boxType: 'WHY_IT_MATTERS',
    title: 'Progress you can actually see',
    leadIn: 'Your grade history and weekly points are the clearest read on whether your search is moving forward.',
    bullets: ['A flat week is useful information too — it is a prompt to change something, not just a number.'],
  },
  {
    pageKey: 'got-hired',
    boxType: 'WHY_IT_MATTERS',
    title: 'Tell us the moment it happens',
    leadIn: 'Claiming your Offer Bonus here is quick, and it helps us understand what is actually working across the platform.',
    bullets: ['We verify offer letters before paying out — have that ready.'],
  },
  {
    pageKey: 'benefits',
    boxType: 'WHY_IT_MATTERS',
    title: 'The money side matters as much as the job search',
    leadIn: 'Unemployment benefits, health coverage, and funded training programs have real deadlines — worth knowing before you need them.',
    bullets: ['Program details vary by state — use this as a starting point, not the final word.'],
  },
  {
    pageKey: 'support',
    boxType: 'WHY_IT_MATTERS',
    title: "You don't have to be in crisis to use this page",
    leadIn: 'A career transition is a real, recognized stressor on its own — this page is here whenever you want it, no strings attached.',
    bullets: ['Nothing here is triggered by your activity, and it never affects your grade.'],
  },
]

async function main() {
  let created = 0
  let skipped = 0
  for (const row of ROWS) {
    const existing = await prisma.pageContent.findFirst({
      where: { pageKey: row.pageKey, boxType: row.boxType, title: row.title },
    })
    if (existing) {
      skipped++
      continue
    }
    await prisma.pageContent.create({
      data: {
        pageKey: row.pageKey,
        boxType: row.boxType,
        title: row.title,
        leadIn: row.leadIn ?? null,
        bullets: row.bullets,
        footer: row.footer ?? null,
      },
    })
    created++
  }
  console.log(`Created ${created} rows, skipped ${skipped} already-existing rows.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
