// One-off: give the sample alumni in the demo workspaces (washjeff, demo-one-louisville-*) a function and
// skills so the AI skills panel on the Outcomes tab has data. Only touches isSampleData profiles that
// have no function yet. Rerun-safe. Run: node --env-file=.env.local --import tsx scripts/backfill-demo-ai-skills.ts [--dry]
import { prisma } from '@/lib/prisma'
import { demoProfile } from '@/lib/higher-ed/demo-skills'

async function main() {
  const dry = process.argv.includes('--dry')
  const insts = await prisma.institution.findMany({ where: { isDemo: true, OR: [{ slug: 'washjeff' }, { slug: { startsWith: 'demo-one-louisville' } }] }, select: { id: true, slug: true } })
  for (const inst of insts) {
    const members = await prisma.institutionMember.findMany({
      where: { institutionId: inst.id, candidateId: { not: null }, candidate: { isSampleData: true, primaryFunction: null } },
      select: { candidateId: true },
      orderBy: { id: 'asc' },
    })
    console.log(inst.slug, 'profiles to update:', members.length)
    let i = 0
    for (const m of members) {
      const p = demoProfile(inst.slug, i++)
      if (!dry) await prisma.candidateProfile.update({ where: { id: m.candidateId! }, data: { primaryFunction: p.primaryFunction, resumeKeywords: p.resumeKeywords } })
    }
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
