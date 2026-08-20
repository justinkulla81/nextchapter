import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { lookupNextChapterMemberships } from '@/lib/network/member-lookup'
import { MEMBERSHIP_LABEL } from '@/lib/network/next-chapter-membership'
import { getCurrentEmployerName, companyMatchesCurrentEmployer } from '@/lib/network/current-employer-flag'
import { ContactDetailPanel, type ContactRowData } from '@/components/dashboard/ContactDetailPanel'
import { StarContactButton } from '@/components/dashboard/StarContactButton'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'

export const metadata: Metadata = { title: 'Contact' }

export default async function ContactProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getDashboardData()

  const contact = await prisma.supportNetworkContact.findFirst({
    where: { id, candidateId: profile.id },
    include: {
      outreachLogs: { orderBy: { loggedAt: 'desc' }, take: 1 },
      _count: { select: { outreachLogs: true } },
    },
  })
  if (!contact) notFound()

  const [membership, currentEmployerName] = await Promise.all([
    contact.email ? lookupNextChapterMemberships([contact.email]).then((m) => m.get(contact.email!.toLowerCase()) ?? null) : Promise.resolve(null),
    profile.confidentialSearchMode ? getCurrentEmployerName(profile.id) : Promise.resolve(null),
  ])

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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/dashboard/network/contacts"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to Contact Directory
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{row.name}</h1>
            <StarContactButton contactId={row.id} isPriority={row.isPriority} />
          </div>
          <p className="text-sm text-muted-foreground">
            {[row.title, row.company].filter(Boolean).join(' at ') || 'No title or company on file'}
            {row.isAtCurrentEmployer && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-orange">
                Your employer
              </span>
            )}
          </p>
          {row.membership && (
            <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              {MEMBERSHIP_LABEL[row.membership]}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {row.email && (
            <a
              href={gmailComposeHref(row.email, '')}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              Email
            </a>
          )}
          {row.linkedinUrl && (
            <a
              href={row.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              LinkedIn
            </a>
          )}
        </div>
      </div>

      <ContactDetailPanel contact={row} />
    </div>
  )
}
