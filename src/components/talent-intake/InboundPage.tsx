import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { InboundView } from './InboundView'

// Co-branded Inbound page (spec F2). Firm page routes to the right recruiter (F3a); a personal page goes straight to
// that recruiter. Only VERIFIED firms are live. The look (logo, color, font, background and an optional banner photo) is
// the firm's own, set in the onboarding wizard. One screen: a slim brand bar, one headline, the résumé, one button.
export async function InboundPage({
  firmSlug,
  recruiterSlug,
  notFit,
}: {
  firmSlug: string
  recruiterSlug: string | null
  notFit: boolean
}) {
  const firm = await prisma.recruiterFirm.findUnique({ where: { slug: firmSlug } })
  if (!firm || firm.status !== 'VERIFIED') notFound()
  const recruiter = recruiterSlug
    ? await prisma.recruiter.findFirst({
        where: { recruiterFirmId: firm.id, intakeSlug: recruiterSlug, firmRole: { in: ['ADMIN', 'RECRUITER'] } },
        select: { fullName: true, profilePictureUrl: true, intakeBio: true },
      })
    : null
  if (recruiterSlug && !recruiter) notFound()

  return <InboundView firm={{ ...firm, slug: firm.slug! }} recruiter={recruiter} recruiterSlug={recruiterSlug} notFit={notFit} />
}
