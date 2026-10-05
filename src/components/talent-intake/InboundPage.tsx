import Image from 'next/image'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { InboundForm } from './InboundForm'

// Co-branded Inbound page (spec F2). Firm page routes to the right
// recruiter (F3a); a personal page goes straight to that recruiter. Only
// VERIFIED firms are live.
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

  const who = recruiter ? `${recruiter.fullName} at ${firm.name}` : firm.name
  const accent = firm.accentColor ?? '#1d4e89'

  return (
    <div className="min-h-screen bg-background">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <main className="mx-auto max-w-2xl space-y-8 px-6 py-12">
        <header className="space-y-6">
          <div className="flex items-center gap-3">
            {firm.logoUrl ? (
              <Image src={firm.logoUrl} alt={`${firm.name} logo`} width={160} height={48} className="h-12 w-auto object-contain" unoptimized />
            ) : (
              <p className="text-xl font-semibold" style={{ color: accent }}>
                {firm.name}
              </p>
            )}
          </div>
          {recruiter && (
            <div className="flex items-center gap-4">
              {recruiter.profilePictureUrl && (
                <Image
                  src={recruiter.profilePictureUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 rounded-full object-cover"
                  unoptimized
                />
              )}
              <div>
                <p className="font-medium">{recruiter.fullName}</p>
                <p className="text-sm text-muted-foreground">{firm.name}</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {notFit ? `Thanks for your interest in ${firm.name}` : `Submit your resume to ${firm.name}`}
            </h1>
            <p className="text-muted-foreground">
              {notFit
                ? 'We don’t have a role that fits right now. Send your resume so we can keep you in mind, and get free support for your search from NextChapter.'
                : 'Every submission gets an answer. If you’re not a fit for a current search, you still get free support from NextChapter: a read on your job market and a plan for your search.'}
            </p>
            {recruiter?.intakeBio && <p className="text-sm whitespace-pre-line text-muted-foreground">{recruiter.intakeBio}</p>}
          </div>
        </header>

        <InboundForm firmSlug={firm.slug!} recruiterSlug={recruiterSlug} notFit={notFit} firmName={firm.name} who={who} />

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          Courtesy of {who}. Powered by NextChapter.
        </footer>
      </main>
    </div>
  )
}
