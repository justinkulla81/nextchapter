import { OrgHomeHero } from '@/components/partners/OrgHomeHero'
import { LABELS, upcomingEvents, type PublicPageContentData, type PublicPageKind } from '@/lib/public-page/content'

// The organization's own section on its public page (owner decision 2026-11-17): what a paid organization wrote, with its
// own pictures. Marked as written by the organization, beside the page's sourced sections. It adds no sign-up ask (the
// page frame already has the one).

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const day = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`))

export function OrgOwnSection({ orgName, kind, content, headingClass = 'text-xl font-semibold' }: { orgName: string; kind: PublicPageKind; content: PublicPageContentData; headingClass?: string }) {
  const L = LABELS[kind]
  const events = upcomingEvents(content, new Date().toISOString().slice(0, 10))
  const c = content.contact
  const hasContact = !!(c.website || c.email || c.phone || c.address || c.hours)
  return (
    <section aria-labelledby="own-words" className="mt-10 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="own-words" className={headingClass}>
          From {orgName}
        </h2>
        <p className="text-xs text-muted-foreground">Written by {orgName}</p>
      </div>
      {content.imageUrl ? (
        <OrgHomeHero
          name={orgName}
          line={content.productName ? `${orgName} · ${content.productName}` : orgName}
          tagline={content.tagline}
          imageUrl={content.imageUrl}
          logoUrl={content.logoUrl}
          inset={content.productImageUrl ? { url: content.productImageUrl, label: content.productName ?? 'Our product' } : null}
          stats={[]}
        />
      ) : (
        (content.logoUrl || content.tagline) && (
          <div className="flex items-center gap-3">
            {content.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- the organization's own logo
              <img src={content.logoUrl} alt={`${orgName} logo`} className="size-12 rounded-lg border border-border bg-white object-contain p-1" />
            )}
            {content.tagline && <p className="text-lg font-semibold">{content.tagline}</p>}
          </div>
        )
      )}
      {content.intro && <p className="max-w-3xl whitespace-pre-line">{content.intro}</p>}
      <div className="grid gap-6 sm:grid-cols-2">
        {content.highlights.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">{L.highlights}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {content.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        )}
        {events.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">{L.events}</h3>
            <ul className="space-y-1 text-sm">
              {events.map((e) => (
                <li key={`${e.date}-${e.title}`}>
                  <span className="text-muted-foreground">{day(e.date)}</span> ·{' '}
                  {e.url ? (
                    <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                      {e.title}
                    </a>
                  ) : (
                    e.title
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasContact && (
          <div className="space-y-1 text-sm">
            <h3 className="font-semibold">Contact</h3>
            {c.website && (
              <p>
                <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                  {L.website}
                </a>
              </p>
            )}
            {c.email && (
              <p>
                <a href={`mailto:${c.email}`} className="underline underline-offset-2">
                  {c.email}
                </a>
              </p>
            )}
            {c.phone && <p>{c.phone}</p>}
            {c.address && <p>{c.address}</p>}
            {c.hours && <p className="text-muted-foreground">{c.hours}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
