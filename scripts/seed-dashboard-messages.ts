// One-time seed script: creates the pinned "How NextChapter works" dashboard
// message plus a few starter rotation messages. Safe to re-run — skips any
// title that already exists instead of creating duplicates.
//
// Run: npm run seed:dashboard-messages

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MESSAGES: { title: string; bullets: string[]; footer?: string; isPinned?: boolean }[] = [
  {
    title: 'How NextChapter works',
    isPinned: true,
    bullets: [
      'Market Reality Grade — an honest read on where you stand today. It moves only when you re-assess, not from weekly activity.',
      'Weekly Search Score — your grade for this week’s effort, earned one point at a time from real Search Actions.',
      'Weekly Search Sprint — the actions you commit to each week, shown right on this dashboard.',
      'Dossier — a verified profile built from your references and work, that shows hiring managers what your resume can’t.',
    ],
    footer: "Start with this week's Sprint below — Victoria's here if you want to talk through it.",
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
