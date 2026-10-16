import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { formatDisplayName } from '@/lib/format-name'
import { lookupNextChapterMemberships } from '@/lib/network/member-lookup'
import { getCurrentEmployerName, companyMatchesCurrentEmployer } from '@/lib/network/current-employer-flag'
import { findCompanyByName } from '@/lib/companies/find-company-by-name'
import { orgNamesMatch } from '@/lib/text/org-name-match'
import { type ContactRowData } from '@/components/dashboard/ContactDetailPanel'
import { ContactProfileView } from '@/components/dashboard/ContactProfileView'
import { StarContactButton } from '@/components/dashboard/StarContactButton'
import { PLAYBOOK_PURPOSES, ASK_SIZES, HOOKS } from '@/lib/network/playbook'
import { OutreachCoach } from '@/components/dashboard/OutreachCoach'

export const metadata: Metadata = { title: 'Contact' }

function daysSince(date: Date | null): number | null {
  return date ? Math.floor((Date.now() - date.getTime()) / 86_400_000) : null
}

export default async function ContactProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ purpose?: string; ask?: string; hook?: string; role?: string; from?: string }>
}) {
  const [{ id }, sp, profile] = await Promise.all([params, searchParams, getDashboardData()])

  const contact = await prisma.supportNetworkContact.findFirst({
    where: { id, candidateId: profile.id },
    include: {
      outreachLogs: { orderBy: { loggedAt: 'desc' }, take: 1 },
      _count: { select: { outreachLogs: true } },
    },
  })
  if (!contact) notFound()

  const contactCompanyName = contact.company ?? contact.inferredCompany

  const [membership, currentEmployerName, companyCard] = await Promise.all([
    contact.email ? lookupNextChapterMemberships([contact.email]).then((m) => m.get(contact.email!.toLowerCase()) ?? null) : Promise.resolve(null),
    profile.confidentialSearchMode ? getCurrentEmployerName(profile.id) : Promise.resolve(null),
    findCompanyByName(contactCompanyName),
  ])

  // "You both worked at X" — matched against the viewer's own work history
  // with the same loose orgNamesMatch() used for the company-card lookup,
  // not exact string equality, so name variants ("Jobs for the Future
  // (JFF)" vs "Jobs for the Future") still connect.
  const sharedCompany = contactCompanyName
    ? (profile.workHistory.find((w) => orgNamesMatch(w.companyName, contactCompanyName))?.companyName ?? null)
    : null

  const row: ContactRowData = {
    ...contact,
    hasReachedOut: contact.outreachLogs.length > 0,
    lastOutreachChannel: contact.outreachLogs[0]?.channel ?? null,
    lastOutreachAt: contact.outreachLogs[0]?.loggedAt ?? null,
    outreachCount: contact._count.outreachLogs,
    membership,
    isAtCurrentEmployer:
      companyMatchesCurrentEmployer(currentEmployerName, contact.company) ||
      companyMatchesCurrentEmployer(currentEmployerName, contact.inferredCompany),
  }

  const referenceHref = `/dashboard/references?name=${encodeURIComponent(contact.name)}&email=${encodeURIComponent(contact.email ?? '')}`

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/dashboard/network/contacts"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to Contact Directory
      </Link>

      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{row.name}</h1>
        <StarContactButton contactId={row.id} isPriority={row.isPriority} />
      </div>

      <ContactProfileView
        contact={row}
        membership={membership}
        isAtCurrentEmployer={row.isAtCurrentEmployer}
        referenceHref={referenceHref}
        companyCardHref={companyCard ? `/dashboard/companies/${encodeURIComponent(companyCard.canonicalNameNormalized)}` : null}
        sharedCompany={sharedCompany}
      />

      <OutreachCoach
        contactId={row.id}
        contactName={formatDisplayName(row.name)}
        contactEmail={row.email}
        contactCompany={row.company ?? row.inferredCompany}
        contactTitle={row.title}
        warmth={row.warmth}
        daysSinceLastContact={daysSince(row.lastOutreachAt)}
        candidateFirstName={profile.firstName ?? ''}
        targetRole={profile.targetRoleType}
        discreet={profile.confidentialSearchMode}
        initial={{
          purpose: PLAYBOOK_PURPOSES.find((p) => p.purpose === sp.purpose)?.purpose,
          askSize: ASK_SIZES.find((a) => a.size === sp.ask)?.size,
          hook: HOOKS.find((h) => h.kind === sp.hook)?.kind,
          roleTitle: sp.role?.slice(0, 120),
          fromThisWeek: sp.from === 'this-week',
        }}
      />
    </div>
  )
}
