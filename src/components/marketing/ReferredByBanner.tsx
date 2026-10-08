import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { REFERRAL_COOKIE } from '@/lib/candidates/referral'

// "Referred by Jason Nickell, Summit Search" — shown when the visitor arrived
// through someone's referral link (nc_ref cookie, set by /api/r/<code>).
// Renders nothing for no cookie, an unknown code, or a switched-off link.
export async function ReferredByBanner() {
  const code = (await cookies()).get(REFERRAL_COOKIE)?.value
  if (!code) return null
  const link = await prisma.referralLink.findUnique({
    where: { code },
    select: {
      isActive: true,
      label: true,
      ownerCrmPerson: {
        select: {
          fullName: true,
          affiliations: { where: { isCurrent: true }, orderBy: { isPrimary: 'desc' }, take: 1, select: { org: { select: { name: true } } } },
        },
      },
    },
  })
  if (!link?.isActive) return null
  const name = link.ownerCrmPerson?.fullName ?? link.label
  const org = link.ownerCrmPerson?.affiliations[0]?.org.name
  return (
    <div className="border-b bg-success/5 px-6 py-2.5 text-center text-sm">
      Referred by <strong>{name}</strong>
      {org ? <span className="text-muted-foreground">, {org}</span> : null}
    </div>
  )
}
