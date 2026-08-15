import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { hasRoleGrant } from '@/lib/auth/role-grants'
import { BenefitsNetworkProposeForm } from '@/components/dashboard/BenefitsNetworkProposeForm'

export const metadata: Metadata = { title: 'Propose a Benefits Network offer' }

export default async function ProposeBenefitsNetworkListingPage() {
  const profile = await getDashboardData()
  const isAlum = await hasRoleGrant(profile.userId, 'alum')

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Propose a Benefits Network offer</h1>
        <p className="text-sm text-muted-foreground">
          If your employer, alma mater, or a professional association you belong to offers something NextChapter
          members would value — a discount, a waived fee, a seat in a program — you can source it here. The
          institution carries the quality; you carry the relationship and get credited on every listing.
        </p>
      </div>

      {!isAlum ? (
        <div className="rounded-lg border border-dashed border-light-gray bg-off-white p-4 text-sm text-muted-foreground">
          Proposing a Benefits Network offer opens up once you&apos;re a NextChapter alum — i.e. after you&apos;ve
          landed your next role and it&apos;s been confirmed.
        </div>
      ) : (
        <BenefitsNetworkProposeForm />
      )}

      <Link href="/dashboard/benefits-network" className="inline-block text-sm text-primary underline underline-offset-4">
        ← Back to the catalog
      </Link>
    </div>
  )
}
