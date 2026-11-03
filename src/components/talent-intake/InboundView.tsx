import Image from 'next/image'
import { firmTheme } from '@/lib/recruiter/brand'
import { InboundForm } from './InboundForm'

export interface InboundViewFirm {
  name: string
  slug: string
  logoUrl: string | null
  brandHeroUrl: string | null
  accentColor?: string | null
  brandFont?: string | null
  brandTone?: string | null
}
export interface InboundViewRecruiter { fullName: string; profilePictureUrl: string | null; intakeBio: string | null }

// The Inbound page as the member sees it. Pure presentation, so dev-preview can show it with sample data.
export function InboundView({ firm, recruiter, recruiterSlug, notFit }: { firm: InboundViewFirm; recruiter: InboundViewRecruiter | null; recruiterSlug: string | null; notFit: boolean }) {
  const who = recruiter ? `${recruiter.fullName} at ${firm.name}` : firm.name
  const t = firmTheme(firm)
  const heading = notFit ? `Thanks for your interest in ${firm.name}` : `Send your résumé to ${firm.name}`
  const intro = notFit
    ? 'There is no role that fits right now. Send your résumé so we can keep you in mind.'
    : recruiter
      ? `Your résumé goes to ${recruiter.fullName}.`
      : 'Your résumé goes to the recruiter whose focus fits yours.'

  return (
    <div className="min-h-screen" style={{ background: t.bg, color: t.ink, fontFamily: t.fontStack }}>
      <header className="px-6 py-5" style={{ background: t.accent, color: t.onAccent }}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          {firm.logoUrl ? (
            <span className="inline-flex rounded-sm bg-white px-3 py-1.5">
              <Image src={firm.logoUrl} alt={`${firm.name} logo`} width={160} height={40} className="h-8 w-auto object-contain" unoptimized />
            </span>
          ) : (
            <span className="text-2xl uppercase" style={{ letterSpacing: '.04em' }}>{firm.name}</span>
          )}
          <span className="text-sm" style={{ opacity: 0.9 }}>Powered by <b>NextChapter</b></span>
        </div>
      </header>

      {firm.brandHeroUrl && (
        <div aria-hidden="true" className="h-40 w-full sm:h-56" style={{ background: `linear-gradient(rgba(20,25,25,.15), rgba(20,25,25,.35)), url(${firm.brandHeroUrl}) center/cover` }} />
      )}

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <div className="space-y-4">
          {recruiter?.profilePictureUrl && (
            <Image src={recruiter.profilePictureUrl} alt="" width={56} height={56} className="size-14 rounded-full object-cover" unoptimized />
          )}
          <h1 className="text-4xl leading-tight sm:text-5xl" style={{ textWrap: 'balance' }}>{heading}</h1>
          <p className="max-w-xl text-lg" style={{ color: t.muted }}>{intro}</p>
          {recruiter?.intakeBio && <p className="max-w-xl whitespace-pre-line text-sm" style={{ color: t.muted }}>{recruiter.intakeBio}</p>}
        </div>

        <InboundForm
          firmSlug={firm.slug}
          recruiterSlug={recruiterSlug}
          notFit={notFit}
          firmName={firm.name}
          who={who}
          accent={t.accent}
          onAccent={t.onAccent}
          paper={t.paper}
          line={t.line}
          muted={t.muted}
        />

        <footer className="flex items-center gap-2 border-t pt-4 text-xs" style={{ borderColor: t.line, color: t.muted }}>
          <span className="inline-flex size-5 items-center justify-center rounded-[3px] bg-[#0b2545] text-[9px] font-bold text-white">NC</span>
          <span>Courtesy of {who}. Powered by <b>NextChapter</b>.</span>
        </footer>
      </main>
    </div>
  )
}
