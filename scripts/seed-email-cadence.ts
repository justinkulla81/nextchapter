// One-time seed script: creates the 7 CandidateEmailSchedule rows (one per
// weekday) that drive the admin-editable email cadence. Send hours match
// today's vercel.json cron schedules exactly, so behavior is unchanged at
// cutover. Safe to re-run — skips any dayOfWeek that already has a row.
//
// Run: npm run seed:email-cadence

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SeedRow {
  dayOfWeek: number
  emailKey:
    | 'MORNING_MOTIVATION'
    | 'MARKET_UPDATE'
    | 'DAILY_NUDGE'
    | 'MIDWEEK_CHECKIN'
    | 'GAP_NUDGE'
    | 'COMMUNITY_DIGEST'
    | 'FINISH_LINE'
  title: string
  description: string
  sendHourUtc: number
}

const ROWS: SeedRow[] = [
  {
    dayOfWeek: 1,
    emailKey: 'MORNING_MOTIVATION',
    title: 'Morning Motivation',
    description: 'Kicks off the week — last week’s results, this week’s target.',
    sendHourUtc: 9,
  },
  {
    dayOfWeek: 2,
    emailKey: 'MARKET_UPDATE',
    title: 'Market Update',
    description: 'Job market stats + a curated research link.',
    sendHourUtc: 14,
  },
  {
    dayOfWeek: 3,
    emailKey: 'DAILY_NUDGE',
    title: 'Daily Nudge',
    description: 'A personalized one-thing-today nudge.',
    sendHourUtc: 13,
  },
  {
    dayOfWeek: 4,
    emailKey: 'MIDWEEK_CHECKIN',
    title: 'Midweek Check-in',
    description: 'A midweek encouragement + primary-action reminder.',
    sendHourUtc: 13,
  },
  {
    dayOfWeek: 5,
    emailKey: 'GAP_NUDGE',
    title: 'Close the Gap',
    description: 'How many points remain to lock in an A this week.',
    sendHourUtc: 21,
  },
  {
    dayOfWeek: 6,
    emailKey: 'COMMUNITY_DIGEST',
    title: 'Your Week in Review',
    description: 'Encouragement notes received + coaching activity recap.',
    sendHourUtc: 15,
  },
  {
    dayOfWeek: 0,
    emailKey: 'FINISH_LINE',
    title: 'Finish Line',
    description: 'Week-close-out recap — on pace for an A, or what it takes to still get there.',
    sendHourUtc: 13,
  },
]

async function main() {
  let created = 0
  let skipped = 0
  for (const row of ROWS) {
    const existing = await prisma.candidateEmailSchedule.findUnique({ where: { dayOfWeek: row.dayOfWeek } })
    if (existing) {
      skipped++
      continue
    }
    await prisma.candidateEmailSchedule.create({
      data: {
        dayOfWeek: row.dayOfWeek,
        emailKey: row.emailKey,
        title: row.title,
        description: row.description,
        sendHourUtc: row.sendHourUtc,
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
