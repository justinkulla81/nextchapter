import Image from 'next/image'
import { firmTheme, isHexColor } from '@/lib/recruiter/brand'
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
  const t0 = firmTheme(firm)
  // A firm that has not set its brand gets NextChapter's own look (navy, light background, Source Serif headings, Inter text),
  // not the generic brand defaults. Each setting it has made replaces the matching default. Text is always Inter; only the
  // headings take the firm's font, so the page uses two typefaces at most.
  const hasAccent = !!firm.accentColor && isHexColor(firm.accentColor)
  const hasTone = !!firm.brandTone
  const hasFont = !!firm.brandFont
  const branded = hasAccent || hasTone
  const t = {
    accent: hasAccent ? t0.accent : '#0b2545',
    onAccent: hasAccent ? t0.onAccent : '#ffffff',
    bg: hasTone ? t0.bg : '#f7f9fa',
    paper: hasTone ? t0.paper : '#ffffff',
    line: hasTone ? t0.line : '#dfe3ea',
    ink: branded ? t0.ink : '#0b2545',
    muted: branded ? t0.muted : '#5a6779',
  }
  const headingFont = hasFont ? { fontFamily: t0.fontStack } : undefined
  const headingClass = hasFont ? '' : ' font-display'
  const recruiterFirst = recruiter ? recruiter.fullName.split(/\s+/)[0] : null
  const gets: [string, string][] = [
    [recruiter ? `${recruiter.fullName} reads it` : `A ${firm.name} recruiter reads it`, `Your résumé goes to ${recruiter ? recruiterFirst : 'the recruiter whose focus fits yours'} at ${firm.name}, filed by function and level.`],
    ['A free NextChapter profile', 'Built from your résumé and emailed to you, with a career dossier you can keep and use on your own search.'],
    ['You control what is shared', `Choose whether ${firm.name} sees your search status, where you land or profile updates. Change it or disconnect anytime.`],
  ]
  const steps: [string, string][] = [
    ['Send your résumé', 'PDF or Word. We read your name and email from it, so there is no form to fill in.'],
    [`${firm.name} receives it`, `${recruiterFirst ?? 'A recruiter'} reviews it against current searches. You get a confirmation by email.`],
    ['Claim your profile', 'Open the link in that email to see your profile and decide what to share.'],
  ]
  const heading = notFit ? `Thanks for your interest in ${firm.name}` : `Send your résumé to ${firm.name}`
  const intro = notFit
    ? 'There is no role that fits right now. Send your résumé so we can keep you in mind.'
    : recruiter
      ? `Your résumé goes to ${recruiter.fullName}.`
      : 'Your résumé goes to the recruiter whose focus fits yours.'

  return (
    <div className="min-h-screen" style={{ background: t.bg, color: t.ink }}>
      <header className="px-6 py-5" style={{ background: t.accent, color: t.onAccent }}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          {firm.logoUrl ? (
            <span className="inline-flex rounded-sm bg-white px-3 py-1.5">
              <Image src={firm.logoUrl} alt={`${firm.name} logo`} width={160} height={40} className="h-8 w-auto object-contain" unoptimized />
            </span>
          ) : (
            <span className={`text-2xl uppercase${headingClass}`} style={{ letterSpacing: '.04em', ...headingFont }}>{firm.name}</span>
          )}
          <span className="text-sm" style={{ opacity: 0.9 }}>Powered by <b>NextChapter</b></span>
        </div>
      </header>

      {firm.brandHeroUrl && (
        <div aria-hidden="true" className="h-40 w-full sm:h-56" style={{ background: `linear-gradient(rgba(20,25,25,.15), rgba(20,25,25,.35)), url(${firm.brandHeroUrl}) center/cover` }} />
      )}

      <main className="mx-auto grid max-w-5xl gap-12 px-6 py-12 lg:grid-cols-[1fr_26rem] lg:gap-16 lg:py-16">
        <div className="space-y-10">
          <div className="space-y-4">
            {recruiter?.profilePictureUrl && (
              <Image src={recruiter.profilePictureUrl} alt="" width={56} height={56} className="size-14 rounded-full object-cover" unoptimized />
            )}
            <h1 className={`text-4xl leading-tight${headingClass}`} style={{ textWrap: 'balance', ...headingFont }}>{heading}</h1>
            <p className="max-w-xl text-lg" style={{ color: t.muted }}>{intro}</p>
            {recruiter?.intakeBio && <p className="max-w-xl whitespace-pre-line text-sm" style={{ color: t.muted }}>{recruiter.intakeBio}</p>}
          </div>

          <section aria-labelledby="inbound-get" className="space-y-4">
            <h2 id="inbound-get" className="text-sm font-semibold uppercase" style={{ letterSpacing: '.08em', color: t.muted }}>What you get</h2>
            <ul className="space-y-3">
              {gets.map(([title, text]) => (
                <li key={title} className="border-l-2 pl-4" style={{ borderColor: t.accent }}>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm" style={{ color: t.muted }}>{text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="inbound-how" className="space-y-4">
            <h2 id="inbound-how" className="text-sm font-semibold uppercase" style={{ letterSpacing: '.08em', color: t.muted }}>How it works</h2>
            <ol className="space-y-4">
              {steps.map(([title, text], i) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ background: t.accent, color: t.onAccent }}>{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm" style={{ color: t.muted }}>{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6 self-start border p-6 shadow-sm lg:sticky lg:top-8" style={{ background: t.paper, borderColor: t.line }}>
          <h2 className={`text-2xl${headingClass}`} style={headingFont}>Send your résumé</h2>
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
        </div>

        <footer className="flex items-center gap-2 border-t pt-4 text-xs lg:col-span-2" style={{ borderColor: t.line, color: t.muted }}>
          <span className="inline-flex size-5 items-center justify-center rounded-[3px] bg-[#0b2545] text-[9px] font-bold text-white">NC</span>
          <span>Courtesy of {who}. Powered by <b>NextChapter</b>.</span>
        </footer>
      </main>
    </div>
  )
}
