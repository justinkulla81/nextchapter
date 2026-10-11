// Resets and seeds demo tenants from their fixtures
// (src/lib/higher-ed/demo-tenants.ts). Fictional members, staff and gifts,
// every row isSampleData. Same function the in-app "Reset demo data" runs.
//
//   npm run seed:he-demo              # every demo tenant
//   npm run seed:he-demo -- washjeff  # just one
import { prisma } from '../../src/lib/prisma'
import { resetDemoInstitution } from '../../src/lib/higher-ed/demo-seed'
import { DEMO_TENANTS } from '../../src/lib/higher-ed/demo-tenants'
import { seedDemoContent } from '../../src/lib/institution/admin'

async function main() {
  const wanted = process.argv.slice(2)
  const slugs = wanted.length ? wanted : Object.keys(DEMO_TENANTS)
  for (const slug of slugs) {
    const tenant = DEMO_TENANTS[slug]
    if (!tenant) throw new Error(`No demo fixture "${slug}". Known: ${Object.keys(DEMO_TENANTS).join(', ')}`)
    const result = await prisma.$transaction((tx) => resetDemoInstitution(tx, new Date(), tenant), { timeout: 120_000, maxWait: 20_000 })
    const sample = await seedDemoContent(result.institutionId, 'demo-seed')
    console.log(`Seeded /i/${slug}:`, { ...result, sampleJobs: sample.jobs, targetCompanies: sample.targets })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
