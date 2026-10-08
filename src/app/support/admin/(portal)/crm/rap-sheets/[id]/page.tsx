import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { RapSheetView } from '@/components/admin/RapSheetView'
import type { RapSheetContent } from '@/lib/crm/rap-sheet/types'

export const maxDuration = 30

export default async function RapSheetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const sheet = await prisma.crmRapSheet.findUnique({ where: { id }, include: { person: { select: { id: true, fullName: true } } } })
  if (!sheet || !sheet.content) notFound()
  return (
    <div className="space-y-6">
      <nav className="text-sm"><Link href={`/support/admin/crm/people/${sheet.person.id}`} className="text-muted-foreground hover:underline">← {sheet.person.fullName}</Link></nav>
      <header>
        <h1 className="text-2xl font-semibold">Rap sheet: {sheet.person.fullName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Researched {sheet.generatedAt?.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET{sheet.meetingTitle ? ` · ${sheet.meetingTitle}` : ''}</p>
      </header>
      <div className="max-w-3xl"><RapSheetView c={sheet.content as unknown as RapSheetContent} /></div>
    </div>
  )
}
