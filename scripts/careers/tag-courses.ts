// Tags catalog courses with the taxonomy skills they teach (whole-phrase match on the
// course's title, description and keywords; see src/lib/careers/course-tagging.ts).
// Re-runnable: AUTO tags are rebuilt each run, tags an admin added (source ADMIN) are kept.
// Run careers:import-onet first. Use --dry-run to print what would be tagged.
//
//   npm run careers:tag-courses -- [--dry-run]
import { prisma } from '../../src/lib/prisma'
import { tagCourse, type TaggableSkill } from '../../src/lib/careers/course-tagging'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const [courses, skillRows] = await Promise.all([
    prisma.course.findMany({ select: { id: true, title: true, description: true, keywords: true } }),
    prisma.skill.findMany({ where: { kind: { in: ['KNOWLEDGE', 'TECHNOLOGY'] } }, select: { id: true, name: true, kind: true } }),
  ])
  if (skillRows.length === 0) {
    console.error('No skills found. Run careers:import-onet first.')
    process.exit(1)
  }
  const skills = skillRows as TaggableSkill[]
  const names = new Map(skills.map((s) => [s.id, s.name]))

  const rows: { courseId: string; skillId: string; source: string }[] = []
  let tagged = 0
  for (const course of courses) {
    const ids = tagCourse(course, skills)
    if (ids.length > 0) tagged++
    for (const skillId of ids) rows.push({ courseId: course.id, skillId, source: 'AUTO' })
    if (dryRun && ids.length > 0) console.log(`${course.title}: ${ids.map((i) => names.get(i)).join(', ')}`)
  }
  console.log(`${tagged} of ${courses.length} courses tagged, ${rows.length} tags.`)
  if (dryRun) return

  await prisma.$transaction([
    prisma.courseSkill.deleteMany({ where: { source: 'AUTO' } }),
    prisma.courseSkill.createMany({ data: rows, skipDuplicates: true }),
  ])
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
