import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { InboundPage } from '@/components/talent-intake/InboundPage'

export async function generateMetadata({ params }: { params: Promise<{ firm: string }> }): Promise<Metadata> {
  const { firm } = await params
  const row = await prisma.recruiterFirm.findUnique({ where: { slug: firm }, select: { name: true } })
  return { title: row ? `Submit your resume to ${row.name}` : 'NextChapter', robots: { index: false, follow: false } }
}

export default async function FirmInboundPage({
  params,
  searchParams,
}: {
  params: Promise<{ firm: string }>
  searchParams: Promise<{ nf?: string }>
}) {
  const { firm } = await params
  const { nf } = await searchParams
  return <InboundPage firmSlug={firm} recruiterSlug={null} notFit={nf === '1'} />
}
