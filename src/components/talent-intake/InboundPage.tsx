import Image from 'next/image'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { firmTheme } from '@/lib/recruiter/brand'
import { InboundForm } from './InboundForm'

// Co-branded Inbound page (spec F2). Firm page routes to the right
// recruiter (F3a); a personal page goes straight to that recruiter. Only
// VERIFIED firms are live. The look (logo, color, font, background and
// banner photo) is the firm's own, set in the onboarding wizard.
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
  const t = firmTheme(firm)
  const heading = notFit ? `Thanks for your interest in ${firm.name}` : `Submit your resume to ${firm.name}`

  return (
    <div className="min-h-screen" style={{ background: t.bg, color: t.ink, fontFamily: t.fontStack }}>
      <header className="px-6 py-4" style={{ background: t.accent, color: t.onAccent }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          {firm.logoUrl ? (
            <span className="inline-flex rounded-sm bg-white px-3 py-1.5">
              <Image src={firm.logoUrl} alt={`${firm.name} logo`} width={160} height={40} className="h-8 w-auto object-contain" unoptimized />
            </span>
          ) : (
            <span className="text-xl" style={{ letterSpacing: '.03em' }}>{firm.name}</span>
          )}
          {firm.website && (
            <a href={firm.website} className="text-xs uppercase tracking-widest underline-offset-4 hover:underline" style={{ color: t.onAccent }}>
              Visit our website
            </a>
          )}
        </div>
      </header>

      <section
        className="px-6 py-14"
        style={{
          background: firm.brandHeroUrl
            ? `linear-gradient(rgba(20,25,25,.45), rgba(20,25,25,.7)), url(${firm.brandHeroUrl}) center/cover`
            : t.accent,
          color: firm.brandHeroUrl ? '#ffffff' : t.onAccent,
        }}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {recruiter && (
            <div className="flex items-center gap-3">
              {recruiter.profilePictureUrl && (
                <Image src={recruiter.profilePictureUrl} alt="" width={48} height={48} className="size-12 rounded-full object-cover" unoptimized />
              )}
              <p className="text-sm opacity-90">{recruiter.fullName}</p>
            </div>
          )}
          <h1 className="text-3xl leading-tight sm:text-5xl" style={{ maxWidth: '18em', textWrap: 'balance' }}>
            {heading}
          </h1>
          <p className="max-w-xl opacity-90">
            {notFit
              ? 'We do not have a role that fits right now. Send your resume so we can keep you in mind, and get free support for your search from NextChapter.'
              : 'Every submission gets an answer. If you are not a fit for a current search, you still get free support from NextChapter: a read on your job market and a plan for your search.'}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        {recruiter?.intakeBio && <p className="whitespace-pre-line text-sm" style={{ color: t.muted }}>{recruiter.intakeBio}</p>}
        <div className="rounded-md border px-5 py-4" style={{ background: t.paper, borderColor: t.line }}>
          <p className="font-semibold">What to expect</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm" style={{ color: t.muted }}>
            <li>{firm.name} reads each resume against its current and upcoming searches.</li>
            <li>If there is a potential fit, a recruiter contacts you directly.</li>
            <li>Either way, you get a free NextChapter profile: a market read and a plan for your search.</li>
          </ul>
        </div>

        <InboundForm
          firmSlug={firm.slug!}
          recruiterSlug={recruiterSlug}
          notFit={notFit}
          firmName={firm.name}
          who={who}
          accent={t.accent}
          onAccent={t.onAccent}
        />

        <footer className="flex items-center gap-2 border-t pt-4 text-xs" style={{ borderColor: t.line, color: t.muted }}>
          <span className="inline-flex size-5 items-center justify-center rounded-[3px] bg-[#0b2545] text-[9px] font-bold text-white">NC</span>
          <span>Courtesy of {who}. Powered by <b>NextChapter</b>.</span>
        </footer>
      </main>
    </div>
  )
}
