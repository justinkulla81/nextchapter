import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { OrganizationWizard } from '@/components/admin/OrganizationWizard'

export const metadata = { title: 'New organization' }

// One place to create a customer and give it one or many portals, live or as a demo.
// Arriving from a won CRM deal (?crm=<id>) pre-fills the name and links the two.
export default async function NewOrganizationPage({ searchParams }: { searchParams: Promise<{ crm?: string }> }) {
  await requireAdmin()
  const { crm: crmId } = await searchParams
  const crm = crmId
    ? await prisma.crmOrganization.findUnique({ where: { id: crmId }, select: { id: true, name: true, website: true, emailDomain: true } })
    : null
  const domain = crm?.emailDomain ?? (crm?.website ? crm.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null)
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New organization</h1>
        <p className="mt-1 text-muted-foreground">
          Create a customer, choose the portals it gets, brand it, and make it live or a demo with sample data.
          {crm && <> Linked to the CRM record for <strong>{crm.name}</strong>.</>}
        </p>
      </div>
      <OrganizationWizard crm={crm ? { id: crm.id, name: crm.name, domain } : null} />
    </div>
  )
}
