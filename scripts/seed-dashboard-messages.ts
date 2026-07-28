// One-time seed script: creates the pinned "How NextChapter works" dashboard
// message plus a few starter rotation messages. Safe to re-run — skips any
// title that already exists instead of creating duplicates.
//
// Run: npm run seed:dashboard-messages

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MESSAGES: {
  title: string
  bullets: string[]
  footer?: string
  isPinned?: boolean
  sequenceOrder?: number
}[] = [
  {
    title: 'How NextChapter works',
    isPinned: true,
    bullets: [
      'Market Reality Grade — an honest read on where you stand today. This gets updated every week based on your Search Score, Learning, Working and Networking.',
      'Weekly Search Score — your grade for this week’s effort, earned one point at a time from real Search Actions.',
      'Weekly Search Sprint — the actions you commit to each week, shown right on this dashboard.',
      'Executive Dossier — a verified profile built from your references and work, that shows hiring managers what your resume can’t.',
    ],
    footer: "Start with this week's Sprint below — Victoria's here if you want to talk through it.",
  },
  // First-login education sequence (sequenceOrder 1-4) — shown in this
  // order right after the pinned message above, before the general
  // motivational rotation below. See getNextDashboardMessage.
  {
    title: 'One grade, updated every week',
    sequenceOrder: 1,
    bullets: [
      'Your Market Reality Grade is one number — not a snapshot frozen at signup.',
      'It updates weekly based on your Search Score, Learning, Working and Networking.',
    ],
    footer: 'Put in real work in any of those areas and the grade moves to reflect it.',
  },
  {
    title: 'Your Weekly Search Sprint, in plain terms',
    sequenceOrder: 2,
    bullets: [
      'Pick Search Actions worth points — 1 point = 1 minute of real effort.',
      "Hit this week's target and you earn an A for the week.",
      'You can set or change your commitment Sunday 12:01am through Monday 12:01pm PT — after that it locks for the week.',
      "Anything you complete outside your commitment still counts, in “More Actions Available.”",
    ],
    footer: 'Set this week’s goals from the Weekly Search Sprint card below.',
  },
  {
    title: 'The A-List and your Dossier',
    sequenceOrder: 3,
    bullets: [
      'Consistent A weeks build toward the private A-List — recognition only you and admins see.',
      "They also strengthen your Dossier, the reference-verified profile that shows what a résumé can't.",
    ],
    footer: 'The more consistent weeks you put together, the stronger both become.',
  },
  {
    title: "Victoria's in your corner",
    sequenceOrder: 4,
    bullets: [
      "She's your AI coach — daily check-ins, a chat that's always open, and she gets more direct the longer a search runs.",
      'If you ever want a human in the mix too, Executive Coach adds one on top of her — no pressure, it’s there when you want it.',
    ],
    footer: 'Say hi any time from the chat below.',
  },
  {
    title: "It's okay to have a slow week",
    bullets: [
      'Momentum matters more than any single day — a slow week doesn’t erase the ones before it.',
      'If you’re stuck, the smallest real action still counts — one message sent, one bullet rewritten.',
      'Check in with Victoria if you want help figuring out the next right move.',
    ],
  },
  {
    title: 'Your network is your fastest path',
    bullets: [
      'Warm outreach converts at a far higher rate than cold applications — most hires trace back to a real conversation.',
      'Aim for quality over volume: one genuine 10-minute check-in beats a mass message.',
      'Your Support Network page has scripts calibrated to how the conversation feels for you.',
    ],
  },
  {
    title: 'Small proof beats a perfect resume',
    bullets: [
      'Hiring managers trust what they can verify — a reference, a work sample, a real project — more than adjectives on a page.',
      'Building your Proof Assets is one of the highest-leverage things you can do this week.',
      'Even one strong reference materially changes how you show up in a Dossier.',
    ],
  },
]

async function main() {
  for (const message of MESSAGES) {
    const existing = await prisma.dashboardMessage.findFirst({ where: { title: message.title } })
    if (existing) {
      console.log(`Skipping "${message.title}" — already exists`)
      continue
    }
    await prisma.dashboardMessage.create({
      data: {
        title: message.title,
        bullets: message.bullets,
        footer: message.footer ?? null,
        isPinned: message.isPinned ?? false,
        sequenceOrder: message.sequenceOrder ?? null,
      },
    })
    console.log(`Created "${message.title}"`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
