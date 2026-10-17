// Adds the AI-skill catalog courses (src/lib/ai-skills/catalog-seed.ts) to the Course table.
// Safe to re-run: skips any (title, url) that already exists, so admin edits are never overwritten.
//
// Run: npm run seed:ai-skill-courses
import { PrismaClient } from '@prisma/client'
import { AI_SKILL_COURSE_SEEDS } from '../src/lib/ai-skills/catalog-seed'

const prisma = new PrismaClient()

async function main() {
  let created = 0
  let skipped = 0
  for (const [i, { expect: _expect, ...course }] of AI_SKILL_COURSE_SEEDS.entries()) {
    const existing = await prisma.course.findFirst({ where: { title: course.title, url: course.url } })
    if (existing) {
      skipped++
      continue
    }
    await prisma.course.create({ data: { ...course, category: 'AI_TRAINING', sortOrder: 100 + i } })
    created++
  }
  console.log(`Created ${created} courses, skipped ${skipped} already-existing courses.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
