import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { InboundPage } from '@/components/talent-intake/InboundPage'

export async function generateMetadata({ params }: { params: Promise<{ firm: string; recruiter: string }> }): Promise<Metadata> {
  const { firm } = await params
  const row = await prisma.recruiterFirm.findUnique({ where: { slug: firm }, select: { name: true } })
  return { title: row ? `Submit your resume to ${row.name}` : 'NextChapter', robots: { index: false, follow: false } }
}

export default async function RecruiterInboundPage({
  params,
  searchParams,
}: {
  params: Promise<{ firm: string; recruiter: string }>
  searchParams: Promise<{ nf?: string }>
}) {
  const { firm, recruiter } = await params
  const { nf } = await searchParams
  return <InboundPage firmSlug={firm} recruiterSlug={recruiter} notFit={nf === '1'} />
}
