// Adds the AI learning paths from the AI-skills analysis (src/lib/learning/ai-course-tags.ts
// AI_LEARNING_PATHS: NIST AI RMF, IAPP AIGP, ISACA AAIA, and the tool paths by function — Copilot
// for finance, Power Automate for operations, Agentforce / Trailhead for sales) to the Course
// table. Safe to re-run: skips any url already there, so an admin's later edits stay.
//
//   node --env-file=.env.local --import tsx scripts/seed-ai-learning-paths.ts
import { PrismaClient } from '@prisma/client'
import { AI_LEARNING_PATHS } from '../src/lib/learning/ai-course-tags'

const prisma = new PrismaClient()

async function main() {
  let added = 0
  for (const p of AI_LEARNING_PATHS) {
    const exists = await prisma.course.findFirst({ where: { url: p.url }, select: { id: true } })
    if (exists) continue
    await prisma.course.create({
      data: {
        category: p.category,
        title: p.title,
        sponsor: p.sponsor,
        description: p.description,
        url: p.url,
        provider: p.provider,
        free: p.free,
        skillLevel: p.skillLevel,
        targetFunctions: p.targetFunctions ?? [],
        keywords: p.keywords ?? [],
      },
    })
    added++
  }
  console.log(`AI learning paths: ${added} added, ${AI_LEARNING_PATHS.length - added} already there`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
