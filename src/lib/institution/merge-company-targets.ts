import 'server-only'
import type { Prisma } from '@prisma/client'

/**
 * When two companies are merged, each college's target list follows the survivor.
 * Where a college already targets the survivor, the source's row is the duplicate
 * and is dropped. This only re-points rows; nothing is read out of an institution.
 * Lives here, with the other institution-scoped code, so a college's target list is
 * never touched from outside it (see src/test/company-wall.test.ts).
 */
export async function moveInstitutionTargets(tx: Prisma.TransactionClient, survivorId: string, sourceId: string): Promise<void> {
  const already = await tx.institutionTargetCompany.findMany({ where: { companyId: survivorId }, select: { institutionId: true } })
  for (const r of already) await tx.institutionTargetCompany.deleteMany({ where: { companyId: sourceId, institutionId: r.institutionId } })
  await tx.institutionTargetCompany.updateMany({ where: { companyId: sourceId }, data: { companyId: survivorId } })
}
