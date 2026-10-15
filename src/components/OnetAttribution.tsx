import { cn } from '@/lib/utils'

// O*NET data reaches us through O*NET Web Services (USDOL/ETA). Its terms require
// crediting and linking to O*NET Web Services wherever the data is used (the
// statement and the "O*NET in-it" logo below are theirs:
// services.onetcenter.org/help/license_data), and the O*NET database's CC BY 4.0
// licence requires naming the release and saying we changed it. We rescale, filter
// and combine its ratings, so the "modified" sentence applies. Keep the wording;
// it is the licences', not ours.
export const ONET_DATABASE_RELEASE = 'O*NET 31.0 Database'
export const ONET_WEB_SERVICES_CREDIT =
  'This site incorporates information from O*NET Web Services by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). O*NET® is a trademark of USDOL/ETA.'

/**
 * The credit. `compact` is the one-line Web Services statement and link, for small
 * panels where only O*NET-derived names appear (tool names in a keyword check);
 * the full form adds the badge and the database licence, for pages showing O*NET ratings.
 */
export function OnetAttribution({ className, withBls = true, compact = false }: { className?: string; withBls?: boolean; compact?: boolean }) {
  if (compact) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Tool names include ones from{' '}
        <a href="https://services.onetcenter.org/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          O*NET Web Services
        </a>
        . {ONET_WEB_SERVICES_CREDIT}
      </p>
    )
  }
  return (
    <div className={cn('flex items-start gap-3 text-xs text-muted-foreground', className)}>
      <a href="https://services.onetcenter.org/" target="_blank" rel="noopener noreferrer" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- O*NET's own badge, served by O*NET */}
        <img
          src="https://services.onetcenter.org/shared/image/logos/onet-in-it.svg"
          alt="This site incorporates information from O*NET Web Services. Click to learn more."
          className="h-8 w-auto"
          loading="lazy"
        />
      </a>
      <p>
        This site incorporates information from{' '}
        <a href="https://services.onetcenter.org/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          O*NET Web Services
        </a>{' '}
        by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). It includes information from the{' '}
        <a href="https://www.onetcenter.org/database.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {ONET_DATABASE_RELEASE}
        </a>
        , used under the{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          CC BY 4.0
        </a>{' '}
        license. O*NET® is a trademark of USDOL/ETA. NextChapter has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications.
        {withBls && ' Pay and growth figures are from the U.S. Bureau of Labor Statistics.'}
      </p>
    </div>
  )
}
