/**
 * Renames one CRM organization and its normalized key.
 *   node --env-file=.env.local --import tsx scripts/crm/rename-org.ts <orgId> "<new name>" [--apply]
 */
import { PrismaClient } from '@prisma/client'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'

const prisma = new PrismaClient()
async function main() {
  const [id, name] = process.argv.slice(2)
  if (!id || !name) throw new Error('usage: rename-org.ts <orgId> "<new name>" [--apply]')
  const key = normalizeOrgName(name)
  const org = await prisma.crmOrganization.findUniqueOrThrow({ where: { id }, select: { name: true } })
  const taken = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: key }, select: { id: true } })
  if (taken && taken.id !== id) throw new Error(`"${name}" is already the name of another organization (${taken.id})`)
  console.log(`"${org.name}" -> "${name}" (key ${key})`)
  if (!process.argv.includes('--apply')) return console.log('dry run: nothing written')
  await prisma.crmOrganization.update({ where: { id }, data: { name, canonicalNameNormalized: key } })
  console.log('renamed')
}
main().finally(() => prisma.$disconnect())
