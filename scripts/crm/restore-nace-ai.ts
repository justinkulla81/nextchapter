/**
 * One-off: undoes the NACE / Nace.AI merge (they are different organizations).
 * The Nace.AI organization had no people, deals or activity when it was merged, so
 * it is recreated from the cleanup backup and relinked to its own Company record;
 * the NACE organization is unlinked from that Company.
 *
 *   node --env-file=.env.local --import tsx scripts/crm/restore-nace-ai.ts [--apply]
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const NACE_AI_ORG = 'cmc183a96c4c094ce091ab9e7486afdeb7'
const NACE_ORG = 'cmvfn2n73004kq223fzu0ralt'
const NACE_AI_COMPANY = 'cmv851nz90000jp0657yb4xh1'

async function main() {
  const backup = JSON.parse(readFileSync(`${process.env.HOME}/nc-dedupe-out3/backup-orgs.json`, 'utf8')) as Record<string, unknown>[]
  const old = backup.find((o) => o?.id === NACE_AI_ORG)
  if (!old) throw new Error('Nace.AI is not in the backup')
  const exists = await prisma.crmOrganization.findUnique({ where: { id: NACE_AI_ORG }, select: { id: true } })
  const nace = await prisma.crmOrganization.findUnique({ where: { id: NACE_ORG }, select: { name: true, companyId: true } })
  console.log(`Nace.AI organization ${exists ? 'already exists' : 'will be recreated'}; NACE currently linked to ${nace?.companyId ?? 'nothing'}`)
  if (!process.argv.includes('--apply')) return console.log('dry run: nothing written')
  if (!exists) {
    await prisma.crmOrganization.create({
      data: {
        id: NACE_AI_ORG, name: old.name as string, canonicalNameNormalized: old.canonicalNameNormalized as string,
        orgTypes: old.orgTypes as never, hiringClient: Boolean(old.hiringClient),
        createdAt: new Date(old.createdAt as string), companyId: NACE_AI_COMPANY, companyLinkState: 'ADMIN',
      },
    })
  }
  if (nace?.companyId === NACE_AI_COMPANY) await prisma.crmOrganization.update({ where: { id: NACE_ORG }, data: { companyId: null, companyLinkState: null } })
  console.log('done')
}
main().finally(() => prisma.$disconnect())
